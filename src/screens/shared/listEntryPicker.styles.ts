import { StyleSheet } from "react-native";
import {
  BORDER_RADIUS,
  FONT_SIZES,
  FONT_WEIGHTS,
  palette,
  SPACING,
} from "../../theme";

export const pickerStyles = StyleSheet.create({
  entrySearchInput: {
    flex: 1,
    height: "100%",
    color: palette.ink,
    fontSize: FONT_SIZES.label,
  },
  clearEntrySearch: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  createEntryRow: {
    minHeight: 84,
    paddingHorizontal: SPACING.snug,
    paddingVertical: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  createEntryRowUnselected: { opacity: 0.72 },
  createEntryPoster: {
    width: 40,
    height: 60,
    overflow: "hidden",
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: "#2A2A2A",
  },
  createEntryInfo: { flex: 1, minWidth: 0, justifyContent: "center" },
  createEntryTitle: {
    color: palette.ink,
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.medium,
  },
  createEntryFacts: {
    color: palette.muted,
    fontSize: FONT_SIZES.finePrint,
    marginTop: SPACING.xs,
  },
  entryCheckbox: {
    width: 32,
    height: 32,
    marginHorizontal: SPACING.xxs,
    borderRadius: BORDER_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#353534",
  },
  entryCheckboxSelected: { backgroundColor: palette.violet },
  noMatchingEntries: {
    minHeight: 80,
    padding: SPACING.lg,
    justifyContent: "center",
  },
  noMatchingEntriesText: {
    color: palette.muted,
    fontSize: FONT_SIZES.label,
    lineHeight: 19,
  },
  createListSubmit: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: palette.ink,
  },
  createListSubmitText: {
    color: "#131313",
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.bold,
  },
});
