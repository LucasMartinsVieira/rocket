import { StyleSheet } from "react-native";
import { FONT_SIZES, FONT_WEIGHTS, palette, SPACING } from "../../theme";

export const layoutStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  chipRail: {
    gap: SPACING.sm,
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.xs,
  },
  horizontalFilterRail: { flexGrow: 0, flexShrink: 0, height: 52 },
  fill: { flex: 1 },
  wideGrid: { justifyContent: "flex-start", columnGap: SPACING.lg },
  emptyTitle: {
    color: palette.ink,
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.bold,
    marginTop: SPACING.roomy,
    textAlign: "center",
  },
  emptyBody: {
    color: palette.muted,
    fontSize: FONT_SIZES.label,
    lineHeight: 19,
    textAlign: "center",
    marginTop: SPACING.compact,
  },
  modalHeader: {
    minHeight: 58,
    paddingHorizontal: SPACING.roomy,
    backgroundColor: palette.background,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    color: palette.ink,
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.bold,
  },
});
