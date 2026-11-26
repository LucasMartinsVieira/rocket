import { useMemo, useRef, useState } from "react";
import {
  type AccessibilityActionEvent,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { useReducedMotion } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "../../components/Icon";
import { ListAccentPicker } from "../../components/ListAccentPicker";
import { ListIconPicker } from "../../components/ListIconPicker";
import {
  Cover,
  statusColor,
  WIDE_MEDIA_CARD_WIDTH,
} from "../../components/MediaUI";
import { actionStyles } from "../../components/shared/actions.styles";
import { dialogStyles } from "../../components/shared/dialog.styles";
import { formStyles } from "../../components/shared/form.styles";
import { layoutStyles } from "../../components/shared/layout.styles";
import { mediaStyles } from "../../components/shared/mediaPresentation.styles";
import {
  type CustomList,
  LIST_ACCENT_COLOR,
  type ListAccent,
  type ListIcon,
  type MediaEntry,
  type MediaType,
} from "../../model";
import { palette, SPACING } from "../../theme";
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
  onReorder: (entryIds: string[]) => Promise<void>;
  onChangeAccent: (accent: ListAccent) => Promise<void>;
  onChangeIcon: (icon: ListIcon) => Promise<void>;
};

type Layout = "covers" | "table";
type DragPreview = {
  from: number;
  to: number;
  offset: number;
  rowShift: number;
};

