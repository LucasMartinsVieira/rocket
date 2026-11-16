import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Icon } from "../components/Icon";
import {
  deleteProviderCredential,
  getProviderCredential,
  isProviderVaultAvailable,
  purgeProviderCredentials,
  saveProviderCredential,
} from "../providerCredentials";
import { styles } from "../styles";
import { palette } from "../theme";

const PROVIDERS = [
  {
    id: "omdb",
    name: "OMDb API",
    platform: "Movies & series",
    label: "Secret API key",
    icon: <Icon name="clapperboard" size={21} color="#D2BBFF" />,
    color: "#D2BBFF",
  },
  {
    id: "rawg",
    name: "RAWG Video Games",
    platform: "Games archive",
    label: "User client API key",
    icon: <Icon name="gamepad" size={21} color="#FFB68E" />,
    color: "#FFB68E",
  },
  {
    id: "tenrai",
    name: "Tenrai",
    platform: "Anime & manga",
    label: "API token",
    icon: <Icon name="book" size={21} color="#D2BBFF" />,
    color: "#D2BBFF",
  },
  {
    id: "books",
    name: "Open Library & Google Books",
    platform: "Books & editions",
    label: "Google Books API key (fallback only)",
    icon: <Icon name="library" size={21} color="#CCC3D8" />,
    color: "#CCC3D8",
  },
] as const;

