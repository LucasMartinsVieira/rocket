import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Cover } from "../components/MediaUI";
import { LIST_ACCENTS, LIST_ACCENT_COLOR, type CustomList, type ListAccent, type MediaEntry } from "../model";
import { styles } from "../styles";

type Props = {
  entries: MediaEntry[];
  lists: CustomList[];
  onCreate: (name: string, description: string, accent: ListAccent, entryIds: string[]) => Promise<string | null>;
  onCancel: () => void;
};

export function CreateListScreen({ entries, lists, onCreate, onCancel }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accent, setAccent] = useState<ListAccent>("Dusk");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const duplicate = useMemo(() => {
    const normalized = name.trim().toLocaleLowerCase();
    return !!normalized && lists.some((list) => list.name.toLocaleLowerCase() === normalized);
  }, [lists, name]);
  const visibleEntries = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return entries;
    return entries.filter((entry) => [entry.title, ...entry.alternateTitles, entry.creator]
      .join(" ").toLocaleLowerCase().includes(term));
  }, [entries, search]);

  const toggleEntry = (id: string) => {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((selectedId) => selectedId !== id)
      : [...current, id]);
  };

  const toggleVisibleEntries = () => {
    const visibleIds = visibleEntries.map((entry) => entry.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds((current) => allVisibleSelected
      ? current.filter((id) => !visibleIds.includes(id))
      : [...new Set([...current, ...visibleIds])]);
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || duplicate || saving) return;
    setSaving(true);
    const message = await onCreate(trimmed, description, accent, selectedIds);
    setSaving(false);
    if (message) {
      setError(message);
      return;
    }
    onCancel();
  };

  return <KeyboardAvoidingView style={styles.createListScreen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView
      style={styles.createListScroll}
      contentContainerStyle={styles.createListContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.createListIntro}>
        <View>
          <Text style={styles.createListHeading}>List details</Text>
          <Text style={styles.createListSubheading}>A personal shelf for your library</Text>
        </View>
        <Text style={styles.createListLocalLabel}>Saved on device</Text>
      </View>

      <View style={styles.createFieldGroup}>
        <View style={styles.createFieldLabelRow}>
          <Text style={styles.createFieldLabel}>List name <Text style={styles.requiredMark}>*</Text></Text>
          <Text style={styles.createFieldCounter}>{name.length}/36</Text>
        </View>
        <TextInput
          value={name}
          onChangeText={(value) => { setName(value); setError(""); }}
          placeholder="e.g. Cyberpunk & Dystopia"
          placeholderTextColor="#958DA1"
          maxLength={36}
          returnKeyType="next"
          style={styles.createListNameInput}
          accessibilityLabel="List name, required"
          accessibilityHint="Enter a unique name up to 36 characters"
        />
        <View style={styles.createValidationRow}>
          <Text style={[styles.createValidationText, (duplicate || error) && styles.createValidationError]} accessibilityRole={duplicate || error ? "alert" : undefined}>
            {error || (duplicate ? "A list with this name already exists." : name.trim() ? "Unique list name available" : "List names must be unique.")}
          </Text>
          <Text style={styles.createConstraintText}>Duplicates restricted</Text>
        </View>
      </View>

      <View style={styles.createFieldGroup}>
        <Text style={styles.createFieldLabel}>Scope & description <Text style={styles.optionalMark}>(optional)</Text></Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="What belongs on this shelf?"
          placeholderTextColor="#958DA1"
          multiline
          textAlignVertical="top"
          maxLength={240}
          style={styles.createDescriptionInput}
          accessibilityLabel="Optional list description"
        />
      </View>

      <View style={styles.createFieldGroup}>
        <Text style={styles.createFieldLabel}>Accent</Text>
        <View style={styles.accentChoices}>
          {LIST_ACCENTS.map((choice) => {
            const chosen = accent === choice;
            return <Pressable
              key={choice}
              onPress={() => setAccent(choice)}
              style={[styles.accentChoice, chosen && styles.accentChoiceSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected: chosen }}
              accessibilityLabel={`${choice} accent`}
            >
              <View style={[styles.accentSwatch, { backgroundColor: LIST_ACCENT_COLOR[choice] }, chosen && styles.accentSwatchSelected]} />
              <Text style={[styles.accentChoiceLabel, chosen && styles.accentChoiceLabelSelected]}>{choice}</Text>
            </Pressable>;
          })}
        </View>
      </View>

      <View style={styles.populateHeading}>
        <View style={styles.populateTitleRow}>
          <Text style={styles.createFieldLabel}>Add titles</Text>
          <Text style={styles.selectedCount}>{selectedIds.length} selected</Text>
        </View>
        {visibleEntries.length ? <Pressable onPress={toggleVisibleEntries} style={styles.selectAllButton} accessibilityRole="button">
          <Text style={styles.selectAllText}>{visibleEntries.every((entry) => selectedIds.includes(entry.id)) ? "Deselect all" : "Select all"}</Text>
        </Pressable> : null}
      </View>
      <View style={styles.entrySearchBox}>
        <Text style={styles.entrySearchGlyph}>⌕</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Filter your library…"
          placeholderTextColor="#958DA1"
          style={styles.entrySearchInput}
          returnKeyType="search"
          accessibilityLabel="Filter library titles"
        />
        {search ? <Pressable onPress={() => setSearch("")} style={styles.clearEntrySearch} accessibilityRole="button" accessibilityLabel="Clear title filter"><Text style={styles.clearEntrySearchText}>×</Text></Pressable> : null}
      </View>

      <View style={styles.createEntryList}>
        {visibleEntries.length ? visibleEntries.map((entry) => {
          const selected = selectedIds.includes(entry.id);
          const facts = [entry.releaseYear, entry.creator].filter(Boolean).join(" · ");
          return <Pressable
            key={entry.id}
            onPress={() => toggleEntry(entry.id)}
            style={[styles.createEntryRow, !selected && styles.createEntryRowUnselected]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`${entry.title}, ${entry.type}${facts ? `, ${facts}` : ""}`}
          >
            <View style={styles.createEntryPoster}>
              <Cover uri={entry.coverUri} type={entry.type} title={entry.title} />
            </View>
            <View style={styles.createEntryInfo}>
              <Text style={styles.createEntryTitle} numberOfLines={1}>{entry.title}</Text>
              <Text style={styles.createEntryFacts} numberOfLines={1}>{entry.type}{facts ? `  ·  ${facts}` : ""}</Text>
            </View>
            <View style={[styles.entryCheckbox, selected && styles.entryCheckboxSelected]}>
              {selected ? <Text style={styles.entryCheckboxMark}>✓</Text> : null}
            </View>
          </Pressable>;
        }) : <View style={styles.noMatchingEntries}>
          <Text style={styles.noMatchingEntriesText}>{entries.length ? "No matching titles." : "Your library is empty. You can add titles to this list later."}</Text>
        </View>}
      </View>

      <View style={styles.localStorageNote}>
        <Text style={styles.localStorageLock}>▣</Text>
        <Text style={styles.localStorageText}>Lists are stored on this device. Deleting a list removes its groupings only; library titles stay intact.</Text>
      </View>
    </ScrollView>

    <View style={styles.createListFooter}>
      <Pressable
        onPress={() => void submit()}
        disabled={!name.trim() || duplicate || saving}
        style={[styles.createListSubmit, (!name.trim() || duplicate || saving) && styles.disabledButton]}
        accessibilityRole="button"
        accessibilityLabel="Create list"
      >
        <Text style={styles.createListSubmitText}>＋  Create list</Text>
      </Pressable>
      <Pressable onPress={onCancel} style={styles.discardListButton} accessibilityRole="button">
        <Text style={styles.discardListText}>Discard and return</Text>
      </Pressable>
    </View>
  </KeyboardAvoidingView>;
}
