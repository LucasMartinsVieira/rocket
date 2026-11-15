import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Chip, Cover, FormField, isUsableImageUrl, statusColor } from "../components/MediaUI";
import { palette } from "../theme";
import { styles } from "../styles";
import { CREATOR_ROLE, MEDIA_TYPES, STATUSES, type EntryDraft, type JournalEntry, type MediaEntry, type MediaStatus } from "../model";

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
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [journalComposerOpen, setJournalComposerOpen] = useState(false);
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
              <Text style={styles.modalTitle}>Media item detail</Text>
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
              <View style={styles.statusSelectWrap}>
                <Pressable style={styles.statusSelector} onPress={() => setStatusMenuOpen((open) => !open)} accessibilityRole="button" accessibilityLabel={`Status: ${detailEntry.status}`} accessibilityState={{ expanded: statusMenuOpen }}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor(detailEntry.status) }]} />
                  <Text style={styles.statusSelectorText}>{detailEntry.status}</Text>
                  <Text style={styles.statusArrow}>⌄</Text>
                </Pressable>
                {statusMenuOpen ? <View style={styles.statusMenu}>
                  {STATUSES.map((status) => <Pressable key={status} style={[styles.statusOption, detailEntry.status === status && styles.statusOptionSelected]} onPress={() => { onChangeStatus(status); setStatusMenuOpen(false); }} accessibilityRole="button" accessibilityLabel={status} accessibilityState={{ selected: detailEntry.status === status }}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor(status) }]} />
                    <Text style={styles.statusOptionText}>{status}</Text>
                  </Pressable>)}
                </View> : null}
              </View>
              <View style={styles.factRail}>
                <Text style={styles.factText}>{detailEntry.type}</Text>
                {detailEntry.releaseYear ? <><View style={styles.factSeparator} /><Text style={styles.factText}>{detailEntry.releaseYear}</Text></> : null}
                {detailEntry.creator ? <><View style={styles.factSeparator} /><Text style={styles.factText}>{detailEntry.creatorRole}: {detailEntry.creator}</Text></> : null}
              </View>
              {detailEntry.summary ? (
                <>
                  <Text style={styles.detailSection}>Summary</Text>
                  <Text style={styles.detailCopy}>{detailEntry.summary}</Text>
                </>
              ) : null}
              <View style={styles.sectionHeader}>
                <Text style={styles.detailSection}>Your note</Text>
                <Pressable onPress={() => onEdit(detailEntry)} style={styles.quietAction} accessibilityRole="button" accessibilityLabel="Edit note">
                  <Text style={styles.quietActionText}>Edit</Text>
                </Pressable>
              </View>
              <View style={styles.noteCard}>
                <Text style={styles.detailCopy}>{detailEntry.note || "No note yet. Add one to keep a thought with this title."}</Text>
              </View>
              <View style={styles.sectionHeader}>
                <Text style={styles.detailSection}>Journal</Text>
                <Pressable onPress={() => setJournalComposerOpen((open) => !open)} style={styles.journalAddButton} accessibilityRole="button" accessibilityLabel="Add journal entry">
                  <Text style={styles.journalAddText}>{journalComposerOpen ? "Cancel" : "＋  Add entry"}</Text>
                </Pressable>
              </View>
              {journalComposerOpen ? <View style={styles.journalComposer}>
                <TextInput value={journalDraft} onChangeText={setJournalDraft} placeholder="Write a dated thought…" placeholderTextColor={palette.faint} style={[styles.input, styles.multiline]} multiline textAlignVertical="top" accessibilityLabel="Journal entry" />
                <Pressable style={[styles.primaryButton, !journalDraft.trim() && styles.disabledButton]} onPress={() => { onAddJournal(); setJournalComposerOpen(false); }} disabled={!journalDraft.trim()} accessibilityRole="button">
                  <Text style={styles.primaryButtonText}>Save entry</Text>
                </Pressable>
              </View> : null}
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

export function EntryFormModal({ visible, onClose, onSave, onDelete, draft, setValue, onChangeType, journal, journalDraft, setJournalDraft, formError }: {
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
