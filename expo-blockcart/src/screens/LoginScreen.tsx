"use client";

import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { Text, TextInput, Button, Surface, useTheme } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../lib/supabase";
import { parseError } from "../lib/errorParser";
import { useToast } from "../components/ToastProvider";
import { colors, spacing, borderRadius } from "../theme/colors";

export default function LoginScreen() {
  const theme = useTheme();
  const { showError } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      showError("Email and password are required.");
      return;
    }

    setLoading(true);
    try {
      if (isRegisterMode) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) {
          throw error;
        }
        if (!data.session) {
          showError(
            "Please check your inbox to confirm your email before logging in."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          throw error;
        }
      }
    } catch (error) {
      const parsedError = parseError(error);
      console.error("Auth error:", error);
      showError(parsedError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={["#0F172A", "#1E293B", "#334155"]}
      locations={[0, 0.5, 1]}
      style={styles.container}
    >
      <View style={styles.decorativeOrb1} />
      <View style={styles.decorativeOrb2} />

      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", android: undefined })}
        style={styles.keyboardView}
      >
        <Surface elevation={4} style={styles.card}>
          <LinearGradient
            colors={["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.05)"]}
            style={styles.cardGradient}
          >
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <LinearGradient
                  colors={[colors.primary, colors.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.logoGradient}
                >
                  <Text style={styles.logoText}>BC</Text>
                </LinearGradient>
              </View>

              <Text variant="displaySmall" style={styles.title}>
                Blockcart
              </Text>
              <Text variant="bodyLarge" style={styles.subtitle}>
                {isRegisterMode
                  ? "Create an account to start earning with your receipts"
                  : "Sign in to continue earning rewards"}
              </Text>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.formField}>
                <TextInput
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  mode="outlined"
                  outlineColor="rgba(255, 255, 255, 0.2)"
                  activeOutlineColor={colors.primary}
                  textColor="#FFFFFF"
                  style={styles.input}
                  theme={{
                    colors: {
                      onSurfaceVariant: "rgba(255, 255, 255, 0.6)",
                      placeholder: "rgba(255, 255, 255, 0.5)",
                    },
                  }}
                />
              </View>
              <View style={styles.formField}>
                <TextInput
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  mode="outlined"
                  outlineColor="rgba(255, 255, 255, 0.2)"
                  activeOutlineColor={colors.primary}
                  textColor="#FFFFFF"
                  style={styles.input}
                  theme={{
                    colors: {
                      onSurfaceVariant: "rgba(255, 255, 255, 0.6)",
                      placeholder: "rgba(255, 255, 255, 0.5)",
                    },
                  }}
                />
              </View>

              <LinearGradient
                colors={[colors.primary, colors.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Button
                  mode="contained"
                  onPress={handleSubmit}
                  loading={loading}
                  disabled={loading}
                  style={styles.submitButton}
                  contentStyle={styles.buttonContent}
                  labelStyle={styles.buttonLabel}
                  buttonColor="transparent"
                >
                  {isRegisterMode ? "Create account" : "Sign in"}
                </Button>
              </LinearGradient>

              <Button
                mode="text"
                onPress={() => setIsRegisterMode((prev) => !prev)}
                disabled={loading}
                textColor="rgba(255, 255, 255, 0.8)"
                style={styles.switchButton}
              >
                {isRegisterMode
                  ? "Already have an account? Sign in"
                  : "New here? Create an account"}
              </Button>
            </View>
          </LinearGradient>
        </Surface>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
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
  },
  logoText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  title: {
    textAlign: "center",
    fontWeight: "700",
    color: "#FFFFFF",
  },
  subtitle: {
    textAlign: "center",
    color: "rgba(255, 255, 255, 0.7)",
    paddingHorizontal: spacing.md,
  },
  formContainer: {
    gap: spacing.md,
  },
  formField: {
    width: "100%",
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
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
});
