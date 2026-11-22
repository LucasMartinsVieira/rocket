const assert = require("node:assert/strict");
const { test } = require("node:test");
const { mount, nodes, text } = require("./helpers/native-ui.cjs");

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
    id: "google:book",
    adapterId: "books",
    title: "First book",
    type: "Book",
    provider: "Google Books",
    sourceUrl: "https://books.google.com/books?id=book",
  };
  const cursors = [];
  const gameCursors = [];
  const imported = [];
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
        Pressable: "Pressable",
        ScrollView: "ScrollView",
        Text: "Text",
        TextInput: "TextInput",
        View: "View",
      },
      "../../components/Icon": { Icon: "Icon" },
      "../../components/MediaUI": { Cover: "Cover" },
      "../../providers/registry": {
        catalogAdapters: {
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
        },
      },
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
  assert.ok(byLabel(tree, "View First book on Google Books"));
});
