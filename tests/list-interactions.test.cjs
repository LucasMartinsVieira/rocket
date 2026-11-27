const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");
const { mount } = require("./helpers/native-ui.cjs");
const {
  isStyleModule,
  loadStyleModule,
} = require("./helpers/style-modules.cjs");

// Inspect rendered JSX and invoke handlers without claiming native touch testing.
function load(file, reducedMotion = false) {
  const exports = {};
  const element = (type, props) => ({ type, props });
  const dependencies = {
    "react/jsx-runtime": { jsx: element, jsxs: element, Fragment: "Fragment" },
    react: {},
    "react-native-reanimated": { useReducedMotion: () => reducedMotion },
    "react-native": {
      useWindowDimensions: () => ({ width: 400 }),
      FlatList: "FlatList",
      Pressable: "Pressable",
      ScrollView: "ScrollView",
      Text: "Text",
      View: "View",
    },
    "../../theme": { palette: {}, SPACING: { lg: 16 } },
    "../../model": { LIST_ACCENT_COLOR: { Dusk: "#7C3AED" }, STATUSES: [] },
    "../Icon": { Icon: "Icon" },
    "../../components/Icon": { Icon: "Icon" },
    "../../components/MediaUI": {
      Cover: "Cover",
      MediaCard: "MediaCard",
      MediaRow: "MediaRow",
      WIDE_MEDIA_CARD_WIDTH: 190,
    },
    "../../components/MediaTypeFilter": { MediaTypeFilter: "MediaTypeFilter" },
  };
  const code = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src", file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  vm.runInNewContext(code, {
    exports,
    require: (name) => {
      if (isStyleModule(name)) return loadStyleModule(file, name);
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}

test("library delegates rendering to FlatList without limiting available titles", () => {
  const { LibraryScreen } = load("screens/LibraryScreen/LibraryScreen.tsx");
  const entries = Array.from({ length: 290 }, (_, i) => ({ id: `title-${i}` }));
  const opened = [];
  const actions = [];
  const props = {
    entries,
    totalCount: entries.length,
    hasAnyEntries: true,
    onOpen: (entry) => opened.push(entry),
    onShowActions: (entry) => actions.push(entry),
  };
  const last = entries.at(-1);
  for (const [layout, width, columns, cellType] of [
    ["covers", 400, 2, "MediaCard"],
    ["covers", 840, 4, "MediaCard"],
    ["table", 840, 1, "MediaRow"],
  ]) {
    const tree = nodes(
      LibraryScreen({ ...props, layout, width, wide: width >= 720 }),
    );
    const list = tree.find((node) => node.type === "FlatList").props;
    assert.equal(list.data, entries);
    assert.equal(list.numColumns, columns);
    assert.equal(list.keyExtractor(last), last.id);
    assert.equal(
      tree.some((node) => node.type === cellType),
      false,
    );
    assert.equal(Boolean(list.ListHeaderComponent), layout === "table");

    const cell = list.renderItem({ item: last });
    assert.equal(cell.type, cellType);
    assert.equal(cell.props.entry, last);
    cell.props.onPress();
    cell.props.onLongPress();
  }
  assert.deepEqual(opened, [last, last, last]);
  assert.deepEqual(actions, [last, last, last]);
});

test("library skeleton uses responsive poster slots without actionable controls", () => {
  const { LibrarySkeleton } = load("screens/LibraryScreen/LibrarySkeleton.tsx");
  for (const [width, wide, posterCount] of [
    [400, false, 4],
    [840, true, 8],
  ]) {
    const tree = nodes(LibrarySkeleton({ width, wide }));
    assert.equal(
      tree.filter((node) => node.props.style === "poster").length,
      posterCount,
    );
    assert.equal(
      tree.some((node) => node.props.onPress || node.type === "TextInput"),
      false,
    );
  }
});

test("missing and failed covers use the media-type icon and retain their labels", () => {
  const ui = mount(
    "components/MediaUI/MediaUI.tsx",
    "Cover",
    { uri: "", type: "TV Show", title: "Example series" },
    {
      "react-native": { Image: "Image", Text: "Text", View: "View" },
      "../../model": { TYPE_COLOR: { "TV Show": "#A0A3A8", Book: "#A0A3A8" } },
      "../Icon": {
        Icon: "Icon",
        MEDIA_TYPE_ICONS: { "TV Show": "tv", Book: "book" },
      },
    },
  );
  const assertFallback = (tree, iconName, type, title) => {
    const children = nodes(tree);
    const icon = children.find((node) => node.type === "Icon");
    assert.equal(icon.props.name, iconName);
    assert.equal(icon.props.accessible, false);
    assert.ok(children.some((node) => node.props.children === type));
    assert.ok(children.some((node) => node.props.children === title));
  };
  assertFallback(ui.render(), "tv", "TV Show", "Example series");

  const cover = ui.render({
    uri: "https://example.com/cover.jpg",
    type: "Book",
    title: "Example book",
  });
  assert.equal(cover.type, "Image");
  cover.props.onError();
  assertFallback(ui.render(), "book", "Book", "Example book");
  assert.equal(ui.render({ uri: "https://example.com/new.jpg" }).type, "Image");
});

test("library table rows have no right chevron and remain pressable", () => {
  const { MediaRow } = load("components/MediaUI/MediaUI.tsx");
  for (const wide of [false, true]) {
    let opened = 0;
    const row = MediaRow({
      entry: {
        title: "Title",
        type: "Book",
        status: "Planned",
        releaseYear: 2026,
      },
      wide,
      onPress: () => {
        opened += 1;
      },
    });
    assert.equal(row.type, "Pressable");
    row.props.onPress();
    assert.equal(opened, 1);
    assert.equal(
      nodes(row).some(
        (node) => node.props.style === "chevron" || node.props.children === "›",
      ),
      false,
    );
  }
});

test("whole list cards include covers and empty areas in their open target, with separate delete", () => {
  const { ListsScreen } = load("screens/ListsScreen/ListsScreen.tsx");
  for (const count of [0, 5]) {
    const list = {
      id: "list",
      name: "Books",
      type: "Book",
      accent: "Dusk",
      icon: "book",
    };
    const entries = Array.from({ length: count }, (_, id) => ({
      id: String(id),
      title: `Title ${id}`,
      type: "Book",
      listIds: [list.id],
    }));
    let opened = 0;
    let deleted = 0;
    let menus = 0;
    const tree = ListsScreen({
      lists: [list],
      entries,
      typeFilter: "All",
      setTypeFilter: () => {},
      onCreatePress: () => {},
      onOpen: (value) => {
        assert.equal(value, list);
        opened += 1;
      },
      onDelete: (value) => {
        assert.equal(value, list);
        deleted += 1;
      },
      onShowActions: (value) => {
        assert.equal(value, list);
        menus += 1;
      },
    });
    const card = nodes(tree).find(
      (node) => node.props.style === "collectionCard",
    );
    const [open, remove] = card.props.children;
    assert.equal(open.type, "Pressable");
    assert.equal(remove.type, "Pressable");
    assert.match(open.props.accessibilityLabel, /^Open Books/);
    assert.equal(remove.props.accessibilityLabel, "Delete Books");
    assert.equal(open.props.style({ pressed: false })[0], "collectionOpen");
    assert.equal(open.props.style({ pressed: true })[1], "entryPressed");
    assert.equal(open.props.style({ pressed: true })[2], "entryPressedMotion");
    assert.equal(
      nodes(open).some(
        (node) =>
          node.props.style === (count ? "listPreviewRow" : "listEmptyHint"),
      ),
      true,
    );
    assert.equal(
      nodes(open).filter((node) => node.type === "Pressable").length,
      1,
    );
    assert.equal(
      nodes(card).some((node) => node.props.children === "›"),
      false,
    );
    open.props.onPress();
    assert.equal(opened, 1);
    assert.equal(deleted, 0);
    remove.props.onPress();
    assert.equal(opened, 1);
    assert.equal(deleted, 1);
    open.props.onLongPress();
    open.props.onAccessibilityAction({
      nativeEvent: { actionName: "showMenu" },
    });
    assert.equal(menus, 2);
    assert.equal(opened, 1);
  }
});

test("media covers and narrow/wide rows expose long-press and accessible context actions", () => {
  const { MediaCard, MediaRow } = load("components/MediaUI/MediaUI.tsx");
  for (const Component of [MediaCard, MediaRow]) {
    for (const wide of [false, true]) {
      let menus = 0;
      let opened = 0;
      const tree = Component({
        entry: { title: "Title", type: "Book", status: "Planned" },
        wide,
        onPress: () => {
          opened += 1;
        },
        onLongPress: () => {
          menus += 1;
        },
      });
      tree.props.onLongPress();
      tree.props.onAccessibilityAction({
        nativeEvent: { actionName: "showMenu" },
      });
      assert.equal(menus, 2);
      assert.equal(opened, 0);
      assert.equal(tree.props.delayLongPress, 200);
      tree.props.onPress();
      assert.equal(opened, 1);
    }
  }
});

test("media and list entries show stronger held feedback and retain static feedback for reduced motion", () => {
  for (const reducedMotion of [false, true]) {
    const { MediaCard, MediaRow } = load(
      "components/MediaUI/MediaUI.tsx",
      reducedMotion,
    );
    const { ListsScreen } = load(
      "screens/ListsScreen/ListsScreen.tsx",
      reducedMotion,
    );
    const entry = { title: "Title", type: "Book", status: "Planned" };
    const list = {
      id: "list",
      name: "Books",
      type: "Book",
      accent: "Dusk",
      icon: "book",
    };
    const cards = [];
    for (const Component of [MediaCard, MediaRow]) {
      for (const wide of [false, true])
        cards.push(Component({ entry, wide, onPress: () => {} }));
    }
    const lists = ListsScreen({
      lists: [list],
      entries: [],
      typeFilter: "All",
    });
    cards.push(
      nodes(lists).find((node) =>
        node.props.accessibilityLabel?.startsWith("Open Books"),
      ),
    );
    for (const card of cards) {
      const down = card.props.style({ pressed: true });
      const up = card.props.style({ pressed: false });
      assert.equal(down.includes("entryPressed"), true);
      assert.equal(down.includes("entryPressedMotion"), !reducedMotion);
      assert.equal(up.includes("entryPressed"), false);
      assert.equal(up.includes("entryPressedMotion"), false);
    }
  }
});
