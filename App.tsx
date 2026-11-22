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
import { styles } from "./App.styles";
import { restoredLibrary } from "./src/backup";
import {
  ContextActionSheet,
  type ContextTarget,
} from "./src/components/ContextActionSheet";
import { DeleteConfirmationDialog } from "./src/components/DeleteConfirmationDialog";
import { Icon } from "./src/components/Icon";
import { BottomTab, isUsableImageUrl } from "./src/components/MediaUI";
import { actionStyles } from "./src/components/shared/actions.styles";
import { layoutStyles } from "./src/components/shared/layout.styles";
import {
  type CustomList,
  changeDraftType,
  type EntryDraft,
  emptyDraft,
  entryDateError,
  type JournalEntry,
  type ListAccent,
  type ListIcon,
  type MediaEntry,
  type MediaStatus,
  type MediaType,
} from "./src/model";
import { entryRepository } from "./src/repositories/entryRepository";
import { journalRepository } from "./src/repositories/journalRepository";
import { listRepository } from "./src/repositories/listRepository";
import { BackupRestoreScreen } from "./src/screens/BackupRestoreScreen";
import { CreateListScreen } from "./src/screens/CreateListScreen";
import { CreditsScreen } from "./src/screens/CreditsScreen";
import { EntryDetailsModal, EntryFormModal } from "./src/screens/EntryModals";
import { LibraryScreen } from "./src/screens/LibraryScreen";
import { ListsScreen } from "./src/screens/ListsScreen";
import { ListViewScreen } from "./src/screens/ListViewScreen";
import { ProviderIntegrationsScreen } from "./src/screens/ProviderIntegrationsScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
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
  const [deletingList, setDeletingList] = useState<CustomList | null>(null);
  const [contextSelection, setContextSelection] = useState<{
    kind: "entry" | "list";
    id: string;
  } | null>(null);
  const [settingsPage, setSettingsPage] = useState<
    "settings" | "providers" | "credits" | "backup" | null
  >(null);
  const [layout, setLayout] = useState<Layout>("covers");
  const [typeFilter, setTypeFilter] = useState<MediaType | "All">("All");
  const [listTypeFilter, setListTypeFilter] = useState<MediaType | "All">(
    "All",
  );
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
      entryRepository.list(),
      listRepository.list(),
    ]);
    const orderPairs = await Promise.all(
      nextLists.map(
        async (list) =>
          [list.id, await listRepository.getEntryIds(list.id)] as const,
      ),
    );
    setEntries(nextEntries);
    setLists(nextLists);
    setListEntryOrder(Object.fromEntries(orderPairs));
  };

  const initialize = async () => {
    setDatabaseError("");
    try {
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
  const contextEntry =
    contextSelection?.kind === "entry"
      ? entries.find((entry) => entry.id === contextSelection.id)
      : undefined;
  const contextList =
    contextSelection?.kind === "list"
      ? lists.find((list) => list.id === contextSelection.id)
      : undefined;
  const contextTarget: ContextTarget | null = contextEntry
    ? { kind: "entry", entry: contextEntry }
    : contextList
      ? {
          kind: "list",
          list: contextList,
          count: entries.filter((entry) =>
            entry.listIds.includes(contextList.id),
          ).length,
        }
      : null;

  const createCustomList = async (
    name: string,
    type: MediaType,
    description: string,
    accent: ListAccent,
    entryIds: string[],
    icon: ListIcon,
  ) => {
    try {
      await listRepository.create(
        name,
        type,
        description,
        accent,
        entryIds,
        icon,
      );
      await refresh();
      return null;
    } catch (error) {
      return error instanceof Error && /unique|constraint/i.test(error.message)
        ? "A list with this name already exists."
        : "Could not create the list. Try again.";
    }
  };

  const confirmDeleteList = (list: CustomList) => {
    setDeletingList(list);
  };

  const changeListMembership = async (
    mediaId: string,
    listId: string,
    included: boolean,
  ) => {
    try {
      await listRepository.setMembership(mediaId, listId, included);
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
    } catch (error) {
      Alert.alert(
        "Could not update list",
        error instanceof Error && error.message.startsWith("Only ")
          ? error.message
          : "Try changing this title’s list membership again.",
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
    await listRepository.reorderEntries(listId, orderedIds);
    setListEntryOrder((current) => ({ ...current, [listId]: orderedIds }));
  };

  const openEditor = (entry?: MediaEntry) => {
    setDetailEntry(null);
    setFormError("");
    setDraft(entry ? { ...entry } : emptyDraft());
    setJournal([]);
    setJournalDraft("");
    if (entry) void journalRepository.listForEntry(entry.id).then(setJournal);
    setEditorVisible(true);
  };

  const openDetails = async (entry: MediaEntry) => {
    setDetailEntry(entry);
    setJournalDraft("");
    setJournal(await journalRepository.listForEntry(entry.id));
  };

  const changeDetailStatus = async (status: MediaStatus) => {
    if (!detailEntry) return;
    const id = detailEntry.id;
    try {
      await entryRepository.setStatus(id, status);
      setDetailEntry((current) =>
        current?.id === id ? { ...current, status } : current,
      );
      await refresh();
    } catch {
      Alert.alert("Could not update status", "Try changing the status again.");
    }
  };

  const addJournalEntry = async () => {
    if (!detailEntry || !journalDraft.trim()) return;
    try {
      await journalRepository.create(detailEntry.id, journalDraft);
      setJournal(await journalRepository.listForEntry(detailEntry.id));
      setJournalDraft("");
    } catch {
      Alert.alert(
        "Could not save journal entry",
        "Your text is still here. Try again.",
      );
    }
  };

  const changeDetailRating = async (rating: number | null) => {
    if (!detailEntry) return;
    const id = detailEntry.id;
    try {
      await entryRepository.setRating(id, rating);
      setDetailEntry((current) =>
        current?.id === id ? { ...current, rating } : current,
      );
      await refresh();
    } catch {
      Alert.alert("Could not save rating", "Try again.");
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
    if (
      draft.duration !== null &&
      (!Number.isSafeInteger(draft.duration) || draft.duration <= 0)
    ) {
      setFormError(
        "Duration must be a positive whole number, or leave it blank.",
      );
      return;
    }
    if (draft.coverUri.trim() && !isUsableImageUrl(draft.coverUri.trim())) {
      setFormError("Cover URL must start with http:// or https://.");
      return;
    }
    const dateError = entryDateError(draft.startDate, draft.endDate);
    if (dateError) {
      setFormError(dateError);
      return;
    }
    setFormError("");
    try {
      const entryId = await entryRepository.save(draft);
      if (journalDraft.trim())
        await journalRepository.create(entryId, journalDraft);
      await refresh();
      setEditorVisible(false);
    } catch {
      setFormError(
        "Could not save entry. Your edits are still here; try again.",
      );
    }
  };

  const deleteCurrentEntry = async () => {
    if (!draft.id) return;
    const entryId = draft.id;
    await entryRepository.remove(entryId);
    await refresh();
    setEditorVisible(false);
  };

  const deleteDetailEntry = async () => {
    if (!detailEntry) return;
    await entryRepository.remove(detailEntry.id);
    await refresh();
    setDetailEntry(null);
  };

  if (!ready) {
    return (
      <SafeAreaView style={styles.loading}>
        <Text style={styles.wordmark}>rocket</Text>
        <ActivityIndicator
          color={palette.violet}
          style={styles.loadingIndicator}
        />
        <Text style={styles.loadingText}>Opening your library…</Text>
      </SafeAreaView>
    );
  }

  if (databaseError)
    return (
      <SafeAreaView style={styles.loading}>
        <Text style={styles.wordmark}>rocket</Text>
        <Text style={layoutStyles.emptyTitle}>Library unavailable</Text>
        <Text style={layoutStyles.emptyBody}>{databaseError}</Text>
        <Pressable
          style={actionStyles.primaryButton}
          onPress={() => void initialize()}
          accessibilityRole="button"
        >
          <Text style={actionStyles.primaryButtonText}>Try again</Text>
        </Pressable>
      </SafeAreaView>
    );

  if (settingsPage === "backup") {
    return (
      <>
        <StatusBar style="light" />
        <BackupRestoreScreen
          titleCount={entries.length}
          listCount={lists.length}
          onBack={() => setSettingsPage("settings")}
          onLibrary={() => {
            setTab("library");
            setSearch("");
            setTypeFilter("All");
            setStatusFilter("All");
            setSettingsPage(null);
          }}
          onRestored={(backup) => {
            const library = restoredLibrary(backup);
            setEntries(library.entries);
            setLists(library.lists);
            setListEntryOrder(library.order);
            setDetailEntry(null);
            setEditorVisible(false);
            setCreatingList(false);
            setViewingListId(null);
            setDeletingList(null);
            setContextSelection(null);
            setDraft(emptyDraft());
            setJournal([]);
            setJournalDraft("");
            setFormError("");
          }}
        />
      </>
    );
  }

  return (
    <SafeAreaView style={layoutStyles.screen} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <View style={styles.topBar}>
        <View>
          {settingsPage ? (
            <View style={styles.createListTopRow}>
              <Pressable
                onPress={() =>
                  setSettingsPage(
                    settingsPage !== "settings" ? "settings" : null,
                  )
                }
                style={styles.createListBack}
                accessibilityRole="button"
                accessibilityLabel={
                  settingsPage !== "settings"
                    ? "Back to settings"
                    : "Back to library"
                }
              >
                <Icon name="chevronLeft" size={22} color={palette.ink} />
              </Pressable>
              <Text style={styles.screenTitle}>
                {settingsPage === "providers"
                  ? "Provider Integrations"
                  : settingsPage === "credits"
                    ? "Credits"
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
            <Icon name="settingsAlt" size={22} color={palette.background} />
          </Pressable>
        ) : null}
      </View>
      {settingsPage === "providers" ? (
        <ProviderIntegrationsScreen />
      ) : settingsPage === "credits" ? (
        <CreditsScreen />
      ) : settingsPage === "settings" ? (
        <SettingsScreen
          onOpenProviderIntegrations={() => setSettingsPage("providers")}
          onOpenCredits={() => setSettingsPage("credits")}
          onOpenBackup={() => setSettingsPage("backup")}
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
            onShowActions={(entry) =>
              setContextSelection({ kind: "entry", id: entry.id })
            }
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
          onShowEntryActions={(entry) =>
            setContextSelection({ kind: "entry", id: entry.id })
          }
          onToggleMembership={(entry, included) =>
            void changeListMembership(entry.id, viewingList.id, included)
          }
          onRemoveMembership={(entry) =>
            confirmRemoveFromList(viewingList, entry)
          }
          onDeleteList={() => confirmDeleteList(viewingList)}
          onReorder={(orderedIds) => saveListOrder(viewingList.id, orderedIds)}
          onChangeAccent={async (accent) => {
            await listRepository.setAccent(viewingList.id, accent);
            setLists((current) =>
              current.map((list) =>
                list.id === viewingList.id ? { ...list, accent } : list,
              ),
            );
          }}
          onChangeIcon={async (icon) => {
            try {
              await listRepository.setIcon(viewingList.id, icon);
              await refresh();
            } catch {
              Alert.alert("Could not change icon", "Try again.");
            }
          }}
        />
      ) : (
        <ListsScreen
          lists={lists}
          entries={entries}
          typeFilter={listTypeFilter}
          setTypeFilter={setListTypeFilter}
          onCreatePress={() => setCreatingList(true)}
          onOpen={(list) => {
            setViewingListId(list.id);
          }}
          onDelete={confirmDeleteList}
          onShowActions={(list) =>
            setContextSelection({ kind: "list", id: list.id })
          }
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
        onChangeRating={changeDetailRating}
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
        onRemove={deleteDetailEntry}
      />
      <EntryFormModal
        visible={editorVisible}
        onClose={() => setEditorVisible(false)}
        onSave={() => void saveCurrentEntry()}
        onDelete={deleteCurrentEntry}
        draft={draft}
        setValue={setValue}
        onChangeType={(type) => {
          setFormError("");
          setDraft((current) => changeDraftType(current, type, lists));
        }}
        journal={journal}
        journalDraft={journalDraft}
        setJournalDraft={setJournalDraft}
        formError={formError}
      />
      {deletingList ? (
        <DeleteConfirmationDialog
          visible
          target={{
            kind: "list",
            list: deletingList,
            count: entries.filter((entry) =>
              entry.listIds.includes(deletingList.id),
            ).length,
          }}
          onCancel={() => setDeletingList(null)}
          onConfirm={async () => {
            await listRepository.remove(deletingList.id);
            await refresh();
            if (viewingListId === deletingList.id) setViewingListId(null);
          }}
        />
      ) : null}
      {contextTarget ? (
        <ContextActionSheet
          key={`${contextSelection!.kind}:${contextSelection!.id}`}
          target={contextTarget}
          lists={lists}
          onClose={() => setContextSelection(null)}
          onOpen={() => {
            setContextSelection(null);
            if (contextEntry) void openDetails(contextEntry);
            else if (contextList) setViewingListId(contextList.id);
          }}
          onChangeStatus={async (status) => {
            if (!contextEntry) return;
            await entryRepository.setStatus(contextEntry.id, status);
            await refresh();
          }}
          onToggleMembership={async (listId, included) => {
            if (!contextEntry) return;
            await listRepository.setMembership(
              contextEntry.id,
              listId,
              included,
            );
            await refresh();
          }}
          onDuplicate={async () => {
            if (!contextList) return;
            await listRepository.duplicate(contextList.id);
            await refresh();
          }}
          onDelete={async () => {
            if (contextEntry) await entryRepository.remove(contextEntry.id);
            else if (contextList) await listRepository.remove(contextList.id);
            await refresh();
          }}
        />
      ) : null}
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
