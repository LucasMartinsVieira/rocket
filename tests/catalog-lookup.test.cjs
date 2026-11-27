const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");
const { mount, nodes, text } = require("./helpers/native-ui.cjs");

function loadCatalogSearch(catalogAdapters) {
  const exports = {};
  const source = fs.readFileSync(
    path.join(__dirname, "../src/catalogSearch.ts"),
    "utf8",
  );
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    {
      exports,
      Error,
      require: (name) => {
        assert.equal(name, "./providers/registry");
        return { catalogAdapters };
      },
    },
  );
  return exports;
}

test("registered movie and game adapters page independently and route previews after a provider failure", async () => {
  const first = {
    id: "tt123",
    adapterId: "omdb",
    title: "First movie",
    type: "Movie",
    provider: "OMDb API",
    releaseYear: 2024,
    sourceUrl: "https://www.imdb.com/title/tt123/",
  };
  const second = { ...first, id: "tt456", title: "Second movie" };
  const series = {
    ...first,
    id: "tt789",
    adapterId: "omdb-series",
    title: "First show",
    type: "TV Show",
    duration: 3,
  };
  const game = {
    ...first,
    id: "igdb:1",
    adapterId: "igdb",
    title: "First game",
    type: "Game",
    provider: "IGDB",
    sourceUrl: "https://www.igdb.com/games/first-game",
  };
  const finalGame = { ...game, id: "igdb:3", title: "Third game" };
  const book = {
    ...first,
    id: "openlibrary:OL123W",
    adapterId: "books",
    title: "First book",
    type: "Book",
    provider: "Open Library",
    sourceUrl: "https://openlibrary.org/works/OL123W",
  };
  const cursors = [];
  const gameCursors = [];
  const imported = [];
  let keyboardDismissals = 0;
  let previewed;
  const tenraiAdapters = Object.fromEntries(
    ["Anime", "Manga"].map((type) => {
      const kind = type.toLowerCase();
      const id = `tenrai-${kind}`;
      const result = {
        ...first,
        id: `tenrai:${kind}:1`,
        adapterId: id,
        title: `First ${type}`,
        type,
        provider: "Tenrai",
        sourceUrl: `https://myanimelist.net/${kind}/1`,
      };
      return [
        id,
        {
          id,
          search: async () => ({ results: [result] }),
          details: async (selected) => {
            assert.equal(selected, result);
            return { ...selected, summary: `${type} synopsis` };
          },
        },
      ];
    }),
  );
  const ui = mount(
    "screens/LookupImportScreen/LookupImportScreen.tsx",
    "LookupImportScreen",
    {
      visible: true,
      onClose() {},
      onImport: (result) => imported.push(result),
    },
    {
      "react-native": {
        ActivityIndicator: "ActivityIndicator",
        KeyboardAvoidingView: "KeyboardAvoidingView",
        Modal: "Modal",
        Platform: { OS: "android" },
        Keyboard: {
          dismiss: () => {
            keyboardDismissals += 1;
          },
        },
        Pressable: "Pressable",
        ScrollView: "ScrollView",
        Text: "Text",
        TextInput: "TextInput",
        View: "View",
      },
      "../../components/Icon": { Icon: "Icon" },
      "../../components/MediaUI": { Cover: "Cover" },
      "../../model": { formatDuration: (_, value) => `${value} seasons` },
      "../../catalogSearch": loadCatalogSearch({
        ...tenraiAdapters,
        books: {
          id: "books",
          search: async ({ cursor }) => {
            if (cursor === undefined)
              return { results: [book], nextCursor: "books-page-two" };
            assert.equal(cursor, "books-page-two");
            throw new Error("Books unavailable");
          },
          details: async (selected) => {
            assert.equal(selected, book);
            return { ...selected, summary: "Book synopsis" };
          },
        },
        igdb: {
          id: "igdb",
          search: async ({ cursor, signal }) => {
            assert.ok(signal instanceof AbortSignal);
            gameCursors.push(cursor);
            if (cursor === undefined)
              return { results: [game], nextCursor: "game-page-two" };
            if (cursor === "game-page-two")
              return {
                results: [{ ...game, id: "igdb:2", title: "Second game" }],
                nextCursor: "game-page-three",
              };
            assert.equal(cursor, "game-page-three");
            return { results: [finalGame] };
          },
          details: async (result) => ({
            ...result,
            summary: "Game synopsis",
          }),
        },
        omdb: {
          id: "omdb",
          search: async ({ cursor, signal }) => {
            assert.ok(signal instanceof AbortSignal);
            assert.equal(keyboardDismissals, 1);
            cursors.push(cursor);
            return cursor === undefined
              ? { results: [first], nextCursor: "opaque-next-page" }
              : { results: [second] };
          },
          details: async (result) => {
            previewed = result;
            return { ...result, summary: "Movie synopsis" };
          },
        },
        "omdb-series": {
          id: "omdb-series",
          search: async () => ({ results: [series] }),
          details: async (result) => ({
            ...result,
            summary: "Series synopsis",
          }),
        },
      }),
    },
  );
  const byLabel = (tree, label) =>
    nodes(tree).find((node) => node.props.accessibilityLabel === label);
  const button = (tree, label) =>
    nodes(tree).find(
      (node) => node.type === "Pressable" && text(node).trim() === label,
    );
  const settle = () => new Promise((resolve) => setImmediate(resolve));

  byLabel(ui.render(), "Media query").props.onChangeText("Movie");
  button(ui.render(), "Query").props.onPress();
  assert.equal(keyboardDismissals, 1);
  await settle();
  let tree = ui.render();
  assert.ok(byLabel(tree, "Preview First book"));
  assert.ok(byLabel(tree, "Preview First movie"));
  button(tree, "Load more titles").props.onPress();
  await settle();
  tree = ui.render();
  const alert = nodes(tree).find(
    (node) => node.props.accessibilityRole === "alert",
  );
  assert.ok(alert);
  assert.match(text(alert), /Books unavailable/);
  assert.deepEqual(cursors, [undefined, "opaque-next-page"]);
  button(tree, "Load more titles").props.onPress();
  await settle();
  tree = ui.render();
  assert.deepEqual(gameCursors, [
    undefined,
    "game-page-two",
    "game-page-three",
  ]);
  assert.deepEqual(cursors, [undefined, "opaque-next-page"]);
  assert.equal(button(tree, "Load more titles"), undefined);
  assert.ok(byLabel(tree, "Preview First movie"));
  byLabel(tree, "Preview Second movie").props.onPress();
  await settle();
  tree = ui.render();
  assert.equal(previewed, second);
  assert.match(text(tree), /Movie synopsis/);
  assert.equal(imported.length, 0);
  byLabel(tree, "Fill Add Title form").props.onPress();
  assert.equal(imported[0].id, second.id);
  byLabel(tree, "Preview Third game").props.onPress();
  await settle();
  tree = ui.render();
  assert.match(text(tree), /Game synopsis/);
  assert.equal(imported.length, 1);
  byLabel(tree, "Fill Add Title form").props.onPress();
  assert.equal(imported[1].id, finalGame.id);
  for (const [title, synopsis] of [
    ["First Anime", /Anime synopsis/],
    ["First Manga", /Manga synopsis/],
    ["First book", /Book synopsis/],
  ]) {
    byLabel(tree, `Preview ${title}`).props.onPress();
    await settle();
    tree = ui.render();
    assert.match(text(tree), synopsis);
  }
  assert.ok(byLabel(tree, "View First book on Open Library"));
  button(tree, "Books (Open Library)").props.onPress();
  tree = ui.render();
  byLabel(tree, "Media query").props.onSubmitEditing();
  assert.equal(keyboardDismissals, 2);
  await settle();
  tree = ui.render();
  assert.ok(byLabel(tree, "Preview First book"));
  assert.equal(byLabel(tree, "Preview First movie"), undefined);
  assert.deepEqual(cursors, [undefined, "opaque-next-page"]);
  button(tree, "TV Shows (OMDb)").props.onPress();
  byLabel(ui.render(), "Media query").props.onSubmitEditing();
  await settle();
  tree = ui.render();
  assert.equal(byLabel(tree, "Preview First movie"), undefined);
  byLabel(tree, "Preview First show").props.onPress();
  await settle();
  tree = ui.render();
  assert.match(text(tree), /3 seasons/);
  assert.match(text(tree), /Series synopsis/);
  byLabel(tree, "Fill Add Title form").props.onPress();
  assert.equal(imported[2].type, "TV Show");
  assert.equal(imported[2].duration, 3);
});

