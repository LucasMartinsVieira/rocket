const assert = require("node:assert/strict");
const { test } = require("node:test");
const { mount, nodes, text } = require("./helpers/native-ui.cjs");

const statuses = [
  "Planned",
  "In Progress",
  "Completed",
  "Paused",
  "Dropped",
  "Revisiting",
];
const bookList = { id: "books", name: "Reading", type: "Book", icon: "book" };
const movieList = {
  id: "movies",
  name: "Watching",
  type: "Movie",
  icon: "film",
};
const entry = {
  id: "entry",
  title: "My title",
  type: "Book",
  creator: "Author",
  releaseYear: 2026,
  duration: 200,
  summary: "My synopsis",
  coverUri: "",
  status: "Planned",
  listIds: [],
};
function sheet(target = { kind: "entry", entry }, handlers = {}) {
  return mount(
    "components/ContextActionSheet/ContextActionSheet.tsx",
    "ContextActionSheet",
    {
      target,
      lists: [bookList, movieList],
      onClose: () => {},
      onOpen: () => {},
      onChangeStatus: async () => {},
      onToggleMembership: async () => {},
      onDuplicate: async () => {},
      onDelete: async () => {},
      ...handlers,
    },
    {
      "../../model": { STATUSES: statuses, formatDuration: () => "200 pages" },
      "../Icon": { Icon: "Icon" },
      "../MediaUI": { Cover: "Cover", statusColor: () => "#fff" },
      "../DeleteConfirmationDialog": {
        DeleteConfirmationDialog: "DeleteConfirmationDialog",
      },
    },
  );
}
const byLabel = (tree, label) =>
  nodes(tree).find((node) => node.props.accessibilityLabel === label);
const button = (tree, label) =>
  nodes(tree).find(
    (node) => node.type === "Pressable" && text(node).trim() === label,
  );
async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

test("media summary is real, details open explicitly, and backdrop/Back close without navigation", () => {
  let opened = 0;
  let closed = 0;
  const ui = sheet(undefined, {
    onOpen: () => {
      opened += 1;
    },
    onClose: () => {
      closed += 1;
    },
  });
  const tree = ui.render();
  for (const content of [
    "My title",
    "Author",
    "2026",
    "200 pages",
    "My synopsis",
  ])
    assert.ok(text(tree).includes(content));
  byLabel(tree, "Open media item details").props.onPress();
  assert.equal(opened, 1);
  const backdrop = byLabel(tree, "Close context menu");
  backdrop.props.onPress();
  tree.props.onRequestClose();
  assert.equal(closed, 2);
  assert.equal(opened, 1);
});

test("sheet entrance animates only after modal presentation and honors system reduced motion", () => {
  for (const target of [
    { kind: "entry", entry },
    { kind: "list", list: bookList, count: 0 },
  ]) {
    const ui = sheet(target);
    let tree = ui.render();
    const panel = () =>
      nodes(tree).find((node) => node.type === "AnimatedScrollView");
    assert.equal(panel().props.style[1].opacity, 0);
    assert.equal(panel().props.style[1].transform[0].translateY, 24);
    assert.equal(ui.animations.length, 0);
    tree.props.onShow();
    assert.equal(ui.animations[0].config.duration, 140);
    assert.equal(ui.animations[0].config.reduceMotion, "system");
    tree = ui.render();
    assert.equal(panel().props.style[1].opacity, 1);
    assert.equal(panel().props.style[1].transform[0].translateY, 0);
    assert.equal(
      nodes(tree).find((node) => node.type === "AnimatedView").props
        .pointerEvents,
      "none",
    );
    ui.render();
    assert.equal(ui.animations.length, 1);
    ui.unmount();
    assert.ok(ui.animations.at(-1).cancelled);
  }
});

test("status selector offers all six explicit statuses and waits for persistence", async () => {
  let selected;
  const ui = sheet(undefined, {
    onChangeStatus: async (status) => {
      selected = status;
    },
  });
  byLabel(ui.render(), "Status: Planned").props.onPress();
  const tree = ui.render();
  for (const status of statuses) assert.ok(byLabel(tree, status));
  byLabel(tree, "Paused").props.onPress();
  assert.equal(selected, "Paused");
  assert.equal(byLabel(ui.render(), "Status: Planned").props.disabled, true);
  await settle();
  const updated = ui.render({
    target: { kind: "entry", entry: { ...entry, status: "Paused" } },
  });
  assert.ok(byLabel(updated, "Status: Paused"));
  assert.equal(byLabel(updated, "Planned"), undefined);
});

