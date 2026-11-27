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
import { Icon } from "../../components/Icon";
import { actionStyles } from "../../components/shared/actions.styles";
import { layoutStyles } from "../../components/shared/layout.styles";
import { mediaStyles } from "../../components/shared/mediaPresentation.styles";
import {
  deleteProviderCredential,
  getProviderCredential,
  isProviderVaultAvailable,
  purgeProviderCredentials,
  saveProviderCredential,
} from "../../providerCredentials";
import { parseIgdbCredentials } from "../../providers/igdb";
import { palette } from "../../theme";
import { providerCardStyles } from "../shared/providerCards.styles";
import { styles } from "./styles";

const PROVIDERS = [
  {
    id: "omdb",
    name: "OMDb API",
    platform: "Movies & TV Shows",
    keyless: false,
    label: "Secret API key",
    icon: <Icon name="clapperboard" size={21} color="#D2BBFF" />,
    color: "#D2BBFF",
  },
  {
    id: "igdb",
    name: "IGDB Video Games",
    platform: "Games archive",
    keyless: false,
    label: "Twitch Client Secret",
    icon: <Icon name="gamepad" size={21} color="#FFB68E" />,
    color: "#FFB68E",
  },
  {
    id: "tenrai",
    name: "Tenrai",
    platform: "Anime & manga",
    keyless: true,
    icon: <Icon name="book" size={21} color="#D2BBFF" />,
    color: "#D2BBFF",
  },
  {
    id: "books",
    name: "Open Library",
    platform: "Books & editions",
    keyless: true,
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
  const [editingClientId, setEditingClientId] = useState("");
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
        PROVIDERS.filter((provider) => !provider.keyless).map(
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
      const saved = await getProviderCredential(id);
      if (id === "igdb") {
        const credentials = saved
          ? parseIgdbCredentials(saved)
          : { clientId: "", clientSecret: "" };
        setEditingClientId(credentials.clientId);
        setEditingValue(credentials.clientSecret);
      } else {
        setEditingValue(saved ?? "");
        setEditingClientId("");
      }
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
        setRevealedValues((current) => ({
          ...current,
          [id]:
            id === "igdb" ? parseIgdbCredentials(value).clientSecret : value,
        }));
    } catch {
      setError("Could not reveal this credential.");
    }
  };

  const saveCredential = async () => {
    if (!editingId || !editingValue.trim() || saving) return;
    const value =
      editingId === "igdb"
        ? JSON.stringify({
            clientId: editingClientId.trim(),
            clientSecret: editingValue.trim(),
          })
        : editingValue.trim();
    if (editingId === "igdb") {
      try {
        parseIgdbCredentials(value);
      } catch {
        setError(
          "Enter a valid Twitch Client ID and Client Secret (letters and numbers only).",
        );
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      await saveProviderCredential(editingId, value);
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
      setEditingClientId("");
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
                if (editingId === id) {
                  setEditingId(null);
                  setEditingValue("");
                  setEditingClientId("");
                }
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
                setEditingValue("");
                setEditingClientId("");
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
    keyless: boolean;
    label?: string;
    icon: ReactNode;
    color: string;
  }) => {
    const configured = configuredIds.includes(provider.id);
    const revealedValue = revealedValues[provider.id];
    const isEditing = editingId === provider.id;
    return (
      <View key={provider.id} style={providerCardStyles.providerCard}>
        <View style={styles.providerCardHeading}>
          <View style={styles.providerIcon}>{provider.icon}</View>
          <View style={styles.providerHeadingCopy}>
            <Text style={providerCardStyles.providerName}>{provider.name}</Text>
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
              {provider.keyless
                ? "No key needed"
                : configured
                  ? "Credential saved"
                  : "Not configured"}
            </Text>
          </View>
        </View>

        {provider.keyless ? (
          <Text style={styles.providerUsageNote}>
            {provider.id === "tenrai"
              ? "Public anime and manga lookup. No credentials are sent. Tenrai server keys must not be used in mobile apps. Data from MyAnimeList via Tenrai."
              : "Public book lookup by title, author, or ISBN. No credentials are sent."}
          </Text>
        ) : isEditing ? (
          <View style={styles.providerEditor}>
            {provider.id === "igdb" ? (
              <>
                <Text style={styles.providerUsageNote}>
                  Use your own Twitch developer application credentials, not a
                  shared Rocket secret. This personal-use flow contacts Twitch
                  to obtain an IGDB token; tokens stay in memory. Never
                  distribute your Client Secret.
                </Text>
                <Text style={styles.providerFieldLabel}>Twitch Client ID</Text>
                <TextInput
                  value={editingClientId}
                  onChangeText={setEditingClientId}
                  placeholder="Your Twitch application Client ID"
                  placeholderTextColor={palette.faint}
                  style={styles.providerSecretInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="IGDB Twitch Client ID"
                />
              </>
            ) : null}
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
                  setEditingClientId("");
                }}
                style={styles.providerCancelButton}
                accessibilityRole="button"
              >
                <Text style={styles.providerCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void saveCredential()}
                disabled={
                  !editingValue.trim() ||
                  (provider.id === "igdb" && !editingClientId.trim()) ||
                  saving
                }
                style={[
                  styles.providerSaveButton,
                  (!editingValue.trim() ||
                    (provider.id === "igdb" && !editingClientId.trim()) ||
                    saving) &&
                    actionStyles.disabledButton,
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
                ? "Used for movie and TV show lookup when you submit a query. Not yet verified."
                : "Personal Twitch credentials authenticate with Twitch for IGDB lookup. Saving does not verify credentials. Access tokens stay in memory."}
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
      style={layoutStyles.fill}
      contentContainerStyle={providerCardStyles.providersBody}
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
        <Text style={providerCardStyles.vaultTitle}>Provider credentials</Text>
        <Text style={providerCardStyles.vaultDescription}>
          Save personal API keys on this device. They stay private in the system
          secure store. Movie and TV lookup sends its key directly to OMDb. IGDB
          uses your personal Twitch credentials. Open Library and Tenrai need no
          key.
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
                Credentials are not sent to a Rocket server. Requests go
                directly to providers over HTTPS. IGDB's Client Secret is sent
                only to Twitch's token endpoint; IGDB receives the access token
                and Client ID. Tenrai and Open Library need no key.
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
            <View style={mediaStyles.mediaTypeFact}>
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
