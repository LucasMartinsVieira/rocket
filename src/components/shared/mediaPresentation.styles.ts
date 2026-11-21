import { StyleSheet } from "react-native";
import {
  BORDER_RADIUS,
  FONT_SIZES,
  FONT_WEIGHTS,
  palette,
  SPACING,
} from "../../theme";

export const mediaStyles = StyleSheet.create({
  entryPressed: {
    backgroundColor: palette.violetWash,
    borderRadius: BORDER_RADIUS.md,
    opacity: 0.9,
  },
  entryPressedMotion: { transform: [{ scale: 0.98 }] },
  statusDot: { width: 7, height: 7, borderRadius: BORDER_RADIUS.pill },
  statusSelector: {
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderRadius: BORDER_RADIUS.pill,
    backgroundColor: palette.surface,
  },
  statusSelectorText: {
    color: palette.ink,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.medium,
  },
  statusOption: {
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  statusOptionSelected: { backgroundColor: "#353534" },
  statusOptionText: { color: palette.ink, fontSize: FONT_SIZES.label },
  mediaTypeFact: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.compact,
  },
});