test("list picker filters incompatible lists and uses live membership counts", async () => {
  let membership;
  const ui = sheet(undefined, {
    onToggleMembership: async (...args) => {
      membership = args;
    },
  });
  byLabel(ui.render(), "Add to list, in 0 lists").props.onPress();
  const tree = ui.render();
  assert.equal(byLabel(tree, "Watching"), undefined);
  assert.equal(
    byLabel(tree, "Reading").props.accessibilityState.checked,
    false,
  );
  byLabel(tree, "Reading").props.onPress();
  assert.deepEqual(membership, ["books", true]);
  await settle();
  const updated = ui.render({
    target: { kind: "entry", entry: { ...entry, listIds: ["books"] } },
  });
  assert.ok(byLabel(updated, "Add to list, in 1 list"));
  assert.equal(
    byLabel(updated, "Reading").props.accessibilityState.checked,
    true,
  );
  byLabel(updated, "Reading").props.onPress();
  assert.deepEqual(membership, ["books", false]);
  await settle();
});

test("cancelling removal closes the entire context flow without opening details or deleting", () => {
  for (const target of [
    { kind: "entry", entry },
    { kind: "list", list: bookList, count: 0 },
  ]) {
    let closed = 0;
    let opened = 0;
    let deleted = 0;
    const ui = sheet(target, {
      onClose: () => {
        closed += 1;
      },
      onOpen: () => {
        opened += 1;
      },
      onDelete: async () => {
        deleted += 1;
      },
    });
    button(
      ui.render(),
      target.kind === "entry" ? "Remove title" : "Remove list",
    ).props.onPress();
    const tree = ui.render();
    const confirmation = nodes(tree).find(
      (node) => node.type === "DeleteConfirmationDialog",
    );
    assert.equal(confirmation.props.embedded, true);
    assert.equal(
      nodes(tree).some((node) => node.props.style === "contextSheet"),
      false,
    );
    confirmation.props.onCancel();
    assert.equal(closed, 1);
    assert.equal(opened, 0);
    assert.equal(deleted, 0);
  }
});

