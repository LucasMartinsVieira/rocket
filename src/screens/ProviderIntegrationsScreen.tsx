import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { styles } from "../styles";
import {
  deleteProviderCredential,
  getProviderCredential,
  isProviderVaultAvailable,
  purgeProviderCredentials,
  saveProviderCredential,
} from "../providerCredentials";

const PROVIDERS = [
  { id: "omdb", name: "OMDb API", platform: "Movies & series", label: "Secret API key", icon: "▣", color: "#D2BBFF" },
  { id: "rawg", name: "RAWG Video Games", platform: "Games archive", label: "User client API key", icon: "⌘", color: "#FFB68E" },
  { id: "anilist", name: "AniList & MAL", platform: "Anime & manga", label: "API token", icon: "▤", color: "#D2BBFF" },
  { id: "books", name: "Open Library & Google Books", platform: "Books & editions", label: "Optional API key", icon: "▤", color: "#CCC3D8" },
] as const;

export function ProviderIntegrationsScreen() {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [configuredIds, setConfiguredIds] = useState<string[]>([]);
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [saving, setSaving] = useState(false);

  const loadCredentials = async () => {
    setLoading(true);
    setError("");
    try {
      const isAvailable = Platform.OS !== "web" && await isProviderVaultAvailable();
      setAvailable(isAvailable);
      if (!isAvailable) return;
      const pairs = await Promise.all(PROVIDERS.map(async (provider) => [provider.id, !!await getProviderCredential(provider.id)] as const));
      const savedIds = pairs.filter(([, configured]) => configured).map(([id]) => id);
      setConfiguredIds(savedIds);
    } catch {
      setError("Could not read credentials from secure storage.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadCredentials(); }, []);

  const savedCount = useMemo(() => configuredIds.length, [configuredIds]);

  const startEditing = async (id: string) => {
    try {
      setEditingValue(await getProviderCredential(id) ?? "");
      setEditingId(id);
    } catch {
      setError("Could not open this credential.");
    }
  };

  const toggleReveal = async (id: string) => {
    if (id in revealedValues) {
      setRevealedValues((current) => { const next = { ...current }; delete next[id]; return next; });
      return;
    }
    try {
      const value = await getProviderCredential(id);
      if (value !== null) setRevealedValues((current) => ({ ...current, [id]: value }));
    } catch {
      setError("Could not reveal this credential.");
    }
  };

  const saveCredential = async () => {
    if (!editingId || !editingValue.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await saveProviderCredential(editingId, editingValue.trim());
      setConfiguredIds((current) => current.includes(editingId) ? current : [...current, editingId]);
      setRevealedValues((current) => { const next = { ...current }; delete next[editingId]; return next; });
      setEditingId(null);
      setEditingValue("");
    } catch {
      setError("Could not save this credential. Check device secure storage and try again.");
    } finally {
      setSaving(false);
    }
  };

  const removeCredential = (id: string, name: string) => {
    Alert.alert(`Remove ${name} credential?`, "This deletes its saved secret from this device.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => {
        void deleteProviderCredential(id).then(() => {
          setConfiguredIds((current) => current.filter((configuredId) => configuredId !== id));
          setRevealedValues((current) => { const next = { ...current }; delete next[id]; return next; });
          if (editingId === id) setEditingId(null);
        }).catch(() => setError("Could not remove this credential."));
      } },
    ]);
  };

  const purgeAll = () => {
    if (!savedCount) return;
    Alert.alert("Purge saved secrets?", "This permanently removes all provider credentials stored on this device.", [
      { text: "Cancel", style: "cancel" },
      { text: "Purge all", style: "destructive", onPress: () => {
        void purgeProviderCredentials().then(() => {
          setConfiguredIds([]);
          setRevealedValues({});
          setEditingId(null);
        }).catch(() => setError("Could not purge all credentials. Try again."));
      } },
    ]);
  };

  const renderProvider = (provider: { id: string; name: string; platform: string; label: string; icon: string; color: string }) => {
    const configured = configuredIds.includes(provider.id);
    const revealedValue = revealedValues[provider.id];
    const isEditing = editingId === provider.id;
    return <View key={provider.id} style={styles.providerCard}>
      <View style={styles.providerCardHeading}>
        <View style={styles.providerIcon}><Text style={[styles.providerIconText, { color: provider.color }]}>{provider.icon}</Text></View>
        <View style={styles.providerHeadingCopy}>
          <Text style={styles.providerName}>{provider.name}</Text>
          <Text style={styles.providerSubtitle}>{provider.platform}</Text>
        </View>
        <View style={[styles.providerState, configured ? styles.providerStateSaved : styles.providerStateEmpty]}>
          <Text style={[styles.providerStateText, configured ? styles.providerStateSavedText : styles.providerStateEmptyText]}>{configured ? "Credential saved" : "Not configured"}</Text>
        </View>
      </View>

      {isEditing ? <View style={styles.providerEditor}>
        <Text style={styles.providerFieldLabel}>{provider.label}</Text>
        <TextInput
          value={editingValue}
          onChangeText={setEditingValue}
          placeholder="Paste your API key or token"
          placeholderTextColor="#958DA1"
          style={styles.providerSecretInput}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={`${provider.name} ${provider.label}`}
        />
        <View style={styles.providerEditorActions}>
          <Pressable onPress={() => { setEditingId(null); setEditingValue(""); }} style={styles.providerCancelButton} accessibilityRole="button"><Text style={styles.providerCancelText}>Cancel</Text></Pressable>
          <Pressable onPress={() => void saveCredential()} disabled={!editingValue.trim() || saving} style={[styles.providerSaveButton, (!editingValue.trim() || saving) && styles.disabledButton]} accessibilityRole="button"><Text style={styles.providerSaveText}>{saving ? "Saving…" : "Save credential"}</Text></Pressable>
        </View>
      </View> : configured ? <View style={styles.providerSecretBlock}>
        <Text style={styles.providerFieldLabel}>{provider.label}</Text>
        <View style={styles.providerSavedRow}>
          <Text style={styles.providerMaskedValue} numberOfLines={1}>{revealedValue ?? "••••••••••••••••"}</Text>
          <Pressable onPress={() => void toggleReveal(provider.id)} style={styles.providerIconButton} accessibilityRole="button" accessibilityLabel={revealedValue ? `Hide ${provider.name} credential` : `Reveal ${provider.name} credential`}>
            <Text style={styles.providerActionGlyph}>{revealedValue ? "◉̸" : "◉"}</Text>
          </Pressable>
          <Pressable onPress={() => void startEditing(provider.id)} style={styles.providerIconButton} accessibilityRole="button" accessibilityLabel={`Edit ${provider.name} credential`}><Text style={styles.providerActionGlyph}>✎</Text></Pressable>
          <Pressable onPress={() => removeCredential(provider.id, provider.name)} style={styles.providerIconButton} accessibilityRole="button" accessibilityLabel={`Remove ${provider.name} credential`}><Text style={styles.providerActionGlyph}>×</Text></Pressable>
        </View>
        <Text style={styles.providerUsageNote}>Stored securely on this device. Provider lookups are not enabled yet.</Text>
      </View> : <Pressable onPress={() => void startEditing(provider.id)} style={styles.providerAddButton} accessibilityRole="button" accessibilityLabel={`Add ${provider.name} credential`}>
        <Text style={styles.providerAddGlyph}>＋</Text><Text style={styles.providerAddText}>Add credential</Text>
      </Pressable>}
    </View>;
  };

  return <ScrollView style={styles.libraryScroll} contentContainerStyle={styles.providersBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <View style={styles.vaultIntro}>
      <View style={styles.vaultIntroTop}>
        <View style={styles.vaultBadge}><Text style={styles.vaultBadgeGlyph}>▣</Text><Text style={styles.vaultBadgeText}>LOCAL DEVICE STORAGE</Text></View>
        <Text style={styles.vaultAlgorithm}>{available ? "SECURE STORE" : ""}</Text>
      </View>
      <Text style={styles.vaultTitle}>Provider credentials</Text>
      <Text style={styles.vaultDescription}>Save personal API keys on this device. They stay private in the system secure store. Rocket does not use credentials for catalog lookups yet.</Text>
    </View>

    {!available && !loading ? <View style={styles.providerNotice}>
      <Text style={styles.providerNoticeText}>{Platform.OS === "web" ? "Secure credential storage is available on Android and iOS, not on web." : "This device does not provide secure credential storage."}</Text>
    </View> : null}
    {loading ? <ActivityIndicator color="#D2BBFF" style={styles.providerLoading} /> : null}
    {error ? <Text style={styles.providerError} accessibilityRole="alert">{error}</Text> : null}

    {available ? <>
      <View style={styles.providersSectionHeader}>
        <Text style={styles.providersSectionTitle}>Saved credentials ({savedCount})</Text>
        <Text style={styles.providersSectionAside}>On this device</Text>
      </View>
      {PROVIDERS.map((provider) => renderProvider(provider))}
      <View style={styles.providerPrivacyNote}>
        <Text style={styles.providerPrivacyIcon}>◇</Text>
        <View style={styles.providerPrivacyCopy}>
          <Text style={styles.providerPrivacyTitle}>Credentials stay on this device</Text>
          <Text style={styles.providerPrivacyText}>Rocket does not proxy, send, or use saved credentials for provider requests. Catalog lookup is not implemented yet.</Text>
        </View>
      </View>

      <Pressable onPress={purgeAll} disabled={!savedCount} style={[styles.providerPurgeButton, !savedCount && styles.providerPurgeDisabled]} accessibilityRole="button" accessibilityLabel="Purge all saved provider credentials">
        <Text style={styles.providerPurgeText}>⌫  Purge all saved credentials</Text>
      </Pressable>
      <Text style={styles.providerPurgeFootnote}>Permanently deletes {savedCount} saved {savedCount === 1 ? "secret" : "secrets"} from this device.</Text>
    </> : null}

  </ScrollView>;
}
