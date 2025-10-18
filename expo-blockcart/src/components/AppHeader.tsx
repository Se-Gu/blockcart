"use client";
import { Text, useTheme } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { colors, spacing } from "../theme/colors";

interface AppHeaderProps {
  title?: string;
}

export default function AppHeader({ title }: AppHeaderProps) {
  const theme = useTheme();

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{
        paddingTop: 48,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.md,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        variant="headlineSmall"
        style={{
          color: "#FFFFFF",
          fontWeight: "600",
          textAlign: "center",
          letterSpacing: 0.5,
        }}
      >
        {title || "Blockcart"}
      </Text>
    </LinearGradient>
  );
}
