import * as SecureStore from "expo-secure-store";
import { clearIgdbSession } from "./providers/igdb";

const INDEX_KEY = "rocket-provider-credential-index-v1";
const BUILT_IN_IDS = ["omdb", "igdb", "anilist", "books"];

export async function isProviderVaultAvailable() {
  return SecureStore.isAvailableAsync();
}

export async function getProviderCredential(id: string) {
  return SecureStore.getItemAsync(`rocket-provider-${id}`);
}

export async function saveProviderCredential(id: string, value: string) {
  if (id === "igdb") clearIgdbSession();
  await SecureStore.setItemAsync(`rocket-provider-${id}`, value);
}

export async function deleteProviderCredential(id: string) {
  if (id === "igdb") clearIgdbSession();
  await SecureStore.deleteItemAsync(`rocket-provider-${id}`);
}

export async function purgeProviderCredentials() {
  clearIgdbSession();
  const rawIndex = await SecureStore.getItemAsync(INDEX_KEY);
  const legacyIds: string[] = rawIndex
    ? (JSON.parse(rawIndex) as Array<{ id: string }>).map((entry) => entry.id)
    : [];
  const ids = new Set([...BUILT_IN_IDS, ...legacyIds]);
  await Promise.all(
    [...ids].map((id) => SecureStore.deleteItemAsync(`rocket-provider-${id}`)),
  );
  await SecureStore.deleteItemAsync(INDEX_KEY);
}
