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
import { isUsableImageUrl } from "./src/components/MediaUI";
import { EntryDetailsModal, EntryFormModal } from "./src/screens/EntryModals";
import { LibraryScreen } from "./src/screens/LibraryScreen";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  createJournalEntry,
  database,
  getEntries,
  getJournal,
  removeEntry,
  saveEntry,
} from "./src/database";
import { CREATOR_ROLE, emptyDraft, type EntryDraft, type JournalEntry, type MediaEntry, type MediaStatus, type MediaType } from "./src/model";

type Layout = "covers" | "table";

function AppBody() {
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<MediaEntry[]>([]);
  const [layout, setLayout] = useState<Layout>("covers");
  const [typeFilter, setTypeFilter] = useState<MediaType | "All">("All");
  const [statusFilter, setStatusFilter] = useState<MediaStatus | "All">("All");
  const [search, setSearch] = useState("");
  const [editorVisible, setEditorVisible] = useState(false);
  const [detailEntry, setDetailEntry] = useState<MediaEntry | null>(null);
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft());
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [journalDraft, setJournalDraft] = useState("");
  const [databaseError, setDatabaseError] = useState("");
  const [formError, setFormError] = useState("");
  const { width } = useWindowDimensions();
  const wide = width >= 720;

  const refresh = async () => {
    setEntries(await getEntries());
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

  const shownEntries = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return entries.filter((entry) => {
      if (typeFilter !== "All" && entry.type !== typeFilter) return false;
      if (statusFilter !== "All" && entry.status !== statusFilter) return false;
      const words = [entry.title, ...entry.alternateTitles, entry.creator]
        .join(" ")
        .toLocaleLowerCase();
      return !term || words.includes(term);
    });
  }, [entries, typeFilter, statusFilter, search]);

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
          <Text style={styles.wordmark}>ROCKET</Text>
          <Text style={styles.screenTitle}>Library</Text>
        </View>
      </View>
      <LibraryScreen
        entries={shownEntries}
        totalCount={entries.length}
        hasAnyEntries={entries.length > 0}
        layout={layout}
        setLayout={setLayout}
        search={search}
        setSearch={setSearch}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        wide={wide}
        onOpen={(entry) => void openDetails(entry)}
        onAdd={openEditor}
      />
      <Pressable onPress={() => openEditor()} style={styles.floatingAdd} accessibilityRole="button" accessibilityLabel="Add title">
        <Text style={styles.floatingAddText}>＋  Add title</Text>
      </Pressable>

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
