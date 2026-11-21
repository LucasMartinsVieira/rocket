import { Pressable, ScrollView, Text, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { Icon } from "../../components/Icon";
import { MediaTypeFilter } from "../../components/MediaTypeFilter";
import { Cover } from "../../components/MediaUI";
import { actionStyles } from "../../components/shared/actions.styles";
import { layoutStyles } from "../../components/shared/layout.styles";
import { mediaStyles } from "../../components/shared/mediaPresentation.styles";
import {
  type CustomList,
  LIST_ACCENT_COLOR,
  type MediaEntry,
  type MediaType,
} from "../../model";
import { styles } from "./styles";

type Props = {
  lists: CustomList[];
  entries: MediaEntry[];
  typeFilter: MediaType | "All";
  setTypeFilter: (value: MediaType | "All") => void;
  onCreatePress: () => void;
  onOpen: (list: CustomList) => void;
  onDelete: (list: CustomList) => void;
  onShowActions: (list: CustomList) => void;
};

export function ListsScreen({
  lists,
  entries,
  typeFilter,
  setTypeFilter,
  onCreatePress,
  onOpen,
  onDelete,
  onShowActions,
}: Props) {
  const reducedMotion = useReducedMotion();
  const visibleLists = lists.filter(
    (list) => typeFilter === "All" || list.type === typeFilter,
  );
  return (
    <>
      <View style={styles.listSectionHeading}>
        <View style={styles.listSectionLabelRow}>
          <Text style={styles.listSectionTitle}>Your lists</Text>
          <Text
            style={styles.listCountBadge}
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${visibleLists.length} lists shown out of ${lists.length}`}
          >
            {visibleLists.length}
          </Text>
        </View>
        <Pressable
          onPress={onCreatePress}
          style={styles.listAddButton}
          accessibilityRole="button"
          accessibilityLabel="Create a list"
        >
          <Text style={styles.listAddButtonText}>＋ New list</Text>
        </Pressable>
      </View>
      <MediaTypeFilter value={typeFilter} onChange={setTypeFilter} />
      <ScrollView
        style={layoutStyles.fill}
        contentContainerStyle={styles.listsBody}
        showsVerticalScrollIndicator={false}
      >
        {visibleLists.length ? (
          visibleLists.map((list) => {
            const members = entries.filter((entry) =>
              entry.listIds.includes(list.id),
            );
            const previews = members.slice(0, 4);
            const extraCount = Math.max(0, members.length - previews.length);
            return (
              <View key={list.id} style={styles.collectionCard}>
                <Pressable
                  onPress={() => onOpen(list)}
                  onLongPress={() => onShowActions(list)}
                  delayLongPress={200}
                  accessibilityHint="Touch and hold for list actions"
                  accessibilityActions={[
                    { name: "showMenu", label: "Show list actions" },
                  ]}
                  onAccessibilityAction={(event) => {
                    if (event.nativeEvent.actionName === "showMenu")
                      onShowActions(list);
                  }}
                  style={({ pressed }) => [
                    styles.collectionOpen,
                    pressed && mediaStyles.entryPressed,
                    pressed && !reducedMotion && mediaStyles.entryPressedMotion,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${list.name}, ${list.type} list, ${members.length} ${members.length === 1 ? "title" : "titles"}`}
                >
                  <View style={styles.collectionTopRow}>
                    <View style={styles.collectionMain}>
                      <View style={styles.collectionNameRow}>
                        <Icon
                          name={list.icon}
                          size={20}
                          color={LIST_ACCENT_COLOR[list.accent]}
                        />
                        <Text style={styles.collectionName} numberOfLines={1}>
                          {list.name}
                        </Text>
                      </View>
                      {list.description ? (
                        <Text
                          style={styles.collectionDescription}
                          numberOfLines={2}
                        >
                          {list.description}
                        </Text>
                      ) : null}
                      <Text style={styles.collectionCount}>
                        {list.type} list · {members.length}{" "}
                        {members.length === 1 ? "title" : "titles"}
                      </Text>
                    </View>
                  </View>
                  {previews.length ? (
                    <View style={styles.listPreviewRow}>
                      {previews.map((entry) => (
                        <View key={entry.id} style={styles.listPreviewCover}>
                          <Cover
                            uri={entry.coverUri}
                            type={entry.type}
                            title={entry.title}
                          />
                        </View>
                      ))}
                      {extraCount ? (
                        <View style={styles.listMoreTile}>
                          <Text style={styles.listMoreText}>+{extraCount}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <View style={styles.listEmptyHint}>
                      <Text style={styles.listEmptyText}>
                        Add titles from their details
                      </Text>
                    </View>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => onDelete(list)}
                  style={[styles.listAction, styles.collectionAction]}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${list.name}`}
                >
                  <Text style={styles.listActionMark}>⋮</Text>
                </Pressable>
              </View>
            );
          })
        ) : (
          <View style={styles.listEmptyState}>
            <Text style={styles.listEmptyTitle}>
              {lists.length ? "No lists in this view" : "No lists yet"}
            </Text>
            <Text style={styles.listEmptyText}>
              {lists.length
                ? "Choose another media type or clear the filter."
                : "Create a list, then add titles from their details."}
            </Text>
            {typeFilter !== "All" ? (
              <Pressable
                onPress={() => setTypeFilter("All")}
                style={actionStyles.quietAction}
                accessibilityRole="button"
                accessibilityLabel="Clear list filters"
              >
                <Text style={actionStyles.quietActionText}>Clear filters</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
    </>
  );
}
