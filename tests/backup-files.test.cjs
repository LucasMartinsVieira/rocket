const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

const compiled = ts.transpileModule(
  readFileSync(join(__dirname, "../src/backupFiles.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;

function load(fileSystem, limit = 1000) {
  const exports = {};
  class BackupFileError extends Error {
    constructor(kind) {
      super(kind);
      this.kind = kind;
    }
  }
  const modules = {
    "expo-file-system": { FileMode: { ReadOnly: "r" }, ...fileSystem },
    "expo-sharing": {},
    "react-native": { Platform: { OS: "android" } },
    "./backup": {
      BackupFileError,
      MAX_BACKUP_BYTES: limit,
      parseBackup: JSON.parse,
    },
  };
  runInNewContext(compiled, {
    exports,
    TextDecoder,
    TypeError,
    require: (name) => modules[name],
  });
  return exports;
}

test("backup picker reads Unicode across chunk boundaries and closes on completion or size failure", async () => {
  const payload = Buffer.from(JSON.stringify({ note: "秘密 📚" }));
  const pick = (bytes) => {
    let offset = 0;
    let closed = false;
    return {
      file: {
        name: "rocket.json",
        size: 0, // A document provider may not report the length.
        open(mode) {
          assert.equal(mode, "r");
          return {
            readBytes: async (limit) => {
              const chunk = bytes.subarray(offset, offset + Math.min(2, limit));
              offset += chunk.length;
              return chunk;
            },
            close: async () => {
              closed = true;
            },
          };
        },
      },
      closed: () => closed,
    };
  };
  for (const limit of [payload.length, payload.length - 1]) {
    const item = pick(payload);
    const api = load(
      {
        File: {
          pickFileAsync: async () => ({ canceled: false, result: item.file }),
        },
      },
      limit,
    );
    if (limit === payload.length) {
      assert.equal((await api.pickBackupFile()).backup.note, "秘密 📚");
    } else {
      await assert.rejects(api.pickBackupFile(), { kind: "size" });
    }
    assert.equal(item.closed(), true);
  }
});

test("a cancelled folder selection saves nothing; a failed write removes the incomplete file", async () => {
  let deleted = false;
  let cancel = true;
  const api = load({
    Directory: {
      pickDirectoryAsync: async () => {
        if (cancel) throw { code: "ERR_PICKER_CANCELLED" };
        return {
          createFile: () => ({
            exists: true,
            write: async () => {
              throw new Error("Write failure");
            },
            delete: () => {
              deleted = true;
            },
          }),
        };
      },
    },
  });
  const snapshot = api.prepareBackupFile({
    exportedAt: "2026-11-19T12:43:22.123Z",
    entries: [{ note: "秘密 📚" }],
  });
  assert.match(snapshot.name, /^rocket-backup-2026-11-19-124322123Z\.json$/);
  assert.equal(snapshot.bytes, Buffer.byteLength(snapshot.json, "utf8"));
  assert.equal(await api.saveBackupFile(snapshot), false);
  assert.equal(deleted, false);
  cancel = false;
  await assert.rejects(api.saveBackupFile(snapshot), /Write failure/);
  assert.equal(deleted, true);
});
