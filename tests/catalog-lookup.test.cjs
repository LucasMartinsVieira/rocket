const assert = require("node:assert/strict");
const { test } = require("node:test");
const { mount, nodes, text } = require("./helpers/native-ui.cjs");

test("lookup keeps movie results after a provider failure and uses the adapter for paging and preview", async () => {
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
  const cursors = [];
  const credentialsRead = [];
  const imported = [];
  let previewed;
  const emptyPage = async () => ({ results: [], total: 0 });
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
      "../../providerCredentials": {
        getProviderCredential: async (id) => {
          credentialsRead.push(id);
          return null;
        },
      },
      "../../providers/books": {
        searchBooks: async () => {
          throw new Error("Books unavailable");
        },
      },
      "../../providers/igdb": { igdb: { search: emptyPage } },
      "../../providers/tenrai": { searchTenrai: emptyPage },
      "../../providers/registry": {
        catalogAdapters: {
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
  assert.ok(
    nodes(tree).some((node) => node.props.accessibilityRole === "alert"),
  );
  assert.ok(byLabel(tree, "Preview First movie"));
  button(tree, "Load more titles").props.onPress();
  await settle();
  tree = ui.render();
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
  assert.equal(credentialsRead.includes("omdb"), false);
});
