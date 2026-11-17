import { Pressable, ScrollView, Text, View } from "react-native";
import { Cover } from "../components/MediaUI";
import { Icon } from "../components/Icon";
import { type CustomList, LIST_ACCENT_COLOR, type MediaEntry } from "../model";
import { styles } from "../styles";

type Props = {
  lists: CustomList[];
  entries: MediaEntry[];
  onCreatePress: () => void;
  onOpen: (list: CustomList) => void;
  onDelete: (list: CustomList) => void;
};

export function ListsScreen({
  lists,
  entries,
  onCreatePress,
  onOpen,
  onDelete,
}: Props) {
  return (
    <>
      <View style={styles.listSectionHeading}>
        <View style={styles.listSectionLabelRow}>
          <Text style={styles.listSectionTitle}>Your lists</Text>
          <Text style={styles.listCountBadge}>{lists.length}</Text>
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
      <ScrollView
        style={styles.libraryScroll}
        contentContainerStyle={styles.listsBody}
        showsVerticalScrollIndicator={false}
      >
        {lists.length ? (
          lists.map((list) => {
            const members = entries.filter((entry) =>
              entry.listIds.includes(list.id),
            );
            const previews = members.slice(0, 4);
            const extraCount = Math.max(0, members.length - previews.length);
            return (
              <View key={list.id} style={styles.collectionCard}>
                <View style={styles.collectionTopRow}>
                  <Pressable
                    onPress={() => onOpen(list)}
                    style={styles.collectionMain}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${list.name}, ${members.length} ${members.length === 1 ? "title" : "titles"}`}
                  >
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
                      {members.length}{" "}
                      {members.length === 1 ? "title" : "titles"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onDelete(list)}
                    style={styles.listAction}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${list.name}`}
                  >
                    <Text style={styles.listActionMark}>⋮</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onOpen(list)}
                    style={styles.listArrowTouch}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${list.name}`}
                  >
                    <Text style={styles.listArrow}>›</Text>
                  </Pressable>
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
                  <Pressable
                    onPress={() => onOpen(list)}
                    style={styles.listEmptyHint}
                    accessibilityRole="button"
                  >
                    <Text style={styles.listEmptyText}>
                      Add titles from their details
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.listEmptyState}>
            <Text style={styles.listEmptyTitle}>No lists yet</Text>
            <Text style={styles.listEmptyText}>
              Create a list, then add titles from their details.
            </Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}
