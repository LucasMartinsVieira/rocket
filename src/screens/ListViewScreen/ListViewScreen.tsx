import type { ElementRef, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useReducedMotion } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "../../components/Icon";
import { ListIconPicker } from "../../components/ListIconPicker";
import { Cover, statusColor } from "../../components/MediaUI";
import { actionStyles } from "../../components/shared/actions.styles";
import { dialogStyles } from "../../components/shared/dialog.styles";
import { formStyles } from "../../components/shared/form.styles";
import { layoutStyles } from "../../components/shared/layout.styles";
import { mediaStyles } from "../../components/shared/mediaPresentation.styles";
import {
  type CustomList,
  LIST_ACCENT_COLOR,
  type ListIcon,
  type MediaEntry,
  type MediaType,
} from "../../model";
import { palette } from "../../theme";
import { pickerStyles } from "../shared/listEntryPicker.styles";
import { styles } from "./styles";

type Props = {
  list: CustomList;
  entries: MediaEntry[];
  allEntries: MediaEntry[];
  wide: boolean;
  onOpenEntry: (entry: MediaEntry) => void;
  onShowEntryActions: (entry: MediaEntry) => void;
  onToggleMembership: (entry: MediaEntry, included: boolean) => void;
  onRemoveMembership: (entry: MediaEntry) => void;
  onDeleteList: () => void;
  onReorder: (entryIds: string[]) => void;
  onChangeIcon: (icon: ListIcon) => Promise<void>;
};

type Layout = "covers" | "table";

const typeNames: Record<MediaType, string> = {
  Anime: "Anime",
  Manga: "Manga",
  Movie: "Movies",
  Book: "Books",
  Game: "Games",
};

