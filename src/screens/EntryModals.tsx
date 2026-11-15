import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Chip, Cover, FormField, isUsableImageUrl } from "../components/MediaUI";
import { palette } from "../theme";
import { styles } from "../styles";
import { CREATOR_ROLE, MEDIA_TYPES, STATUSES, type CustomList, type EntryDraft, type JournalEntry, type MediaEntry, type MediaStatus } from "../model";

export function EntryDetailsModal({ detailEntry, onClose, onEdit, journal, journalDraft, setJournalDraft, onChangeStatus, onAddJournal, onRemove }: {
  detailEntry: MediaEntry | null;
  onClose: () => void;
  onEdit: (entry: MediaEntry) => void;
  journal: JournalEntry[];
  journalDraft: string;
  setJournalDraft: (value: string) => void;
  onChangeStatus: (status: MediaStatus) => void;
  onAddJournal: () => void;
  onRemove: () => void;
}) {
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
              <Text style={styles.modalTitle}>Title details</Text>
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
                <Text style={styles.helperText}>
                  {detailEntry.alternateTitles.join(" · ")}
                </Text>
              ) : null}
              <View style={styles.chipWrap}>
                {STATUSES.map((status) => (
                  <Chip
                    key={status}
                    label={status}
                    selected={detailEntry.status === status}
                    onPress={() => onChangeStatus(status)}
                    compact
                  />
                ))}
              </View>
              <Text style={styles.detailFacts}>
                {[
                  detailEntry.type,
                  detailEntry.releaseYear,
                  detailEntry.creator
                    ? `${detailEntry.creatorRole}: ${detailEntry.creator}`
                    : "",
                ]
                  .filter(Boolean)
                  .join("  ·  ")}
              </Text>
              {detailEntry.summary ? (
                <>
                  <Text style={styles.detailSection}>Summary</Text>
                  <Text style={styles.detailCopy}>{detailEntry.summary}</Text>
                </>
              ) : null}
              <Text style={styles.detailSection}>Your note</Text>
              <Text style={styles.detailCopy}>
                {detailEntry.note ||
                  "No note yet. Add one when editing this title."}
              </Text>
              <View style={styles.journalHeading}>
                <Text style={styles.detailSection}>Journal</Text>
                <Text style={styles.helperText}>Dated entries</Text>
              </View>
              <TextInput
                value={journalDraft}
                onChangeText={setJournalDraft}
                placeholder="Add journal entry"
                placeholderTextColor={palette.faint}
                style={[styles.input, styles.multiline]}
                multiline
                textAlignVertical="top"
                accessibilityLabel="Add journal entry"
              />
              <Pressable
                style={[
                  styles.primaryButton,
                  !journalDraft.trim() && styles.disabledButton,
                ]}
                onPress={onAddJournal}
                disabled={!journalDraft.trim()}
                accessibilityRole="button"
              >
                <Text style={styles.primaryButtonText}>Add journal entry</Text>
              </Pressable>
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
              <Pressable style={styles.removeButton} onPress={onRemove} accessibilityRole="button">
                <Text style={styles.removeButtonText}>Remove title</Text>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        ) : null}
      </Modal>
  );
}

export function EntryFormModal({ visible, onClose, onSave, onDelete, draft, setValue, onChangeType, lists, journal, journalDraft, setJournalDraft, formError }: {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  draft: EntryDraft;
  setValue: <K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) => void;
  onChangeType: (type: EntryDraft["type"]) => void;
  lists: CustomList[];
  journal: JournalEntry[];
  journalDraft: string;
  setJournalDraft: (value: string) => void;
  formError: string;
}) {
  return (
<Modal
        visible={visible}
        animationType="slide"
        onRequestClose={onClose}
      >
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
                <Text style={styles.closeText}>×</Text>
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
              <Text style={styles.fieldLabel}>Media type</Text>
              <View style={styles.chipWrap}>
                {MEDIA_TYPES.map((type) => (
                  <Chip
                    key={type}
                    label={type}
                    selected={draft.type === type}
                    onPress={() => onChangeType(type)}
                  />
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
                value={
                  draft.releaseYear == null ? "" : String(draft.releaseYear)
                }
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

              <Text style={[styles.fieldLabel, styles.sectionLabel]}>
                Status
              </Text>
              <View style={styles.chipWrap}>
                {STATUSES.map((status) => (
                  <Chip
                    key={status}
                    label={status}
                    selected={draft.status === status}
                    onPress={() => setValue("status", status)}
                    compact
                  />
                ))}
              </View>

              <FormField
                label="Your note"
                value={draft.note}
                onChangeText={(value) => setValue("note", value)}
                placeholder="A note that stays with this title"
                multiline
              />

              <Text style={[styles.fieldLabel, styles.sectionLabel]}>
                Your lists
              </Text>
              {lists.length ? (
                <View style={styles.chipWrap}>
                  {lists.map((list) => {
                    const selected = draft.listIds.includes(list.id);
                    return (
                      <Chip
                        key={list.id}
                        label={`${selected ? "✓  " : ""}${list.name}`}
                        selected={selected}
                        onPress={() =>
                          setValue(
                            "listIds",
                            selected
                              ? draft.listIds.filter((id) => id !== list.id)
                              : [...draft.listIds, list.id],
                          )
                        }
                      />
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.helperText}>
                  Create a list from the Lists tab.
                </Text>
              )}

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
                    style={[
                      styles.input,
                      styles.multiline,
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
                    <Text style={styles.helperText}>
                      Your journal is empty.
                    </Text>
                  )}
                </>
              ) : (
                <Text style={[styles.helperText, styles.journalHint]}>
                  Save the title to start its journal.
                </Text>
              )}

              {draft.id ? (
                <Pressable
                  style={styles.removeButton}
                  onPress={onDelete}
                >
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
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
  );
}
