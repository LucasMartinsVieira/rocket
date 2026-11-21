const assert = require("node:assert/strict");
const { test } = require("node:test");
const { mount, nodes, text } = require("./helpers/native-ui.cjs");

const backup = { version: 1, exportedAt: "2026-11-19T12:00:00.000Z" };
const file = { name: "rocket.json", backup };
const snapshot = { ...file, bytes: 1800, json: "{}" };
const counts = { titles: 12, lists: 2, journals: 4, ratings: 3 };
class BackupFileError extends Error {
  constructor(kind) {
    super("Please choose another file.");
    this.kind = kind;
  }
}
function screen({ props, database, files } = {}) {
  return mount(
    "screens/BackupRestoreScreen/BackupRestoreScreen.tsx",
    "BackupRestoreScreen",
    {
      titleCount: 20,
      listCount: 3,
      onBack() {},
      onLibrary() {},
      onRestored() {},
      ...props,
    },
    {
      "react-native": {
        ActivityIndicator: "ActivityIndicator",
        Modal: "Modal",
        Pressable: "Pressable",
        ScrollView: "ScrollView",
        Text: "Text",
        View: "View",
        Platform: { OS: "android" },
        BackHandler: { addEventListener: () => ({ remove() {} }) },
      },
      "../../backup": {
        BACKUP_VERSION: 1,
        BackupFileError,
        snapshotCounts: () => counts,
      },
      "../../backupFiles": {
        canSaveBackup: true,
        pickBackupFile: async () => file,
        prepareBackupFile: () => snapshot,
        saveBackupFile: async () => true,
        ...files,
      },
      "../../database": {
        exportLibraryBackup: async () => backup,
        replaceLibraryFromBackup: async () => {},
        ...database,
      },
      "../../components/Icon": { Icon: "Icon" },
    },
  );
}
const action = (tree, label) => {
  const control = nodes(tree).find(
    (node) => node.type?.name === "Button" && node.props.label === label,
  );
  assert.ok(control, `Missing action: ${label}`);
  assert.notEqual(control.props.disabled, true);
  control.props.onPress();
};
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("restore validates and previews first, cancel never writes, actual success follows progress", async () => {
  let finish;
  let writes = 0;
  let restored = 0;
  const ui = screen({
    props: {
      onRestored: (selected) => {
        assert.equal(selected, backup);
        restored++;
      },
    },
    database: {
      replaceLibraryFromBackup: () => {
        writes++;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    },
  });
  action(ui.render(), "Select backup file…");
  await flush();
  action(ui.render(), "Continue to restore");
  action(ui.render(), "Cancel");
  assert.equal(writes, 0);
  action(ui.render(), "Continue to restore");
  action(ui.render(), "Replace library");
  assert.match(text(ui.render()), /Restoring library/);
  assert.equal(writes, 1);
  assert.equal(restored, 0);
  finish();
  await flush();
  assert.match(text(ui.render()), /Library restored/);
  assert.equal(restored, 1);
});

test("a failed restore offers retry and an invalid or cancelled picker never replaces the library", async () => {
  let next = null;
  let writes = 0;
  const ui = screen({
    props: {
      titleCount: 0,
      listCount: 0,
      onRestored: () => assert.fail("Failed restore committed"),
    },
    files: {
      pickBackupFile: async () => {
        if (next instanceof Error) throw next;
        return next;
      },
    },
    database: {
      replaceLibraryFromBackup: async () => {
        writes++;
        throw new Error("Write failed");
      },
    },
  });
  action(ui.render(), "Select backup file…");
  await flush();
  next = new BackupFileError("version");
  action(ui.render(), "Select backup file…");
  await flush();
  assert.equal(writes, 0);
  assert.equal(
    nodes(ui.render()).some(
      (node) => node.props.title === "Unsupported backup version",
    ),
    true,
  );
  next = file;
  action(ui.render(), "Choose another file");
  await flush();
  action(ui.render(), "Continue to restore");
  action(ui.render(), "Restore library");
  await flush();
  assert.equal(writes, 1);
  assert.ok(
    nodes(ui.render()).some(
      (node) => node.props.message === "Your current library hasn’t changed.",
    ),
  );
  action(ui.render(), "Review backup again");
  action(ui.render(), "Continue to restore");
});

test("recovery export saves without abandoning restore preview or running replacement", async () => {
  let saves = 0;
  const ui = screen({
    files: {
      saveBackupFile: async (value) => {
        assert.equal(value, snapshot);
        saves++;
        return true;
      },
    },
    database: {
      replaceLibraryFromBackup: async () =>
        assert.fail("Export triggered restore"),
    },
  });
  action(ui.render(), "Select backup file…");
  await flush();
  action(ui.render(), "Back up current library first");
  await flush();
  action(ui.render(), "Save backup file");
  await flush();
  assert.equal(saves, 1);
  assert.match(text(ui.render()), /Backup saved to your selected folder/);
  action(ui.render(), "Continue to restore");
});
