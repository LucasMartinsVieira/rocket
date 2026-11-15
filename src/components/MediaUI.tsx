import { useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import { palette } from "../theme";
import { styles } from "../styles";
import { TYPE_COLOR, type MediaEntry, type MediaType } from "../model";

export function Chip({
  label,
  selected,
  onPress,
  compact = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        compact && styles.chipCompact,
        selected && styles.chipSelected,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <Text
        style={[
          styles.chipLabel,
          compact && styles.chipLabelCompact,
          selected && styles.chipLabelSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: "number-pad";
  autoCapitalize?: "none" | "sentences";
}) {
  return (
    <View style={styles.formField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.faint}
        style={[styles.input, multiline && styles.multiline]}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "sentences"}
        accessibilityLabel={label}
      />
    </View>
  );
}

export function Cover({
  uri,
  type,
  title = "",
  large = false,
}: {
  uri: string;
  type: MediaType;
  title?: string;
  large?: boolean;
}) {
  const [failed, setFailed] = useState("");
  if (uri && isUsableImageUrl(uri) && uri !== failed) {
    return (
      <Image
        source={{ uri }}
        style={[styles.cover, large && styles.coverLarge]}
        resizeMode="cover"
        onError={() => setFailed(uri)}
      />
    );
  }
  const symbol =
    type === "Movie"
      ? "◉"
      : type === "Book"
        ? "▤"
        : type === "Game"
          ? "✣"
          : type === "Manga"
            ? "▧"
            : "✳";
  return (
    <View
      style={[
        styles.coverFallback,
        { backgroundColor: `${TYPE_COLOR[type]}18` },
        large && styles.coverLarge,
      ]}
    >
      <Text style={[styles.coverSymbol, { color: TYPE_COLOR[type] }]}>
        {symbol}
      </Text>
      <Text style={[styles.coverType, { color: TYPE_COLOR[type] }]}>
        {type}
      </Text>
      {title ? (
        <Text style={styles.coverFallbackTitle} numberOfLines={2}>
          {title}
        </Text>
      ) : null}
    </View>
  );
}

export function MediaCard({
  entry,
  onPress,
  wide = false,
}: {
  entry: MediaEntry;
  onPress: () => void;
  wide?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.mediaCard, wide && styles.wideCard]}
      accessibilityRole="button"
      accessibilityLabel={`${entry.title}, ${entry.type}${entry.releaseYear ? `, ${entry.releaseYear}` : ""}, ${entry.status}`}
    >
      <View style={styles.mediaCover}>
        <Cover uri={entry.coverUri} type={entry.type} title={entry.title} />
        <View
          style={[
            styles.statusPill,
            entry.status === "Completed" && styles.statusDone,
            entry.status === "Revisiting" && styles.statusRevisiting,
          ]}
        >
          <Text
            style={[
              styles.statusPillText,
              entry.status === "Completed" && styles.statusDoneText,
              entry.status === "Revisiting" && styles.statusRevisitingText,
            ]}
          >
            {entry.status}
          </Text>
        </View>
      </View>
      <View style={styles.mediaCaption}>
        <Text style={styles.mediaTitle} numberOfLines={2}>
          {entry.title}
        </Text>
        <Text style={styles.mediaMeta} numberOfLines={1}>
          {entry.type}
          {entry.releaseYear ? `  /  ${entry.releaseYear}` : ""}
        </Text>
      </View>
    </Pressable>
  );
}

export function MediaRow({
  entry,
  onPress,
  wide = false,
}: {
  entry: MediaEntry;
  onPress: () => void;
  wide?: boolean;
}) {
  if (wide)
    return (
      <Pressable
        onPress={onPress}
        style={styles.tableRow}
        accessibilityRole="button"
        accessibilityLabel={`${entry.title}, ${entry.type}, ${entry.releaseYear ?? "year unknown"}, ${entry.status}`}
      >
        <View style={styles.tableTitleCell}>
          <View style={styles.tableCover}>
            <Cover uri={entry.coverUri} type={entry.type} title={entry.title} />
          </View>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {entry.title}
          </Text>
        </View>
        <Text style={styles.tableCell}>{entry.type}</Text>
        <Text style={styles.tableCell}>{entry.releaseYear ?? "—"}</Text>
        <Text style={styles.tableCell}>{entry.status}</Text>
      </Pressable>
    );
  return (
    <Pressable
      onPress={onPress}
      style={styles.mediaRow}
      accessibilityRole="button"
      accessibilityLabel={`${entry.title}, ${entry.type}${entry.releaseYear ? `, ${entry.releaseYear}` : ""}, ${entry.status}`}
    >
      <View style={styles.rowCover}>
        <Cover uri={entry.coverUri} type={entry.type} title={entry.title} />
      </View>
      <View style={styles.rowDetails}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {entry.title}
        </Text>
        <Text style={styles.rowMeta}>
          {entry.type}
          {entry.releaseYear ? `  ·  ${entry.releaseYear}` : ""}
        </Text>
        <Text style={styles.rowStatus}>{entry.status}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export function ToggleButton({
  label,
  mark,
  active,
  onPress,
}: {
  label: string;
  mark: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.toggleButton, active && styles.toggleActive]}
      accessibilityRole="button"
      accessibilityLabel={`${label} view`}
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.toggleMark, active && styles.toggleMarkActive]}>
        {mark}
      </Text>
    </Pressable>
  );
}

export function BottomTab({
  label,
  mark,
  active,
  onPress,
}: {
  label: string;
  mark: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.bottomTab}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text
        style={[styles.bottomTabMark, active && styles.bottomTabMarkActive]}
      >
        {mark}
      </Text>
      <Text
        style={[styles.bottomTabLabel, active && styles.bottomTabLabelActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function isUsableImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
