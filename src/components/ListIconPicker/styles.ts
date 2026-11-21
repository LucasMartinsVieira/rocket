import { StyleSheet } from "react-native";
import { BORDER_RADIUS, palette, SPACING } from "../../theme";

export const styles = StyleSheet.create({
  listIconGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  listIconChoice: {
    width: 52,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: "transparent",
  },
  listIconChoiceSelected: {
    borderColor: palette.violetText,
    backgroundColor: palette.violetWash,
  },
});
