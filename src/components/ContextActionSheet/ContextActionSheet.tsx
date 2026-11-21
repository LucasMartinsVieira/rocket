import { type ComponentRef, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  findNodeHandle,
  Keyboard,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  type CustomList,
  formatDuration,
  type MediaEntry,
  type MediaStatus,
  STATUSES,
} from "../../model";
import { palette } from "../../theme";
import { DeleteConfirmationDialog } from "../DeleteConfirmationDialog";
import { Icon } from "../Icon";
import { Cover, statusColor } from "../MediaUI";
import { actionStyles } from "../shared/actions.styles";
import { dialogStyles } from "../shared/dialog.styles";
import { mediaStyles } from "../shared/mediaPresentation.styles";
import { styles } from "./styles";

export type ContextTarget =
  | { kind: "entry"; entry: MediaEntry }
  | { kind: "list"; list: CustomList; count: number };

export function ContextActionSheet({
  target,
  lists,
  onClose,
  onOpen,
  onChangeStatus,
  onToggleMembership,
  onDuplicate,
  onDelete,
}: {
  target: ContextTarget;
  lists: CustomList[];
  onClose: () => void;
  onOpen: () => void;
  onChangeStatus: (status: MediaStatus) => Promise<void>;
  onToggleMembership: (listId: string, included: boolean) => Promise<void>;
  onDuplicate: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [listsOpen, setListsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const mounted = useRef(true);
  const entrance = useSharedValue(0);
  const scrimStyle = useAnimatedStyle(() => ({ opacity: entrance.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: (1 - entrance.value) * 24 }],
  }));
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelAnimation(entrance);
    };
  }, [entrance]);
  const heading = useRef<ComponentRef<typeof Text>>(null);
  const entry = target.kind === "entry" ? target.entry : null;
  const list = target.kind === "list" ? target.list : null;
  const compatibleLists = lists.filter((item) => item.type === entry?.type);
  const membershipCount = entry
    ? lists.filter((item) => entry.listIds.includes(item.id)).length
    : 0;
  const dismiss = () => {
    if (!deleting || !pending.current) onClose();
  };
  const run = async (
    action: () => Promise<void>,
    message: string,
    close = false,
  ) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      if (close && mounted.current) onClose();
    } catch {
      if (mounted.current) setError(message);
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <Modal
      transparent
      visible
      animationType="none"
      onRequestClose={dismiss}
      onShow={() => {
        entrance.value = withTiming(1, {
          duration: 140,
          easing: Easing.out(Easing.cubic),
          reduceMotion: ReduceMotion.System,
        });
        Keyboard.dismiss();
        const handle = findNodeHandle(heading.current);
        if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
      }}
    >
      {deleting ? (
        <DeleteConfirmationDialog
          embedded
          visible
          target={target}
          onCancel={onClose}
          onConfirm={async () => {
            pending.current = true;
            try {
              await onDelete();
            } finally {
              pending.current = false;
            }
          }}
        />
      ) : (
        <SafeAreaView style={styles.contextOverlay}>
          <Animated.View
            pointerEvents="none"
            style={[styles.contextScrim, scrimStyle]}
          />
          <Pressable
            style={dialogStyles.deleteBackdrop}
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel="Close context menu"
          />
          <Animated.ScrollView
            style={[styles.contextSheet, sheetStyle]}
            contentContainerStyle={styles.contextContent}
            bounces={false}
            keyboardShouldPersistTaps="handled"
            accessibilityViewIsModal
            onAccessibilityEscape={dismiss}
          >
            <View style={styles.contextHeader}>
              <View style={styles.contextPreview}>
                {entry ? (
                  <Cover
                    uri={entry.coverUri}
                    type={entry.type}
                    title={entry.title}
                  />
                ) : (
                  <Icon
                    name={list!.icon}
                    size={28}
                    color={palette.violetText}
                  />
                )}
              </View>
              <View style={styles.contextInfo}>
                <Text style={styles.contextMeta}>
                  {entry ? entry.type : `${list!.type} list`}
                </Text>
                <Text
                  ref={heading}
                  accessibilityRole="header"
                  style={styles.contextTitle}
                  numberOfLines={2}
                >
                  {entry ? entry.title : list!.name}
                </Text>
                <Text style={styles.contextMeta} numberOfLines={2}>
                  {entry
                    ? [
                        entry.creator,
                        entry.releaseYear,
                        formatDuration(entry.type, entry.duration),
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : target.kind === "list"
                      ? `${target.count} ${target.count === 1 ? "title" : "titles"}`
                      : ""}
                </Text>
              </View>
              <Pressable
                onPress={dismiss}
                style={actionStyles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close context menu"
              >
                <Icon name="x" size={20} color={palette.muted} />
              </Pressable>
            </View>
            {entry?.summary || list?.description ? (
              <Text style={styles.contextSummary} numberOfLines={3}>
                {entry?.summary || list?.description}
              </Text>
            ) : null}
            <Pressable
              onPress={onOpen}
              disabled={busy}
              style={({ pressed }) => [
                styles.contextAction,
                pressed && styles.contextPressed,
                busy && actionStyles.disabledButton,
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                entry ? "Open media item details" : "Open list details"
              }
            >
              <Icon name="eye" size={20} color={palette.violetText} />
              <Text style={styles.contextActionText}>
                {entry ? "Open title details" : "Open list details"}
              </Text>
            </Pressable>
            {entry ? (
              <>
                <Text style={styles.contextSection}>Media status</Text>
                <Pressable
                  onPress={() => setStatusOpen((open) => !open)}
                  disabled={busy}
                  style={({ pressed }) => [
                    mediaStyles.statusSelector,
                    pressed && styles.contextPressed,
                    busy && actionStyles.disabledButton,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Status: ${entry.status}`}
                  accessibilityState={{ expanded: statusOpen, disabled: busy }}
                >
                  <View
                    style={[
                      mediaStyles.statusDot,
                      { backgroundColor: statusColor(entry.status) },
                    ]}
                  />
                  <Text style={mediaStyles.statusSelectorText}>
                    {entry.status}
                  </Text>
                  <Icon name="chevronDown" size={18} color={palette.faint} />
                </Pressable>
                {statusOpen ? (
                  <View style={styles.contextStatusOptions}>
                    {STATUSES.map((status) => (
                      <Pressable
                        key={status}
                        disabled={busy}
                        style={[
                          mediaStyles.statusOption,
                          entry.status === status &&
                            mediaStyles.statusOptionSelected,
                        ]}
                        accessibilityRole="radio"
                        accessibilityLabel={status}
                        accessibilityState={{
                          selected: entry.status === status,
                          disabled: busy,
                        }}
                        onPress={() =>
                          void run(async () => {
                            await onChangeStatus(status);
                            if (mounted.current) setStatusOpen(false);
                          }, "Could not update status. Try again.")
                        }
                      >
                        <View
                          style={[
                            mediaStyles.statusDot,
                            { backgroundColor: statusColor(status) },
                          ]}
                        />
                        <Text style={mediaStyles.statusOptionText}>
                          {status}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <Pressable
                  onPress={() => setListsOpen((open) => !open)}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.contextAction,
                    pressed && styles.contextPressed,
                    busy && actionStyles.disabledButton,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Add to list, in ${membershipCount} ${membershipCount === 1 ? "list" : "lists"}`}
                  accessibilityState={{ expanded: listsOpen, disabled: busy }}
                >
                  <Icon name="bookmark" size={20} color={palette.muted} />
                  <Text style={styles.contextActionText}>Add to list</Text>
                  <Text style={styles.contextMeta}>
                    {membershipCount} {membershipCount === 1 ? "list" : "lists"}
                  </Text>
                </Pressable>
                {listsOpen ? (
                  <View style={styles.contextMemberships}>
                    {compatibleLists.length ? (
                      compatibleLists.map((item) => {
                        const included = entry.listIds.includes(item.id);
                        return (
                          <Pressable
                            key={item.id}
                            disabled={busy}
                            style={({ pressed }) => [
                              styles.contextMembership,
                              pressed && styles.contextPressed,
                              busy && actionStyles.disabledButton,
                            ]}
                            accessibilityRole="checkbox"
                            accessibilityLabel={item.name}
                            accessibilityState={{
                              checked: included,
                              disabled: busy,
                            }}
                            onPress={() =>
                              void run(
                                () => onToggleMembership(item.id, !included),
                                "Could not update list membership. Try again.",
                              )
                            }
                          >
                            <Icon
                              name={item.icon}
                              size={18}
                              color={palette.muted}
                            />
                            <Text style={styles.contextActionText}>
                              {item.name}
                            </Text>
                            <Icon
                              name={included ? "check" : "plus"}
                              size={18}
                              color={
                                included ? palette.violetText : palette.muted
                              }
                            />
                          </Pressable>
                        );
                      })
                    ) : (
                      <Text style={styles.contextMeta}>
                        No {entry.type} lists yet. Create one from Lists to
                        group this title.
                      </Text>
                    )}
                  </View>
                ) : null}
              </>
            ) : (
              <Pressable
                disabled={busy}
                onPress={() =>
                  void run(
                    onDuplicate,
                    "Could not duplicate list. Try again.",
                    true,
                  )
                }
                style={({ pressed }) => [
                  styles.contextAction,
                  pressed && styles.contextPressed,
                  busy && actionStyles.disabledButton,
                ]}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy }}
              >
                <Icon name="copy" size={20} color={palette.muted} />
                <Text style={styles.contextActionText}>Duplicate list</Text>
              </Pressable>
            )}
            {busy ? (
              <ActivityIndicator
                color={palette.violetText}
                accessibilityLabel="Saving changes"
              />
            ) : null}
            {error ? (
              <Text style={dialogStyles.deleteError} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
            <Pressable
              disabled={busy}
              onPress={() => setDeleting(true)}
              style={({ pressed }) => [
                styles.contextRemove,
                pressed && styles.contextPressed,
                busy && actionStyles.disabledButton,
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy }}
            >
              <Icon name="trash" size={20} color={palette.error} />
              <Text style={dialogStyles.contextRemoveText}>
                {entry ? "Remove title" : "Remove list"}
              </Text>
            </Pressable>
          </Animated.ScrollView>
        </SafeAreaView>
      )}
    </Modal>
  );
}
