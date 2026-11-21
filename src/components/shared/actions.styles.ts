import { StyleSheet } from "react-native";
import {
  BORDER_RADIUS,
  FONT_SIZES,
  FONT_WEIGHTS,
  palette,
  SPACING,
} from "../../theme";

export const actionStyles = StyleSheet.create({
  primaryButton: {
    minHeight: 44,
    marginTop: SPACING.roomy,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.pill,
    backgroundColor: palette.violet,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: palette.onAccent,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.bold,
  },
  disabledButton: { opacity: 0.45 },
  closeButton: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.pill,
    backgroundColor: palette.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  quietAction: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  quietActionText: {
    color: palette.violetText,
    fontSize: FONT_SIZES.label,
    fontWeight: FONT_WEIGHTS.semibold,
  },
});
