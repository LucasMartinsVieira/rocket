import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "./src/components/Icon";
import { BottomTab, isUsableImageUrl } from "./src/components/MediaUI";
import {
  createJournalEntry,
  createList,
  database,
  deleteList,
  getEntries,
  getJournal,
  getListEntryIds,
  getLists,
  removeEntry,
  reorderListEntries,
  saveEntry,
  setEntryListMembership,
} from "./src/database";
import {
  CREATOR_ROLE,
  type CustomList,
  type EntryDraft,
  emptyDraft,
  type JournalEntry,
  type ListAccent,
  type MediaEntry,
  type MediaStatus,
  type MediaType,
} from "./src/model";
import { CreateListScreen } from "./src/screens/CreateListScreen";
import { EntryDetailsModal, EntryFormModal } from "./src/screens/EntryModals";
import { LibraryScreen } from "./src/screens/LibraryScreen";
import { ListsScreen } from "./src/screens/ListsScreen";
import { ListViewScreen } from "./src/screens/ListViewScreen";
import { ProviderIntegrationsScreen } from "./src/screens/ProviderIntegrationsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { styles } from "./src/styles";
import { palette } from "./src/theme";

type Layout = "covers" | "table";
type MainTab = "library" | "lists";

function AppBody() {
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<MediaEntry[]>([]);
  const [lists, setLists] = useState<CustomList[]>([]);
  const [listEntryOrder, setListEntryOrder] = useState<
    Record<string, string[]>
  >({});
  const [tab, setTab] = useState<MainTab>("library");
  const [creatingList, setCreatingList] = useState(false);
  const [viewingListId, setViewingListId] = useState<string | null>(null);
  const [settingsPage, setSettingsPage] = useState<
    "settings" | "providers" | null
  >(null);
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
    const [nextEntries, nextLists] = await Promise.all([
      getEntries(),
      getLists(),
    ]);
    const orderPairs = await Promise.all(
      nextLists.map(
        async (list) => [list.id, await getListEntryIds(list.id)] as const,
      ),
    );
    setEntries(nextEntries);
    setLists(nextLists);
    setListEntryOrder(Object.fromEntries(orderPairs));
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

  const viewingList = lists.find((list) => list.id === viewingListId);

  const createCustomList = async (
    name: string,
    description: string,
    accent: ListAccent,
    entryIds: string[],
  ) => {
    try {
      await createList(name, description, accent, entryIds);
      await refresh();
      return null;
    } catch (error) {
      return error instanceof Error && /unique|constraint/i.test(error.message)
        ? "A list with this name already exists."
        : "Could not create the list. Try again.";
    }
  };

  const confirmDeleteList = (list: CustomList) => {
    Alert.alert(
      `Delete “${list.name}”?`,
      "Titles stay in your library. They will only be removed from this list.",
      [
        { text: "Keep list", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            void deleteList(list.id)
              .then(async () => {
                if (viewingListId === list.id) setViewingListId(null);
                await refresh();
              })
              .catch(() => Alert.alert("Could not delete list", "Try again.")),
        },
      ],
    );
  };

  const changeListMembership = async (
    mediaId: string,
    listId: string,
    included: boolean,
  ) => {
    try {
      await setEntryListMembership(mediaId, listId, included);
      setDetailEntry((current) => {
        if (!current || current.id !== mediaId) return current;
        return {
          ...current,
          listIds: included
            ? [...new Set([...current.listIds, listId])]
            : current.listIds.filter((id) => id !== listId),
        };
      });
      await refresh();
    } catch {
      Alert.alert(
        "Could not update list",
        "Try changing this title’s list membership again.",
      );
    }
  };

  const confirmRemoveFromList = (list: CustomList, entry: MediaEntry) => {
    Alert.alert(
      `Remove “${entry.title}” from this list?`,
      "The title, note, and journal stay in your library.",
      [
        { text: "Keep title", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => void changeListMembership(entry.id, list.id, false),
        },
      ],
    );
  };

  const saveListOrder = async (listId: string, orderedIds: string[]) => {
    setListEntryOrder((current) => ({ ...current, [listId]: orderedIds }));
    try {
      await reorderListEntries(listId, orderedIds);
    } catch {
      Alert.alert(
        "Could not reorder titles",
        "Your previous order has been restored.",
      );
      await refresh();
    }
  };

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
    const entryId = draft.id;
    Alert.alert(
      "Remove this entry?",
      "Its note, list memberships, and journal entries will also be removed.",
      [
        { text: "Keep entry", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            void removeEntry(entryId)
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
          {settingsPage ? (
            <View style={styles.createListTopRow}>
              <Pressable
                onPress={() =>
                  setSettingsPage(
                    settingsPage === "providers" ? "settings" : null,
                  )
                }
                style={styles.createListBack}
                accessibilityRole="button"
                accessibilityLabel={
                  settingsPage === "providers"
                    ? "Back to settings"
                    : "Back to library"
                }
              >
                <Icon name="chevronLeft" size={22} color={palette.ink} />
              </Pressable>
              <Text style={styles.screenTitle}>
                {settingsPage === "providers"
                  ? "Provider Integrations"
                  : "Settings"}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.wordmark}>ROCKET</Text>
              {viewingList ? (
                <View style={styles.createListTopRow}>
                  <Pressable
                    onPress={() => setViewingListId(null)}
                    style={styles.createListBack}
                    accessibilityRole="button"
                    accessibilityLabel="Back to lists"
                  >
                    <Icon name="chevronLeft" size={22} color={palette.ink} />
                  </Pressable>
                  <Text style={styles.screenTitle}>Lists</Text>
                </View>
              ) : creatingList ? (
                <View style={styles.createListTopRow}>
                  <Pressable
                    onPress={() => setCreatingList(false)}
                    style={styles.createListBack}
                    accessibilityRole="button"
                    accessibilityLabel="Back to lists"
                  >
                    <Icon name="chevronLeft" size={22} color={palette.ink} />
                  </Pressable>
                  <Text style={styles.screenTitle}>New list</Text>
                </View>
              ) : (
                <Text style={styles.screenTitle}>
                  {tab === "lists" ? "Lists" : "Library"}
                </Text>
              )}
            </>
          )}
        </View>
        {!settingsPage && !creatingList && !viewingList ? (
          <Pressable
            onPress={() => setSettingsPage("settings")}
            style={styles.settingsHeaderButton}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            {/* <View style={styles.settingsAvatarIcon}> */}
            {/*   <View style={styles.settingsAvatarHead} /> */}
            {/*   <View style={styles.settingsAvatarBody} /> */}
            {/* </View> */}

            <Icon name="settingsAlt" size={22} color={palette.background} />
          </Pressable>
        ) : null}
      </View>
      {settingsPage === "providers" ? (
        <ProviderIntegrationsScreen />
      ) : settingsPage === "settings" ? (
        <SettingsScreen
          onOpenProviderIntegrations={() => setSettingsPage("providers")}
        />
      ) : tab === "library" ? (
        <>
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
          <Pressable
            onPress={() => openEditor()}
            style={styles.floatingAdd}
            accessibilityRole="button"
            accessibilityLabel="Add title"
          >
            <Text style={styles.floatingAddText}>＋ Add title</Text>
          </Pressable>
        </>
      ) : creatingList ? (
        <CreateListScreen
          entries={entries}
          lists={lists}
          onCreate={createCustomList}
          onCancel={() => setCreatingList(false)}
        />
      ) : viewingList ? (
        <ListViewScreen
          list={viewingList}
          entries={(() => {
            const members = entries.filter((entry) =>
              entry.listIds.includes(viewingList.id),
            );
            const positions = new Map(
              (listEntryOrder[viewingList.id] ?? []).map((id, index) => [
                id,
                index,
              ]),
            );
            return members.sort(
              (a, b) =>
                (positions.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
                (positions.get(b.id) ?? Number.MAX_SAFE_INTEGER),
            );
          })()}
          allEntries={entries}
          wide={wide}
          onOpenEntry={(entry) => void openDetails(entry)}
          onToggleMembership={(entry, included) =>
            void changeListMembership(entry.id, viewingList.id, included)
          }
          onRemoveMembership={(entry) =>
            confirmRemoveFromList(viewingList, entry)
          }
          onDeleteList={() => confirmDeleteList(viewingList)}
          onReorder={(orderedIds) =>
            void saveListOrder(viewingList.id, orderedIds)
          }
        />
      ) : (
        <ListsScreen
          lists={lists}
          entries={entries}
          onCreatePress={() => setCreatingList(true)}
          onOpen={(list) => {
            setViewingListId(list.id);
          }}
          onDelete={confirmDeleteList}
        />
      )}
      {!creatingList && !viewingList && !settingsPage ? (
        <View style={styles.bottomBar}>
          <BottomTab
            label="LIBRARY"
            icon="library"
            active={tab === "library"}
            onPress={() => setTab("library")}
          />
          <BottomTab
            label="LISTS"
            icon="list"
            active={tab === "lists"}
            onPress={() => setTab("lists")}
          />
        </View>
      ) : null}

      <EntryDetailsModal
        detailEntry={detailEntry}
        onClose={() => setDetailEntry(null)}
        onEdit={openEditor}
        journal={journal}
        journalDraft={journalDraft}
        setJournalDraft={setJournalDraft}
        onChangeStatus={(status) => void changeDetailStatus(status)}
        lists={lists}
        onToggleList={(listId, included) =>
          detailEntry &&
          void changeListMembership(detailEntry.id, listId, included)
        }
        onOpenLists={() => {
          setDetailEntry(null);
          setCreatingList(false);
          setViewingListId(null);
          setTab("lists");
        }}
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
        onChangeType={(type) => {
          setFormError("");
          setDraft((current) => ({
            ...current,
            type,
            creatorRole: CREATOR_ROLE[type],
          }));
        }}
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppBody />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
