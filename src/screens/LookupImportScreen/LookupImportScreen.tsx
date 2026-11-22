import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { Icon } from "../../components/Icon";
import { Cover } from "../../components/MediaUI";
import { actionStyles } from "../../components/shared/actions.styles";
import { formStyles } from "../../components/shared/form.styles";
import { layoutStyles } from "../../components/shared/layout.styles";
import { mediaStyles } from "../../components/shared/mediaPresentation.styles";
import { catalogAdapters } from "../../providers/registry";
import { palette } from "../../theme";
import { styles } from "./styles";

const filters = [
  { id: "all", label: "All Providers", color: "#D2BBFF" },
  { id: "omdb", label: "Movies (OMDb)", color: "#FFB68E" },
  { id: "books", label: "Books (OpenLib)", color: "#C5C6C8" },
  { id: "tenrai-anime", label: "Anime (Tenrai)", color: "#D2BBFF" },
  { id: "tenrai-manga", label: "Manga (Tenrai)", color: "#D2BBFF" },
  { id: "igdb", label: "Games (IGDB)", color: "#FFDBC9" },
] as const satisfies readonly {
  id: AdapterId | "all";
  label: string;
  color: string;
}[];

type Props = {
  visible: boolean;
  onClose: () => void;
  onImport: (result: CatalogResult) => void;
};

type AdapterId = keyof typeof catalogAdapters;

export function LookupImportScreen({ visible, onClose, onImport }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AdapterId | "all">("all");
  const [queryAttempted, setQueryAttempted] = useState(false);
  const [results, setResults] = useState<CatalogResult[]>([]);
  const [selected, setSelected] = useState<CatalogResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const lastQuery = useRef("");
  const adapterCursors = useRef<Partial<Record<AdapterId, string>>>({});
  const cancel = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setLoading(false);
  };
  useEffect(() => {
    if (!visible) requestRef.current?.abort();
    return () => requestRef.current?.abort();
  }, [visible]);

  const search = async (nextPage = 1) => {
    if (!query.trim()) return;
    cancel();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    setQueryAttempted(true);
    setSelected(null);
    if (nextPage === 1) {
      setResults([]);
      setHasMore(false);
      lastQuery.current = query.trim();
      adapterCursors.current = {};
    }
    try {
      const ids = filters.flatMap(({ id }) =>
        id !== "all" &&
        (filter === "all" || filter === id) &&
        (nextPage === 1 || adapterCursors.current[id] !== undefined)
          ? [id]
          : [],
      );
      const responses = await Promise.allSettled(
        ids.map((id) =>
          catalogAdapters[id].search({
            query: lastQuery.current,
            cursor: adapterCursors.current[id],
            signal: controller.signal,
          }),
        ),
      );
      if (controller.signal.aborted) return;
      const collected: CatalogResult[] = [];
      const errors: string[] = [];
      for (const [index, response] of responses.entries()) {
        const id = ids[index];
        if (response.status === "rejected") {
          delete adapterCursors.current[id];
          errors.push(
            response.reason instanceof Error
              ? response.reason.message
              : "Provider lookup failed.",
          );
          continue;
        }
        const data = response.value;
        adapterCursors.current[id] = data.nextCursor;
        collected.push(...data.results);
      }
      setResults((current) => [
        ...new Map(
          [...(nextPage === 1 ? [] : current), ...collected].map((item) => [
            item.id,
            item,
          ]),
        ).values(),
      ]);
      setHasMore(
        Object.values(adapterCursors.current).some(
          (cursor) => cursor !== undefined,
        ),
      );
      setError(errors.join("\n"));
      setPage(nextPage);
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

  const select = async (result: CatalogResult) => {
    cancel();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    setSelected(null);
    try {
      const adapter = Object.values(catalogAdapters).find(
        (candidate) => candidate.id === result.adapterId,
      );
      if (!adapter)
        throw new Error("Could not find a catalog provider for this title.");
      const details = await adapter.details(result, controller.signal);
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
                  cancel();
                  setResults([]);
                  setSelected(null);
                  setError("");
                  setHasMore(false);
                  setQuery(value);
                  setQueryAttempted(false);
                }}
                placeholder="Search title, author, ISBN, or IMDb ID…"
                placeholderTextColor={palette.faint}
                style={styles.lookupSearchInput}
                accessibilityLabel="Media query"
                returnKeyType="search"
                onSubmitEditing={() => void search()}
              />
              {query ? (
                <Pressable
                  onPress={() => {
                    cancel();
                    setResults([]);
                    setSelected(null);
                    setError("");
                    setHasMore(false);
                    setQuery("");
                    setQueryAttempted(false);
                  }}
                  style={styles.lookupClear}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <Icon name="x" size={18} color={palette.muted} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => void search()}
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
                    cancel();
                    setFilter(item.id);
                    setResults([]);
                    setSelected(null);
                    setQueryAttempted(false);
                    setError("");
                    setHasMore(false);
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
                    : "Search movies, books, anime, manga & games"}
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
            {!loading && hasMore && page < 100 && results.length > 0 ? (
              <Pressable
                onPress={() => void search(page + 1)}
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
                  Library, movies with your OMDb key, or games with your
                  personal IGDB/Twitch credentials. Google Books fallback uses
                  your saved Books key. Manual entry is always available.
                </Text>
              </View>
            ) : null}
            <Pressable
              onPress={() => void Linking.openURL("https://www.omdbapi.com/")}
              accessibilityRole="link"
            >
              <Text style={styles.lookupManualText}>
                Movie data from OMDb · CC BY-NC 4.0
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