test("catalog searches deduplicate results and keep continuation tied to the original query", async () => {
  const calls = [];
  const result = { id: "one", adapterId: "books", title: "First" };
  const updated = { ...result, title: "Updated" };
  const { searchCatalog, loadMoreCatalogResults } = loadCatalogSearch({
    books: {
      id: "books",
      search: async ({ query, cursor }) => {
        calls.push({ query, cursor });
        return cursor === undefined
          ? { results: [result, result], nextCursor: "next" }
          : { results: [updated] };
      },
    },
  });
  const first = await searchCatalog("  query  ", "books");
  assert.equal(first.results.length, 1);
  const second = await loadMoreCatalogResults(first);
  assert.equal(second.results.length, 1);
  assert.equal(second.results[0], updated);
  assert.equal(first.results[0], result);
  assert.equal(second.continuation, undefined);
  assert.deepEqual(calls, [
    { query: "query", cursor: undefined },
    { query: "query", cursor: "next" },
  ]);
});

test("cancelled searches and previews discard a late response", async () => {
  const result = { id: "one", adapterId: "omdb" };
  const searchSignal = new AbortController();
  const previewSignal = new AbortController();
  const { searchCatalog, getCatalogDetails } = loadCatalogSearch({
    omdb: {
      id: "omdb",
      search: async () => {
        searchSignal.abort();
        return { results: [result] };
      },
      details: async () => {
        previewSignal.abort();
        return result;
      },
    },
  });
  await assert.rejects(
    searchCatalog("title", "all", searchSignal.signal),
    /cancelled/,
  );
  await assert.rejects(
    getCatalogDetails(result, previewSignal.signal),
    /cancelled/,
  );
});
