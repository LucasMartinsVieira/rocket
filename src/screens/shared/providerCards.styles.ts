import { StyleSheet } from "react-native";
import {
  BORDER_RADIUS,
  FONT_SIZES,
  FONT_WEIGHTS,
  palette,
  SPACING,
} from "../../theme";

export const providerCardStyles = StyleSheet.create({
  providersBody: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.compact,
    paddingBottom: SPACING.xxl,
    gap: SPACING.md,
  },
  vaultTitle: {
    color: palette.ink,
    fontSize: FONT_SIZES.heading,
    lineHeight: 27,
    fontWeight: FONT_WEIGHTS.semibold,
    letterSpacing: -0.35,
  },
  vaultDescription: {
    color: palette.muted,
    fontSize: FONT_SIZES.small,
    lineHeight: 21,
  },
  providerCard: {
    padding: SPACING.md,
    gap: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: palette.surface,
  },
  providerName: {
    color: palette.ink,
    fontSize: FONT_SIZES.body,
    fontWeight: FONT_WEIGHTS.semibold,
  },
});
