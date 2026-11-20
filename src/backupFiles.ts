import { Directory, File, FileMode, Paths } from "expo-file-system";
import { isAvailableAsync, shareAsync } from "expo-sharing";
import { Platform } from "react-native";
import {
  BackupFileError,
  type LibraryBackup,
  MAX_BACKUP_BYTES,
  parseBackup,
} from "./backup";

export type BackupExport = {
  backup: LibraryBackup;
  name: string;
  json: string;
  bytes: number;
};

function utf8Size(text: string) {
  let bytes = 0;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

export function prepareBackupFile(backup: LibraryBackup): BackupExport {
  const json = `${JSON.stringify(backup, null, 2)}\n`;
  const bytes = utf8Size(json);
  if (bytes > MAX_BACKUP_BYTES) throw new BackupFileError("size");
  const [day, time = ""] = backup.exportedAt.split("T");
  return {
    backup,
    json,
    bytes,
    name: `rocket-backup-${day}-${time.replace(/\D/g, "")}Z.json`,
  };
}

function deleteIfPossible(file: File) {
  try {
    if (file.exists) file.delete();
  } catch {
    // Cleanup is best effort; never hide the original file operation error.
  }
}

export async function pickBackupFile() {
  const picked = await File.pickFileAsync({
    mimeTypes: ["application/json", "text/plain", "application/octet-stream"],
  });
  if (picked.canceled) return null;
  const file = picked.result;
  if (file.size > MAX_BACKUP_BYTES) throw new BackupFileError("size");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const reader = file.open(FileMode.ReadOnly);
  let bytes = 0;
  const chunks: string[] = [];
  try {
    while (bytes <= MAX_BACKUP_BYTES) {
      const chunk = await reader.readBytes(
        Math.min(64 * 1024, MAX_BACKUP_BYTES - bytes + 1),
      );
      if (!chunk.length) break;
      bytes += chunk.length;
      if (bytes > MAX_BACKUP_BYTES) throw new BackupFileError("size");
      chunks.push(decoder.decode(chunk, { stream: true }));
    }
    chunks.push(decoder.decode());
  } catch (error) {
    if (error instanceof TypeError) throw new BackupFileError("invalid");
    throw error;
  } finally {
    await reader.close();
  }
  return { name: file.name, backup: parseBackup(chunks.join("")) };
}

export const canSaveBackup = Platform.OS === "android";

export async function saveBackupFile(snapshot: BackupExport) {
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ERR_PICKER_CANCELLED"
    )
      return false;
    throw error;
  }
  const file = directory.createFile(snapshot.name, "application/json");
  try {
    await file.write(snapshot.json);
  } catch (error) {
    deleteIfPossible(file);
    throw error;
  }
  return true;
}

export async function shareBackupFile(snapshot: BackupExport) {
  if (!(await isAvailableAsync())) throw new Error("Sharing is unavailable.");
  const directory = new Directory(Paths.cache, "rocket-backup-share");
  // Leave the most recently shared file readable for the recipient app. Remove
  // the previous staging copy the next time the user explicitly shares.
  if (directory.exists) directory.delete();
  directory.create();
  const file = new File(directory, snapshot.name);
  file.create();
  try {
    await file.write(snapshot.json);
    await shareAsync(file.uri, {
      mimeType: "application/json",
      dialogTitle: "Share Rocket backup",
      UTI: "public.json",
    });
  } catch (error) {
    deleteIfPossible(file);
    throw error;
  }
}