test("deletion Back cannot dismiss during the actual operation", async () => {
  let finish;
  let closed = 0;
  const ui = sheet(undefined, {
    onClose: () => {
      closed += 1;
    },
    onDelete: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  button(ui.render(), "Remove title").props.onPress();
  const tree = ui.render();
  const confirmation = nodes(tree).find(
    (node) => node.type === "DeleteConfirmationDialog",
  );
  const pending = confirmation.props.onConfirm();
  tree.props.onRequestClose();
  assert.equal(closed, 0);
  finish();
  await pending;
  confirmation.props.onCancel();
  assert.equal(closed, 1);
});

test("duplicate is guarded against repeat taps and failures stay retryable", async () => {
  let copies = 0;
  let closed = 0;
  const ui = sheet(
    { kind: "list", list: bookList, count: 3 },
    {
      onClose: () => {
        closed += 1;
      },
      onDuplicate: async () => {
        copies += 1;
        if (copies === 1) throw new Error("disk full");
      },
    },
  );
  let tree = ui.render();
  assert.match(text(tree), /Reading/);
  assert.ok(byLabel(tree, "Open list details"));
  const duplicate = button(tree, "Duplicate list").props.onPress;
  duplicate();
  duplicate();
  await settle();
  tree = ui.render();
  assert.equal(copies, 1);
  assert.equal(closed, 0);
  assert.match(text(tree), /Could not duplicate list/);
  button(tree, "Duplicate list").props.onPress();
  await settle();
  assert.equal(copies, 2);
  assert.equal(closed, 1);
});

test("outside tap dismisses during duplication and late completion cannot close a newer menu", async () => {
  let finish;
  let closed = 0;
  const ui = sheet(
    { kind: "list", list: bookList, count: 0 },
    {
      onClose: () => {
        closed += 1;
      },
      onDuplicate: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
  );
  const tree = ui.render();
  button(tree, "Duplicate list").props.onPress();
  byLabel(tree, "Close context menu").props.onPress();
  assert.equal(closed, 1);
  ui.unmount();
  finish();
  await settle();
  assert.equal(closed, 1);
});

test("list details expose removal and reserve hold-to-drag for explicit reorder mode", () => {
  const gestures = [];
  const pan = () => {
    const gesture = {
      enabled: (value) => {
        gesture.active = value;
        return gesture;
      },
      activateAfterLongPress: () => gesture,
      onStart: () => gesture,
      onUpdate: () => gesture,
      onEnd: () => gesture,
    };
    gestures.push(gesture);
    return gesture;
  };
  const members = [entry, { ...entry, id: "second", title: "Second" }];
  let menus = 0;
  let removed = 0;
  let opened = 0;
  const ui = mount(
    "screens/ListViewScreen/ListViewScreen.tsx",
    "ListViewScreen",
    {
      list: { ...bookList, accent: "Dusk" },
      entries: members,
      allEntries: members,
      wide: false,
      onOpenEntry: () => {
        opened += 1;
      },
      onShowEntryActions: () => {
        menus += 1;
      },
      onToggleMembership: () => {},
      onRemoveMembership: () => {},
      onDeleteList: () => {
        removed += 1;
      },
      onReorder: () => {},
      onChangeIcon: async () => {},
    },
    {
      "react-native-gesture-handler": {
        Gesture: { Pan: pan },
        GestureDetector: "GestureDetector",
      },
      "react-native-reanimated": {
        runOnJS: (fn) => fn,
        useReducedMotion: () => false,
      },
      "../../components/Icon": { Icon: "Icon" },
      "../../components/ListIconPicker": { ListIconPicker: "ListIconPicker" },
      "../../components/MediaUI": { Cover: "Cover", statusColor: () => "#fff" },
      "../../model": { LIST_ACCENT_COLOR: { Dusk: "#7C3AED" } },
    },
  );
  let tree = ui.render();
  assert.equal(
    gestures.every((gesture) => !gesture.active),
    true,
  );
  byLabel(tree, "Open My title").props.onPressIn();
  tree = ui.render();
  const heldCard = nodes(tree).find(
    (node) =>
      Array.isArray(node.props.style) &&
      node.props.style.includes("listViewCard") &&
      node.props.style.includes("entryPressed"),
  );
  assert.ok(heldCard);
  assert.ok(heldCard.props.style.includes("entryPressedMotion"));
  byLabel(tree, "Open My title").props.onPressOut();
  tree = ui.render();
  assert.equal(
    nodes(tree).some(
      (node) =>
        Array.isArray(node.props.style) &&
        node.props.style.includes("entryPressed"),
    ),
    false,
  );
  assert.match(text(byLabel(tree, "Delete Reading")), /Remove list/);
  byLabel(tree, "Delete Reading").props.onPress();
  assert.equal(removed, 1);
  byLabel(tree, "Open My title").props.onLongPress();
  assert.equal(menus, 1);
  assert.equal(opened, 0);
  byLabel(tree, "List view").props.onPress();
  tree = ui.render();
  byLabel(tree, "Open My title").props.onLongPress();
  assert.equal(menus, 2);
  byLabel(tree, "Reorder titles").props.onPress();
  gestures.length = 0;
  tree = ui.render();
  assert.equal(
    gestures.every((gesture) => gesture.active),
    true,
  );
  assert.equal(byLabel(tree, "Open My title").props.onLongPress, undefined);
  byLabel(tree, "Open My title").props.onPress();
  assert.equal(opened, 0);
  byLabel(tree, "Finish reordering titles").props.onPress();
  gestures.length = 0;
  tree = ui.render();
  assert.equal(
    gestures.every((gesture) => !gesture.active),
    true,
  );
  byLabel(tree, "Open My title").props.onLongPress();
  assert.equal(menus, 3);
  byLabel(tree, "Reorder titles").props.onPress();
  tree = ui.render({ entries: [entry] });
  assert.ok(byLabel(tree, "Finish reordering titles"));
});
