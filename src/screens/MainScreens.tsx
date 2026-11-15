import type { Dispatch, SetStateAction } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Chip, MediaCard, MediaRow, ToggleButton } from "../components/MediaUI";
import { palette } from "../theme";
import { styles } from "../styles";
import { MEDIA_TYPES, STATUSES, type CustomList, type MediaEntry, type MediaStatus, type MediaType } from "../model";

type Layout = "covers" | "table";

type LibraryScreenProps = {
  selectedList?: CustomList;
  shownEntries: MediaEntry[];
  layout: Layout;
  setLayout: (layout: Layout) => void;
  search: string;
  setSearch: (value: string) => void;
  typeFilter: MediaType | "All";
  setTypeFilter: (value: MediaType | "All") => void;
  listFilter: string | null;
  setListFilter: (value: string | null) => void;
  statusFilter: MediaStatus | "All";
  setStatusFilter: (value: MediaStatus | "All") => void;
  entries: MediaEntry[];
  wide: boolean;
  openDetails: (entry: MediaEntry) => void;
  openEditor: (entry?: MediaEntry) => void;
};

export function LibraryScreen(props: LibraryScreenProps) {
  const {
    selectedList, shownEntries, layout, setLayout, search, setSearch,
    typeFilter, setTypeFilter, listFilter, setListFilter, statusFilter,
    setStatusFilter, entries, wide, openDetails, openEditor,
  } = props;

  return <>
    <View style={styles.titleRow}>
      <View style={styles.titleBlock}>
        <Text style={styles.screenTitle}>{selectedList?.name ?? "My library"}</Text>
        <Text style={styles.countText}>{shownEntries.length} {shownEntries.length === 1 ? "title" : "titles"}</Text>
      </View>
      <View style={styles.viewToggle}>
        <ToggleButton label="Covers" mark="Covers" active={layout === "covers"} onPress={() => setLayout("covers")} />
        <ToggleButton label="Table" mark="Table" active={layout === "table"} onPress={() => setLayout("table")} />
      </View>
    </View>
    <View style={styles.searchBox}>
      <Text style={styles.searchMark}>⌕</Text>
      <TextInput value={search} onChangeText={setSearch} placeholder="Search your titles" placeholderTextColor={palette.faint} style={styles.searchInput} returnKeyType="search" accessibilityLabel="Search titles" />
      {search ? <Pressable onPress={() => setSearch("")} style={styles.iconTouch} accessibilityRole="button" accessibilityLabel="Clear search"><Text style={styles.searchClear}>×</Text></Pressable> : null}
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
      {(["All", ...MEDIA_TYPES] as const).map((type) => <Chip key={type} label={type} selected={typeFilter === type} onPress={() => setTypeFilter(type)} />)}
    </ScrollView>
    {listFilter ? <Pressable style={styles.listFilter} onPress={() => setListFilter(null)} accessibilityRole="button" accessibilityLabel="Clear list filter"><Text style={styles.listFilterText}>From {selectedList?.name}</Text><Text style={styles.listFilterClear}>Clear ×</Text></Pressable> : null}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRail, styles.statusRail]}>
      {(["All", ...STATUSES] as const).map((status) => <Chip key={status} label={status} selected={statusFilter === status} onPress={() => setStatusFilter(status)} compact />)}
    </ScrollView>
    <ScrollView style={styles.libraryScroll} contentContainerStyle={styles.libraryBody} showsVerticalScrollIndicator={false}>
      {shownEntries.length ? layout === "covers" ? <View style={[styles.cardGrid, wide && styles.wideGrid]}>{shownEntries.map((entry) => <MediaCard key={entry.id} entry={entry} wide={wide} onPress={() => openDetails(entry)} />)}</View> : <>
        {wide ? <View style={styles.tableHeader}><Text style={[styles.tableHeading, styles.tableTitle]}>Title</Text><Text style={styles.tableHeading}>Type</Text><Text style={styles.tableHeading}>Year</Text><Text style={styles.tableHeading}>Status</Text></View> : null}
        {shownEntries.map((entry) => <MediaRow key={entry.id} entry={entry} wide={wide} onPress={() => openDetails(entry)} />)}
      </> : <View style={styles.emptyState}>
        <View style={styles.emptyMark}><Text style={styles.emptyMarkText}>✳</Text></View>
        <Text style={styles.emptyTitle}>{entries.length ? "No titles in this view" : "Your archive starts here"}</Text>
        <Text style={styles.emptyBody}>{entries.length ? "Try a different filter or search." : "Add the books, films, games, manga, and anime you want to keep track of."}</Text>
        {entries.length ? <Pressable style={styles.primaryButton} onPress={() => { setSearch(""); setTypeFilter("All"); setStatusFilter("All"); setListFilter(null); }} accessibilityRole="button"><Text style={styles.primaryButtonText}>Clear filters</Text></Pressable> : <Pressable style={styles.primaryButton} onPress={() => openEditor()} accessibilityRole="button"><Text style={styles.primaryButtonText}>Add your first title</Text></Pressable>}
      </View>}
    </ScrollView>
  </>;
}

type ListsScreenProps = {
  newListName: string;
  setNewListName: Dispatch<SetStateAction<string>>;
  addCustomList: () => void;
  listError: string;
  lists: CustomList[];
  entries: MediaEntry[];
  openList: (id: string) => void;
  confirmDeleteList: (list: CustomList) => void;
};

export function ListsScreen({ newListName, setNewListName, addCustomList, listError, lists, entries, openList, confirmDeleteList }: ListsScreenProps) {
  return <>
    <View style={styles.titleRow}><View><Text style={styles.screenTitle}>Your lists</Text><Text style={styles.countText}>Collections you make</Text></View></View>
    <View style={styles.newListRow}>
      <TextInput value={newListName} onChangeText={setNewListName} placeholder="Name a list" placeholderTextColor={palette.faint} style={styles.newListInput} onSubmitEditing={addCustomList} returnKeyType="done" accessibilityLabel="New list name" />
      <Pressable onPress={addCustomList} disabled={!newListName.trim()} style={[styles.createButton, !newListName.trim() && styles.disabledButton]} accessibilityRole="button"><Text style={styles.createButtonText}>Create</Text></Pressable>
    </View>
    {listError ? <Text style={styles.errorText}>{listError}</Text> : null}
    <ScrollView contentContainerStyle={styles.listsBody} showsVerticalScrollIndicator={false}>
      {lists.length ? lists.map((list) => {
        const count = entries.filter((entry) => entry.listIds.includes(list.id)).length;
        return <View key={list.id} style={styles.listTile}>
          <Pressable style={styles.listMain} onPress={() => openList(list.id)} accessibilityRole="button" accessibilityLabel={`Open ${list.name}, ${count} ${count === 1 ? "title" : "titles"}`}>
            <View style={styles.listIcon}><Text style={styles.listIconText}>↗</Text></View>
            <View style={styles.listInfo}><Text style={styles.listName}>{list.name}</Text><Text style={styles.listCount}>{count} {count === 1 ? "title" : "titles"}</Text></View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable onPress={() => confirmDeleteList(list)} style={styles.listDelete} accessibilityRole="button" accessibilityLabel={`Remove list ${list.name}`}><Text style={styles.listDeleteText}>×</Text></Pressable>
        </View>;
      }) : <View style={styles.emptyState}><View style={styles.emptyMark}><Text style={styles.emptyMarkText}>＋</Text></View><Text style={styles.emptyTitle}>A list for anything</Text><Text style={styles.emptyBody}>Make a collection above, then add titles to it from their details.</Text></View>}
    </ScrollView>
  </>;
}
