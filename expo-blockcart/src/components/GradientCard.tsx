import type React from "react"
import { LinearGradient } from "expo-linear-gradient"
import { StyleSheet } from "react-native"
import { colors, spacing, borderRadius, elevation } from "../theme/colors"

type GradientCardProps = {
  children: React.ReactNode
  variant?: "primary" | "accent" | "subtle"
}

export default function GradientCard({ children, variant = "primary" }: GradientCardProps) {
  const gradientColors = {
    primary: [colors.gradientStart, colors.gradientMid, colors.gradientEnd],
    accent: [colors.accent, colors.accentDark],
    subtle: [`${colors.primary}15`, `${colors.accent}10`],
  }

  return (
    <LinearGradient
      colors={gradientColors[variant]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.gradient, elevation.lg]}
    >
      {children}
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  gradient: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
})
