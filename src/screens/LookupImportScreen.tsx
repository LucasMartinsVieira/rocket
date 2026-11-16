import { useState } from "react";
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
import { Icon } from "../components/Icon";
import { styles } from "../styles";
import { palette } from "../theme";

const filters = [
  { label: "All Providers", color: "#D2BBFF" },
  { label: "Movies (OMDb)", color: "#FFB68E" },
  { label: "Books (OpenLib)", color: "#C5C6C8" },
  { label: "Anime & Manga", color: "#D2BBFF" },
  { label: "Games (RAWG)", color: "#FFDBC9" },
];

type Props = { visible: boolean; onClose: () => void };

export function LookupImportScreen({ visible, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All Providers");
  const [queryAttempted, setQueryAttempted] = useState(false);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.modalContent}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.lookupHeader}>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Back to add title"
            >
              <Icon name="chevronLeft" size={24} color={palette.ink} />
            </Pressable>
            <Text style={styles.lookupHeaderTitle}>Lookup & Import</Text>
            <View style={styles.lookupHeaderIcon}>
              <Icon name="search" size={20} color={palette.primaryText} />
            </View>
          </View>
          <ScrollView
            style={styles.libraryScroll}
            contentContainerStyle={styles.lookupContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.lookupConnectionRow}>
              <View style={styles.lookupInline}>
                <View style={styles.lookupConnectionDot} />
                <Text style={styles.lookupConnectionText}>
                  PROVIDER CATALOG LINK
                </Text>
              </View>
              <View style={styles.lookupEndpointBadge}>
                <Icon name="settingsAlt" size={14} color={palette.violetText} />
                <Text style={styles.lookupEndpointText}>Not connected</Text>
              </View>
            </View>
            <View style={styles.lookupSearch}>
              <Icon name="search" size={21} color={palette.muted} />
              <TextInput
                value={query}
                onChangeText={(value) => {
                  setQuery(value);
                  setQueryAttempted(false);
                }}
                placeholder="Search title, creator, ISBN, or ID…"
                placeholderTextColor={palette.faint}
                style={styles.lookupSearchInput}
                accessibilityLabel="Media query"
                returnKeyType="search"
                onSubmitEditing={() => setQueryAttempted(true)}
              />
              {query ? (
                <Pressable
                  onPress={() => {
                    setQuery("");
                    setQueryAttempted(false);
                  }}
                  style={styles.lookupClear}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <Icon name="x" size={18} color={palette.muted} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => setQueryAttempted(true)}
                disabled={!query.trim()}
                style={[
                  styles.lookupQueryButton,
                  !query.trim() && styles.disabledButton,
                ]}
                accessibilityRole="button"
                accessibilityState={{ disabled: !query.trim() }}
              >
                <Text style={styles.lookupQueryText}>Query</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.lookupFilterRail}
            >
              {filters.map((item) => (
                <Pressable
                  key={item.label}
                  onPress={() => setFilter(item.label)}
                  style={[
                    styles.lookupFilter,
                    filter === item.label && styles.lookupFilterSelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === item.label }}
                >
                  <View
                    style={[styles.statusDot, { backgroundColor: item.color }]}
                  />
                  <Text style={styles.lookupFilterText}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.lookupIntro}>
              <View style={styles.lookupInline}>
                <Icon name="telescope" size={15} color={palette.violetText} />
                <Text style={styles.lookupResultCount}>
                  No catalog results yet
                </Text>
              </View>
              <Text style={styles.lookupIntroCopy}>
                Select a result to preview its title, creator, synopsis, and
                cover before filling your add-title form.
              </Text>
            </View>
            <View style={styles.lookupEmpty}>
              <View style={styles.lookupEmptyIcon}>
                <Icon name="search" size={30} color={palette.violetText} />
              </View>
              <Text style={styles.lookupEmptyTitle}>
                {queryAttempted
                  ? "Provider lookup is not connected yet"
                  : "Find your next library title"}
              </Text>
              <Text
                style={styles.lookupEmptyCopy}
                accessibilityLiveRegion="polite"
              >
                {queryAttempted
                  ? "This screen is ready for catalog search, but API requests are not enabled. You can still enter this title manually."
                  : "Search and provider filters are ready. Results will appear here when catalog lookup is connected."}
              </Text>
            </View>
          </ScrollView>
          <View style={styles.lookupTray}>
            <View style={styles.lookupTrayHeading}>
              <View style={styles.lookupInline}>
                <Icon name="sparkles" size={14} color="#FFB68E" />
                <Text style={styles.lookupTrayLabel}>IMPORT PREVIEW</Text>
              </View>
              <Text style={styles.lookupTrayTitle}>No title selected</Text>
            </View>
            <Pressable
              disabled
              style={[styles.lookupImportButton, styles.disabledButton]}
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              accessibilityLabel="Fill Add Title form, select a catalog result first"
            >
              <Icon name="plus" size={20} color={palette.background} />
              <Text style={styles.lookupImportText}>Fill “Add Title” Form</Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={styles.lookupManualButton}
              accessibilityRole="button"
            >
              <Text style={styles.lookupManualText}>
                Or skip auto-fill & enter manually
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