export function ListViewScreen({
  list,
  entries,
  allEntries,
  wide,
  onOpenEntry,
  onShowEntryActions,
  onToggleMembership,
  onRemoveMembership,
  onDeleteList,
  onReorder,
  onChangeIcon,
}: Props) {
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [savingIcon, setSavingIcon] = useState(false);
  const [layout, setLayout] = useState<Layout>("covers");
  const [orderedEntries, setOrderedEntries] = useState(entries);
  const orderedEntriesRef = useRef(entries);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [pressedEntryId, setPressedEntryId] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const geometry = useRef(
    new Map<string, { x: number; y: number; width: number; height: number }>(),
  );
  const lastTargetId = useRef<string | null>(null);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const { width } = useWindowDimensions();
  const memberIds = useMemo(
    () => new Set(entries.map((entry) => entry.id)),
    [entries],
  );
  useEffect(() => {
    orderedEntriesRef.current = entries;
    setOrderedEntries(entries);
  }, [entries]);
  const shownEntries = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return orderedEntries.filter(
      (entry) =>
        entry.type === list.type &&
        (!term ||
          [entry.title, ...entry.alternateTitles, entry.creator]
            .join(" ")
            .toLocaleLowerCase()
            .includes(term)),
    );
  }, [orderedEntries, search, list.type]);
  const pickerEntries = useMemo(() => {
    const term = pickerSearch.trim().toLocaleLowerCase();
    return allEntries.filter(
      (entry) =>
        entry.type === list.type &&
        (!term ||
          [entry.title, ...entry.alternateTitles, entry.creator]
            .join(" ")
            .toLocaleLowerCase()
            .includes(term)),
    );
  }, [allEntries, pickerSearch, list.type]);
  const cardWidth = wide ? 190 : Math.max(0, (width - 44) / 2);

  const openPicker = () => {
    setPickerSearch("");
    setPickerOpen(true);
  };

  const measureItem = (
    id: string,
    x: number,
    y: number,
    itemWidth: number,
    height: number,
  ) => {
    geometry.current.set(id, { x, y, width: itemWidth, height });
  };

  const moveDraggedItem = (id: string, x: number, y: number) => {
    const targetId = [...geometry.current.entries()].find(
      ([, rect]) =>
        x >= rect.x &&
        x <= rect.x + rect.width &&
        y >= rect.y &&
        y <= rect.y + rect.height,
    )?.[0];
    if (!targetId || targetId === id || targetId === lastTargetId.current)
      return;
    lastTargetId.current = targetId;
    const current = orderedEntriesRef.current;
    const from = current.findIndex((entry) => entry.id === id);
    const to = current.findIndex((entry) => entry.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    orderedEntriesRef.current = next;
    setOrderedEntries(next);
  };

  const finishDrag = () => {
    setDraggedId(null);
    lastTargetId.current = null;
    onReorder(orderedEntriesRef.current.map((entry) => entry.id));
  };

  const entryPressFeedback = (id: string) => ({
    onPressIn: () => {
      if (!reordering) setPressedEntryId(id);
    },
    onPressOut: () => setPressedEntryId(null),
  });
  const showEntryActions = (entry: MediaEntry) => {
    setPressedEntryId(null);
    onShowEntryActions(entry);
  };

  const dragGesture = (id: string) =>
    Gesture.Pan()
      .enabled(reordering && !search.trim())
      .activateAfterLongPress(350)
      .onStart(() => runOnJS(setDraggedId)(id))
      .onUpdate((event) =>
        runOnJS(moveDraggedItem)(id, event.absoluteX, event.absoluteY),
      )
      .onEnd(() => runOnJS(finishDrag)());

  return (
    <>
      <ScrollView
        style={layoutStyles.fill}
        contentContainerStyle={styles.listViewBody}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.listViewIntro}>
          <View style={styles.listViewTags}>
            <View style={styles.localListTag}>
              <View
                style={[
                  styles.localListDot,
                  { backgroundColor: LIST_ACCENT_COLOR[list.accent] },
                ]}
              />
              <Text style={styles.localListTagText}>LOCAL LIST</Text>
            </View>
            <Text style={styles.accentTag}>{list.accent.toUpperCase()}</Text>
            <View style={styles.listViewTagSpacer} />
            <Pressable
              onPress={onDeleteList}
              style={actionStyles.quietAction}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${list.name}`}
            >
              <View style={mediaStyles.mediaTypeFact}>
                <Icon name="trash" size={18} color={palette.error} />
                <Text style={dialogStyles.contextRemoveText}>Remove list</Text>
              </View>
            </Pressable>
          </View>
          <View style={formStyles.sectionHeader}>
            <View style={styles.listIdentity}>
              <Icon
                name={list.icon}
                size={24}
                color={LIST_ACCENT_COLOR[list.accent]}
              />
              <Text style={[styles.listViewTitle, styles.listIdentityTitle]}>
                {list.name}
              </Text>
            </View>
            <Pressable
              onPress={() => setIconPickerOpen((current) => !current)}
              style={actionStyles.quietAction}
              accessibilityRole="button"
              accessibilityLabel="Change list icon"
              accessibilityState={{ expanded: iconPickerOpen }}
            >
              <Icon
                name="pencil"
                size={18}
                color={LIST_ACCENT_COLOR[list.accent]}
              />
            </Pressable>
          </View>
          {iconPickerOpen ? (
            <ListIconPicker
              value={list.icon}
              disabled={savingIcon}
              onChange={(icon) => {
                setSavingIcon(true);
                void onChangeIcon(icon).finally(() => setSavingIcon(false));
              }}
            />
          ) : null}
          {list.description ? (
            <Text style={styles.listViewDescription}>{list.description}</Text>
          ) : null}
          <View style={styles.listMetrics}>
            <Text style={styles.listMetricCount}>
              {entries.length} {entries.length === 1 ? "title" : "titles"}
            </Text>
            <View style={styles.listMetricDivider} />
            <Text style={styles.listMetricTypes} numberOfLines={1}>
              {list.type} list
            </Text>
          </View>
        </View>

        <View style={styles.listViewToolbar}>
          <View style={styles.listViewSearch}>
            <Icon name="search" size={20} color="#958DA1" />
            <TextInput
              value={search}
              editable={!reordering}
              onChangeText={setSearch}
              placeholder="Filter this list…"
              placeholderTextColor="#958DA1"
              style={pickerStyles.entrySearchInput}
              returnKeyType="search"
              accessibilityLabel="Filter titles in this list"
            />
            {search ? (
              <Pressable
                onPress={() => setSearch("")}
                style={pickerStyles.clearEntrySearch}
                accessibilityRole="button"
                accessibilityLabel="Clear list filter"
              >
                <Icon name="x" size={18} color="#958DA1" />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.listViewLayoutToggle}>
            <Pressable
              onPress={() => setLayout("covers")}
              style={[
                styles.listViewLayoutButton,
                layout === "covers" && styles.listViewLayoutButtonSelected,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Cover view"
              accessibilityState={{ selected: layout === "covers" }}
            >
              <Icon
                name="grid"
                size={18}
                color={layout === "covers" ? "#E5E2E1" : "#958DA1"}
              />
            </Pressable>
            <Pressable
              onPress={() => setLayout("table")}
              style={[
                styles.listViewLayoutButton,
                layout === "table" && styles.listViewLayoutButtonSelected,
              ]}
              accessibilityRole="button"
              accessibilityLabel="List view"
              accessibilityState={{ selected: layout === "table" }}
            >
              <Icon
                name="list"
                size={18}
                color={layout === "table" ? "#E5E2E1" : "#958DA1"}
              />
            </Pressable>
          </View>
          <Pressable
            onPress={openPicker}
            style={styles.listViewAddButton}
            accessibilityRole="button"
            accessibilityLabel="Add titles to list"
          >
            <Icon name="plus" size={21} color="#D2BBFF" />
          </Pressable>
        </View>

        {entries.length > 1 || reordering ? (
          <Pressable
            onPress={() => {
              setSearch("");
              setReordering((current) => !current);
            }}
            style={actionStyles.quietAction}
            accessibilityRole="button"
            accessibilityLabel={
              reordering ? "Finish reordering titles" : "Reorder titles"
            }
            accessibilityState={{ selected: reordering }}
          >
            <View style={mediaStyles.mediaTypeFact}>
              <Icon
                name={reordering ? "check" : "grip"}
                size={18}
                color={palette.violetText}
              />
              <Text style={actionStyles.quietActionText}>
                {reordering ? "Done reordering" : "Reorder titles"}
              </Text>
            </View>
          </Pressable>
        ) : null}
        <View style={styles.listIntegrityNote}>
          <Icon
            name={reordering ? "grip" : "list"}
            size={18}
            color={palette.faint}
          />
          <Text style={styles.listIntegrityText}>
            {reordering
              ? "Press and hold a title, then drag to change its order."
              : "Touch and hold a title for actions. Use Reorder titles to change the order."}{" "}
            The minus button removes a membership only; the title stays in your
            library.
          </Text>
        </View>

        {shownEntries.length ? (
          layout === "covers" ? (
            <View style={[styles.listViewGrid, wide && layoutStyles.wideGrid]}>
              {shownEntries.map((entry) => (
                <DraggableItem
                  key={entry.id}
                  id={entry.id}
                  gesture={dragGesture(entry.id)}
                  onMeasure={measureItem}
                  dragging={draggedId === entry.id}
                  style={[
                    styles.listViewGridItem,
                    wide && styles.listViewGridItemWide,
                  ]}
                >
                  <View
                    style={[
                      styles.listViewCard,
                      pressedEntryId === entry.id && mediaStyles.entryPressed,
                      pressedEntryId === entry.id &&
                        !reducedMotion &&
                        mediaStyles.entryPressedMotion,
                    ]}
                  >
                    <View
                      style={[
                        styles.listViewPoster,
                        { height: cardWidth * 1.5 },
                      ]}
                    >
                      <Pressable
                        {...entryPressFeedback(entry.id)}
                        onPress={() => {
                          if (!reordering) onOpenEntry(entry);
                        }}
                        onLongPress={
                          reordering ? undefined : () => showEntryActions(entry)
                        }
                        delayLongPress={200}
                        accessibilityActions={
                          reordering
                            ? undefined
                            : [
                                {
                                  name: "showMenu",
                                  label: "Show title actions",
                                },
                              ]
                        }
                        onAccessibilityAction={(event) => {
                          if (
                            !reordering &&
                            event.nativeEvent.actionName === "showMenu"
                          )
                            onShowEntryActions(entry);
                        }}
                        style={styles.listViewPosterPress}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${entry.title}`}
                      >
                        <Cover
                          uri={entry.coverUri}
                          type={entry.type}
                          title={entry.title}
                        />
                      </Pressable>
                      <View style={styles.listViewStatus} pointerEvents="none">
                        <View
                          style={[
                            mediaStyles.statusDot,
                            { backgroundColor: statusColor(entry.status) },
                          ]}
                        />
                        <Text
                          style={[
                            styles.listViewStatusText,
                            { color: statusColor(entry.status) },
                          ]}
                          numberOfLines={1}
                        >
                          {entry.status}
                        </Text>
                      </View>
                      {draggedId !== entry.id ? (
                        <Pressable
                          onPress={() => onRemoveMembership(entry)}
                          style={styles.listViewRemove}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${entry.title} from ${list.name}`}
                        >
                          <Icon name="minus" size={20} color="#CCC3D8" />
                        </Pressable>
                      ) : null}
                    </View>
                    <Pressable
                      {...entryPressFeedback(entry.id)}
                      onPress={() => {
                        if (!reordering) onOpenEntry(entry);
                      }}
                      onLongPress={
                        reordering ? undefined : () => showEntryActions(entry)
                      }
                      delayLongPress={200}
                      accessibilityActions={
                        reordering
                          ? undefined
                          : [{ name: "showMenu", label: "Show title actions" }]
                      }
                      onAccessibilityAction={(event) => {
                        if (
                          !reordering &&
                          event.nativeEvent.actionName === "showMenu"
                        )
                          onShowEntryActions(entry);
                      }}
                      style={styles.listViewCaption}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${entry.title}`}
                    >
                      <Text style={styles.listViewEntryTitle} numberOfLines={1}>
                        {entry.title}
                      </Text>
                      <Text
                        style={styles.listViewEntryCreator}
                        numberOfLines={1}
                      >
                        {[entry.creator, entry.releaseYear]
                          .filter(Boolean)
                          .join(" · ") || entry.type}
                      </Text>
                      <Text style={styles.listViewEntryType}>
                        {entry.type.toUpperCase()}
                      </Text>
                    </Pressable>
                  </View>
                </DraggableItem>
              ))}
            </View>
          ) : (
            <View style={styles.listViewRows}>
              {shownEntries.map((entry) => (
                <DraggableItem
                  key={entry.id}
                  id={entry.id}
                  gesture={dragGesture(entry.id)}
                  onMeasure={measureItem}
                  dragging={draggedId === entry.id}
                >
                  <View
                    style={[
                      styles.listViewRow,
                      draggedId === entry.id && styles.draggedListItem,
                      pressedEntryId === entry.id && mediaStyles.entryPressed,
                      pressedEntryId === entry.id &&
                        !reducedMotion &&
                        mediaStyles.entryPressedMotion,
                    ]}
                  >
                    <Pressable
                      {...entryPressFeedback(entry.id)}
                      onPress={() => {
                        if (!reordering) onOpenEntry(entry);
                      }}
                      onLongPress={
                        reordering ? undefined : () => showEntryActions(entry)
                      }
                      delayLongPress={200}
                      accessibilityActions={
                        reordering
                          ? undefined
                          : [{ name: "showMenu", label: "Show title actions" }]
                      }
                      onAccessibilityAction={(event) => {
                        if (
                          !reordering &&
                          event.nativeEvent.actionName === "showMenu"
                        )
                          onShowEntryActions(entry);
                      }}
                      style={styles.listViewRowMain}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${entry.title}`}
                    >
                      <View style={styles.listViewRowPoster}>
                        <Cover
                          uri={entry.coverUri}
                          type={entry.type}
                          title={entry.title}
                        />
                      </View>
                      <View style={styles.listViewRowInfo}>
                        <Text
                          style={styles.listViewEntryTitle}
                          numberOfLines={1}
                        >
                          {entry.title}
                        </Text>
                        <Text
                          style={styles.listViewEntryCreator}
                          numberOfLines={1}
                        >
                          {[entry.creator, entry.releaseYear]
                            .filter(Boolean)
                            .join(" · ") || entry.type}
                        </Text>
                        <Text style={styles.listViewRowStatus}>
                          {entry.status}
                        </Text>
                      </View>
                    </Pressable>
                    {draggedId !== entry.id ? (
                      <Pressable
                        onPress={() => onRemoveMembership(entry)}
                        style={styles.listViewRowRemove}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${entry.title} from ${list.name}`}
                      >
                        <Icon name="minus" size={20} color="#CCC3D8" />
                      </Pressable>
                    ) : null}
                  </View>
                </DraggableItem>
              ))}
            </View>
          )
        ) : (
          <View style={styles.listViewEmpty}>
            <Text style={styles.listViewEmptyTitle}>
              {entries.length ? "No matching titles" : "This list is empty"}
            </Text>
            <Text style={styles.listViewEmptyText}>
              {entries.length
                ? "Try another search."
                : `Add ${typeNames[list.type]} from your library to build this shelf.`}
            </Text>
            {!entries.length ? (
              <Pressable
                onPress={openPicker}
                style={styles.listViewEmptyAdd}
                accessibilityRole="button"
              >
                <Icon name="plus" size={16} color="#FFFFFF" />
                <Text style={styles.listViewEmptyAddText}>Add titles</Text>
              </Pressable>
            ) : null}
          </View>
        )}
        <View style={styles.listViewFooter}>
          <Text style={styles.listViewFooterTitle}>Stored on this device</Text>
          <Text style={styles.listViewFooterText}>
            {entries.length} linked {entries.length === 1 ? "title" : "titles"}{" "}
            · Removing a list never deletes library entries.
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={pickerOpen}
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <SafeAreaView style={layoutStyles.screen} edges={["top", "bottom"]}>
          <View style={layoutStyles.modalHeader}>
            <Pressable
              onPress={() => setPickerOpen(false)}
              style={actionStyles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close title picker"
            >
              <Icon name="x" size={22} color="#E5E2E1" />
            </Pressable>
            <Text style={layoutStyles.modalTitle}>
              Add {typeNames[list.type]}
            </Text>
            <Text style={styles.pickerSelectedCount}>
              {entries.length} added
            </Text>
          </View>
          <View style={styles.pickerSearchBox}>
            <Icon name="search" size={20} color="#958DA1" />
            <TextInput
              value={pickerSearch}
              onChangeText={setPickerSearch}
              placeholder={`Filter ${list.type} titles…`}
              placeholderTextColor="#958DA1"
              style={pickerStyles.entrySearchInput}
              accessibilityLabel="Search library titles"
            />
          </View>
          <ScrollView
            contentContainerStyle={styles.pickerRows}
            keyboardShouldPersistTaps="handled"
          >
            {pickerEntries.length ? (
              pickerEntries.map((entry) => {
                const included = memberIds.has(entry.id);
                return (
                  <Pressable
                    key={entry.id}
                    onPress={() => onToggleMembership(entry, !included)}
                    style={[
                      pickerStyles.createEntryRow,
                      !included && pickerStyles.createEntryRowUnselected,
                    ]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: included }}
                    accessibilityLabel={`${included ? "Remove" : "Add"} ${entry.title} ${included ? "from" : "to"} ${list.name}`}
                  >
                    <View style={pickerStyles.createEntryPoster}>
                      <Cover
                        uri={entry.coverUri}
                        type={entry.type}
                        title={entry.title}
                      />
                    </View>
                    <View style={pickerStyles.createEntryInfo}>
                      <Text
                        style={pickerStyles.createEntryTitle}
                        numberOfLines={1}
                      >
                        {entry.title}
                      </Text>
                      <Text
                        style={pickerStyles.createEntryFacts}
                        numberOfLines={1}
                      >
                        {entry.type}
                        {entry.releaseYear ? `  ·  ${entry.releaseYear}` : ""}
                        {entry.creator ? `  ·  ${entry.creator}` : ""}
                      </Text>
                    </View>
                    <View
                      style={[
                        pickerStyles.entryCheckbox,
                        included && pickerStyles.entryCheckboxSelected,
                      ]}
                    >
                      {included ? (
                        <Icon name="check" size={18} color="#FFFFFF" />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <View style={pickerStyles.noMatchingEntries}>
                <Text style={pickerStyles.noMatchingEntriesText}>
                  No matching {list.type} titles in your library.
                </Text>
              </View>
            )}
          </ScrollView>
          <View style={styles.pickerFooter}>
            <Pressable
              onPress={() => setPickerOpen(false)}
              style={pickerStyles.createListSubmit}
              accessibilityRole="button"
            >
              <Text style={pickerStyles.createListSubmitText}>Done</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

type DraggableItemProps = {
  id: string;
  gesture: ReturnType<typeof Gesture.Pan>;
  dragging: boolean;
  onMeasure: (
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void;
  style?: object | object[];
  children: ReactNode;
};

function DraggableItem({
  id,
  gesture,
  dragging,
  onMeasure,
  style,
  children,
}: DraggableItemProps) {
  const viewRef = useRef<ElementRef<typeof View>>(null);
  return (
    <GestureDetector gesture={gesture}>
      <View
        ref={viewRef}
        onLayout={() =>
          viewRef.current?.measureInWindow((x, y, width, height) =>
            onMeasure(id, x, y, width, height),
          )
        }
        style={[style, dragging && styles.draggedListItem]}
      >
        {children}
      </View>
    </GestureDetector>
  );
}
