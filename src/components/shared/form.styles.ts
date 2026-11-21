import { StyleSheet } from "react-native";
import {
  BORDER_RADIUS,
  FONT_SIZES,
  FONT_WEIGHTS,
  palette,
  SPACING,
} from "../../theme";

export const formStyles = StyleSheet.create({
  formMediaType: {
    minHeight: 44,
    paddingHorizontal: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.compact,
    borderRadius: BORDER_RADIUS.pill,
    backgroundColor: palette.surface,
  },
  formMediaTypeSelected: { backgroundColor: palette.ink },
  formMediaTypeText: {
    color: palette.muted,
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.medium,
  },
  formMediaTypeTextSelected: {
    color: palette.background,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: SPACING.sm,
  },
  formField: { marginTop: SPACING.lg },
  fieldLabel: {
    color: palette.ink,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
    marginBottom: SPACING.sm,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    color: palette.ink,
    fontSize: FONT_SIZES.body,
  },
  multiline: { minHeight: 94, paddingTop: SPACING.md, lineHeight: 20 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  helperText: {
    color: palette.muted,
    fontSize: FONT_SIZES.caption,
    lineHeight: 18,
    marginTop: SPACING.xs,
  },
  errorText: {
    color: "#FFB4AB",
    fontSize: FONT_SIZES.label,
    lineHeight: 19,
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.md,
  },
});