export function ProviderIntegrationsScreen() {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [configuredIds, setConfiguredIds] = useState<string[]>([]);
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>(
    {},
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [saving, setSaving] = useState(false);

  const loadCredentials = async () => {
    setLoading(true);
    setError("");
    try {
      const isAvailable =
        Platform.OS !== "web" && (await isProviderVaultAvailable());
      setAvailable(isAvailable);
      if (!isAvailable) return;
      const pairs = await Promise.all(
        PROVIDERS.map(
          async (provider) =>
            [
              provider.id,
              !!(await getProviderCredential(provider.id)),
            ] as const,
        ),
      );
      const savedIds = pairs
        .filter(([, configured]) => configured)
        .map(([id]) => id);
      setConfiguredIds(savedIds);
    } catch {
      setError("Could not read credentials from secure storage.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCredentials();
  }, []);

  const savedCount = useMemo(() => configuredIds.length, [configuredIds]);

  const startEditing = async (id: string) => {
    try {
      setEditingValue((await getProviderCredential(id)) ?? "");
      setEditingId(id);
    } catch {
      setError("Could not open this credential.");
    }
  };

  const toggleReveal = async (id: string) => {
    if (id in revealedValues) {
      setRevealedValues((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      return;
    }
    try {
      const value = await getProviderCredential(id);
      if (value !== null)
        setRevealedValues((current) => ({ ...current, [id]: value }));
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
      setConfiguredIds((current) =>
        current.includes(editingId) ? current : [...current, editingId],
      );
      setRevealedValues((current) => {
        const next = { ...current };
        delete next[editingId];
        return next;
      });
      setEditingId(null);
      setEditingValue("");
    } catch {
      setError(
        "Could not save this credential. Check device secure storage and try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const removeCredential = (id: string, name: string) => {
    Alert.alert(
      `Remove ${name} credential?`,
      "This deletes its saved secret from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void deleteProviderCredential(id)
              .then(() => {
                setConfiguredIds((current) =>
                  current.filter((configuredId) => configuredId !== id),
                );
                setRevealedValues((current) => {
                  const next = { ...current };
                  delete next[id];
                  return next;
                });
                if (editingId === id) setEditingId(null);
              })
              .catch(() => setError("Could not remove this credential."));
          },
        },
      ],
    );
  };

  const purgeAll = () => {
    if (!savedCount) return;
    Alert.alert(
      "Purge saved secrets?",
      "This permanently removes all provider credentials stored on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Purge all",
          style: "destructive",
          onPress: () => {
            void purgeProviderCredentials()
              .then(() => {
                setConfiguredIds([]);
                setRevealedValues({});
                setEditingId(null);
              })
              .catch(() =>
                setError("Could not purge all credentials. Try again."),
              );
          },
        },
      ],
    );
  };

  const renderProvider = (provider: {
    id: string;
    name: string;
    platform: string;
    label: string;
    icon: ReactNode;
    color: string;
  }) => {
    const configured = configuredIds.includes(provider.id);
    const revealedValue = revealedValues[provider.id];
    const isEditing = editingId === provider.id;
    return (
      <View key={provider.id} style={styles.providerCard}>
        <View style={styles.providerCardHeading}>
          <View style={styles.providerIcon}>{provider.icon}</View>
          <View style={styles.providerHeadingCopy}>
            <Text style={styles.providerName}>{provider.name}</Text>
            <Text style={styles.providerSubtitle}>{provider.platform}</Text>
          </View>
          <View
            style={[
              styles.providerState,
              configured
                ? styles.providerStateSaved
                : styles.providerStateEmpty,
            ]}
          >
            <Text
              style={[
                styles.providerStateText,
                configured
                  ? styles.providerStateSavedText
                  : styles.providerStateEmptyText,
              ]}
            >
              {provider.id === "tenrai"
                ? "No key needed"
                : configured
                  ? "Credential saved"
                  : "Not configured"}
            </Text>
          </View>
        </View>

        {provider.id === "tenrai" ? (
          <Text style={styles.providerUsageNote}>
            Public anime and manga lookup. No credentials are sent. Tenrai
            server keys must not be used in mobile apps. Data from MyAnimeList
            via Tenrai.
          </Text>
        ) : isEditing ? (
          <View style={styles.providerEditor}>
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
              <Pressable
                onPress={() => {
                  setEditingId(null);
                  setEditingValue("");
                }}
                style={styles.providerCancelButton}
                accessibilityRole="button"
              >
                <Text style={styles.providerCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void saveCredential()}
                disabled={!editingValue.trim() || saving}
                style={[
                  styles.providerSaveButton,
                  (!editingValue.trim() || saving) && styles.disabledButton,
                ]}
                accessibilityRole="button"
              >
                <Text style={styles.providerSaveText}>
                  {saving ? "Saving…" : "Save credential"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : configured ? (
          <View style={styles.providerSecretBlock}>
            <Text style={styles.providerFieldLabel}>{provider.label}</Text>
            <View style={styles.providerSavedRow}>
              <Text style={styles.providerMaskedValue} numberOfLines={1}>
                {revealedValue ?? "••••••••••••••••"}
              </Text>
              <Pressable
                onPress={() => void toggleReveal(provider.id)}
                style={styles.providerIconButton}
                accessibilityRole="button"
                accessibilityLabel={
                  revealedValue
                    ? `Hide ${provider.name} credential`
                    : `Reveal ${provider.name} credential`
                }
              >
                <Icon
                  name={revealedValue ? "eyeOff" : "eye"}
                  size={18}
                  color={palette.faint}
                />
              </Pressable>
              <Pressable
                onPress={() => void startEditing(provider.id)}
                style={styles.providerIconButton}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${provider.name} credential`}
              >
                <Icon name="pencil" size={18} color={palette.faint} />
              </Pressable>
              <Pressable
                onPress={() => removeCredential(provider.id, provider.name)}
                style={styles.providerIconButton}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${provider.name} credential`}
              >
                <Icon name="trash" size={18} color={palette.faint} />
              </Pressable>
            </View>
            <Text style={styles.providerUsageNote}>
              {provider.id === "omdb"
                ? "Used for movie lookup when you submit a query. Not yet verified."
                : provider.id === "books"
                  ? "Open Library needs no key. This key is sent only to Google Books for fallback searches and previews."
                  : "Stored securely on this device. Lookup for this provider is not enabled yet."}
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={() => void startEditing(provider.id)}
            style={styles.providerAddButton}
            accessibilityRole="button"
            accessibilityLabel={`Add ${provider.name} credential`}
          >
            <Text style={styles.providerAddGlyph}>＋</Text>
            <Text style={styles.providerAddText}>Add credential</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.libraryScroll}
      contentContainerStyle={styles.providersBody}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.vaultIntro}>
        <View style={styles.vaultIntroTop}>
          <View style={styles.vaultBadge}>
            <Icon name="lock" size={14} color={palette.violetText} />
            <Text style={styles.vaultBadgeText}>LOCAL DEVICE STORAGE</Text>
          </View>
          <Text style={styles.vaultAlgorithm}>
            {available ? "SECURE STORE" : ""}
          </Text>
        </View>
        <Text style={styles.vaultTitle}>Provider credentials</Text>
        <Text style={styles.vaultDescription}>
          Save personal API keys on this device. They stay private in the system
          secure store. Movie and book lookups send keys directly to OMDb or
          Google Books when needed. Open Library and Tenrai need no key. Game
          lookup is not connected yet.
        </Text>
      </View>

      {!available && !loading ? (
        <View style={styles.providerNotice}>
          <Text style={styles.providerNoticeText}>
            {Platform.OS === "web"
              ? "Secure credential storage is available on Android and iOS, not on web."
              : "This device does not provide secure credential storage."}
          </Text>
        </View>
      ) : null}
      {loading ? (
        <ActivityIndicator color="#D2BBFF" style={styles.providerLoading} />
      ) : null}
      {error ? (
        <Text style={styles.providerError} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      {available ? (
        <>
          <View style={styles.providersSectionHeader}>
            <Text style={styles.providersSectionTitle}>
              Saved credentials ({savedCount})
            </Text>
            <Text style={styles.providersSectionAside}>On this device</Text>
          </View>
          {PROVIDERS.map((provider) => renderProvider(provider))}
          <View style={styles.providerPrivacyNote}>
            <Icon name="shield" size={23} color={palette.violetText} />
            <View style={styles.providerPrivacyCopy}>
              <Text style={styles.providerPrivacyTitle}>
                Secure storage, direct requests
              </Text>
              <Text style={styles.providerPrivacyText}>
                Credentials are not sent to a Rocket server. OMDb requests go
                directly to OMDb or Google Books over HTTPS using your saved
                keys. Tenrai and Open Library need no key. Game credentials are
                not used yet.
              </Text>
            </View>
          </View>

          <Pressable
            onPress={purgeAll}
            disabled={!savedCount}
            style={[
              styles.providerPurgeButton,
              !savedCount && styles.providerPurgeDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Purge all saved provider credentials"
          >
            <View style={styles.mediaTypeFact}>
              <Icon name="trash" size={18} color="#FFB4AB" />
              <Text style={styles.providerPurgeText}>
                Purge all saved credentials
              </Text>
            </View>
          </Pressable>
          <Text style={styles.providerPurgeFootnote}>
            Permanently deletes {savedCount} saved{" "}
            {savedCount === 1 ? "secret" : "secrets"} from this device.
          </Text>
        </>
      ) : null}
    </ScrollView>
  );
}
