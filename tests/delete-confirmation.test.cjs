const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");
const {
  isStyleModule,
  loadStyleModule,
} = require("./helpers/style-modules.cjs");

function dialog(props) {
  const file =
    "components/DeleteConfirmationDialog/DeleteConfirmationDialog.tsx";
  const slots = [];
  let cursor = 0;
  let effects = [];
  let dirty = false;
  let keyboardDismissals = 0;
  const jsx = (type, props) => ({ type, props });
  const react = {
    useState: (initial) => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [
        slots[index],
        (value) => {
          const next =
            typeof value === "function" ? value(slots[index]) : value;
          dirty ||= !Object.is(next, slots[index]);
          slots[index] = next;
        },
      ];
    },
    useRef: (initial) => {
      const index = cursor++;
      slots[index] ??= { current: initial };
      return slots[index];
    },
    useEffect: (effect, deps) => {
      const index = cursor++;
      if (
        !slots[index] ||
        deps.some((value, i) => !Object.is(value, slots[index][i]))
      ) {
        slots[index] = deps;
        effects.push(effect);
      }
    },
  };
  const deps = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      Modal: "Modal",
      Pressable: "Pressable",
      ScrollView: "ScrollView",
      Text: "Text",
      View: "View",
      ActivityIndicator: "ActivityIndicator",
      Keyboard: {
        dismiss: () => {
          keyboardDismissals += 1;
        },
      },
      AccessibilityInfo: { setAccessibilityFocus: () => {} },
      findNodeHandle: () => null,
    },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "../../theme": { palette: {} },
    "../Icon": { Icon: "Icon", MEDIA_TYPE_ICONS: { Book: "book" } },
    "../MediaUI": { Cover: "Cover" },
  };
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, "../src", file), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
        },
      },
    ).outputText,
    {
      exports,
      require: (name) => {
        if (isStyleModule(name)) return loadStyleModule(file, name);
        assert.ok(name in deps, name);
        return deps[name];
      },
    },
  );
  return {
    render: (changes = {}) => {
      Object.assign(props, changes);
      let tree;
      do {
        dirty = false;
        cursor = 0;
        effects = [];
        tree = exports.DeleteConfirmationDialog(props);
        for (const effect of effects) effect();
      } while (dirty);
      return tree;
    },
    keyboardDismissals: () => keyboardDismissals,
  };
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}
const byStyle = (tree, style) =>
  nodes(tree).find((node) =>
    typeof node.props.style === "function"
      ? node.props.style({ pressed: false })[0] === style
      : node.props.style === style,
  );
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join(" ");
  if (tree && typeof tree === "object") return text(tree.props?.children);
  return typeof tree === "string" || typeof tree === "number"
    ? String(tree)
    : "";
}
const target = {
  kind: "entry",
  entry: {
    title: "My book",
    type: "Book",
    coverUri: "https://example.com/cover.jpg",
  },
};
async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

test("delete dialog uses actual item preview and Cancel, backdrop, and Back never delete", () => {
  let cancelled = 0;
  let deleted = 0;
  const ui = dialog({
    visible: true,
    target,
    onCancel: () => {
      cancelled += 1;
    },
    onConfirm: async () => {
      deleted += 1;
    },
  });
  const tree = ui.render();
  assert.match(text(tree), /My book/);
  assert.match(text(tree), /note, journal entries, and all list memberships/);
  assert.equal(
    nodes(tree).find((node) => node.type === "Cover").props.uri,
    target.entry.coverUri,
  );
  assert.equal(
    byStyle(tree, "deleteScroll").props.accessibilityViewIsModal,
    true,
  );
  byStyle(tree, "deleteCancel").props.onPress();
  byStyle(tree, "deleteBackdrop").props.onPress();
  tree.props.onRequestClose();
  assert.equal(cancelled, 3);
  assert.equal(deleted, 0);
  assert.equal(ui.keyboardDismissals(), 1);
});

test("context sheets can embed the existing confirmation without opening another native modal", () => {
  const ui = dialog({
    visible: true,
    target,
    embedded: true,
    onCancel: () => {},
    onConfirm: async () => {},
  });
  const tree = ui.render();
  assert.equal(tree.type, "SafeAreaView");
  assert.equal(
    nodes(tree).some((node) => node.type === "Modal"),
    false,
  );
  assert.equal(ui.render({ visible: false }), null);
});

test("delete waits for real completion, guards duplicate taps, and blocks dismissal while busy", async () => {
  let resolve;
  let deleted = 0;
  let cancelled = 0;
  const ui = dialog({
    visible: true,
    target,
    onCancel: () => {
      cancelled += 1;
    },
    onConfirm: () => {
      deleted += 1;
      return new Promise((done) => {
        resolve = done;
      });
    },
  });
  const tree = ui.render();
  const confirm = byStyle(tree, "deleteConfirm").props.onPress;
  confirm();
  confirm();
  // The ref guard also protects handlers captured before React rerenders.
  tree.props.onRequestClose();
  byStyle(tree, "deleteCancel").props.onPress();
  assert.equal(deleted, 1);
  assert.equal(cancelled, 0);
  const busy = ui.render();
  assert.match(text(busy), /Deleting…/);
  assert.equal(byStyle(busy, "deleteConfirm").props.disabled, true);
  assert.equal(byStyle(busy, "deleteCancel").props.disabled, true);
  assert.equal(byStyle(busy, "deleteBackdrop").props.disabled, true);
  resolve();
  await settle();
  assert.equal(cancelled, 1);
  assert.equal(byStyle(ui.render(), "deleteConfirm").props.disabled, false);
});

test("failed deletion stays open with accessible feedback and can be retried", async () => {
  let attempts = 0;
  let cancelled = 0;
  const ui = dialog({
    visible: true,
    target,
    onCancel: () => {
      cancelled += 1;
    },
    onConfirm: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("database failure");
    },
  });
  byStyle(ui.render(), "deleteConfirm").props.onPress();
  await settle();
  const failed = ui.render();
  assert.equal(cancelled, 0);
  assert.match(text(failed), /Could not finish deleting/);
  assert.equal(byStyle(failed, "deleteError").props.accessibilityRole, "alert");
  assert.equal(byStyle(failed, "deleteConfirm").props.disabled, false);
  byStyle(failed, "deleteConfirm").props.onPress();
  await settle();
  assert.equal(attempts, 2);
  assert.equal(cancelled, 1);
});

test("list deletion explicitly preserves titles and personal data, including on empty lists", () => {
  for (const count of [0, 1, 3]) {
    const ui = dialog({
      visible: true,
      target: {
        kind: "list",
        list: { name: "Reading", type: "Book", icon: "star" },
        count,
      },
      onCancel: () => {},
      onConfirm: async () => {},
    });
    const tree = ui.render();
    assert.match(text(tree), /Delete list/);
    assert.match(text(tree), /Reading/);
    assert.match(
      text(tree),
      /Your titles, notes, and journal entries stay in your library/,
    );
    assert.match(
      text(tree),
      new RegExp(`${count}.*title.*stay.*in your library`),
    );
    assert.equal(
      nodes(tree).some(
        (node) => node.type === "Icon" && node.props.name === "star",
      ),
      true,
    );
  }
});
