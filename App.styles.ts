import { StyleSheet } from "react-native";
import {
  BORDER_RADIUS,
  FONT_SIZES,
  FONT_WEIGHTS,
  palette,
  SPACING,
} from "./src/theme";

export const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: palette.background,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: palette.muted,
    marginTop: SPACING.sm,
    fontSize: FONT_SIZES.label,
  },
  topBar: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  settingsHeaderButton: {
    width: 52,
    height: 52,
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: "#D2BBFF",
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: {
    color: palette.faint,
    fontSize: FONT_SIZES.micro,
    fontWeight: FONT_WEIGHTS.bold,
    letterSpacing: 1.4,
  },
  screenTitle: {
    color: palette.ink,
    fontSize: FONT_SIZES.screenTitle,
    letterSpacing: -0.9,
    fontWeight: FONT_WEIGHTS.extrabold,
  },
  floatingAdd: {
    position: "absolute",
    right: 18,
    bottom: 82,
    minHeight: 52,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.pill,
    backgroundColor: "#E5E2E1",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  floatingAddText: {
    color: "#131313",
    fontSize: FONT_SIZES.small,
    fontWeight: FONT_WEIGHTS.semibold,
  },
  bottomBar: {
    height: 64,
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderTopColor: palette.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
  },
  createListTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  createListBack: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingIndicator: { marginTop: SPACING.roomy },
});
