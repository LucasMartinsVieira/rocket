import { StyleSheet } from "react-native";
import {
  BORDER_RADIUS,
  FONT_SIZES,
  FONT_WEIGHTS,
  palette,
  SPACING,
} from "../../theme";

export const styles = StyleSheet.create({
  settingsBody: {
    gap: SPACING.md,
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  settingsLink: {
    minHeight: 76,
    paddingHorizontal: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: palette.surface,
  },
  settingsLinkIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: "#2A2A2A",
  },
  settingsLinkCopy: { flex: 1, gap: SPACING.xs },
  settingsLinkTitle: {
    color: palette.ink,
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  settingsLinkSubtitle: {
    color: palette.muted,
    fontSize: FONT_SIZES.finePrint,
    lineHeight: 15,
  },
});
