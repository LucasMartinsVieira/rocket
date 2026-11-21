// Numbers are React Native logical units, not physical pixels.
export const SPACING = {
  xxs: 2,
  xs: 4,
  compact: 6,
  sm: 8,
  snug: 10,
  md: 12,
  lg: 16,
  roomy: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  section: 48,
} as const;

export const FONT_SIZES = {
  micro: 10,
  finePrint: 11,
  caption: 12,
  label: 13,
  small: 14,
  body: 16,
  subtitle: 18,
  heading: 20,
  title: 24,
  screenTitle: 28,
  display: 32,
  artwork: 40,
} as const;

export const FONT_WEIGHTS = {
  light: "300",
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
} as const;

export const BORDER_RADIUS = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  sheet: 24,
  pill: 9999,
} as const;

export const palette = {
  background: "#131313",
  surface: "#1C1B1B",
  surfaceRaised: "#201F1F",
  surfaceHighest: "#353534",
  error: "#FFB4AB",
  secondary: "#FFB68E",
  errorWash: "#93000A66",
  onError: "#690005",
  scrim: "rgba(0, 0, 0, 0.85)",
  ink: "#E5E2E1",
  muted: "#CCC3D8",
  faint: "#958DA1",
  line: "#2A2A2A",
  violet: "#7C3AED",
  violetText: "#D2BBFF",
  primaryText: "#3F008E",
  violetWash: "#241B35",
  green: "#B6A0FF",
  red: "#FF8F86",
  quiet: "#A0A3A8",
  onAccent: "#3F008E",
  backupSuccess: "#52D6AB",
  backupSuccessWash: "#10382C",
  backupAmberWash: "#422B19",
  backupDanger: "#BE2026",
};
