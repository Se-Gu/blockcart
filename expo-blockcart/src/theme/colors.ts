export const colors = {
  // Primary & Accent - adjusted for better contrast
  primary: "#1976D2", // Slightly darker blue for better contrast
  primaryDark: "#1565C0",
  primaryLight: "#42A5F5",
  accent: "#00BFA5", // Adjusted teal for better visibility
  accentDark: "#00897B",
  accentLight: "#64FFDA",

  // Backgrounds - improved contrast ratios
  background: "#FAFAFA", // Slightly darker for less eye strain
  backgroundDark: "#121212", // True dark for OLED
  surface: "#FFFFFF",
  surfaceDark: "#1E1E1E", // Better contrast than previous
  surfaceVariant: "#F5F5F5",
  surfaceVariantDark: "#2C2C2C", // Improved from previous
  surfaceElevated: "#FFFFFF",
  surfaceElevatedDark: "#252525",

  // Text - enhanced contrast for accessibility
  textPrimary: "#1A1A1A", // Darker for better contrast
  textPrimaryDark: "#FFFFFF",
  textSecondary: "#616161", // Improved from #6B7280
  textSecondaryDark: "#B0B0B0", // Better contrast in dark mode
  textTertiary: "#9E9E9E",
  textTertiaryDark: "#808080",

  // Status Colors - enhanced visibility and contrast
  error: "#D32F2F", // Darker red for better contrast
  errorDark: "#F44336",
  errorLight: "#EF5350",
  success: "#2E7D32", // Darker green for better contrast
  successDark: "#4CAF50",
  successLight: "#66BB6A",
  warning: "#F57C00", // Better contrast than previous
  warningDark: "#FF9800",
  warningLight: "#FFB74D",
  info: "#1976D2",
  infoDark: "#2196F3",
  infoLight: "#64B5F6",

  // Receipt Status Colors - improved contrast
  pending: "#F57C00",
  pendingDark: "#FF9800",
  approved: "#2E7D32",
  approvedDark: "#4CAF50",
  pendingReview: "#1976D2",
  pendingReviewDark: "#2196F3",
  flagged: "#E64A19",
  flaggedDark: "#FF5722",
  rejected: "#D32F2F",
  rejectedDark: "#F44336",

  // Gradients - refined for better visual harmony
  gradientStart: "#1976D2",
  gradientMid: "#00ACC1",
  gradientEnd: "#00BFA5",

  // Overlay colors for better layering
  overlay: "rgba(0, 0, 0, 0.5)",
  overlayLight: "rgba(0, 0, 0, 0.3)",
  overlayDark: "rgba(0, 0, 0, 0.7)",
  scrim: "rgba(0, 0, 0, 0.32)",
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
}

export const typography = {
  fontWeights: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
    extrabold: "800" as const,
  },
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.6,
    loose: 1.8,
  },
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
  },
}

export const elevation = {
  none: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  xl: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
}
