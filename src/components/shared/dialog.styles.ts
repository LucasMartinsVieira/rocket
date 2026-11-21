import { StyleSheet } from "react-native";
import {
  BORDER_RADIUS,
  FONT_SIZES,
  FONT_WEIGHTS,
  palette,
  SPACING,
} from "../../theme";

export const dialogStyles = StyleSheet.create({
  contextRemoveText: {
    color: palette.error,
    fontSize: FONT_SIZES.body,
    lineHeight: 21,
    fontWeight: FONT_WEIGHTS.medium,
  },
  deleteOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.lg,
    backgroundColor: palette.scrim,
  },
  deleteBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  deleteIconBox: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.errorWash,
  },
  deleteError: {
    color: palette.error,
    fontSize: FONT_SIZES.label,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
});
