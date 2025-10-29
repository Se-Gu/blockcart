"use client"

import { useState } from "react"
import { KeyboardAvoidingView, Platform, StyleSheet, View, ScrollView, Image } from "react-native"
import { Text, TextInput, Button, Surface, useTheme } from "react-native-paper"
import { LinearGradient } from "expo-linear-gradient"
import { supabase } from "../lib/supabase"
import { parseError } from "../lib/errorParser"
import { useToast } from "../components/ToastProvider"
import { colors, spacing, borderRadius } from "../theme/colors"

const logoSource = require("../../assets/icon.jpg")

export default function LoginScreen() {
  const theme = useTheme()
  const { showError } = useToast()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [isRegisterMode, setIsRegisterMode] = useState(false)

  const isDark = theme.dark
  const inputBackgroundColor = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)"
  const inputTextColor = theme.colors.onSurface
  const inputOutlineColor = isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)"
  const inputPlaceholderColor = theme.colors.onSurfaceVariant
  const switchButtonColor = isDark ? "rgba(255, 255, 255, 0.8)" : theme.colors.primary

  const handleSubmit = async () => {
    if (!email || !password) {
      showError("Email and password are required.")
      return
    }

    setLoading(true)
    try {
      if (isRegisterMode) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) {
          throw error
        }
        if (!data.session) {
          showError("Please check your inbox to confirm your email before logging in.")
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) {
          throw error
        }
      }
    } catch (error) {
      const parsedError = parseError(error)
      console.error("Auth error:", error)
      showError(parsedError.message)
    } finally {
      setLoading(false)
    }
  }

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
    },
    decorativeOrb1: {
      position: "absolute",
      top: -100,
      right: -100,
      width: 300,
      height: 300,
      borderRadius: 150,
      backgroundColor: colors.primary,
      opacity: 0.15,
    },
    decorativeOrb2: {
      position: "absolute",
      bottom: -150,
      left: -100,
      width: 400,
      height: 400,
      borderRadius: 200,
      backgroundColor: colors.accent,
      opacity: 0.1,
    },
    scrollView: {
      flex: 1,
      width: "100%",
    },
    scrollContent: {
      flexGrow: 1,
    },
    keyboardView: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
    },
    card: {
      width: "100%",
      maxWidth: 420,
      borderRadius: borderRadius.xl,
      overflow: "hidden",
      backgroundColor: "transparent",
    },
    cardGradient: {
      padding: spacing.xl,
      gap: spacing.lg,
    },
    header: {
      gap: spacing.sm,
      alignItems: "center",
    },
    logoContainer: {
      marginBottom: spacing.sm,
    },
    logoGradient: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 8,
      overflow: "hidden",
    },
    logoImage: {
      width: 72,
      height: 72,
      borderRadius: 36,
    },
    title: {
      textAlign: "center",
      fontWeight: "700",
      color: theme.colors.onSurface,
    },
    subtitle: {
      textAlign: "center",
      color: theme.colors.onSurfaceVariant,
      paddingHorizontal: spacing.md,
    },
    formContainer: {
      gap: spacing.md,
    },
    formField: {
      width: "100%",
    },
    input: {
      backgroundColor: inputBackgroundColor, // Now theme-aware
    },
    buttonGradient: {
      borderRadius: borderRadius.md,
      marginTop: spacing.sm,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    submitButton: {
      borderRadius: borderRadius.md,
    },
    buttonContent: {
      paddingVertical: spacing.sm,
    },
    buttonLabel: {
      fontSize: 16,
      fontWeight: "600",
    },
    switchButton: {
      marginTop: spacing.xs,
    },
  })

  return (
    <LinearGradient
      colors={[theme.colors.surface, theme.colors.surfaceVariant, theme.colors.background]}
      locations={[0, 0.5, 1]}
      style={dynamicStyles.container}
    >
      <View style={dynamicStyles.decorativeOrb1} />
      <View style={dynamicStyles.decorativeOrb2} />

      <ScrollView
        style={dynamicStyles.scrollView}
        contentContainerStyle={dynamicStyles.scrollContent}
        bounces={false}
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
      >
        <KeyboardAvoidingView
          behavior={Platform.select({ ios: "padding", android: undefined })}
          style={dynamicStyles.keyboardView}
        >
          <Surface elevation={4} style={dynamicStyles.card}>
            <LinearGradient
              colors={["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.05)"]}
              style={dynamicStyles.cardGradient}
            >
              <View style={dynamicStyles.header}>
                <View style={dynamicStyles.logoContainer}>
                  <LinearGradient
                    colors={[colors.primary, colors.accent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={dynamicStyles.logoGradient}
                  >
                    <Image source={logoSource} style={dynamicStyles.logoImage} resizeMode="cover" />
                  </LinearGradient>
                </View>

                <Text variant="displaySmall" style={dynamicStyles.title}>
                  Blockcart
                </Text>
                <Text variant="bodyLarge" style={dynamicStyles.subtitle}>
                  {isRegisterMode
                    ? "Create an account to start earning with your receipts"
                    : "Sign in to continue earning rewards"}
                </Text>
              </View>

              <View style={dynamicStyles.formContainer}>
                <View style={dynamicStyles.formField}>
                  <TextInput
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    mode="outlined"
                    outlineColor={inputOutlineColor}
                    activeOutlineColor={colors.primary}
                    textColor={inputTextColor}
                    style={dynamicStyles.input}
                    theme={{
                      colors: {
                        onSurfaceVariant: inputPlaceholderColor,
                        placeholder: inputPlaceholderColor,
                      },
                    }}
                  />
                </View>
                <View style={dynamicStyles.formField}>
                  <TextInput
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    mode="outlined"
                    outlineColor={inputOutlineColor}
                    activeOutlineColor={colors.primary}
                    textColor={inputTextColor}
                    style={dynamicStyles.input}
                    theme={{
                      colors: {
                        onSurfaceVariant: inputPlaceholderColor,
                        placeholder: inputPlaceholderColor,
                      },
                    }}
                  />
                </View>

                <LinearGradient
                  colors={[colors.primary, colors.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={dynamicStyles.buttonGradient}
                >
                  <Button
                    mode="contained"
                    onPress={handleSubmit}
                    loading={loading}
                    disabled={loading}
                    style={dynamicStyles.submitButton}
                    contentStyle={dynamicStyles.buttonContent}
                    labelStyle={dynamicStyles.buttonLabel}
                    buttonColor="transparent"
                  >
                    {isRegisterMode ? "Create account" : "Sign in"}
                  </Button>
                </LinearGradient>

                <Button
                  mode="text"
                  onPress={() => setIsRegisterMode((prev) => !prev)}
                  disabled={loading}
                  textColor={switchButtonColor}
                  style={dynamicStyles.switchButton}
                >
                  {isRegisterMode ? "Already have an account? Sign in" : "New here? Create an account"}
                </Button>
              </View>
            </LinearGradient>
          </Surface>
        </KeyboardAvoidingView>
      </ScrollView>
    </LinearGradient>
  )
}
