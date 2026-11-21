const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const modules = new Map();
const StyleSheet = {
  hairlineWidth: 1,
  create: (styles) =>
    Object.fromEntries(Object.keys(styles).map((key) => [key, key])),
};

// Load real sheets, but keep names as identifiers for JSX behavior assertions.
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    {
      exports,
      require: (name) => {
        if (name === "react-native") return { StyleSheet };
        const target = path.resolve(path.dirname(file), `${name}.ts`);
        assert.equal(target, path.resolve(__dirname, "../../src/theme.ts"));
        return load(target);
      },
    },
  );
  modules.set(file, exports);
  return exports;
}

exports.loadStyleModule = (file, name) =>
  load(path.resolve(__dirname, "../../src", path.dirname(file), `${name}.ts`));
exports.isStyleModule = (name) =>
  name === "./styles" || name.endsWith(".styles");
