const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { isStyleModule, loadStyleModule } = require("./style-modules.cjs");

// Minimal hook/JSX harness for action behavior; not native gesture or layout testing.
exports.mount = function mount(file, exportName, props, dependencies = {}) {
  const slots = [];
  let index = 0;
  let effects = [];
  let dirty = false;
  const cleanups = new Map();
  const animations = [];
  const jsx = (type, props) => ({ type, props });
  const deps = {
    react: {
      useState: (initial) => {
        const slot = index++;
        if (!(slot in slots)) slots[slot] = initial;
        return [
          slots[slot],
          (value) => {
            const next =
              typeof value === "function" ? value(slots[slot]) : value;
            dirty ||= !Object.is(next, slots[slot]);
            slots[slot] = next;
          },
        ];
      },
      useRef: (initial) => (slots[index++] ??= { current: initial }),
      useMemo: (fn) => {
        index++;
        return fn();
      },
      useEffect: (effect, deps) => {
        const slot = index++;
        if (
          !deps ||
          !slots[slot] ||
          deps.some((value, i) => !Object.is(value, slots[slot][i]))
        ) {
          slots[slot] = deps;
          effects.push(() => {
            cleanups.get(slot)?.();
            const cleanup = effect();
            if (typeof cleanup === "function") cleanups.set(slot, cleanup);
            else cleanups.delete(slot);
          });
        }
      },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": {
      FlatList: "FlatList",
      Modal: "Modal",
      Pressable: "Pressable",
      ScrollView: "ScrollView",
      Text: "Text",
      View: "View",
      ActivityIndicator: "ActivityIndicator",
      TextInput: "TextInput",
      AccessibilityInfo: { setAccessibilityFocus: () => {} },
      findNodeHandle: () => null,
      Keyboard: { dismiss: () => {} },
      useWindowDimensions: () => ({ width: 400 }),
    },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "react-native-reanimated": {
      __esModule: true,
      default: { View: "AnimatedView", ScrollView: "AnimatedScrollView" },
      useSharedValue: (initial) => (slots[index++] ??= { value: initial }),
      useAnimatedStyle: (fn) => fn(),
      withTiming: (value, config) => {
        animations.push({ value, config });
        return value;
      },
      cancelAnimation: (value) => {
        animations.push({ cancelled: value });
      },
      ReduceMotion: { System: "system" },
      Easing: { cubic: "cubic", out: (value) => value },
      useReducedMotion: () => false,
    },
    "../../theme": { palette: {} },
    ...dependencies,
  };
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, "../../src", file), "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
        },
      },
    ).outputText,
    {
      AbortController,
      exports,
      require: (name) => {
        if (isStyleModule(name)) return loadStyleModule(file, name);
        assert.ok(name in deps, name);
        return deps[name];
      },
    },
  );
  return {
    animations,
    unmount: () => {
      for (const cleanup of cleanups.values()) cleanup();
      cleanups.clear();
    },
    render: (changes = {}) => {
      Object.assign(props, changes);
      let tree;
      do {
        dirty = false;
        index = 0;
        effects = [];
        tree = exports[exportName](props);
        for (const effect of effects) effect();
      } while (dirty);
      return tree;
    },
  };
};
exports.nodes = function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
};
exports.text = function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join(" ");
  if (tree && typeof tree === "object") return text(tree.props?.children);
  return typeof tree === "string" || typeof tree === "number"
    ? String(tree)
    : "";
};
