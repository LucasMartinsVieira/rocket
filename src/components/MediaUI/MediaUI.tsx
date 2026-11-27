import { useState } from "react";
import {
  Image,
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import {
  type MediaEntry,
  type MediaStatus,
  type MediaType,
  TYPE_COLOR,
} from "../../model";
import { palette } from "../../theme";
import { Icon, type IconName } from "../Icon";
import { formStyles } from "../shared/form.styles";
import { mediaStyles } from "../shared/mediaPresentation.styles";
import { styles, WIDE_MEDIA_CARD_WIDTH } from "./styles";

export function statusColor(status: MediaStatus) {
  const colors: Record<MediaStatus, string> = {
    Planned: "#958DA1",
    "In Progress": "#FF7A17",
    Completed: "#7C3AED",
    Paused: "#FACC15",
    Dropped: "#EF6B64",
    Revisiting: "#2DD4BF",
  };
  return colors[status];
}

export function StatusChip({
  label,
  status,
  selected,
  onPress,
}: {
  label: string;
  status: MediaStatus | null;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.statusChip, selected && styles.statusChipSelected]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <View
        style={[
          mediaStyles.statusDot,
          { backgroundColor: status ? statusColor(status) : palette.faint },
        ]}
      />
      <Text
        style={[
          styles.statusChipLabel,
          selected && styles.statusChipLabelSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function StatusPill({ status }: { status: MediaStatus }) {
  return (
    <View
      style={[
        styles.cardStatus,
        { backgroundColor: `${statusColor(status)}22` },
      ]}
    >
      <View
        style={[
          mediaStyles.statusDot,
          { backgroundColor: statusColor(status) },
        ]}
      />
      <Text style={[styles.cardStatusText, { color: statusColor(status) }]}>
        {status}
      </Text>
    </View>
  );
}

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
    <View style={formStyles.formField}>
      <Text style={formStyles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.faint}
        style={[formStyles.input, multiline && formStyles.multiline]}
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
      : type === "TV Show"
        ? "▣"
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
  onLongPress,
  wide = false,
}: {
  entry: MediaEntry;
  onPress: () => void;
  onLongPress?: () => void;
  wide?: boolean;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const cardWidth = wide ? WIDE_MEDIA_CARD_WIDTH : (screenWidth - 32) * 0.483;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={200}
      accessibilityHint="Touch and hold for title actions"
      accessibilityActions={
        onLongPress
          ? [{ name: "showMenu", label: "Show title actions" }]
          : undefined
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "showMenu") onLongPress?.();
      }}
      style={({ pressed }) => [
        styles.mediaCard,
        wide && styles.wideCard,
        pressed && mediaStyles.entryPressed,
        pressed && !reducedMotion && mediaStyles.entryPressedMotion,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${entry.title}, ${entry.type}${entry.releaseYear ? `, ${entry.releaseYear}` : ""}, ${entry.status}`}
    >
      <View style={[styles.mediaCover, { height: cardWidth * 1.5 }]}>
        <Cover uri={entry.coverUri} type={entry.type} title={entry.title} />
      </View>
      <View style={styles.mediaCaption}>
        <Text style={styles.mediaTitle} numberOfLines={2}>
          {entry.title}
        </Text>
        <Text style={styles.mediaMeta} numberOfLines={1}>
          {entry.type}
          {entry.releaseYear ? `  ·  ${entry.releaseYear}` : ""}
        </Text>
        <StatusPill status={entry.status} />
      </View>
    </Pressable>
  );
}

export function MediaRow({
  entry,
  onPress,
  onLongPress,
  wide = false,
}: {
  entry: MediaEntry;
  onPress: () => void;
  onLongPress?: () => void;
  wide?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  if (wide)
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.tableRow,
          pressed && mediaStyles.entryPressed,
          pressed && !reducedMotion && mediaStyles.entryPressedMotion,
        ]}
        onLongPress={onLongPress}
        delayLongPress={200}
        accessibilityHint="Touch and hold for title actions"
        accessibilityActions={
          onLongPress
            ? [{ name: "showMenu", label: "Show title actions" }]
            : undefined
        }
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "showMenu") onLongPress?.();
        }}
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
      style={({ pressed }) => [
        styles.mediaRow,
        pressed && mediaStyles.entryPressed,
        pressed && !reducedMotion && mediaStyles.entryPressedMotion,
      ]}
      onLongPress={onLongPress}
      delayLongPress={200}
      accessibilityHint="Touch and hold for title actions"
      accessibilityActions={
        onLongPress
          ? [{ name: "showMenu", label: "Show title actions" }]
          : undefined
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "showMenu") onLongPress?.();
      }}
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
  mark: IconName;
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
      <Icon
        name={mark}
        size={16}
        color={active ? palette.violetText : palette.quiet}
      />
      <Text style={[styles.toggleMark, active && styles.toggleMarkActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function BottomTab({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: IconName;
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
      <Icon name={icon} size={22} color={active ? "#D2BBFF" : "#958DA1"} />
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
