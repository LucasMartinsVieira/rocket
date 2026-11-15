import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { palette } from "./src/theme";
import { styles } from "./src/styles";
import { BottomTab, isUsableImageUrl } from "./src/components/MediaUI";
import { EntryDetailsModal, EntryFormModal } from "./src/screens/EntryModals";
import { LibraryScreen, ListsScreen } from "./src/screens/MainScreens";
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
  type CustomList,
  type EntryDraft,
  type JournalEntry,
  type MediaEntry,
  type MediaStatus,
  type MediaType,
} from "./src/model";

type MainTab = "library" | "lists";
type Layout = "covers" | "table";

function AppBody() {
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<MediaEntry[]>([]);
  const [lists, setLists] = useState<CustomList[]>([]);
  const [tab, setTab] = useState<MainTab>("library");
  const [layout, setLayout] = useState<Layout>("covers");
  const [typeFilter, setTypeFilter] = useState<MediaType | "All">("All");
  const [statusFilter, setStatusFilter] = useState<MediaStatus | "All">("All");
  const [listFilter, setListFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editorVisible, setEditorVisible] = useState(false);
  const [detailEntry, setDetailEntry] = useState<MediaEntry | null>(null);
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft());
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [journalDraft, setJournalDraft] = useState("");
  const [newListName, setNewListName] = useState("");
  const [listError, setListError] = useState("");
  const [databaseError, setDatabaseError] = useState("");
  const [formError, setFormError] = useState("");
  const { width } = useWindowDimensions();
  const wide = width >= 720;

  const refresh = async () => {
    const [nextEntries, nextLists] = await Promise.all([
      getEntries(),
      getLists(),
    ]);
    setEntries(nextEntries);
    setLists(nextLists);
  };

  const initialize = async () => {
    setDatabaseError("");
    try {
      await database();
      await refresh();
      setReady(true);
    } catch {
      setDatabaseError(
        "Rocket could not open its local library. Check device storage, then try again.",
      );
      setReady(true);
    }
  };

  useEffect(() => {
    void initialize();
  }, []);

  const selectedList = lists.find((list) => list.id === listFilter);
  const shownEntries = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return entries.filter((entry) => {
      if (typeFilter !== "All" && entry.type !== typeFilter) return false;
      if (statusFilter !== "All" && entry.status !== statusFilter) return false;
      if (listFilter && !entry.listIds.includes(listFilter)) return false;
      const words = [entry.title, ...entry.alternateTitles, entry.creator]
        .join(" ")
        .toLocaleLowerCase();
      return !term || words.includes(term);
    });
  }, [entries, typeFilter, statusFilter, listFilter, search]);

  const openEditor = (entry?: MediaEntry) => {
    setDetailEntry(null);
    setFormError("");
    setDraft(entry ? { ...entry } : emptyDraft());
    setJournal([]);
    setJournalDraft("");
    if (entry) void getJournal(entry.id).then(setJournal);
    setEditorVisible(true);
  };

  const openDetails = async (entry: MediaEntry) => {
    setDetailEntry(entry);
    setJournalDraft("");
    setJournal(await getJournal(entry.id));
  };

  const changeDetailStatus = async (status: MediaStatus) => {
    if (!detailEntry) return;
    const updated = { ...detailEntry, status };
    try {
      await saveEntry(updated);
      setDetailEntry(updated);
      await refresh();
    } catch {
      Alert.alert("Could not update status", "Try changing the status again.");
    }
  };

  const addJournalEntry = async () => {
    if (!detailEntry || !journalDraft.trim()) return;
    try {
      await createJournalEntry(detailEntry.id, journalDraft);
      setJournal(await getJournal(detailEntry.id));
      setJournalDraft("");
    } catch {
      Alert.alert(
        "Could not save journal entry",
        "Your text is still here. Try again.",
      );
    }
  };

  const setValue = <K extends keyof EntryDraft>(
    key: K,
    value: EntryDraft[K],
  ) => {
    setFormError("");
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const saveCurrentEntry = async () => {
    if (!draft.title.trim()) {
      setFormError("Enter a title to save this entry.");
      return;
    }
    if (
      draft.releaseYear !== null &&
      (!Number.isInteger(draft.releaseYear) ||
        draft.releaseYear < 1 ||
        draft.releaseYear > 9999)
    ) {
      setFormError("Enter a year from 1 to 9999, or leave year blank.");
      return;
    }
    if (draft.coverUri.trim() && !isUsableImageUrl(draft.coverUri.trim())) {
      setFormError("Cover URL must start with http:// or https://.");
      return;
    }
    setFormError("");
    try {
      const entryId = await saveEntry(draft);
      if (journalDraft.trim()) await createJournalEntry(entryId, journalDraft);
      await refresh();
      setEditorVisible(false);
    } catch {
      setFormError(
        "Could not save entry. Your edits are still here; try again.",
      );
    }
  };

  const addCustomList = async () => {
    const name = newListName.trim();
    if (!name) return;
    try {
      await createList(name);
      setNewListName("");
      setListError("");
      await refresh();
    } catch (error) {
      setListError(
        error instanceof Error && /unique|constraint/i.test(error.message)
          ? "A list with this name already exists. Choose another name."
          : "Could not create list. Your name is still here; try again.",
      );
    }
  };

  const confirmDeleteEntry = () => {
    if (!draft.id) return;
    Alert.alert(
      "Remove this entry?",
      "Its note, list memberships, and journal entries will also be removed.",
      [
        { text: "Keep entry", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            void removeEntry(draft.id!)
              .then(refresh)
              .then(() => setEditorVisible(false))
              .catch(() => Alert.alert("Could not remove title", "Try again.")),
        },
      ],
    );
  };

  const confirmDeleteDetailEntry = () => {
    if (!detailEntry) return;
    Alert.alert(
      "Remove this entry?",
      "Its note, list memberships, and journal entries will also be removed.",
      [
        { text: "Keep entry", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            void removeEntry(detailEntry.id)
              .then(refresh)
              .then(() => setDetailEntry(null))
              .catch(() => Alert.alert("Could not remove title", "Try again.")),
        },
      ],
    );
  };

  const confirmDeleteList = (list: CustomList) => {
    Alert.alert(
      "Remove this list?",
      `Entries will stay in your library, but will be removed from “${list.name}”.`,
      [
        { text: "Keep list", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            void deleteList(list.id)
              .then(() => {
                if (listFilter === list.id) setListFilter(null);
                return refresh();
              })
              .catch(() =>
                Alert.alert(
                  "Could not remove list",
                  "Your titles are unchanged. Try again.",
                ),
              ),
        },
      ],
    );
  };

  if (!ready) {
    return (
      <SafeAreaView style={styles.loading}>
        <Text style={styles.wordmark}>rocket</Text>
        <ActivityIndicator color={palette.violet} style={{ marginTop: 20 }} />
        <Text style={styles.loadingText}>Opening your library…</Text>
      </SafeAreaView>
    );
  }

  if (databaseError)
    return (
      <SafeAreaView style={styles.loading}>
        <Text style={styles.wordmark}>rocket</Text>
        <Text style={styles.emptyTitle}>Library unavailable</Text>
        <Text style={styles.emptyBody}>{databaseError}</Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => void initialize()}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>Try again</Text>
        </Pressable>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <View style={styles.topBar}>
        <View>
          <Text style={styles.wordmark}>rocket</Text>
          <Text style={styles.tagline}>Your own little archive</Text>
        </View>
        {tab === "library" ? <Pressable onPress={() => openEditor()} style={styles.addButton} accessibilityRole="button" accessibilityLabel="Add a title"><Text style={styles.addGlyph}>＋</Text></Pressable> : null}
      </View>
      {tab === "library" ? <LibraryScreen
        selectedList={selectedList}
        shownEntries={shownEntries}
        layout={layout}
        setLayout={setLayout}
        search={search}
        setSearch={setSearch}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        listFilter={listFilter}
        setListFilter={setListFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        entries={entries}
        wide={wide}
        openDetails={(entry) => void openDetails(entry)}
        openEditor={openEditor}
      /> : <ListsScreen
        newListName={newListName}
        setNewListName={setNewListName}
        addCustomList={() => void addCustomList()}
        listError={listError}
        lists={lists}
        entries={entries}
        openList={(id) => { setListFilter(id); setTab("library"); }}
        confirmDeleteList={confirmDeleteList}
      />}

      <View style={styles.bottomBar}>
        <BottomTab
          label="Library"
          mark="▦"
          active={tab === "library"}
          onPress={() => setTab("library")}
        />
        <BottomTab
          label="Lists"
          mark="▤"
          active={tab === "lists"}
          onPress={() => setTab("lists")}
        />
      </View>

      <EntryDetailsModal
        detailEntry={detailEntry}
        onClose={() => setDetailEntry(null)}
        onEdit={openEditor}
        journal={journal}
        journalDraft={journalDraft}
        setJournalDraft={setJournalDraft}
        onChangeStatus={(status) => void changeDetailStatus(status)}
        onAddJournal={() => void addJournalEntry()}
        onRemove={confirmDeleteDetailEntry}
      />
      <EntryFormModal
        visible={editorVisible}
        onClose={() => setEditorVisible(false)}
        onSave={() => void saveCurrentEntry()}
        onDelete={confirmDeleteEntry}
        draft={draft}
        setValue={setValue}
        onChangeType={(type) => { setFormError(""); setDraft((current) => ({ ...current, type, creatorRole: CREATOR_ROLE[type] })); }}
        lists={lists}
        journal={journal}
        journalDraft={journalDraft}
        setJournalDraft={setJournalDraft}
        formError={formError}
      />
    </SafeAreaView>
  );
}


export default function App() {
  return (
    <SafeAreaProvider>
      <AppBody />
    </SafeAreaProvider>
  );
}