function moveEntry(entries: MediaEntry[], id: string, to: number) {
  const from = entries.findIndex((entry) => entry.id === id);
  if (from < 0 || to < 0 || to >= entries.length || from === to) return entries;
  const next = [...entries];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

const typeNames: Record<MediaType, string> = {
  Anime: "Anime",
  Manga: "Manga",
  Movie: "Movies",
  Book: "Books",
  Game: "Games",
};

function CoverRowSeparator() {
  return <View style={styles.listViewGridSeparator} />;
}

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
  onChangeAccent,
  onChangeIcon,
}: Props) {
  const [appearancePicker, setAppearancePicker] = useState<
    "icon" | "accent" | null
  >(null);
  const [savingIcon, setSavingIcon] = useState(false);
  const [savingAccent, setSavingAccent] = useState(false);
  const [accentError, setAccentError] = useState("");
  const [layout, setLayout] = useState<Layout>("covers");
  const [reorderDraft, setReorderDraft] = useState<MediaEntry[] | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [reorderError, setReorderError] = useState("");
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const rowLayouts = useRef(new Map<string, { y: number; height: number }>());
  const activeDrag = useRef<{
    id: string;
    centers: number[];
    rowShift: number;
  } | null>(null);
  const writingOrder = useRef(false);
  const [pressedEntryId, setPressedEntryId] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const { width } = useWindowDimensions();
  const memberIds = useMemo(
    () => new Set(entries.map((entry) => entry.id)),
    [entries],
  );
  const shownEntries = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return entries.filter(
      (entry) =>
        entry.type === list.type &&
        (!term ||
          [entry.title, ...entry.alternateTitles, entry.creator]
            .join(" ")
            .toLocaleLowerCase()
            .includes(term)),
    );
  }, [entries, search, list.type]);
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
  const covers = layout === "covers";
  const columns = !covers
    ? 1
    : wide
      ? Math.max(
          1,
          Math.floor(
            (width - SPACING.lg) / (WIDE_MEDIA_CARD_WIDTH + SPACING.lg),
          ),
        )
      : 2;
  const cardWidth = wide
    ? WIDE_MEDIA_CARD_WIDTH
    : Math.max(0, (width - 44) / 2);
  const columnStyle = wide ? layoutStyles.wideGrid : styles.listViewGridRow;
  const reorderScrollGesture = useMemo(() => Gesture.Native(), []);
  const reorderGestures = useMemo(() => {
    return reorderDraft?.map(({ id }, from) => {
      // Preview with transforms so the active gesture and its measured hit targets stay fixed.
      const projectDrop = (translationY: number) => {
        const drag = activeDrag.current;
        if (drag?.id !== id) return;
        const { centers } = drag;
        const center = Math.max(
          centers[0],
          Math.min(centers[centers.length - 1], centers[from] + translationY),
        );
        let to = from;
        while (to + 1 < centers.length && center >= centers[to + 1]) to += 1;
        while (to > 0 && center <= centers[to - 1]) to -= 1;
        return {
          from,
          to,
          offset: center - centers[from],
          rowShift: drag.rowShift,
        };
      };

      return Gesture.Pan()
        .enabled(!savingOrder)
        .maxPointers(1)
        .activateAfterLongPress(250)
        .blocksExternalGesture(reorderScrollGesture)
        .runOnJS(true)
        .onStart(() => {
          if (writingOrder.current || activeDrag.current) return;
          const layouts = reorderDraft.map((entry) =>
            rowLayouts.current.get(entry.id),
          );
          if (!layouts.every((layout) => layout !== undefined)) return;
          const centers = layouts.map(({ y, height }) => y + height / 2);
          if (
            centers.some(
              (center, index) => index > 0 && center <= centers[index - 1],
            )
          )
            return;
          const current = layouts[from];
          const previous = layouts[from - 1];
          const next = layouts[from + 1];
          const gap = previous
            ? current.y - previous.y - previous.height
            : next
              ? next.y - current.y - current.height
              : 0;
          const rowShift = current.height + Math.max(0, gap);
          activeDrag.current = { id, centers, rowShift };
          setDragPreview({ from, to: from, offset: 0, rowShift });
        })
        .onUpdate(({ translationY }) => {
          const drop = projectDrop(translationY);
          if (drop) setDragPreview(drop);
        })
        .onEnd(({ translationY }, success) => {
          const drop = success ? projectDrop(translationY) : undefined;
          if (!drop || drop.to === from) return;
          setReorderError("");
          setReorderDraft((current) =>
            current ? moveEntry(current, id, drop.to) : current,
          );
        })
        .onFinalize(() => {
          if (activeDrag.current?.id !== id) return;
          activeDrag.current = null;
          setDragPreview(null);
        });
    });
  }, [reorderDraft, reorderScrollGesture, savingOrder]);

  const openPicker = () => {
    setPickerSearch("");
    setPickerOpen(true);
  };

  const openReorder = () => {
    Keyboard.dismiss();
    rowLayouts.current.clear();
    activeDrag.current = null;
    setDragPreview(null);
    setPressedEntryId(null);
    setReorderError("");
    setReorderDraft(entries);
  };

  const moveTitle = (id: string, offset: -1 | 1) => {
    if (writingOrder.current || activeDrag.current) return;
    setReorderError("");
    setReorderDraft((current) => {
      if (!current) return current;
      const from = current.findIndex((entry) => entry.id === id);
      return from < 0 ? current : moveEntry(current, id, from + offset);
    });
  };

  const closeReorder = () => {
    if (writingOrder.current) return;
    activeDrag.current = null;
    setDragPreview(null);
    setReorderDraft(null);
  };

  const orderChanged = reorderDraft?.some(
    (entry, index) => entry.id !== entries[index]?.id,
  );
  const saveReorder = async () => {
    if (
      !reorderDraft ||
      !orderChanged ||
      writingOrder.current ||
      activeDrag.current
    )
      return;
    writingOrder.current = true;
    setSavingOrder(true);
    setReorderError("");
    try {
      await onReorder(reorderDraft.map((entry) => entry.id));
      setReorderDraft(null);
    } catch {
      setReorderError(
        "Could not save the new order. Try again or reopen Reorder titles.",
      );
    } finally {
      writingOrder.current = false;
      setSavingOrder(false);
    }
  };

  const entryPressProps = (entry: MediaEntry) => ({
    onPressIn: () => setPressedEntryId(entry.id),
    onPressOut: () => setPressedEntryId(null),
    onPress: () => onOpenEntry(entry),
    onLongPress: () => {
      setPressedEntryId(null);
      onShowEntryActions(entry);
    },
    delayLongPress: 200,
    accessibilityRole: "button" as const,
    accessibilityLabel: `Open ${entry.title}`,
    accessibilityActions: [{ name: "showMenu", label: "Show title actions" }],
    onAccessibilityAction: (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === "showMenu")
        onShowEntryActions(entry);
    },
  });

  const changeAccent = async (accent: ListAccent) => {
    if (savingAccent || accent === list.accent) return;
    setSavingAccent(true);
    setAccentError("");
    try {
      await onChangeAccent(accent);
    } catch {
      setAccentError("Could not change the accent. Try again.");
    } finally {
      setSavingAccent(false);
    }
  };

  return (
    <>
      <FlatList
        key={`${list.id}-${layout}-${columns}`}
        data={shownEntries}
        keyExtractor={(entry) => entry.id}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? columnStyle : undefined}
        ItemSeparatorComponent={covers ? CoverRowSeparator : undefined}
        initialNumToRender={covers ? 4 : 12}
        maxToRenderPerBatch={covers ? 4 : 12}
        windowSize={7}
        style={layoutStyles.fill}
        contentContainerStyle={styles.listViewBody}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listViewHeader}>
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
                <Pressable
                  onPress={() =>
                    setAppearancePicker(
                      appearancePicker === "accent" ? null : "accent",
                    )
                  }
                  style={[actionStyles.quietAction, styles.accentButton]}
                  accessibilityRole="button"
                  accessibilityLabel="Change list accent"
                  accessibilityValue={{ text: list.accent }}
                  accessibilityState={{
                    expanded: appearancePicker === "accent",
                  }}
                >
                  <Text style={actionStyles.quietActionText}>
                    Accent: {list.accent}
                  </Text>
                  <Icon
                    name="chevronDown"
                    size={16}
                    color={palette.violetText}
                  />
                </Pressable>
                <View style={styles.listViewTagSpacer} />
                <Pressable
                  onPress={onDeleteList}
                  style={actionStyles.quietAction}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${list.name}`}
                >
                  <View style={mediaStyles.mediaTypeFact}>
                    <Icon name="trash" size={18} color={palette.error} />
                    <Text style={dialogStyles.contextRemoveText}>
                      Remove list
                    </Text>
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
                  <Text
                    style={[styles.listViewTitle, styles.listIdentityTitle]}
                  >
                    {list.name}
                  </Text>
                </View>
                <Pressable
                  onPress={() =>
                    setAppearancePicker(
                      appearancePicker === "icon" ? null : "icon",
                    )
                  }
                  style={actionStyles.quietAction}
                  accessibilityRole="button"
                  accessibilityLabel="Change list icon"
                  accessibilityState={{ expanded: appearancePicker === "icon" }}
                >
                  <Icon
                    name="pencil"
                    size={18}
                    color={LIST_ACCENT_COLOR[list.accent]}
                  />
                </Pressable>
              </View>
              {appearancePicker === "icon" ? (
                <ListIconPicker
                  value={list.icon}
                  disabled={savingIcon}
                  onChange={(icon) => {
                    setSavingIcon(true);
                    void onChangeIcon(icon).finally(() => setSavingIcon(false));
                  }}
                />
              ) : null}
              {appearancePicker === "accent" ? (
                <>
                  <ListAccentPicker
                    value={list.accent}
                    disabled={savingAccent}
                    onChange={(accent) => void changeAccent(accent)}
                  />
                  {accentError ? (
                    <Text style={styles.inlineError} accessibilityRole="alert">
                      {accentError}
                    </Text>
                  ) : null}
                </>
              ) : null}
              {list.description ? (
                <Text style={styles.listViewDescription}>
                  {list.description}
                </Text>
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

            {entries.length > 1 ? (
              <Pressable
                onPress={openReorder}
                style={actionStyles.quietAction}
                accessibilityRole="button"
                accessibilityLabel="Reorder titles"
              >
                <View style={mediaStyles.mediaTypeFact}>
                  <Icon name="grip" size={18} color={palette.violetText} />
                  <Text style={actionStyles.quietActionText}>
                    Reorder titles
                  </Text>
                </View>
              </Pressable>
            ) : null}
            <View style={styles.listIntegrityNote}>
              <Icon name="list" size={18} color={palette.faint} />
              <Text style={styles.listIntegrityText}>
                Touch and hold a title for actions. The minus button removes it
                from this list only; the title stays in your library.
              </Text>
            </View>
          </View>
        }
        renderItem={({ item: entry, index }) =>
          covers ? (
            <View
              style={[styles.listViewGridItem, wide && { width: cardWidth }]}
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
                  style={[styles.listViewPoster, { height: cardWidth * 1.5 }]}
                >
                  <Pressable
                    {...entryPressProps(entry)}
                    style={styles.listViewPosterPress}
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
                  <Pressable
                    onPress={() => onRemoveMembership(entry)}
                    style={styles.listViewRemove}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${entry.title} from ${list.name}`}
                  >
                    <Icon name="minus" size={20} color="#CCC3D8" />
                  </Pressable>
                </View>
                <Pressable
                  {...entryPressProps(entry)}
                  style={styles.listViewCaption}
                >
                  <Text style={styles.listViewEntryTitle} numberOfLines={1}>
                    {entry.title}
                  </Text>
                  <Text style={styles.listViewEntryCreator} numberOfLines={1}>
                    {[entry.creator, entry.releaseYear]
                      .filter(Boolean)
                      .join(" · ") || entry.type}
                  </Text>
                  <Text style={styles.listViewEntryType}>
                    {entry.type.toUpperCase()}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View
              style={[
                styles.listViewRow,
                index === 0 && styles.listViewRowFirst,
                index === shownEntries.length - 1 && styles.listViewRowLast,
                pressedEntryId === entry.id && mediaStyles.entryPressed,
                pressedEntryId === entry.id &&
                  !reducedMotion &&
                  mediaStyles.entryPressedMotion,
              ]}
            >
              <Pressable
                {...entryPressProps(entry)}
                style={styles.listViewRowMain}
              >
                <View style={styles.listViewRowPoster}>
                  <Cover
                    uri={entry.coverUri}
                    type={entry.type}
                    title={entry.title}
                  />
                </View>
                <View style={styles.listViewRowInfo}>
                  <Text style={styles.listViewEntryTitle} numberOfLines={1}>
                    {entry.title}
                  </Text>
                  <Text style={styles.listViewEntryCreator} numberOfLines={1}>
                    {[entry.creator, entry.releaseYear]
                      .filter(Boolean)
                      .join(" · ") || entry.type}
                  </Text>
                  <Text style={styles.listViewRowStatus}>{entry.status}</Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => onRemoveMembership(entry)}
                style={styles.listViewRowRemove}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${entry.title} from ${list.name}`}
              >
                <Icon name="minus" size={20} color="#CCC3D8" />
              </Pressable>
            </View>
          )
        }
        ListEmptyComponent={
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
        }
        ListFooterComponent={
          <View style={styles.listViewFooter}>
            <Text style={styles.listViewFooterTitle}>
              Stored on this device
            </Text>
            <Text style={styles.listViewFooterText}>
              {entries.length} linked{" "}
              {entries.length === 1 ? "title" : "titles"} · Removing a list
              never deletes library entries.
            </Text>
          </View>
        }
      />

      {reorderDraft ? (
        <Modal visible animationType="slide" onRequestClose={closeReorder}>
          <GestureHandlerRootView style={layoutStyles.fill}>
            <SafeAreaView style={layoutStyles.screen} edges={["top", "bottom"]}>
              <View style={layoutStyles.modalHeader}>
                <Pressable
                  onPress={closeReorder}
                  disabled={savingOrder}
                  style={[
                    actionStyles.quietAction,
                    savingOrder && actionStyles.disabledButton,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel reordering"
                  accessibilityState={{ disabled: savingOrder }}
                >
                  <Text style={actionStyles.quietActionText}>Cancel</Text>
                </Pressable>
                <Text
                  accessibilityRole="header"
                  style={[layoutStyles.modalTitle, styles.reorderHeading]}
                >
                  Reorder titles
                </Text>
                <Pressable
                  onPress={() => void saveReorder()}
                  disabled={
                    !orderChanged || savingOrder || dragPreview !== null
                  }
                  style={[
                    actionStyles.quietAction,
                    (!orderChanged || savingOrder || dragPreview) &&
                      actionStyles.disabledButton,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Save list order"
                  accessibilityState={{
                    disabled:
                      !orderChanged || savingOrder || dragPreview !== null,
                    busy: savingOrder,
                  }}
                >
                  <Text style={actionStyles.quietActionText}>
                    {savingOrder ? "Saving…" : "Save"}
                  </Text>
                </Pressable>
              </View>
              <GestureDetector gesture={reorderScrollGesture}>
                <ScrollView
                  contentContainerStyle={[
                    styles.listViewBody,
                    styles.reorderBody,
                  ]}
                  removeClippedSubviews={false}
                >
                  <Text style={styles.listViewDescription}>
                    Touch and hold a title, then drag it to a new position. Tap
                    Save when you're done.
                  </Text>
                  {reorderError ? (
                    <Text style={styles.inlineError} accessibilityRole="alert">
                      {reorderError}
                    </Text>
                  ) : null}
                  {reorderGestures?.map((gesture, index) => {
                    const entry = reorderDraft[index];
                    let position = index;
                    let translateY = 0;
                    let dragging = false;
                    if (dragPreview) {
                      const { from, to, offset, rowShift } = dragPreview;
                      if (index === from) {
                        dragging = true;
                        position = to;
                        translateY = offset;
                      } else if (from < index && index <= to) {
                        position -= 1;
                        translateY = -rowShift;
                      } else if (to <= index && index < from) {
                        position += 1;
                        translateY = rowShift;
                      }
                    }
                    return (
                      <GestureDetector key={entry.id} gesture={gesture}>
                        <View
                          collapsable={false}
                          onLayout={({
                            nativeEvent: {
                              layout: { y, height },
                            },
                          }) => {
                            rowLayouts.current.set(entry.id, { y, height });
                          }}
                          style={[
                            styles.reorderRow,
                            dragging && styles.reorderDragging,
                            translateY !== 0 && {
                              transform: [{ translateY }],
                            },
                          ]}
                          accessible
                          accessibilityRole="adjustable"
                          accessibilityLabel={`Reorder ${entry.title}`}
                          accessibilityValue={{
                            min: 1,
                            now: position + 1,
                            max: reorderDraft.length,
                          }}
                          accessibilityState={{ disabled: savingOrder }}
                          accessibilityActions={
                            savingOrder
                              ? []
                              : [
                                  ...(index > 0
                                    ? [{ name: "decrement", label: "Move up" }]
                                    : []),
                                  ...(index + 1 < reorderDraft.length
                                    ? [
                                        {
                                          name: "increment",
                                          label: "Move down",
                                        },
                                      ]
                                    : []),
                                ]
                          }
                          onAccessibilityAction={({
                            nativeEvent: { actionName },
                          }) => {
                            if (actionName === "decrement")
                              moveTitle(entry.id, -1);
                            if (actionName === "increment")
                              moveTitle(entry.id, 1);
                          }}
                        >
                          <Text
                            style={[
                              styles.listViewEntryTitle,
                              styles.reorderTitle,
                            ]}
                            numberOfLines={2}
                          >
                            {position + 1}. {entry.title}
                          </Text>
                          <Icon
                            name="grip"
                            size={22}
                            color={palette.violetText}
                          />
                        </View>
                      </GestureDetector>
                    );
                  })}
                </ScrollView>
              </GestureDetector>
            </SafeAreaView>
          </GestureHandlerRootView>
        </Modal>
      ) : null}

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
