const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

function load(file, dependencies) {
  const exports = {};
  const code = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src", file), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  vm.runInNewContext(code, {
    exports,
    require: (name) => {
      assert.ok(Object.hasOwn(dependencies, name), name);
      return dependencies[name];
    },
  });
  return exports;
}

test("the registry clears its IGDB adapter after SecureStore updates, removal, and purge", async () => {
  const storage = new Map([["rocket-provider-omdb", "movie-key"]]);
  const vault = load("providerCredentials.ts", {
    "expo-secure-store": {
      getItemAsync: async (key) => storage.get(key) ?? null,
      setItemAsync: async (key, value) => storage.set(key, value),
      deleteItemAsync: async (key) => storage.delete(key),
    },
  });
  const invalidatedWith = [];
  const { catalogAdapters } = load("providers/registry.ts", {
    "../providerCredentials": vault,
    "./books": load("providers/books.ts", {}),
    "./omdb": { OmdbAdapter: class {} },
    "./tenrai": load("providers/tenrai.ts", {}),
    "./igdb": {
      IgdbAdapter: class {
        id = "igdb";
        constructor(readKey) {
          this.readKey = readKey;
        }
        clearSession() {
          invalidatedWith.push(storage.get("rocket-provider-igdb") ?? null);
        }
      },
    },
  });
  const credentials = JSON.stringify({
    clientId: "client",
    clientSecret: "secret",
  });
  await vault.saveProviderCredential("igdb", credentials);
  assert.equal(await catalogAdapters.igdb.readKey(), credentials);
  assert.deepEqual(invalidatedWith, [credentials]);
  assert.equal(storage.get("rocket-provider-omdb"), "movie-key");
  await vault.deleteProviderCredential("igdb");
  assert.deepEqual(invalidatedWith, [credentials, null]);
  assert.equal(storage.has("rocket-provider-igdb"), false);
  await vault.saveProviderCredential("igdb", credentials);
  await vault.purgeProviderCredentials();
  assert.deepEqual(invalidatedWith, [credentials, null, credentials, null]);
  assert.equal(storage.size, 0);
});
