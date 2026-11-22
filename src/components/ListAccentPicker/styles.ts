import { StyleSheet } from "react-native";
import {
  BORDER_RADIUS,
  FONT_SIZES,
  FONT_WEIGHTS,
  palette,
  SPACING,
} from "../../theme";

export const styles = StyleSheet.create({
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
    padding: SPACING.xs,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: "#0E0E0E",
  },
  choice: {
    flexBasis: 52,
    flexGrow: 1,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: palette.surface,
  },
  choiceSelected: { backgroundColor: "#29282A" },
  swatch: { width: 18, height: 18, borderRadius: BORDER_RADIUS.pill },
  swatchSelected: { borderWidth: 2, borderColor: palette.ink },
  label: { color: palette.muted, fontSize: FONT_SIZES.caption },
  labelSelected: { color: palette.ink, fontWeight: FONT_WEIGHTS.semibold },
});
