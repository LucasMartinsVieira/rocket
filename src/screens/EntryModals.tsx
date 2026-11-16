import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, type IconName } from "../components/Icon";
import {
  Cover,
  FormField,
  isUsableImageUrl,
  statusColor,
} from "../components/MediaUI";
import {
  CREATOR_ROLE,
  type CustomList,
  type EntryDraft,
  type JournalEntry,
  MEDIA_TYPES,
  type MediaEntry,
  type MediaStatus,
  STATUSES,
} from "../model";
import { styles } from "../styles";
import { LookupImportScreen } from "./LookupImportScreen";
import { palette } from "../theme";

const mediaTypeIcons: Record<MediaEntry["type"], IconName> = {
  Anime: "sparkles",
  Manga: "bookImage",
  Movie: "clapperboard",
  Book: "book",
  Game: "gamepad",
};

export function EntryDetailsModal({
  detailEntry,
  onClose,
  onEdit,
  journal,
  journalDraft,
  setJournalDraft,
  onChangeStatus,
  lists,
  onToggleList,
  onOpenLists,
  onAddJournal,
  onRemove,
}: {
  detailEntry: MediaEntry | null;
  onClose: () => void;
  onEdit: (entry: MediaEntry) => void;
  journal: JournalEntry[];
  journalDraft: string;
  setJournalDraft: (value: string) => void;
  onChangeStatus: (status: MediaStatus) => void;
  lists: CustomList[];
  onToggleList: (listId: string, included: boolean) => void;
  onOpenLists: () => void;
  onAddJournal: () => void;
  onRemove: () => void;
}) {
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [journalComposerOpen, setJournalComposerOpen] = useState(false);
  const [managingLists, setManagingLists] = useState(false);
  useEffect(() => setManagingLists(false), [detailEntry?.id]);
  return (
    <Modal
      visible={!!detailEntry}
      animationType="slide"
      onRequestClose={onClose}
    >
      {detailEntry ? (
        <SafeAreaView style={styles.modalSafe} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <Pressable
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Back to library"
            >
              <Text style={styles.closeText}>‹</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Media Item Detail</Text>
            <Pressable
              onPress={() => detailEntry && onEdit(detailEntry)}
              style={styles.saveAction}
              accessibilityRole="button"
              accessibilityLabel="Edit title"
            >
              <Text style={styles.saveText}>Edit</Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.detailBody}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.detailHero}>
              <Cover
                uri={detailEntry.coverUri}
                type={detailEntry.type}
                title={detailEntry.title}
                large
              />
            </View>
            <Text style={styles.detailTitle}>{detailEntry.title}</Text>
            {detailEntry.alternateTitles.length ? (
              <Text style={[styles.helperText, { textAlign: "center" }]}>
                {detailEntry.alternateTitles.join(" · ")}
              </Text>
            ) : null}
            <View style={styles.statusSelectWrap}>
              <Pressable
                style={styles.statusSelector}
                onPress={() => setStatusMenuOpen((open) => !open)}
                accessibilityRole="button"
                accessibilityLabel={`Status: ${detailEntry.status}`}
                accessibilityState={{ expanded: statusMenuOpen }}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: statusColor(detailEntry.status) },
                  ]}
                />
                <Text style={styles.statusSelectorText}>
                  {detailEntry.status}
                </Text>
                <Icon name="chevronDown" size={18} color={palette.faint} />
              </Pressable>
              {statusMenuOpen ? (
                <View style={styles.statusMenu}>
                  {STATUSES.map((status) => (
                    <Pressable
                      key={status}
                      style={[
                        styles.statusOption,
                        detailEntry.status === status &&
                          styles.statusOptionSelected,
                      ]}
                      onPress={() => {
                        onChangeStatus(status);
                        setStatusMenuOpen(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={status}
                      accessibilityState={{
                        selected: detailEntry.status === status,
                      }}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: statusColor(status) },
                        ]}
                      />
                      <Text style={styles.statusOptionText}>{status}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
            <View style={styles.factRail}>
              <View style={styles.mediaTypeFact}>
                <Icon
                  name={mediaTypeIcons[detailEntry.type]}
                  size={16}
                  color={palette.violetText}
                />
                <Text style={styles.factText}>{detailEntry.type}</Text>
              </View>
              {detailEntry.releaseYear ? (
                <>
                  <View style={styles.factSeparator} />
                  <Text style={styles.factText}>{detailEntry.releaseYear}</Text>
                </>
              ) : null}
              {detailEntry.creator ? (
                <>
                  <View style={styles.factSeparator} />
                  <Text style={styles.factText}>{detailEntry.creator}</Text>
                </>
              ) : null}
            </View>
            {detailEntry.summary ? (
              <>
                <Text style={styles.detailSection}>Summary</Text>
                <Text style={styles.detailCopy}>{detailEntry.summary}</Text>
              </>
            ) : null}
            <View style={styles.sectionHeader}>
              <Text style={styles.detailSection}>In lists</Text>
              <Pressable
                onPress={() => setManagingLists((current) => !current)}
                style={styles.quietAction}
                accessibilityRole="button"
                accessibilityLabel="Manage list memberships"
                accessibilityState={{ expanded: managingLists }}
              >
                <View style={styles.mediaTypeFact}>
                  <Icon name="plus" size={14} color={palette.violetText} />
                  <Text style={styles.quietActionText}>
                    {managingLists ? "Done" : "Manage"}
                  </Text>
                </View>
              </Pressable>
            </View>
            {!managingLists ? (
              <View style={styles.membershipWrap}>
                {lists
                  .filter((list) => detailEntry.listIds.includes(list.id))
                  .map((list) => (
                    <View key={list.id} style={styles.membershipChip}>
                      <Icon name="list" size={14} color={palette.muted} />
                      <Text style={styles.membershipLabel}>{list.name}</Text>
                    </View>
                  ))}
                {!lists.some((list) =>
                  detailEntry.listIds.includes(list.id),
                ) ? (
                  <Text style={styles.helperText}>Not in any lists yet.</Text>
                ) : null}
              </View>
            ) : lists.length ? (
              <View style={styles.membershipWrap}>
                {lists.map((list) => {
                  const included = detailEntry.listIds.includes(list.id);
                  return (
                    <Pressable
                      key={list.id}
                      onPress={() => onToggleList(list.id, !included)}
                      style={[
                        styles.membershipChip,
                        included && styles.membershipChipSelected,
                      ]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: included }}
                    >
                      <Text
                        style={[
                          styles.membershipMark,
                          included && styles.membershipMarkSelected,
                        ]}
                      >
                        {included ? "✓" : "+"}
                      </Text>
                      <Text
                        style={[
                          styles.membershipLabel,
                          included && styles.membershipLabelSelected,
                        ]}
                      >
                        {list.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.noListsPrompt}>
                <Text style={styles.helperText}>
                  Create a list to group this title with others.
                </Text>
                <Pressable
                  onPress={onOpenLists}
                  style={styles.quietAction}
                  accessibilityRole="button"
                >
                  <Text style={styles.quietActionText}>Create a list</Text>
                </Pressable>
              </View>
            )}
            <View style={styles.sectionHeader}>
              <Text style={styles.detailSection}>Your note</Text>
              <Pressable
                onPress={() => onEdit(detailEntry)}
                style={styles.quietAction}
                accessibilityRole="button"
                accessibilityLabel="Edit note"
              >
                <Text style={styles.quietActionText}>Edit</Text>
              </Pressable>
            </View>
            <View style={styles.noteCard}>
              <Text style={styles.detailCopy}>
                {detailEntry.note ||
                  "No note yet. Add one to keep a thought with this title."}
              </Text>
            </View>
            <View style={styles.sectionHeader}>
              <Text style={styles.detailSection}>Journal</Text>
              <Pressable
                onPress={() => setJournalComposerOpen((open) => !open)}
                style={styles.journalAddButton}
                accessibilityRole="button"
                accessibilityLabel="Add journal entry"
              >
                <Text style={styles.journalAddText}>
                  {journalComposerOpen ? "Cancel" : "＋  Add entry"}
                </Text>
              </Pressable>
            </View>
            {journalComposerOpen ? (
              <View style={styles.journalComposer}>
                <TextInput
                  value={journalDraft}
                  onChangeText={setJournalDraft}
                  placeholder="Write a dated thought…"
                  placeholderTextColor={palette.faint}
                  style={[styles.input, styles.multiline]}
                  multiline
                  textAlignVertical="top"
                  accessibilityLabel="Journal entry"
                />
                <Pressable
                  style={[
                    styles.primaryButton,
                    !journalDraft.trim() && styles.disabledButton,
                  ]}
                  onPress={() => {
                    onAddJournal();
                    setJournalComposerOpen(false);
                  }}
                  disabled={!journalDraft.trim()}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryButtonText}>Save entry</Text>
                </Pressable>
              </View>
            ) : null}
            {journal.length ? (
              journal.map((item) => (
                <View key={item.id} style={styles.journalItem}>
                  <Text style={styles.journalDate}>
                    {new Date(item.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                  <Text style={styles.journalBody}>{item.body}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.helperText}>Your journal is empty.</Text>
            )}
            <Pressable
              style={styles.removeButton}
              onPress={onRemove}
              accessibilityRole="button"
            >
              <View style={styles.mediaTypeFact}>
                <Icon name="trash" size={18} color={palette.red} />
                <Text style={styles.removeButtonText}>Remove title</Text>
              </View>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      ) : null}
    </Modal>
  );
}

export function EntryFormModal({
  visible,
  onClose,
  onSave,
  onDelete,
  draft,
  setValue,
  onChangeType,
  journal,
  journalDraft,
  setJournalDraft,
  formError,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  draft: EntryDraft;
  setValue: <K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) => void;
  onChangeType: (type: EntryDraft["type"]) => void;
  journal: JournalEntry[];
  journalDraft: string;
  setJournalDraft: (value: string) => void;
  formError: string;
}) {
  const [lookupVisible, setLookupVisible] = useState(false);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.modalContent}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalHeader}>
            <Pressable
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close entry editor"
            >
              <Icon name="x" size={18} color={palette.ink} />
            </Pressable>
            <Text style={styles.modalTitle}>
              {draft.id ? "Title details" : "Add a title"}
            </Text>
            <Pressable
              onPress={onSave}
              style={styles.saveAction}
              accessibilityRole="button"
              accessibilityLabel="Save title"
            >
              <Text style={styles.saveText}>Save</Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {!draft.id ? (
              <Pressable
                onPress={() => setLookupVisible(true)}
                style={styles.lookupEntryButton}
                accessibilityRole="button"
                accessibilityLabel="Find a title with catalog lookup"
              >
                <Icon name="search" size={18} color={palette.violetText} />
                <View style={styles.lookupEntryCopy}>
                  <Text style={styles.lookupEntryTitle}>Lookup & Import</Text>
                  <Text style={styles.lookupEntrySubtitle}>
                    Find a title or continue entering manually
                  </Text>
                </View>
                <Icon
                  name="chevronRight"
                  size={18}
                  color={palette.violetText}
                />
              </Pressable>
            ) : null}
            <Text style={styles.fieldLabel}>Media type</Text>
            <View style={styles.chipWrap}>
              {MEDIA_TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => onChangeType(type)}
                  style={[
                    styles.formMediaType,
                    draft.type === type && styles.formMediaTypeSelected,
                  ]}
                  accessibilityRole="radio"
                  accessibilityLabel={type}
                  accessibilityState={{ selected: draft.type === type }}
                >
                  <Icon
                    name={mediaTypeIcons[type]}
                    size={18}
                    color={
                      draft.type === type ? palette.background : palette.muted
                    }
                  />
                  <Text
                    style={[
                      styles.formMediaTypeText,
                      draft.type === type && styles.formMediaTypeTextSelected,
                    ]}
                  >
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>

            <FormField
              label="Title"
              value={draft.title}
              onChangeText={(value) => setValue("title", value)}
              placeholder="What is it called?"
            />
            {formError.startsWith("Enter a title") ? (
              <Text style={styles.fieldError}>{formError}</Text>
            ) : null}
            <FormField
              label="Alternate titles"
              value={draft.alternateTitles.join(", ")}
              onChangeText={(value) =>
                setValue(
                  "alternateTitles",
                  value
                    .split(",")
                    .map((title) => title.trim())
                    .filter(Boolean),
                )
              }
              placeholder="Comma-separated"
            />
            <FormField
              label="Cover image URL"
              value={draft.coverUri}
              onChangeText={(value) => setValue("coverUri", value)}
              placeholder="https://…"
              autoCapitalize="none"
            />
            {draft.coverUri ? (
              <View style={styles.coverPreview}>
                <Cover
                  uri={isUsableImageUrl(draft.coverUri) ? draft.coverUri : ""}
                  type={draft.type}
                  title={draft.title}
                  large
                />
              </View>
            ) : null}
            <FormField
              label={CREATOR_ROLE[draft.type]}
              value={draft.creator}
              onChangeText={(value) => setValue("creator", value)}
              placeholder="Creator name"
            />
            <FormField
              label="Year of release"
              value={draft.releaseYear == null ? "" : String(draft.releaseYear)}
              onChangeText={(value) =>
                setValue("releaseYear", value.trim() ? Number(value) : null)
              }
              placeholder="e.g. 2024"
              keyboardType="number-pad"
            />
            {formError.startsWith("Enter a year") ? (
              <Text style={styles.fieldError}>{formError}</Text>
            ) : null}
            <FormField
              label="Summary"
              value={draft.summary}
              onChangeText={(value) => setValue("summary", value)}
              placeholder="A short description"
              multiline
            />

            <Text style={[styles.fieldLabel, styles.sectionLabel]}>Status</Text>
            <View style={styles.formStatusGrid}>
              {STATUSES.map((status) => (
                <Pressable
                  key={status}
                  onPress={() => setValue("status", status)}
                  style={[
                    styles.formStatusOption,
                    draft.status === status && styles.formStatusOptionSelected,
                  ]}
                  accessibilityRole="radio"
                  accessibilityLabel={status}
                  accessibilityState={{ selected: draft.status === status }}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: statusColor(status) },
                    ]}
                  />
                  <Text
                    style={[
                      styles.formStatusText,
                      draft.status === status && styles.formStatusTextSelected,
                    ]}
                  >
                    {status}
                  </Text>
                </Pressable>
              ))}
            </View>

            <FormField
              label="Your note"
              value={draft.note}
              onChangeText={(value) => setValue("note", value)}
              placeholder="A note that stays with this title"
              multiline
            />

            {draft.id ? (
              <>
                <Text style={[styles.fieldLabel, styles.sectionLabel]}>
                  Journal
                </Text>
                <Text style={styles.helperText}>
                  Dated thoughts stay separate from your note.
                </Text>
                <TextInput
                  value={journalDraft}
                  onChangeText={setJournalDraft}
                  placeholder="Write a thought…"
                  placeholderTextColor={palette.faint}
                  style={[styles.input, styles.multiline, styles.journalInput]}
                  multiline
                  textAlignVertical="top"
                />
                {journal.length ? (
                  journal.map((entry) => (
                    <View key={entry.id} style={styles.journalItem}>
                      <Text style={styles.journalDate}>
                        {new Date(entry.createdAt).toLocaleDateString(
                          undefined,
                          { year: "numeric", month: "short", day: "numeric" },
                        )}
                      </Text>
                      <Text style={styles.journalBody}>{entry.body}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.helperText}>Your journal is empty.</Text>
                )}
              </>
            ) : (
              <Text style={[styles.helperText, styles.journalHint]}>
                Save the title to start its journal.
              </Text>
            )}

            {draft.id ? (
              <Pressable style={styles.removeButton} onPress={onDelete}>
                <Text style={styles.removeButtonText}>Remove title</Text>
              </Pressable>
            ) : null}
            {formError.startsWith("Could not") ||
            formError.startsWith("Cover URL") ? (
              <Text style={styles.errorText} accessibilityRole="alert">
                {formError}
              </Text>
            ) : null}
          </ScrollView>
          <LookupImportScreen
            visible={lookupVisible}
            onClose={() => setLookupVisible(false)}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
