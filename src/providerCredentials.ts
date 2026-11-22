import * as SecureStore from "expo-secure-store";

const INDEX_KEY = "rocket-provider-credential-index-v1";
const BUILT_IN_IDS = ["omdb", "igdb", "anilist", "books"];
const listeners = new Set<(id: string) => void>();

export function onProviderCredentialChange(listener: (id: string) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function isProviderVaultAvailable() {
  return SecureStore.isAvailableAsync();
}

export async function getProviderCredential(id: string) {
  return SecureStore.getItemAsync(`rocket-provider-${id}`);
}

export async function saveProviderCredential(id: string, value: string) {
  await SecureStore.setItemAsync(`rocket-provider-${id}`, value);
  for (const listener of listeners) listener(id);
}

export async function deleteProviderCredential(id: string) {
  await SecureStore.deleteItemAsync(`rocket-provider-${id}`);
  for (const listener of listeners) listener(id);
}

export async function purgeProviderCredentials() {
  const rawIndex = await SecureStore.getItemAsync(INDEX_KEY);
  const legacyIds: string[] = rawIndex
    ? (JSON.parse(rawIndex) as Array<{ id: string }>).map((entry) => entry.id)
    : [];
  const ids = new Set([...BUILT_IN_IDS, ...legacyIds]);
  await Promise.all([...ids].map(deleteProviderCredential));
  await SecureStore.deleteItemAsync(INDEX_KEY);
}
