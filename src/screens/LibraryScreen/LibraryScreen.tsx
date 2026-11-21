import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Icon } from "../../components/Icon";
import { MediaTypeFilter } from "../../components/MediaTypeFilter";
import {
  MediaCard,
  MediaRow,
  StatusChip,
  ToggleButton,
} from "../../components/MediaUI";
import { layoutStyles } from "../../components/shared/layout.styles";
import {
  type MediaEntry,
  type MediaStatus,
  type MediaType,
  STATUSES,
} from "../../model";
import { palette } from "../../theme";
import { styles } from "./styles";

type Layout = "covers" | "table";

type Props = {
  entries: MediaEntry[];
  totalCount: number;
  hasAnyEntries: boolean;
  layout: Layout;
  setLayout: (layout: Layout) => void;
  search: string;
  setSearch: (value: string) => void;
  typeFilter: MediaType | "All";
  setTypeFilter: (value: MediaType | "All") => void;
  statusFilter: MediaStatus | "All";
  setStatusFilter: (value: MediaStatus | "All") => void;
  wide: boolean;
  onOpen: (entry: MediaEntry) => void;
  onShowActions: (entry: MediaEntry) => void;
};

const statusLabels: Record<MediaStatus | "All", string> = {
  All: "All statuses",
  Planned: "Planned",
  "In Progress": "In Progress",
  Completed: "Completed",
  Paused: "Paused",
  Dropped: "Dropped",
  Revisiting: "Revisiting",
};

export function LibraryScreen({
  entries,
  totalCount,
  hasAnyEntries,
  layout,
  setLayout,
  search,
  setSearch,
  typeFilter,
  setTypeFilter,
  statusFilter,
  setStatusFilter,
  wide,
  onOpen,
  onShowActions,
}: Props) {
  return (
    <>
      <View style={styles.libraryHeading}>
        <View style={styles.libraryTitleLine}>
          <Text style={styles.libraryTitle}>My library</Text>
          <Text style={styles.countText}>
            {totalCount} {totalCount === 1 ? "title" : "titles"}
          </Text>
        </View>
      </View>
      <View style={styles.searchBox}>
        <Icon name="search" size={20} color={palette.faint} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search titles, alternate titles, creators…"
          placeholderTextColor={palette.faint}
          style={styles.searchInput}
          returnKeyType="search"
          accessibilityLabel="Search titles, alternate titles, and creators"
        />
        {search ? (
          <Pressable
            onPress={() => setSearch("")}
            style={styles.iconTouch}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Icon name="x" size={18} color={palette.faint} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.libraryTools}>
        <View style={styles.viewToggle}>
          <ToggleButton
            label="Covers"
            mark="grid"
            active={layout === "covers"}
            onPress={() => setLayout("covers")}
          />
          <ToggleButton
            label="Table"
            mark="list"
            active={layout === "table"}
            onPress={() => setLayout("table")}
          />
        </View>
      </View>
      <MediaTypeFilter value={typeFilter} onChange={setTypeFilter} />
      <ScrollView
        horizontal
        style={layoutStyles.horizontalFilterRail}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={layoutStyles.chipRail}
      >
        {(["All", ...STATUSES] as const).map((status) => (
          <StatusChip
            key={status}
            label={statusLabels[status]}
            status={status === "All" ? null : status}
            selected={statusFilter === status}
            onPress={() => setStatusFilter(status)}
          />
        ))}
      </ScrollView>
      <ScrollView
        style={layoutStyles.fill}
        contentContainerStyle={styles.libraryBody}
        showsVerticalScrollIndicator={false}
      >
        {entries.length ? (
          layout === "covers" ? (
            <View style={[styles.cardGrid, wide && layoutStyles.wideGrid]}>
              {entries.map((entry) => (
                <MediaCard
                  key={entry.id}
                  entry={entry}
                  wide={wide}
                  onPress={() => onOpen(entry)}
                  onLongPress={() => onShowActions(entry)}
                />
              ))}
            </View>
          ) : (
            <>
              {wide ? (
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeading, styles.tableTitle]}>
                    Title
                  </Text>
                  <Text style={styles.tableHeading}>Type</Text>
                  <Text style={styles.tableHeading}>Year</Text>
                  <Text style={styles.tableHeading}>Status</Text>
                </View>
              ) : null}
              {entries.map((entry) => (
                <MediaRow
                  key={entry.id}
                  entry={entry}
                  wide={wide}
                  onPress={() => onOpen(entry)}
                  onLongPress={() => onShowActions(entry)}
                />
              ))}
            </>
          )
        ) : (
          <View style={styles.emptyState}>
            <Text style={layoutStyles.emptyTitle}>
              {hasAnyEntries
                ? "No titles in this view"
                : "Your library starts here"}
            </Text>
            <Text style={layoutStyles.emptyBody}>
              {hasAnyEntries
                ? "Try another search or filter."
                : "Add a title to start your personal shelf."}
            </Text>
            {hasAnyEntries ? (
              <Pressable
                style={styles.secondaryButton}
                onPress={() => {
                  setSearch("");
                  setTypeFilter("All");
                  setStatusFilter("All");
                }}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryButtonText}>Clear filters</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
    </>
  );
}
