import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Icon, MEDIA_TYPE_ICONS } from "../components/Icon";
import { ListIconPicker } from "../components/ListIconPicker";
import { Cover } from "../components/MediaUI";
import {
  type CustomList,
  LIST_ACCENT_COLOR,
  LIST_ACCENTS,
  type ListAccent,
  type ListIcon,
  type MediaEntry,
  MEDIA_TYPES,
  type MediaType,
} from "../model";
import { styles } from "../styles";
import { palette } from "../theme";

type Props = {
  entries: MediaEntry[];
  lists: CustomList[];
  onCreate: (
    name: string,
    type: MediaType,
    description: string,
    accent: ListAccent,
    entryIds: string[],
    icon: ListIcon,
  ) => Promise<string | null>;
  onCancel: () => void;
};

export function CreateListScreen({
  entries,
  lists,
  onCreate,
  onCancel,
}: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<MediaType>("Anime");
  const [description, setDescription] = useState("");
  const [accent, setAccent] = useState<ListAccent>("Dusk");
  const [icon, setIcon] = useState<ListIcon>("list");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const duplicate = useMemo(() => {
    const normalized = name.trim().toLocaleLowerCase();
    return (
      !!normalized &&
      lists.some((list) => list.name.toLocaleLowerCase() === normalized)
    );
  }, [lists, name]);
  const visibleEntries = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return entries.filter(
      (entry) =>
        entry.type === type &&
        (!term ||
          [entry.title, ...entry.alternateTitles, entry.creator]
            .join(" ")
            .toLocaleLowerCase()
            .includes(term)),
    );
  }, [entries, search, type]);

  const toggleEntry = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  };

  const toggleVisibleEntries = () => {
    const visibleIds = visibleEntries.map((entry) => entry.id);
    const allVisibleSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : [...new Set([...current, ...visibleIds])],
    );
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || duplicate || saving) return;
    setSaving(true);
    const message = await onCreate(
      trimmed,
      type,
      description,
      accent,
      selectedIds,
      icon,
    );
    setSaving(false);
    if (message) {
      setError(message);
      return;
    }
    onCancel();
  };

  return (
    <KeyboardAvoidingView
      style={styles.createListScreen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.createListScroll}
        contentContainerStyle={styles.createListContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.createListIntro}>
          <View>
            <Text style={styles.createListHeading}>List details</Text>
            <Text style={styles.createListSubheading}>
              A personal shelf for your library
            </Text>
          </View>
          <Text style={styles.createListLocalLabel}>Saved on device</Text>
        </View>

        <View style={styles.createFieldGroup}>
          <View style={styles.createFieldLabelRow}>
            <Text style={styles.createFieldLabel}>
              List name <Text style={styles.requiredMark}>*</Text>
            </Text>
            <Text style={styles.createFieldCounter}>{name.length}/36</Text>
          </View>
          <TextInput
            value={name}
            onChangeText={(value) => {
              setName(value);
              setError("");
            }}
            placeholder="e.g. Cyberpunk & Dystopia"
            placeholderTextColor="#958DA1"
            maxLength={36}
            returnKeyType="next"
            style={styles.createListNameInput}
            accessibilityLabel="List name, required"
            accessibilityHint="Enter a unique name up to 36 characters"
          />
          <View style={styles.createValidationRow}>
            <Text
              style={[
                styles.createValidationText,
                (duplicate || error) && styles.createValidationError,
              ]}
              accessibilityRole={duplicate || error ? "alert" : undefined}
            >
              {error ||
                (duplicate
                  ? "A list with this name already exists."
                  : name.trim()
                    ? "Unique list name available"
                    : "List names must be unique.")}
            </Text>
            <Text style={styles.createConstraintText}>
              Duplicates restricted
            </Text>
          </View>
        </View>

        <View style={styles.createFieldGroup}>
          <Text style={styles.createFieldLabel}>Media type</Text>
          <View style={styles.chipWrap} accessibilityRole="radiogroup">
            {MEDIA_TYPES.map((choice) => (
              <Pressable
                key={choice}
                onPress={() => {
                  if (choice !== type) {
                    setType(choice);
                    setSelectedIds([]);
                    setError("");
                  }
                }}
                style={[
                  styles.formMediaType,
                  type === choice && styles.formMediaTypeSelected,
                ]}
                accessibilityRole="radio"
                accessibilityLabel={`${choice} list`}
                accessibilityState={{ selected: type === choice }}
              >
                <Icon
                  name={MEDIA_TYPE_ICONS[choice]}
                  size={18}
                  color={type === choice ? palette.background : palette.muted}
                />
                <Text
                  style={[
                    styles.formMediaTypeText,
                    type === choice && styles.formMediaTypeTextSelected,
                  ]}
                >
                  {choice}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.helperText}>
            Only {type} titles can be added. The media type is fixed once the
            list is created. Changing it here clears selected titles.
          </Text>
        </View>

        <View style={styles.createFieldGroup}>
          <Text style={styles.createFieldLabel}>
            Scope & description{" "}
            <Text style={styles.optionalMark}>(optional)</Text>
          </Text>
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
          <Text style={styles.createFieldLabel}>List icon</Text>
          <ListIconPicker value={icon} onChange={setIcon} />
        </View>
        <View style={styles.createFieldGroup}>
          <Text style={styles.createFieldLabel}>Accent</Text>
          <View style={styles.accentChoices}>
            {LIST_ACCENTS.map((choice) => {
              const chosen = accent === choice;
              return (
                <Pressable
                  key={choice}
                  onPress={() => setAccent(choice)}
                  style={[
                    styles.accentChoice,
                    chosen && styles.accentChoiceSelected,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: chosen }}
                  accessibilityLabel={`${choice} accent`}
                >
                  <View
                    style={[
                      styles.accentSwatch,
                      { backgroundColor: LIST_ACCENT_COLOR[choice] },
                      chosen && styles.accentSwatchSelected,
                    ]}
                  />
                  <Text
                    style={[
                      styles.accentChoiceLabel,
                      chosen && styles.accentChoiceLabelSelected,
                    ]}
                  >
                    {choice}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.populateHeading}>
          <View style={styles.populateTitleRow}>
            <Text style={styles.createFieldLabel}>Add titles</Text>
            <Text style={styles.selectedCount}>
              {selectedIds.length} selected
            </Text>
          </View>
          {visibleEntries.length ? (
            <Pressable
              onPress={toggleVisibleEntries}
              style={styles.selectAllButton}
              accessibilityRole="button"
            >
              <Text style={styles.selectAllText}>
                {visibleEntries.every((entry) => selectedIds.includes(entry.id))
                  ? "Deselect all"
                  : "Select all"}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.entrySearchBox}>
          <Icon name="search" size={20} color="#958DA1" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={`Filter ${type} titles…`}
            placeholderTextColor="#958DA1"
            style={styles.entrySearchInput}
            returnKeyType="search"
            accessibilityLabel="Filter library titles"
          />
          {search ? (
            <Pressable
              onPress={() => setSearch("")}
              style={styles.clearEntrySearch}
              accessibilityRole="button"
              accessibilityLabel="Clear title filter"
            >
              <Icon name="x" size={18} color="#958DA1" />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.createEntryList}>
          {visibleEntries.length ? (
            visibleEntries.map((entry) => {
              const selected = selectedIds.includes(entry.id);
              const facts = [entry.releaseYear, entry.creator]
                .filter(Boolean)
                .join(" · ");
              return (
                <Pressable
                  key={entry.id}
                  onPress={() => toggleEntry(entry.id)}
                  style={[
                    styles.createEntryRow,
                    !selected && styles.createEntryRowUnselected,
                  ]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${entry.title}, ${entry.type}${facts ? `, ${facts}` : ""}`}
                >
                  <View style={styles.createEntryPoster}>
                    <Cover
                      uri={entry.coverUri}
                      type={entry.type}
                      title={entry.title}
                    />
                  </View>
                  <View style={styles.createEntryInfo}>
                    <Text style={styles.createEntryTitle} numberOfLines={1}>
                      {entry.title}
                    </Text>
                    <Text style={styles.createEntryFacts} numberOfLines={1}>
                      {entry.type}
                      {facts ? `  ·  ${facts}` : ""}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.entryCheckbox,
                      selected && styles.entryCheckboxSelected,
                    ]}
                  >
                    {selected ? (
                      <Icon name="check" size={18} color="#FFFFFF" />
                    ) : null}
                  </View>
                </Pressable>
              );
            })
          ) : (
            <View style={styles.noMatchingEntries}>
              <Text style={styles.noMatchingEntriesText}>
                {entries.length
                  ? `No matching ${type} titles. Add ${type} titles to your library to include them here.`
                  : "Your library is empty. You can add titles to this list later."}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.localStorageNote}>
          <Icon name="lock" size={17} color="#D2BBFF" />
          <Text style={styles.localStorageText}>
            Lists are stored on this device. Deleting a list removes its
            groupings only; library titles stay intact.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.createListFooter}>
        <Pressable
          onPress={() => void submit()}
          disabled={!name.trim() || duplicate || saving}
          style={[
            styles.createListSubmit,
            (!name.trim() || duplicate || saving) && styles.disabledButton,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Create list"
        >
          <Text style={styles.createListSubmitText}>＋ Create list</Text>
        </Pressable>
        <Pressable
          onPress={onCancel}
          style={styles.discardListButton}
          accessibilityRole="button"
        >
          <Text style={styles.discardListText}>Discard and return</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
