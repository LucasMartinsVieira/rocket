import { useEffect, useState } from "react";
import {
  Alert,
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
import { DeleteConfirmationDialog } from "../../components/DeleteConfirmationDialog";
import { Icon, MEDIA_TYPE_ICONS } from "../../components/Icon";
import {
  Cover,
  FormField,
  isUsableImageUrl,
  statusColor,
} from "../../components/MediaUI";
import { RatingStars } from "../../components/RatingStars";
import { actionStyles } from "../../components/shared/actions.styles";
import { formStyles } from "../../components/shared/form.styles";
import { layoutStyles } from "../../components/shared/layout.styles";
import { mediaStyles } from "../../components/shared/mediaPresentation.styles";
import {
  CREATOR_ROLE,
  type CustomList,
  DURATION_LABEL,
  type EntryDraft,
  formatCalendarDate,
  formatDuration,
  type JournalEntry,
  MEDIA_TYPES,
  type MediaEntry,
  type MediaStatus,
  STATUSES,
} from "../../model";
import { palette } from "../../theme";
import { LookupImportScreen } from "../LookupImportScreen";
import { styles } from "./styles";

export function EntryDetailsModal({
  detailEntry,
  onClose,
  onEdit,
  journal,
  journalDraft,
  setJournalDraft,
  onChangeStatus,
  onChangeRating,
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
  onChangeRating: (rating: number | null) => Promise<void>;
  lists: CustomList[];
  onToggleList: (listId: string, included: boolean) => void;
  onOpenLists: () => void;
  onAddJournal: () => void;
  onRemove: () => Promise<void>;
}) {
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [journalComposerOpen, setJournalComposerOpen] = useState(false);
  const [managingLists, setManagingLists] = useState(false);
  const [savingRating, setSavingRating] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const compatibleLists = lists.filter(
    (list) => list.type === detailEntry?.type,
  );
  useEffect(() => setManagingLists(false), [detailEntry?.id]);
  useEffect(() => setConfirmingDelete(false), [detailEntry?.id]);
  return (
    <Modal
      visible={!!detailEntry}
      animationType="slide"
      onRequestClose={onClose}
    >
      {detailEntry ? (
        <SafeAreaView style={layoutStyles.screen} edges={["top", "bottom"]}>
          <View style={layoutStyles.modalHeader}>
            <Pressable
              style={actionStyles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Back to library"
            >
              <Icon name="chevronLeft" size={24} color={palette.ink} />
            </Pressable>
            <Text style={layoutStyles.modalTitle}>Media Item Detail</Text>
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
              <Text style={[formStyles.helperText, { textAlign: "center" }]}>
                {detailEntry.alternateTitles.join(" · ")}
              </Text>
            ) : null}
            <View style={styles.statusSelectWrap}>
              <Pressable
                style={mediaStyles.statusSelector}
                onPress={() => setStatusMenuOpen((open) => !open)}
                accessibilityRole="button"
                accessibilityLabel={`Status: ${detailEntry.status}`}
                accessibilityState={{ expanded: statusMenuOpen }}
              >
                <View
                  style={[
                    mediaStyles.statusDot,
                    { backgroundColor: statusColor(detailEntry.status) },
                  ]}
                />
                <Text style={mediaStyles.statusSelectorText}>
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
                        mediaStyles.statusOption,
                        detailEntry.status === status &&
                          mediaStyles.statusOptionSelected,
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
                          mediaStyles.statusDot,
                          { backgroundColor: statusColor(status) },
                        ]}
                      />
                      <Text style={mediaStyles.statusOptionText}>{status}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
            <View style={styles.ratingDetail}>
              <Text style={formStyles.fieldLabel}>Your rating</Text>
              <RatingStars
                value={detailEntry.rating}
                disabled={savingRating}
                onChange={(rating) => {
                  setSavingRating(true);
                  void onChangeRating(rating).finally(() =>
                    setSavingRating(false),
                  );
                }}
              />
            </View>
            <View style={styles.factRail}>
              <View style={mediaStyles.mediaTypeFact}>
                <Icon
                  name={MEDIA_TYPE_ICONS[detailEntry.type]}
                  size={16}
                  color={palette.ink}
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
              {formatDuration(detailEntry.type, detailEntry.duration) ? (
                <>
                  <View style={styles.factSeparator} />
                  <Text style={styles.factText}>
                    {formatDuration(detailEntry.type, detailEntry.duration)}
                  </Text>
                </>
              ) : null}
            </View>
            {detailEntry.summary ? (
              <>
                <Text style={styles.detailSection}>Summary</Text>
                <Text style={styles.detailCopy}>{detailEntry.summary}</Text>
              </>
            ) : null}
            {detailEntry.startDate || detailEntry.endDate ? (
              <>
                <Text style={styles.detailSection}>Your dates</Text>
                {detailEntry.startDate ? (
                  <Text style={styles.detailCopy}>
                    Start date: {formatCalendarDate(detailEntry.startDate)}
                  </Text>
                ) : null}
                {detailEntry.endDate ? (
                  <Text style={styles.detailCopy}>
                    End date: {formatCalendarDate(detailEntry.endDate)}
                  </Text>
                ) : null}
              </>
            ) : null}
            <View style={formStyles.sectionHeader}>
              <Text style={styles.detailSection}>In lists</Text>
              <Pressable
                onPress={() => setManagingLists((current) => !current)}
                style={actionStyles.quietAction}
                accessibilityRole="button"
                accessibilityLabel="Manage list memberships"
                accessibilityState={{ expanded: managingLists }}
              >
                <View style={mediaStyles.mediaTypeFact}>
                  <Icon name="plus" size={14} color={palette.violetText} />
                  <Text style={actionStyles.quietActionText}>
                    {managingLists ? "Done" : "Manage"}
                  </Text>
                </View>
              </Pressable>
            </View>
            {!managingLists ? (
              <View style={styles.membershipWrap}>
                {compatibleLists
                  .filter((list) => detailEntry.listIds.includes(list.id))
                  .map((list) => (
                    <View key={list.id} style={styles.membershipChip}>
                      <Icon name={list.icon} size={14} color={palette.muted} />
                      <Text style={styles.membershipLabel}>{list.name}</Text>
                    </View>
                  ))}
                {!compatibleLists.some((list) =>
                  detailEntry.listIds.includes(list.id),
                ) ? (
                  <Text style={formStyles.helperText}>
                    Not in any lists yet.
                  </Text>
                ) : null}
              </View>
            ) : compatibleLists.length ? (
              <View style={styles.membershipWrap}>
                {compatibleLists.map((list) => {
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
                <Text style={formStyles.helperText}>
                  Create a {detailEntry.type} list to group this title with
                  others.
                </Text>
                <Pressable
                  onPress={onOpenLists}
                  style={actionStyles.quietAction}
                  accessibilityRole="button"
                >
                  <Text style={actionStyles.quietActionText}>
                    Create a list
                  </Text>
                </Pressable>
              </View>
            )}
            <View style={formStyles.sectionHeader}>
              <Text style={styles.detailSection}>Your note</Text>
              <Pressable
                onPress={() => onEdit(detailEntry)}
                style={actionStyles.quietAction}
                accessibilityRole="button"
                accessibilityLabel="Edit note"
              >
                <Text style={actionStyles.quietActionText}>Edit</Text>
              </Pressable>
            </View>
            <View style={styles.noteCard}>
              <Text style={styles.detailCopy}>
                {detailEntry.note ||
                  "No note yet. Add one to keep a thought with this title."}
              </Text>
            </View>
            <View style={formStyles.sectionHeader}>
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
                  style={[formStyles.input, formStyles.multiline]}
                  multiline
                  textAlignVertical="top"
                  accessibilityLabel="Journal entry"
                />
                <Pressable
                  style={[
                    actionStyles.primaryButton,
                    !journalDraft.trim() && actionStyles.disabledButton,
                  ]}
                  onPress={() => {
                    onAddJournal();
                    setJournalComposerOpen(false);
                  }}
                  disabled={!journalDraft.trim()}
                  accessibilityRole="button"
                >
                  <Text style={actionStyles.primaryButtonText}>Save entry</Text>
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
              <Text style={formStyles.helperText}>Your journal is empty.</Text>
            )}
            <Pressable
              style={styles.removeButton}
              onPress={() => setConfirmingDelete(true)}
              accessibilityRole="button"
            >
              <View style={mediaStyles.mediaTypeFact}>
                <Icon name="trash" size={18} color={palette.red} />
                <Text style={styles.removeButtonText}>Remove title</Text>
              </View>
            </Pressable>
          </ScrollView>
          <DeleteConfirmationDialog
            visible={confirmingDelete}
            target={{ kind: "entry", entry: detailEntry }}
            onCancel={() => setConfirmingDelete(false)}
            onConfirm={onRemove}
          />
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
  onDelete: () => Promise<void>;
  draft: EntryDraft;
  setValue: <K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) => void;
  onChangeType: (type: EntryDraft["type"]) => void;
  journal: JournalEntry[];
  journalDraft: string;
  setJournalDraft: (value: string) => void;
  formError: string;
}) {
  const [lookupVisible, setLookupVisible] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  useEffect(() => {
    if (!visible) setConfirmingDelete(false);
  }, [visible]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={layoutStyles.screen} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={layoutStyles.fill}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={layoutStyles.modalHeader}>
            <Pressable
              style={actionStyles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close entry editor"
            >
              <Icon name="x" size={18} color={palette.ink} />
            </Pressable>
            <Text style={layoutStyles.modalTitle}>
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
            <Text style={formStyles.fieldLabel}>Media type</Text>
            <View style={formStyles.chipWrap}>
              {MEDIA_TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => onChangeType(type)}
                  style={[
                    formStyles.formMediaType,
                    draft.type === type && formStyles.formMediaTypeSelected,
                  ]}
                  accessibilityRole="radio"
                  accessibilityLabel={type}
                  accessibilityState={{ selected: draft.type === type }}
                >
                  <Icon
                    name={MEDIA_TYPE_ICONS[type]}
                    size={18}
                    color={
                      draft.type === type ? palette.background : palette.muted
                    }
                  />
                  <Text
                    style={[
                      formStyles.formMediaTypeText,
                      draft.type === type &&
                        formStyles.formMediaTypeTextSelected,
                    ]}
                  >
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>

            {draft.id ? (
              <Text style={formStyles.helperText}>
                Changing media type removes incompatible list memberships when
                you save. Your title, note, and journal stay in the library.
              </Text>
            ) : null}
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

            {DURATION_LABEL[draft.type] ? (
              <View style={formStyles.formField}>
                <Text style={formStyles.fieldLabel}>
                  {DURATION_LABEL[draft.type]} (optional)
                </Text>
                <TextInput
                  value={draft.duration === null ? "" : String(draft.duration)}
                  onChangeText={(value) => {
                    if (/^\d*$/.test(value))
                      setValue("duration", value ? Number(value) : null);
                  }}
                  placeholder="Total, not your current progress"
                  placeholderTextColor={palette.faint}
                  style={formStyles.input}
                  keyboardType="number-pad"
                  maxLength={9}
                  accessibilityLabel={DURATION_LABEL[draft.type] ?? "Duration"}
                />
                {formError.startsWith("Duration") ? (
                  <Text style={styles.fieldError} accessibilityRole="alert">
                    {formError}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <Text style={[formStyles.fieldLabel, styles.sectionLabel]}>
              Your rating (optional)
            </Text>
            <RatingStars
              value={draft.rating}
              onChange={(rating) => setValue("rating", rating)}
            />

            <Text style={[formStyles.fieldLabel, styles.sectionLabel]}>
              Status
            </Text>
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
                      mediaStyles.statusDot,
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

            <Text style={[formStyles.fieldLabel, styles.sectionLabel]}>
              Your dates (optional)
            </Text>
            <Text style={formStyles.helperText}>
              When you started or finished this title. Use YYYY-MM-DD.
            </Text>
            <FormField
              label="Start date"
              value={draft.startDate ?? ""}
              onChangeText={(value) => setValue("startDate", value || null)}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
            <FormField
              label="End date"
              value={draft.endDate ?? ""}
              onChangeText={(value) => setValue("endDate", value || null)}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
            {formError.startsWith("Start date") ||
            formError.startsWith("End date") ? (
              <Text style={styles.fieldError} accessibilityRole="alert">
                {formError}
              </Text>
            ) : null}

            <FormField
              label="Your note"
              value={draft.note}
              onChangeText={(value) => setValue("note", value)}
              placeholder="A note that stays with this title"
              multiline
            />

            {draft.id ? (
              <>
                <Text style={[formStyles.fieldLabel, styles.sectionLabel]}>
                  Journal
                </Text>
                <Text style={formStyles.helperText}>
                  Dated thoughts stay separate from your note.
                </Text>
                <TextInput
                  value={journalDraft}
                  onChangeText={setJournalDraft}
                  placeholder="Write a thought…"
                  placeholderTextColor={palette.faint}
                  style={[
                    formStyles.input,
                    formStyles.multiline,
                    styles.journalInput,
                  ]}
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
                  <Text style={formStyles.helperText}>
                    Your journal is empty.
                  </Text>
                )}
              </>
            ) : (
              <Text style={[formStyles.helperText, styles.journalHint]}>
                Save the title to start its journal.
              </Text>
            )}

            {draft.id ? (
              <Pressable
                style={styles.removeButton}
                onPress={() => setConfirmingDelete(true)}
                accessibilityRole="button"
              >
                <Text style={styles.removeButtonText}>Remove title</Text>
              </Pressable>
            ) : null}
            {formError.startsWith("Could not") ||
            formError.startsWith("Cover URL") ? (
              <Text style={formStyles.errorText} accessibilityRole="alert">
                {formError}
              </Text>
            ) : null}
          </ScrollView>
          <LookupImportScreen
            visible={lookupVisible}
            onClose={() => setLookupVisible(false)}
            onImport={(result) => {
              const fill = () => {
                onChangeType(result.type);
                setValue("sourceUrl", result.sourceUrl);
                setValue(
                  "duration",
                  result.duration ??
                    (draft.type === result.type ? draft.duration : null),
                );
                setValue("creatorRole", CREATOR_ROLE[result.type]);
                setValue("title", result.title);
                if (result.creator) setValue("creator", result.creator);
                if (result.summary) setValue("summary", result.summary);
                if (result.coverUri) setValue("coverUri", result.coverUri);
                if (result.releaseYear !== null)
                  setValue("releaseYear", result.releaseYear);
                setLookupVisible(false);
              };
              if (
                draft.title ||
                draft.creator ||
                draft.summary ||
                draft.coverUri ||
                draft.releaseYear !== null ||
                draft.duration !== null
              ) {
                Alert.alert(
                  "Replace form metadata?",
                  "Import catalog metadata, including known duration, into this draft? Your rating, status, dates, note, alternate titles, and matching list memberships stay unchanged. Changing media type removes incompatible memberships when you save. Nothing is saved until you tap Save.",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Fill form", onPress: fill },
                  ],
                );
              } else fill();
            }}
          />
        </KeyboardAvoidingView>
        <DeleteConfirmationDialog
          visible={confirmingDelete}
          target={{ kind: "entry", entry: draft }}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={onDelete}
        />
      </SafeAreaView>
    </Modal>
  );
}
