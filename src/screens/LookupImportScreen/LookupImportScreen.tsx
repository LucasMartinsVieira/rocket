import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { CatalogResult } from "../../catalog";
import {
  type CatalogFilter,
  type CatalogSearchSession,
  getCatalogDetails,
  loadMoreCatalogResults,
  searchCatalog,
} from "../../catalogSearch";
import { Icon } from "../../components/Icon";
import { Cover } from "../../components/MediaUI";
import { actionStyles } from "../../components/shared/actions.styles";
import { formStyles } from "../../components/shared/form.styles";
import { layoutStyles } from "../../components/shared/layout.styles";
import { mediaStyles } from "../../components/shared/mediaPresentation.styles";
import { formatDuration } from "../../model";
import { palette } from "../../theme";
import { styles } from "./styles";

const filters = [
  { id: "all", label: "All Providers", color: "#D2BBFF" },
  { id: "omdb", label: "Movies (OMDb)", color: "#FFB68E" },
  { id: "omdb-series", label: "TV Shows (OMDb)", color: "#FFB68E" },
  { id: "books", label: "Books (Open Library)", color: "#C5C6C8" },
  { id: "tenrai-anime", label: "Anime (Tenrai)", color: "#D2BBFF" },
  { id: "tenrai-manga", label: "Manga (Tenrai)", color: "#D2BBFF" },
  { id: "igdb", label: "Games (IGDB)", color: "#FFDBC9" },
] as const satisfies readonly {
  id: CatalogFilter;
  label: string;
  color: string;
}[];

type Props = {
  visible: boolean;
  onClose: () => void;
  onImport: (result: CatalogResult) => void;
};

