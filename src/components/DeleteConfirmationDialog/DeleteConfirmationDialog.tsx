import { type ComponentRef, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  findNodeHandle,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { CustomList, MediaEntry } from "../../model";
import { palette } from "../../theme";
import { Icon, MEDIA_TYPE_ICONS } from "../Icon";
import { Cover } from "../MediaUI";
import { actionStyles } from "../shared/actions.styles";
import { dialogStyles } from "../shared/dialog.styles";
import { styles } from "./styles";

type Target =
  | { kind: "entry"; entry: Pick<MediaEntry, "title" | "type" | "coverUri"> }
  | { kind: "list"; list: CustomList; count: number };

export function DeleteConfirmationDialog({
  visible,
  target,
  onCancel,
  onConfirm,
  embedded = false,
}: {
  visible: boolean;
  target: Target;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  embedded?: boolean;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const heading = useRef<ComponentRef<typeof Text>>(null);
  useEffect(() => {
    if (visible) {
      setError("");
      Keyboard.dismiss();
    }
  }, [visible]);
  useEffect(() => {
    if (visible && embedded) {
      const handle = findNodeHandle(heading.current);
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    }
  }, [visible, embedded]);

  const cancel = () => {
    if (!pending.current) onCancel();
  };
  const confirm = async () => {
    if (pending.current) return;
    pending.current = true;
    setDeleting(true);
    setError("");
    try {
      await onConfirm();
      onCancel();
    } catch {
      setError("Could not finish deleting. Please try again.");
    } finally {
      pending.current = false;
      setDeleting(false);
    }
  };
  const item = target.kind === "entry" ? target.entry : target.list;
  const title =
    target.kind === "entry"
      ? target.entry.title.trim() || "Untitled entry"
      : target.list.name;

  const content = (
    <SafeAreaView style={dialogStyles.deleteOverlay}>
      <Pressable
        style={dialogStyles.deleteBackdrop}
        onPress={cancel}
        accessible={false}
        disabled={deleting}
      />
      <ScrollView
        style={styles.deleteScroll}
        contentContainerStyle={styles.deleteCard}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        accessibilityViewIsModal
        onAccessibilityEscape={cancel}
      >
        <View style={styles.deleteHeadingRow}>
          <View style={dialogStyles.deleteIconBox}>
            <Icon name="trash" size={22} color={palette.error} />
          </View>
          <Text style={styles.deletePermanent}>Permanent</Text>
        </View>
        <Text
          ref={heading}
          accessibilityRole="header"
          style={styles.deleteTitle}
        >
          {target.kind === "entry" ? "Delete item" : "Delete list"}
        </Text>
        <Text style={styles.deleteDescription}>
          {target.kind === "entry"
            ? "This permanently removes the title from your library, including its note, journal entries, and all list memberships. This cannot be undone."
            : "This permanently deletes the list and its memberships. Your titles, notes, and journal entries stay in your library. This cannot be undone."}
        </Text>
        <View style={styles.deletePreview}>
          <View style={styles.deletePreviewImage}>
            {target.kind === "entry" && target.entry.coverUri ? (
              <Cover
                uri={target.entry.coverUri}
                type={target.entry.type}
                title={target.entry.title}
              />
            ) : (
              <Icon
                name={
                  target.kind === "list"
                    ? target.list.icon
                    : MEDIA_TYPE_ICONS[target.entry.type]
                }
                size={24}
                color={palette.muted}
              />
            )}
          </View>
          <View style={styles.deletePreviewInfo}>
            <View style={styles.deletePreviewMeta}>
              <Text style={styles.deletePreviewBadge}>
                {target.kind === "entry" ? "Library entry" : "List"}
              </Text>
              <Text style={styles.deletePreviewType}>{item.type}</Text>
            </View>
            <Text style={styles.deletePreviewTitle} numberOfLines={2}>
              {title}
            </Text>
            {target.kind === "list" ? (
              <Text style={styles.deletePreviewType}>
                {target.count}{" "}
                {target.count === 1 ? "title stays" : "titles stay"} in your
                library
              </Text>
            ) : null}
          </View>
        </View>
        {error ? (
          <Text style={dialogStyles.deleteError} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <Pressable
          onPress={() => void confirm()}
          disabled={deleting}
          style={({ pressed }) => [
            styles.deleteConfirm,
            (pressed || deleting) && actionStyles.disabledButton,
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            target.kind === "entry"
              ? "Permanently delete item"
              : "Permanently delete list"
          }
          accessibilityState={{ disabled: deleting, busy: deleting }}
        >
          {deleting ? (
            <ActivityIndicator size="small" color={palette.onError} />
          ) : (
            <Icon name="trash" size={20} color={palette.onError} />
          )}
          <Text style={styles.deleteConfirmText}>
            {deleting ? "Deleting…" : "Delete"}
          </Text>
        </Pressable>
        <Pressable
          onPress={cancel}
          disabled={deleting}
          style={({ pressed }) => [
            styles.deleteCancel,
            pressed && styles.deleteCancelPressed,
            deleting && actionStyles.disabledButton,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: deleting }}
        >
          <Text style={styles.deleteCancelText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
  // Context sheets reuse this content inside their existing native modal.
  if (embedded) return visible ? content : null;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={cancel}
      onShow={() => {
        const handle = findNodeHandle(heading.current);
        if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
      }}
    >
      {content}
    </Modal>
  );
}
