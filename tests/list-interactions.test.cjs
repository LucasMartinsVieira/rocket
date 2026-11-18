const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

// Inspect rendered JSX and invoke handlers without claiming native touch testing.
function load(file) {
  const exports = {};
  const element = (type, props) => ({ type, props });
  const dependencies = {
    "react/jsx-runtime": { jsx: element, jsxs: element, Fragment: "Fragment" },
    react: {},
    "react-native": {
      Pressable: "Pressable",
      ScrollView: "ScrollView",
      Text: "Text",
      View: "View",
    },
    "../styles": { styles: new Proxy({}, { get: (_, key) => key }) },
    "../theme": { palette: {} },
    "../model": { LIST_ACCENT_COLOR: { Dusk: "#7C3AED" } },
    "./Icon": { Icon: "Icon" },
    "../components/Icon": { Icon: "Icon" },
    "../components/MediaUI": { Cover: "Cover" },
    "../components/MediaTypeFilter": { MediaTypeFilter: "MediaTypeFilter" },
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

test("library table rows have no right chevron and remain pressable", () => {
  const { MediaRow } = load("components/MediaUI.tsx");
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
  const { ListsScreen } = load("screens/ListsScreen.tsx");
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
    assert.equal(open.props.style({ pressed: true })[1], "collectionPressed");
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
  }
});