export function LookupImportScreen({ visible, onClose, onImport }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const [queryAttempted, setQueryAttempted] = useState(false);
  const [session, setSession] = useState<CatalogSearchSession | null>(null);
  const [selected, setSelected] = useState<CatalogResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const results = session?.results ?? [];
  const seasonCount =
    selected?.type === "TV Show"
      ? formatDuration(selected.type, selected.duration ?? null)
      : null;
  const cancel = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setLoading(false);
  };
  const resetLookup = () => {
    cancel();
    setSession(null);
    setSelected(null);
    setError("");
    setQueryAttempted(false);
  };
  useEffect(() => {
    if (!visible) requestRef.current?.abort();
    return () => requestRef.current?.abort();
  }, [visible]);

  const runSearch = async (previous?: CatalogSearchSession) => {
    cancel();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    setQueryAttempted(true);
    setSelected(null);
    if (!previous) setSession(null);
    try {
      const next = previous
        ? await loadMoreCatalogResults(previous, controller.signal)
        : await searchCatalog(query, filter, controller.signal);
      if (controller.signal.aborted) return;
      setSession(next);
      setError(next.errors.join("\n"));
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not search providers.",
        );
    } finally {
      if (requestRef.current === controller) setLoading(false);
    }
  };

  const submitQuery = () => {
    if (!query.trim() || loading) return;
    Keyboard.dismiss();
    void runSearch();
  };

  const select = async (result: CatalogResult) => {
    cancel();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    setSelected(null);
    try {
      const details = await getCatalogDetails(result, controller.signal);
      if (!controller.signal.aborted) setSelected(details);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load title details.",
        );
    } finally {
      if (requestRef.current === controller) setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={layoutStyles.screen} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={layoutStyles.fill}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.lookupHeader}>
            <Pressable
              onPress={onClose}
              style={actionStyles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Back to add title"
            >
              <Icon name="chevronLeft" size={24} color={palette.ink} />
            </Pressable>
            <Text style={styles.lookupHeaderTitle}>Lookup & Import</Text>
            <View style={styles.lookupHeaderIcon}>
              <Icon name="search" size={20} color={palette.primaryText} />
            </View>
          </View>
          <ScrollView
            style={layoutStyles.fill}
            contentContainerStyle={styles.lookupContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.lookupConnectionRow}>
              <View style={styles.lookupInline}>
                <View style={styles.lookupConnectionDot} />
                <Text style={styles.lookupConnectionText}>
                  PROVIDER CATALOG LINK
                </Text>
              </View>
              <View style={styles.lookupEndpointBadge}>
                <Icon name="settingsAlt" size={14} color={palette.violetText} />
                <Text style={styles.lookupEndpointText}>Catalog lookup</Text>
              </View>
            </View>
            <View style={styles.lookupSearch}>
              <Icon name="search" size={21} color={palette.muted} />
              <TextInput
                value={query}
                onChangeText={(value) => {
                  resetLookup();
                  setQuery(value);
                }}
                placeholder="Search title, author, ISBN, or IMDb ID…"
                placeholderTextColor={palette.faint}
                style={styles.lookupSearchInput}
                accessibilityLabel="Media query"
                returnKeyType="search"
                onSubmitEditing={submitQuery}
              />
              {query ? (
                <Pressable
                  onPress={() => {
                    resetLookup();
                    setQuery("");
                  }}
                  style={styles.lookupClear}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <Icon name="x" size={18} color={palette.muted} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={submitQuery}
                disabled={!query.trim() || loading}
                style={[
                  styles.lookupQueryButton,
                  (!query.trim() || loading) && actionStyles.disabledButton,
                ]}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: !query.trim() || loading,
                }}
              >
                <Text style={styles.lookupQueryText}>Query</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.lookupFilterRail}
            >
              {filters.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    resetLookup();
                    setFilter(item.id);
                  }}
                  style={[
                    styles.lookupFilter,
                    filter === item.id && styles.lookupFilterSelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === item.id }}
                >
                  <View
                    style={[
                      mediaStyles.statusDot,
                      { backgroundColor: item.color },
                    ]}
                  />
                  <Text style={styles.lookupFilterText}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.lookupIntro}>
              <View style={styles.lookupInline}>
                <Icon name="telescope" size={15} color={palette.violetText} />
                <Text style={styles.lookupResultCount}>
                  {queryAttempted
                    ? `${results.length} titles shown`
                    : "Search movies, TV shows, books, anime, manga & games"}
                </Text>
              </View>
              <Text style={styles.lookupIntroCopy}>
                Select a result to preview its title, creator, synopsis, and
                cover before filling your add-title form.
              </Text>
            </View>
            {loading ? (
              <ActivityIndicator
                color={palette.violetText}
                accessibilityLabel="Loading catalog results"
              />
            ) : null}
            {error ? (
              <Text style={formStyles.errorText} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
            {results.map((result) => (
              <View
                key={result.id}
                style={[
                  styles.lookupMovieCard,
                  selected?.id === result.id && styles.lookupMovieSelected,
                ]}
              >
                <View style={styles.lookupMovieCover}>
                  <Cover
                    uri={result.coverUri}
                    type={result.type}
                    title={result.title}
                  />
                </View>
                <View style={styles.lookupMovieCopy}>
                  <Text style={styles.lookupMovieTitle}>{result.title}</Text>
                  <Text style={styles.lookupResultCount}>
                    {result.type} · {result.releaseYear ?? "Year unknown"} ·{" "}
                    {result.provider}
                  </Text>
                  {selected?.id === result.id ? (
                    <>
                      {selected.creator ? (
                        <Text style={styles.lookupIntroCopy}>
                          {selected.creator}
                        </Text>
                      ) : null}
                      {seasonCount ? (
                        <Text style={styles.lookupIntroCopy}>
                          {seasonCount}
                        </Text>
                      ) : null}
                      <Text style={styles.lookupIntroCopy} numberOfLines={4}>
                        {selected.summary || "No synopsis available."}
                      </Text>
                    </>
                  ) : null}
                  <Pressable
                    onPress={() => void select(result)}
                    disabled={loading}
                    style={styles.lookupQueryButton}
                    accessibilityRole="button"
                    accessibilityLabel={`Preview ${result.title}`}
                  >
                    <Text style={styles.lookupQueryText}>
                      {selected?.id === result.id
                        ? "Selected"
                        : "Select & preview"}
                    </Text>
                  </Pressable>
                </View>
                <Pressable
                  onPress={() => void Linking.openURL(result.sourceUrl)}
                  accessibilityRole="link"
                  accessibilityLabel={`View ${result.title} on ${result.provider}`}
                >
                  <Text style={styles.lookupManualText}>Source</Text>
                </Pressable>
              </View>
            ))}
            {!loading && session?.continuation && results.length > 0 ? (
              <Pressable
                onPress={() => void runSearch(session)}
                style={styles.lookupQueryButton}
                accessibilityRole="button"
              >
                <Text style={styles.lookupQueryText}>Load more titles</Text>
              </Pressable>
            ) : null}
            {!results.length && !loading ? (
              <View style={styles.lookupEmpty}>
                <View style={styles.lookupEmptyIcon}>
                  <Icon name="search" size={30} color={palette.violetText} />
                </View>
                <Text style={styles.lookupEmptyTitle}>
                  {queryAttempted
                    ? error
                      ? "Lookup could not complete"
                      : "No matching titles"
                    : "Find your next library title"}
                </Text>
                <Text
                  style={styles.lookupEmptyCopy}
                  accessibilityLiveRegion="polite"
                >
                  Search anime and manga through Tenrai, books through Open
                  Library, movies and TV shows with your OMDb key, or games with
                  your personal IGDB/Twitch credentials. Manual entry is always
                  available.
                </Text>
              </View>
            ) : null}
            <Pressable
              onPress={() => void Linking.openURL("https://www.omdbapi.com/")}
              accessibilityRole="link"
            >
              <Text style={styles.lookupManualText}>
                Movie and TV data from OMDb · CC BY-NC 4.0
              </Text>
            </Pressable>
          </ScrollView>
          <View style={styles.lookupTray}>
            <View style={styles.lookupTrayHeading}>
              <View style={styles.lookupInline}>
                <Icon name="sparkles" size={14} color="#FFB68E" />
                <Text style={styles.lookupTrayLabel}>IMPORT PREVIEW</Text>
              </View>
              <Text style={styles.lookupTrayTitle}>
                {selected
                  ? `${selected.title}${selected.releaseYear ? ` (${selected.releaseYear})` : ""}`
                  : "No title selected"}
              </Text>
            </View>
            <Pressable
              disabled={!selected || loading}
              onPress={() => {
                if (selected) onImport(selected);
              }}
              style={[
                styles.lookupImportButton,
                (!selected || loading) && actionStyles.disabledButton,
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !selected || loading }}
              accessibilityLabel="Fill Add Title form"
            >
              <Icon name="plus" size={20} color={palette.background} />
              <Text style={styles.lookupImportText}>Fill “Add Title” Form</Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={styles.lookupManualButton}
              accessibilityRole="button"
            >
              <Text style={styles.lookupManualText}>
                Or skip auto-fill & enter manually
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
