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
import type { CatalogResult } from "../catalog";
import { Icon } from "../components/Icon";
import { Cover } from "../components/MediaUI";
import { getProviderCredential } from "../providerCredentials";
import { omdb } from "../providers/omdb";
import { igdb } from "../providers/igdb";
import { searchTenrai, tenraiDetails } from "../providers/tenrai";
import { searchBooks, bookDetails, type BookSource } from "../providers/books";
import { styles } from "../styles";
import { palette } from "../theme";

const filters = [
  { label: "All Providers", color: "#D2BBFF" },
  { label: "Movies (OMDb)", color: "#FFB68E" },
  { label: "Books (OpenLib)", color: "#C5C6C8" },
  { label: "Anime (Tenrai)", color: "#D2BBFF" },
  { label: "Manga (Tenrai)", color: "#D2BBFF" },
  { label: "Games (IGDB)", color: "#FFDBC9" },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onImport: (result: CatalogResult) => void;
};

export function LookupImportScreen({ visible, onClose, onImport }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All Providers");
  const [queryAttempted, setQueryAttempted] = useState(false);
  const [results, setResults] = useState<CatalogResult[]>([]);
  const [selected, setSelected] = useState<CatalogResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const requestRef = useRef<AbortController | null>(null);
  const lastQuery = useRef("");
  const bookSource = useRef<BookSource | undefined>(undefined);
  const providerTotals = useRef({
    movies: Infinity,
    books: Infinity,
    anime: Infinity,
    manga: Infinity,
    games: Infinity,
  });
  const supportsMovies =
    filter === "All Providers" || filter === "Movies (OMDb)";
  const supportsBooks =
    filter === "All Providers" || filter === "Books (OpenLib)";
  const supportsAnime =
    filter === "All Providers" || filter === "Anime (Tenrai)";
  const supportsManga =
    filter === "All Providers" || filter === "Manga (Tenrai)";
  const supportsGames = filter === "All Providers" || filter === "Games (IGDB)";
  const supportsLookup =
    supportsMovies ||
    supportsBooks ||
    supportsAnime ||
    supportsManga ||
    supportsGames;
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
    if (!query.trim() || !supportsLookup) return;
    cancel();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    setQueryAttempted(true);
    setSelected(null);
    if (nextPage === 1) {
      setResults([]);
      setTotal(0);
      lastQuery.current = query.trim();
      bookSource.current = undefined;
      providerTotals.current = {
        movies: Infinity,
        books: Infinity,
        anime: Infinity,
        manga: Infinity,
        games: Infinity,
      };
    }
    try {
      const tasks = [];
      const taskKinds: ("movies" | "books" | "anime" | "manga" | "games")[] =
        [];
      if (
        supportsMovies &&
        (nextPage - 1) * 10 < providerTotals.current.movies
      ) {
        taskKinds.push("movies");
        tasks.push(
          (async () => {
            const key = await getProviderCredential("omdb");
            if (controller.signal.aborted) throw new Error("Cancelled");
            const data = await omdb.search(
              lastQuery.current,
              key ?? "",
              nextPage,
              controller.signal,
            );
            return { ...data, kind: "movies" as const };
          })(),
        );
      }
      if (supportsBooks && (nextPage - 1) * 10 < providerTotals.current.books) {
        taskKinds.push("books");
        tasks.push(
          (async () => {
            const key = await getProviderCredential("books").catch(() => null);
            if (controller.signal.aborted) throw new Error("Cancelled");
            const data = await searchBooks(
              lastQuery.current,
              key ?? "",
              nextPage,
              controller.signal,
              bookSource.current,
            );
            return { ...data, kind: "books" as const };
          })(),
        );
      }
      for (const kind of ["anime", "manga"] as const) {
        const enabled = kind === "anime" ? supportsAnime : supportsManga;
        if (enabled && (nextPage - 1) * 10 < providerTotals.current[kind]) {
          taskKinds.push(kind);
          tasks.push(
            searchTenrai(
              lastQuery.current,
              kind,
              nextPage,
              controller.signal,
            ).then((data) => ({ ...data, kind })),
          );
        }
      }
      if (supportsGames && (nextPage - 1) * 10 < providerTotals.current.games) {
        taskKinds.push("games");
        tasks.push(
          (async () => {
            const key = await getProviderCredential("igdb");
            if (controller.signal.aborted) throw new Error("Lookup cancelled.");
            return {
              ...(await igdb.search(
                lastQuery.current,
                key ?? "",
                nextPage,
                controller.signal,
              )),
              kind: "games" as const,
            };
          })(),
        );
      }
      const responses = await Promise.allSettled(tasks);
      if (controller.signal.aborted) return;
      const collected: CatalogResult[] = [];
      const errors: string[] = [];
      for (const [index, response] of responses.entries()) {
        if (response.status === "rejected") {
          providerTotals.current[taskKinds[index]] = (nextPage - 1) * 10;
          errors.push(
            response.reason instanceof Error
              ? response.reason.message
              : "Provider lookup failed.",
          );
          continue;
        }
        const data = response.value;
        providerTotals.current[data.kind] = data.results.length
          ? data.total
          : (nextPage - 1) * 10;
        if (data.kind === "books" && "source" in data)
          bookSource.current = data.source;
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
      setTotal(
        (supportsMovies && Number.isFinite(providerTotals.current.movies)
          ? providerTotals.current.movies
          : 0) +
          (supportsBooks && Number.isFinite(providerTotals.current.books)
            ? providerTotals.current.books
            : 0) +
          (supportsAnime && Number.isFinite(providerTotals.current.anime)
            ? providerTotals.current.anime
            : 0) +
          (supportsManga && Number.isFinite(providerTotals.current.manga)
            ? providerTotals.current.manga
            : 0) +
          (supportsGames && Number.isFinite(providerTotals.current.games)
            ? providerTotals.current.games
            : 0),
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
      const isTenrai = result.type === "Anime" || result.type === "Manga";
      const key = isTenrai
        ? null
        : await getProviderCredential(
            result.type === "Book"
              ? "books"
              : result.type === "Game"
                ? "igdb"
                : "omdb",
          ).catch(() => null);
      if (controller.signal.aborted) return;
      const details = isTenrai
        ? await tenraiDetails(result.id, controller.signal)
        : result.type === "Book"
          ? await bookDetails(result, key ?? "", controller.signal)
          : result.type === "Game"
            ? await igdb.details(result.id, key ?? "", controller.signal)
            : await omdb.details(result.id, key ?? "", controller.signal);
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
      <SafeAreaView style={styles.modalSafe} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.modalContent}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.lookupHeader}>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
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
            style={styles.libraryScroll}
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
                  setTotal(0);
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
                    setTotal(0);
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
                disabled={!query.trim() || loading || !supportsLookup}
                style={[
                  styles.lookupQueryButton,
                  (!query.trim() || loading || !supportsLookup) &&
                    styles.disabledButton,
                ]}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: !query.trim() || loading || !supportsLookup,
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
                  key={item.label}
                  onPress={() => {
                    cancel();
                    setFilter(item.label);
                    setResults([]);
                    setSelected(null);
                    setQueryAttempted(false);
                    setError("");
                    setTotal(0);
                  }}
                  style={[
                    styles.lookupFilter,
                    filter === item.label && styles.lookupFilterSelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === item.label }}
                >
                  <View
                    style={[styles.statusDot, { backgroundColor: item.color }]}
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
              <Text style={styles.errorText} accessibilityRole="alert">
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
            {!loading &&
            results.length < total &&
            page < 100 &&
            results.length > 0 ? (
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
                  {!supportsLookup
                    ? "This provider is coming later"
                    : queryAttempted
                      ? error
                        ? "Lookup could not complete"
                        : "No matching titles"
                      : "Find your next library title"}
                </Text>
                <Text
                  style={styles.lookupEmptyCopy}
                  accessibilityLiveRegion="polite"
                >
                  {!supportsLookup
                    ? "Choose a provider or enter manually."
                    : "Search anime and manga through Tenrai, books through Open Library, movies with your OMDb key, or games with your personal IGDB/Twitch credentials. Google Books fallback uses your saved Books key. Manual entry is always available."}
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
                (!selected || loading) && styles.disabledButton,
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
