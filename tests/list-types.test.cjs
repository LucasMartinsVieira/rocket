const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

// Run the actual screen filter/handler expressions without a native UI runtime.
function screen(file) {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(
      path.join(__dirname, "../src/screens", path.basename(file, ".tsx"), file),
      "utf8",
    ),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const nodes = [];
  function visit(node) {
    nodes.push(node);
    ts.forEachChild(node, visit);
  }
  visit(source);
  const run = (expression, context) => {
    const exports = {};
    const code = ts.transpileModule(`exports.value = ${expression};`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, { exports, useMemo: (fn) => fn(), ...context });
    return exports.value;
  };
  return {
    value: (name, context) => {
      const node = nodes.find(
        (node) =>
          ts.isVariableDeclaration(node) && node.name.getText(source) === name,
      );
      assert.ok(node, `Missing ${name}`);
      return run(node.initializer.getText(source), context);
    },
    typeChoice: (context) => {
      const node = nodes.find(
        (node) =>
          ts.isJsxAttribute(node) &&
          node.name.getText(source) === "onPress" &&
          node.getText(source).includes("setType(choice)"),
      );
      assert.ok(node);
      return run(node.initializer.expression.getText(source), context)();
    },
  };
}

const entries = [
  {
    id: "book-a",
    type: "Book",
    title: "Shared title",
    alternateTitles: ["Alias"],
    creator: "Author",
  },
  {
    id: "movie",
    type: "Movie",
    title: "Shared title",
    alternateTitles: ["Alias"],
    creator: "Director",
  },
  {
    id: "book-b",
    type: "Book",
    title: "Other book",
    alternateTitles: [],
    creator: "Writer",
  },
];
const ids = (rows) => Array.from(rows, (row) => row.id);

test("lists page filters by declared media type, including empty lists", () => {
  const ui = screen("ListsScreen.tsx");
  const lists = [
    { id: "books", type: "Book" },
    { id: "movies", type: "Movie" },
    { id: "empty-books", type: "Book" },
  ];
  assert.deepEqual(
    ids(ui.value("visibleLists", { lists, typeFilter: "All" })),
    ids(lists),
  );
  assert.deepEqual(
    ids(ui.value("visibleLists", { lists, typeFilter: "Book" })),
    ["books", "empty-books"],
  );
  assert.deepEqual(
    ids(ui.value("visibleLists", { lists, typeFilter: "Movie" })),
    ["movies"],
  );
  assert.deepEqual(
    ids(ui.value("visibleLists", { lists, typeFilter: "Game" })),
    [],
  );
  assert.deepEqual(
    ids(ui.value("visibleLists", { lists: [], typeFilter: "All" })),
    [],
  );
  assert.deepEqual(ids(lists), ["books", "movies", "empty-books"]);
});

test("list creation filters by media type before search and select-all", () => {
  const ui = screen("CreateListScreen.tsx");
  for (const [search, expected] of [
    ["", ["book-a", "book-b"]],
    ["Shared", ["book-a"]],
    ["Alias", ["book-a"]],
    ["Writer", ["book-b"]],
    ["Director", []],
  ]) {
    const context = { entries, type: "Book", search };
    const visibleEntries = ui.value("visibleEntries", context);
    assert.deepEqual(ids(visibleEntries), expected);
    let selected;
    ui.value("toggleVisibleEntries", {
      visibleEntries,
      selectedIds: [],
      setSelectedIds: (fn) => {
        selected = fn([]);
      },
    })();
    assert.deepEqual(Array.from(selected), expected);
  }
});

test("changing list type clears selected titles but reselecting the same type does not", () => {
  const ui = screen("CreateListScreen.tsx");
  let type = "Book";
  let selected = ["book-a"];
  const context = (choice) => ({
    type,
    choice,
    setType: (value) => {
      type = value;
    },
    setSelectedIds: (value) => {
      selected = value;
    },
    setError: () => {},
  });
  ui.typeChoice(context("Book"));
  assert.deepEqual(selected, ["book-a"]);
  ui.typeChoice(context("Movie"));
  assert.equal(type, "Movie");
  assert.deepEqual(Array.from(selected), []);
});

test("list detail title picker never offers incompatible media even when search matches", () => {
  const ui = screen("ListViewScreen.tsx");
  for (const [pickerSearch, expected] of [
    ["", ["book-a", "book-b"]],
    ["Shared", ["book-a"]],
    ["Director", []],
  ]) {
    assert.deepEqual(
      ids(
        ui.value("pickerEntries", {
          allEntries: entries,
          list: { type: "Book" },
          pickerSearch,
        }),
      ),
      expected,
    );
  }
});

test("entry details offer memberships only in lists of the entry type", () => {
  const ui = screen("EntryModals.tsx");
  const lists = [
    { id: "books", type: "Book" },
    { id: "movies", type: "Movie" },
  ];
  assert.deepEqual(
    ids(ui.value("compatibleLists", { lists, detailEntry: { type: "Book" } })),
    ["books"],
  );
  assert.deepEqual(
    ids(ui.value("compatibleLists", { lists, detailEntry: { type: "Game" } })),
    [],
  );
  assert.deepEqual(
    ids(ui.value("compatibleLists", { lists, detailEntry: null })),
    [],
  );
});
