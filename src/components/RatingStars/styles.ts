import { StyleSheet } from "react-native";
import { SPACING } from "../../theme";

export const styles = StyleSheet.create({
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: SPACING.xxs,
  },
  ratingStarButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingClear: {
    minHeight: 44,
    paddingHorizontal: SPACING.snug,
    justifyContent: "center",
  },
});
