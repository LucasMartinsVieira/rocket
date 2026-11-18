const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

test("IGDB credentials stay in SecureStore and changes clear cached tokens", async () => {
  const storage = new Map([["rocket-provider-omdb", "movie-key"]]);
  let cleared = 0;
  const exports = {};
  const code = ts.transpileModule(
    fs.readFileSync(
      path.join(__dirname, "../src/providerCredentials.ts"),
      "utf8",
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  vm.runInNewContext(code, {
    exports,
    require: (name) =>
      name === "expo-secure-store"
        ? {
            isAvailableAsync: async () => true,
            getItemAsync: async (key) => storage.get(key) ?? null,
            setItemAsync: async (key, value) => storage.set(key, value),
            deleteItemAsync: async (key) => storage.delete(key),
          }
        : {
            clearIgdbSession: () => {
              cleared += 1;
            },
          },
  });
  const credentials = JSON.stringify({
    clientId: "client",
    clientSecret: "secret",
  });
  await exports.saveProviderCredential("igdb", credentials);
  assert.equal(await exports.getProviderCredential("igdb"), credentials);
  assert.equal(cleared, 1);
  assert.equal(storage.get("rocket-provider-omdb"), "movie-key");
  await exports.deleteProviderCredential("igdb");
  assert.equal(cleared, 2);
  assert.equal(storage.has("rocket-provider-igdb"), false);
  await exports.saveProviderCredential("igdb", credentials);
  await exports.purgeProviderCredentials();
  assert.equal(cleared, 4);
  assert.equal(storage.size, 0);
});
