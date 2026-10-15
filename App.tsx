import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  createJournalEntry,
  createList,
  database,
  deleteList,
  getEntries,
  getJournal,
  getLists,
  removeEntry,
  saveEntry,
} from "./src/database";
import {
  CREATOR_ROLE,
  emptyDraft,
  MEDIA_TYPES,
  STATUSES,
  TYPE_COLOR,
  type CustomList,
  type EntryDraft,
  type JournalEntry,
  type MediaEntry,
  type MediaStatus,
  type MediaType,
} from "./src/model";

const palette = {
  background: "#F2F0F7",
  surface: "#FFFFFF",
  ink: "#28243B",
  muted: "#777487",
  faint: "#A8A5B4",
  line: "#E5E2EB",
  violet: "#5847CE",
  violetWash: "#EAE7FA",
  green: "#477861",
  red: "#A94D5D",
};

type MainTab = "library" | "lists";
type Layout = "cards" | "rows";

function AppBody() {
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<MediaEntry[]>([]);
  const [lists, setLists] = useState<CustomList[]>([]);
  const [tab, setTab] = useState<MainTab>("library");
  const [layout, setLayout] = useState<Layout>("cards");
  const [typeFilter, setTypeFilter] = useState<MediaType | "All">("All");
  const [statusFilter, setStatusFilter] = useState<MediaStatus | "All">("All");
  const [listFilter, setListFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editorVisible, setEditorVisible] = useState(false);
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft());
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [journalDraft, setJournalDraft] = useState("");
  const [newListName, setNewListName] = useState("");

  const refresh = async () => {
    const [nextEntries, nextLists] = await Promise.all([getEntries(), getLists()]);
    setEntries(nextEntries);
    setLists(nextLists);
  };

  useEffect(() => {
    void (async () => {
      try {
        await database();
        await refresh();
        setReady(true);
      } catch {
        Alert.alert("Library unavailable", "Rocket could not open its local library. Restart the app and try again.");
      }
    })();
  }, []);

  const selectedList = lists.find((list) => list.id === listFilter);
  const shownEntries = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return entries.filter((entry) => {
      if (typeFilter !== "All" && entry.type !== typeFilter) return false;
      if (statusFilter !== "All" && entry.status !== statusFilter) return false;
      if (listFilter && !entry.listIds.includes(listFilter)) return false;
      const words = [entry.title, ...entry.alternateTitles, entry.creator].join(" ").toLocaleLowerCase();
      return !term || words.includes(term);
    });
  }, [entries, typeFilter, statusFilter, listFilter, search]);

  const openEditor = (entry?: MediaEntry) => {
    setDraft(entry ? { ...entry } : emptyDraft());
    setJournal([]);
    setJournalDraft("");
    if (entry) void getJournal(entry.id).then(setJournal);
    setEditorVisible(true);
  };

  const setValue = <K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const saveCurrentEntry = async () => {
    if (!draft.title.trim()) {
      Alert.alert("Add a title", "Every library entry needs a title.");
      return;
    }
    if (draft.releaseYear !== null && (!Number.isInteger(draft.releaseYear) || draft.releaseYear < 1 || draft.releaseYear > 9999)) {
      Alert.alert("Check the year", "Enter a year between 1 and 9999.");
      return;
    }
    try {
      const entryId = await saveEntry(draft);
      if (journalDraft.trim()) await createJournalEntry(entryId, journalDraft);
      await refresh();
      setEditorVisible(false);
    } catch {
      Alert.alert("Could not save entry", "Try saving again.");
    }
  };

  const addCustomList = async () => {
    const name = newListName.trim();
    if (!name) return;
    try {
      await createList(name);
      setNewListName("");
      await refresh();
    } catch {
      Alert.alert("List already exists", "Choose another name for this list.");
    }
  };

  const confirmDeleteEntry = () => {
    if (!draft.id) return;
    Alert.alert("Remove this entry?", "Its note, list memberships, and journal entries will also be removed.", [
      { text: "Keep entry", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => void removeEntry(draft.id!).then(refresh).then(() => setEditorVisible(false)) },
    ]);
  };

  const confirmDeleteList = (list: CustomList) => {
    Alert.alert("Remove this list?", `Entries will stay in your library, but will be removed from “${list.name}”.`, [
      { text: "Keep list", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => void deleteList(list.id).then(refresh) },
    ]);
  };

  if (!ready) {
    return (
      <SafeAreaView style={styles.loading}>
        <Text style={styles.wordmark}>rocket</Text>
        <Text style={styles.loadingText}>Opening your library…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="dark" backgroundColor={palette.background} />
      <View style={styles.topBar}>
        <View>
          <Text style={styles.wordmark}>rocket</Text>
          <Text style={styles.tagline}>Your own little archive</Text>
        </View>
        {tab === "library" ? (
          <Pressable onPress={() => openEditor()} style={styles.addButton} accessibilityRole="button" accessibilityLabel="Add a title">
            <Text style={styles.addGlyph}>＋</Text>
          </Pressable>
        ) : null}
      </View>

      {tab === "library" ? (
        <>
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.screenTitle}>{selectedList?.name ?? "My library"}</Text>
              <Text style={styles.countText}>{shownEntries.length} {shownEntries.length === 1 ? "title" : "titles"}</Text>
            </View>
            <View style={styles.viewToggle}>
              <ToggleButton label="Cards" mark="▦" active={layout === "cards"} onPress={() => setLayout("cards")} />
              <ToggleButton label="Rows" mark="☰" active={layout === "rows"} onPress={() => setLayout("rows")} />
            </View>
          </View>
          <View style={styles.searchBox}>
            <Text style={styles.searchMark}>⌕</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search your titles"
              placeholderTextColor={palette.faint}
              style={styles.searchInput}
              returnKeyType="search"
              accessibilityLabel="Search titles"
            />
            {search ? <Pressable onPress={() => setSearch("")}><Text style={styles.searchClear}>×</Text></Pressable> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
            {(["All", ...MEDIA_TYPES] as const).map((type) => <Chip key={type} label={type} selected={typeFilter === type} onPress={() => setTypeFilter(type)} />)}
          </ScrollView>
          {listFilter ? (
            <Pressable style={styles.listFilter} onPress={() => setListFilter(null)}>
              <Text style={styles.listFilterText}>From {selectedList?.name}</Text><Text style={styles.listFilterClear}>Clear ×</Text>
            </Pressable>
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRail, styles.statusRail]}>
            {(["All", ...STATUSES] as const).map((status) => <Chip key={status} label={status} selected={statusFilter === status} onPress={() => setStatusFilter(status)} compact />)}
          </ScrollView>
          <ScrollView style={styles.libraryScroll} contentContainerStyle={styles.libraryBody} showsVerticalScrollIndicator={false}>
            {shownEntries.length ? layout === "cards" ? (
              <View style={styles.cardGrid}>{shownEntries.map((entry) => <MediaCard key={entry.id} entry={entry} onPress={() => openEditor(entry)} />)}</View>
            ) : shownEntries.map((entry) => <MediaRow key={entry.id} entry={entry} onPress={() => openEditor(entry)} />) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyMark}><Text style={styles.emptyMarkText}>✳</Text></View>
                <Text style={styles.emptyTitle}>{entries.length ? "No titles in this view" : "Your archive starts here"}</Text>
                <Text style={styles.emptyBody}>{entries.length ? "Try a different filter or search." : "Add the books, films, games, manga, and anime you want to keep track of."}</Text>
                {!entries.length ? <Pressable style={styles.primaryButton} onPress={() => openEditor()}><Text style={styles.primaryButtonText}>Add your first title</Text></Pressable> : null}
              </View>
            )}
          </ScrollView>
        </>
      ) : (
        <>
          <View style={styles.titleRow}>
            <View><Text style={styles.screenTitle}>Your lists</Text><Text style={styles.countText}>Collections you make</Text></View>
          </View>
          <View style={styles.newListRow}>
            <TextInput
              value={newListName}
              onChangeText={setNewListName}
              placeholder="Name a list"
              placeholderTextColor={palette.faint}
              style={styles.newListInput}
              onSubmitEditing={() => void addCustomList()}
              returnKeyType="done"
            />
            <Pressable onPress={() => void addCustomList()} disabled={!newListName.trim()} style={[styles.createButton, !newListName.trim() && styles.disabledButton]}>
              <Text style={styles.createButtonText}>Create</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.listsBody} showsVerticalScrollIndicator={false}>
            {lists.length ? lists.map((list, index) => {
              const count = entries.filter((entry) => entry.listIds.includes(list.id)).length;
              return (
                <View key={list.id} style={styles.listTile}>
                  <Pressable style={styles.listMain} onPress={() => { setListFilter(list.id); setTab("library"); }}>
                    <View style={[styles.listIcon, { backgroundColor: index % 2 ? "#F5E5ED" : palette.violetWash }]}>
                      <Text style={[styles.listIconText, { color: index % 2 ? "#A74F7C" : palette.violet }]}>↗</Text>
                    </View>
                    <View style={styles.listInfo}>
                      <Text style={styles.listName}>{list.name}</Text>
                      <Text style={styles.listCount}>{count} {count === 1 ? "title" : "titles"}</Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                  <Pressable onPress={() => confirmDeleteList(list)} style={styles.listDelete} accessibilityRole="button" accessibilityLabel={`Delete ${list.name}`}>
                    <Text style={styles.listDeleteText}>×</Text>
                  </Pressable>
                </View>
              );
            }) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyMark}><Text style={styles.emptyMarkText}>＋</Text></View>
                <Text style={styles.emptyTitle}>A list for anything</Text>
                <Text style={styles.emptyBody}>Make a collection above, then add titles to it from their details.</Text>
              </View>
            )}
          </ScrollView>
        </>
      )}

      <View style={styles.bottomBar}>
        <BottomTab label="Library" mark="▦" active={tab === "library"} onPress={() => setTab("library")} />
        <BottomTab label="Lists" mark="▤" active={tab === "lists"} onPress={() => setTab("lists")} />
      </View>

      <Modal visible={editorVisible} animationType="slide" onRequestClose={() => setEditorVisible(false)}>
        <SafeAreaView style={styles.modalSafe} edges={["top", "bottom"]}>
          <KeyboardAvoidingView style={styles.modalContent} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.modalHeader}>
              <Pressable style={styles.closeButton} onPress={() => setEditorVisible(false)} accessibilityLabel="Close entry editor"><Text style={styles.closeText}>×</Text></Pressable>
              <Text style={styles.modalTitle}>{draft.id ? "Title details" : "Add a title"}</Text>
              <Pressable onPress={() => void saveCurrentEntry()}><Text style={styles.saveText}>Save</Text></Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Media type</Text>
              <View style={styles.chipWrap}>{MEDIA_TYPES.map((type) => <Chip key={type} label={type} selected={draft.type === type} onPress={() => setValue("type", type)} />)}</View>

              <FormField label="Title" value={draft.title} onChangeText={(value) => setValue("title", value)} placeholder="What is it called?" />
              <FormField label="Alternate titles" value={draft.alternateTitles.join(", ")} onChangeText={(value) => setValue("alternateTitles", value.split(",").map((title) => title.trim()).filter(Boolean))} placeholder="Comma-separated" />
              <FormField label="Cover image URL" value={draft.coverUri} onChangeText={(value) => setValue("coverUri", value)} placeholder="https://…" autoCapitalize="none" />
              {draft.coverUri ? <View style={styles.coverPreview}><Cover uri={draft.coverUri} type={draft.type} large /></View> : null}
              <FormField label={CREATOR_ROLE[draft.type]} value={draft.creator} onChangeText={(value) => setValue("creator", value)} placeholder="Creator name" />
              <FormField label="Year of release" value={draft.releaseYear == null ? "" : String(draft.releaseYear)} onChangeText={(value) => setValue("releaseYear", value.trim() ? Number(value) : null)} placeholder="e.g. 2024" keyboardType="number-pad" />
              <FormField label="Summary" value={draft.summary} onChangeText={(value) => setValue("summary", value)} placeholder="A short description" multiline />

              <Text style={[styles.fieldLabel, styles.sectionLabel]}>Status</Text>
              <View style={styles.chipWrap}>{STATUSES.map((status) => <Chip key={status} label={status} selected={draft.status === status} onPress={() => setValue("status", status)} compact />)}</View>

              <FormField label="Your note" value={draft.note} onChangeText={(value) => setValue("note", value)} placeholder="A note that stays with this title" multiline />

              <Text style={[styles.fieldLabel, styles.sectionLabel]}>Your lists</Text>
              {lists.length ? (
                <View style={styles.chipWrap}>{lists.map((list) => {
                  const selected = draft.listIds.includes(list.id);
                  return <Chip key={list.id} label={`${selected ? "✓  " : ""}${list.name}`} selected={selected} onPress={() => setValue("listIds", selected ? draft.listIds.filter((id) => id !== list.id) : [...draft.listIds, list.id])} />;
                })}</View>
              ) : <Text style={styles.helperText}>Create a list from the Lists tab.</Text>}

              {draft.id ? (
                <>
                  <Text style={[styles.fieldLabel, styles.sectionLabel]}>Journal</Text>
                  <Text style={styles.helperText}>Dated thoughts stay separate from your note.</Text>
                  <TextInput value={journalDraft} onChangeText={setJournalDraft} placeholder="Write a thought…" placeholderTextColor={palette.faint} style={[styles.input, styles.multiline, styles.journalInput]} multiline textAlignVertical="top" />
                  {journal.length ? journal.map((entry) => (
                    <View key={entry.id} style={styles.journalItem}>
                      <Text style={styles.journalDate}>{new Date(entry.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</Text>
                      <Text style={styles.journalBody}>{entry.body}</Text>
                    </View>
                  )) : <Text style={styles.helperText}>Your journal is empty.</Text>}
                </>
              ) : <Text style={[styles.helperText, styles.journalHint]}>Save the title to start its journal.</Text>}

              {draft.id ? <Pressable style={styles.removeButton} onPress={confirmDeleteEntry}><Text style={styles.removeButtonText}>Remove title</Text></Pressable> : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Chip({ label, selected, onPress, compact = false }: { label: string; selected: boolean; onPress: () => void; compact?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, compact && styles.chipCompact, selected && styles.chipSelected]}>
      <Text style={[styles.chipLabel, compact && styles.chipLabelCompact, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: "number-pad";
  autoCapitalize?: "none" | "sentences";
}) {
  return (
    <View style={styles.formField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.faint}
        style={[styles.input, multiline && styles.multiline]}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "sentences"}
      />
    </View>
  );
}

function Cover({ uri, type, large = false }: { uri: string; type: MediaType; large?: boolean }) {
  const [failed, setFailed] = useState("");
  if (uri && uri !== failed) {
    return <Image source={{ uri }} style={[styles.cover, large && styles.coverLarge]} resizeMode="cover" onError={() => setFailed(uri)} />;
  }
  const symbol = type === "Movie" ? "◉" : type === "Book" ? "▤" : type === "Game" ? "✣" : type === "Manga" ? "▧" : "✳";
  return (
    <View style={[styles.coverFallback, { backgroundColor: `${TYPE_COLOR[type]}18` }, large && styles.coverLarge]}>
      <Text style={[styles.coverSymbol, { color: TYPE_COLOR[type] }]}>{symbol}</Text>
      <Text style={[styles.coverType, { color: TYPE_COLOR[type] }]}>{type}</Text>
    </View>
  );
}

function MediaCard({ entry, onPress }: { entry: MediaEntry; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.mediaCard}>
      <View style={styles.mediaCover}>
        <Cover uri={entry.coverUri} type={entry.type} />
        <View style={[styles.statusPill, entry.status === "Completed" && styles.statusDone, entry.status === "Revisiting" && styles.statusRevisiting]}>
          <Text style={[styles.statusPillText, entry.status === "Completed" && styles.statusDoneText, entry.status === "Revisiting" && styles.statusRevisitingText]}>{entry.status}</Text>
        </View>
      </View>
      <View style={styles.mediaCaption}>
        <Text style={styles.mediaTitle} numberOfLines={2}>{entry.title}</Text>
        <Text style={styles.mediaMeta} numberOfLines={1}>{entry.type}{entry.releaseYear ? `  /  ${entry.releaseYear}` : ""}</Text>
      </View>
    </Pressable>
  );
}

function MediaRow({ entry, onPress }: { entry: MediaEntry; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.mediaRow}>
      <View style={styles.rowCover}><Cover uri={entry.coverUri} type={entry.type} /></View>
      <View style={styles.rowDetails}>
        <Text style={styles.rowTitle} numberOfLines={1}>{entry.title}</Text>
        <Text style={styles.rowMeta}>{entry.type}{entry.releaseYear ? `  ·  ${entry.releaseYear}` : ""}</Text>
        <Text style={styles.rowStatus}>{entry.status}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function ToggleButton({ label, mark, active, onPress }: { label: string; mark: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.toggleButton, active && styles.toggleActive]} accessibilityRole="button" accessibilityLabel={label}><Text style={[styles.toggleMark, active && styles.toggleMarkActive]}>{mark}</Text></Pressable>;
}

function BottomTab({ label, mark, active, onPress }: { label: string; mark: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.bottomTab} accessibilityRole="tab" accessibilityState={{ selected: active }}>
      <Text style={[styles.bottomTabMark, active && styles.bottomTabMarkActive]}>{mark}</Text>
      <Text style={[styles.bottomTabLabel, active && styles.bottomTabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  return <SafeAreaProvider><AppBody /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  loading: { flex: 1, backgroundColor: palette.background, alignItems: "center", justifyContent: "center" },
  loadingText: { color: palette.muted, marginTop: 8, fontSize: 13 },
  topBar: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  wordmark: { color: palette.violet, fontSize: 20, fontWeight: "900", letterSpacing: -1.1 },
  tagline: { color: palette.muted, fontSize: 12, marginTop: 1 },
  addButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: palette.violet, alignItems: "center", justifyContent: "center" },
  addGlyph: { color: palette.surface, fontSize: 26, lineHeight: 30, marginTop: -2 },
  titleRow: { paddingHorizontal: 22, marginBottom: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  titleBlock: { flex: 1 },
  screenTitle: { color: palette.ink, fontSize: 27, letterSpacing: -0.9, fontWeight: "800" },
  countText: { color: palette.muted, fontSize: 13, marginTop: 3 },
  viewToggle: { flexDirection: "row", padding: 3, borderRadius: 12, backgroundColor: "#E7E4ED" },
  toggleButton: { width: 34, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 9 },
  toggleActive: { backgroundColor: palette.surface },
  toggleMark: { color: palette.muted, fontSize: 18 },
  toggleMarkActive: { color: palette.violet },
  searchBox: { height: 48, marginHorizontal: 22, paddingHorizontal: 13, backgroundColor: palette.surface, borderWidth: 1, borderColor: "#EBE9F0", borderRadius: 15, flexDirection: "row", alignItems: "center" },
  searchMark: { color: palette.muted, fontSize: 23, marginRight: 9, transform: [{ rotate: "-20deg" }] },
  searchInput: { flex: 1, height: "100%", color: palette.ink, fontSize: 14 },
  searchClear: { color: palette.muted, fontSize: 23, paddingHorizontal: 4 },
  chipRail: { gap: 8, alignItems: "center", paddingHorizontal: 22, paddingTop: 13, paddingBottom: 8 },
  statusRail: { paddingTop: 5, paddingBottom: 10 },
  chip: { height: 34, paddingHorizontal: 14, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  chipCompact: { height: 30, paddingHorizontal: 12, borderRadius: 10 },
  chipSelected: { backgroundColor: palette.violet, borderColor: palette.violet },
  chipLabel: { color: palette.muted, fontSize: 13, fontWeight: "600" },
  chipLabelCompact: { fontSize: 11 },
  chipLabelSelected: { color: palette.surface },
  listFilter: { marginHorizontal: 22, marginTop: 4, marginBottom: 2, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: palette.violetWash, flexDirection: "row", justifyContent: "space-between" },
  listFilterText: { color: palette.ink, fontSize: 12, fontWeight: "600" },
  listFilterClear: { color: palette.violet, fontSize: 12, fontWeight: "700" },
  libraryScroll: { flex: 1 },
  libraryBody: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 22, flexGrow: 1 },
  cardGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 16 },
  mediaCard: { width: "48.3%", marginBottom: 3 },
  mediaCover: { height: 218, borderRadius: 16, overflow: "hidden", backgroundColor: palette.surface, position: "relative" },
  cover: { width: "100%", height: "100%", backgroundColor: "#EAE8F0" },
  coverLarge: { width: 112, height: 158, borderRadius: 12 },
  coverFallback: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  coverSymbol: { fontSize: 39, fontWeight: "300" },
  coverType: { fontSize: 11, marginTop: 5, fontWeight: "700" },
  statusPill: { position: "absolute", left: 8, bottom: 8, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.95)" },
  statusDone: { backgroundColor: "#E6F0E9" },
  statusRevisiting: { backgroundColor: "#EEE9FF" },
  statusPillText: { color: palette.ink, fontSize: 10, fontWeight: "700" },
  statusDoneText: { color: palette.green },
  statusRevisitingText: { color: palette.violet },
  mediaCaption: { paddingHorizontal: 3, paddingTop: 9 },
  mediaTitle: { color: palette.ink, fontSize: 15, lineHeight: 19, fontWeight: "700" },
  mediaMeta: { color: palette.muted, fontSize: 11, marginTop: 4 },
  mediaRow: { flexDirection: "row", alignItems: "center", backgroundColor: palette.surface, borderWidth: 1, borderColor: "#EBE9F0", borderRadius: 15, padding: 10, marginBottom: 9, gap: 13 },
  rowCover: { width: 53, height: 67, overflow: "hidden", borderRadius: 9 },
  rowDetails: { flex: 1 },
  rowTitle: { color: palette.ink, fontSize: 15, fontWeight: "700" },
  rowMeta: { color: palette.muted, fontSize: 11, marginTop: 4 },
  rowStatus: { color: palette.violet, fontSize: 11, fontWeight: "700", marginTop: 7 },
  emptyState: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 34, paddingVertical: 52 },
  emptyMark: { width: 70, height: 70, borderRadius: 25, backgroundColor: palette.violetWash, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-7deg" }] },
  emptyMarkText: { color: palette.violet, fontSize: 31, transform: [{ rotate: "7deg" }] },
  emptyTitle: { color: palette.ink, fontSize: 17, fontWeight: "700", marginTop: 20, textAlign: "center" },
  emptyBody: { color: palette.muted, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 7 },
  primaryButton: { marginTop: 20, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, backgroundColor: palette.violet },
  primaryButtonText: { color: palette.surface, fontSize: 13, fontWeight: "700" },
  bottomBar: { height: 64, backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.line, flexDirection: "row", alignItems: "center", justifyContent: "space-evenly" },
  bottomTab: { minWidth: 90, alignItems: "center", justifyContent: "center", gap: 2 },
  bottomTabMark: { color: palette.faint, fontSize: 20, height: 23 },
  bottomTabMarkActive: { color: palette.violet },
  bottomTabLabel: { color: palette.muted, fontSize: 10, fontWeight: "600" },
  bottomTabLabelActive: { color: palette.violet },
  newListRow: { paddingHorizontal: 22, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 9 },
  newListInput: { flex: 1, height: 46, paddingHorizontal: 13, borderRadius: 13, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, color: palette.ink, fontSize: 14 },
  createButton: { height: 44, paddingHorizontal: 15, borderRadius: 12, backgroundColor: palette.violet, alignItems: "center", justifyContent: "center" },
  createButtonText: { color: palette.surface, fontSize: 13, fontWeight: "700" },
  disabledButton: { opacity: 0.45 },
  listsBody: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, flexGrow: 1 },
  listTile: { flexDirection: "row", alignItems: "center", backgroundColor: palette.surface, borderRadius: 16, borderWidth: 1, borderColor: "#EBE9F0", padding: 12, marginBottom: 10 },
  listMain: { flex: 1, flexDirection: "row", alignItems: "center" },
  listIcon: { width: 48, height: 48, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  listIconText: { fontSize: 22 },
  listInfo: { flex: 1, marginLeft: 12 },
  listName: { color: palette.ink, fontSize: 15, fontWeight: "700" },
  listCount: { color: palette.muted, fontSize: 11, marginTop: 4 },
  chevron: { color: palette.faint, fontSize: 25, paddingHorizontal: 5 },
  listDelete: { width: 34, height: 38, alignItems: "center", justifyContent: "center" },
  listDeleteText: { color: palette.faint, fontSize: 23 },
  modalSafe: { flex: 1, backgroundColor: palette.background },
  modalContent: { flex: 1 },
  modalHeader: { height: 58, paddingHorizontal: 20, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  closeButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: palette.background, alignItems: "center", justifyContent: "center" },
  closeText: { color: palette.ink, fontSize: 25, lineHeight: 27 },
  modalTitle: { color: palette.ink, fontSize: 16, fontWeight: "700" },
  saveText: { color: palette.violet, fontSize: 14, fontWeight: "800", padding: 8 },
  form: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 44 },
  formField: { marginTop: 17 },
  fieldLabel: { color: palette.ink, fontSize: 13, fontWeight: "700", marginBottom: 8 },
  input: { minHeight: 48, paddingHorizontal: 13, borderRadius: 13, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, color: palette.ink, fontSize: 14 },
  multiline: { minHeight: 94, paddingTop: 12, lineHeight: 20 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sectionLabel: { marginTop: 23 },
  coverPreview: { alignSelf: "flex-start", marginTop: 10, padding: 7, borderRadius: 15, backgroundColor: palette.surface },
  helperText: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  journalInput: { marginTop: 11, marginBottom: 9 },
  journalHint: { marginTop: 18 },
  journalItem: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: palette.line },
  journalDate: { color: palette.violet, fontSize: 11, fontWeight: "700", marginBottom: 5 },
  journalBody: { color: palette.ink, fontSize: 14, lineHeight: 20 },
  removeButton: { marginTop: 28, marginBottom: 10, paddingVertical: 15, borderRadius: 13, alignItems: "center", borderWidth: 1, borderColor: "#E7CDD2" },
  removeButtonText: { color: palette.red, fontSize: 13, fontWeight: "700" },
});
