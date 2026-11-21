const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

const model = {};
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src/model.ts"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText,
  { exports: model },
);

// Exercise the actual form callback without needing a React Native runtime.
const source = ts.createSourceFile(
  "EntryModals.tsx",
  fs.readFileSync(
    path.join(__dirname, "../src/screens/EntryModals.tsx"),
    "utf8",
  ),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let callback;
function visit(node) {
  if (ts.isJsxAttribute(node) && node.name.getText(source) === "onImport")
    callback = node.initializer.expression.getText(source);
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(callback);
const code = ts.transpileModule(
  `const onImport = ${callback}; onImport(result);`,
  {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  },
).outputText;

const result = {
  type: "Game",
  title: "New title",
  creator: "",
  summary: "",
  coverUri: "",
  releaseYear: null,
  duration: null,
  sourceUrl: "https://www.igdb.com/games/new-title",
};
function importInto(sourceUrl, overrides = {}, confirm = true) {
  const draft = {
    type: "Game",
    title: "Old title",
    creator: "Old developer",
    summary: "Old synopsis",
    coverUri: "https://example.com/old.jpg",
    releaseYear: 2000,
    startDate: "2024-06-01",
    endDate: "2024-06-12",
    duration: null,
    sourceUrl,
    rating: 4,
    status: "Paused",
    note: "My note",
    alternateTitles: ["Alias"],
    listIds: ["list-b", "list-a"],
  };
  let prompt = "";
  vm.runInNewContext(code, {
    draft,
    result: { ...result, ...overrides },
    CREATOR_ROLE: { Game: "Developer" },
    setValue: (key, value) => {
      draft[key] = value;
    },
    onChangeType: (type) => {
      Object.assign(
        draft,
        model.changeDraftType(draft, type, [
          { id: "list-b", type: "Game" },
          { id: "list-a", type: "Game" },
        ]),
      );
    },
    setLookupVisible: () => {},
    Alert: {
      alert: (_title, message, buttons) => {
        prompt = message;
        if (confirm)
          buttons.find((button) => button.text === "Fill form").onPress();
      },
    },
  });
  return { draft, prompt };
}

test("catalog import preserves missing metadata and personal data", () => {
  const { draft } = importInto("https://www.igdb.com/games/old-title");
  assert.equal(draft.creator, "Old developer");
  assert.equal(draft.summary, "Old synopsis");
  assert.equal(draft.coverUri, "https://example.com/old.jpg");
  assert.equal(draft.releaseYear, 2000);
  assert.equal(draft.sourceUrl, result.sourceUrl);
  assert.equal(draft.rating, 4);
  assert.equal(draft.status, "Paused");
  assert.equal(draft.startDate, "2024-06-01");
  assert.equal(draft.endDate, "2024-06-12");
  assert.equal(draft.note, "My note");
  assert.deepEqual(draft.listIds, ["list-b", "list-a"]);
  assert.deepEqual(draft.alternateTitles, ["Alias"]);
});
test("replacement imports supplied metadata and cancellation leaves draft intact", () => {
  const { draft } = importInto("https://www.igdb.com/games/old-title", {
    creator: "New developer",
  });
  assert.equal(draft.creator, "New developer");
  const cancelled = importInto(
    "https://www.igdb.com/games/old-title",
    {},
    false,
  ).draft;
  assert.equal(cancelled.sourceUrl, "https://www.igdb.com/games/old-title");
  assert.equal(cancelled.coverUri, "https://example.com/old.jpg");
});
test("manual drafts retain their existing fill-missing-fields behavior", () => {
  const { draft } = importInto("");
  assert.equal(draft.creator, "Old developer");
  assert.equal(draft.coverUri, "https://example.com/old.jpg");
  assert.equal(draft.releaseYear, 2000);
});

test("catalog import of a different media type removes incompatible draft memberships only", () => {
  const { draft } = importInto("", { type: "Book", duration: 240 });
  assert.equal(draft.type, "Book");
  assert.deepEqual(Array.from(draft.listIds), []);
  assert.equal(draft.duration, 240);
  assert.equal(draft.startDate, "2024-06-01");
  assert.equal(draft.endDate, "2024-06-12");
  assert.equal(draft.rating, 4);
  assert.equal(draft.note, "My note");
  assert.equal(draft.status, "Paused");
});
