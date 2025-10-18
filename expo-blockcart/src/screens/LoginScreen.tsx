import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { Text, TextInput, Button, Surface, useTheme } from "react-native-paper";
import { supabase } from "../lib/supabase";
import { parseError } from "../lib/errorParser";
import { useToast } from "../components/ToastProvider";

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
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={styles.container}
    >
      <Surface elevation={2} style={styles.card}>
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            Blockcart
          </Text>
          <Text
            variant="bodyMedium"
            style={{
              textAlign: "center",
              color: theme.colors.onSurfaceVariant,
            }}
          >
            {isRegisterMode
              ? "Create an account to start earning with your receipts."
              : "Sign in with your email to continue."}
          </Text>
        </View>
        <View style={styles.formField}>
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            mode="outlined"
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
          />
        </View>
        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
          style={styles.submitButton}
        >
          {isRegisterMode ? "Create account" : "Sign in"}
        </Button>
        <Button
          mode="text"
          onPress={() => setIsRegisterMode((prev) => !prev)}
          disabled={loading}
        >
          {isRegisterMode
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
        </Button>
      </Surface>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    padding: 24,
    borderRadius: 16,
    gap: 16,
  },
  header: {
    gap: 4,
  },
  title: {
    textAlign: "center",
  },
  formField: {
    width: "100%",
  },
  submitButton: {
    marginTop: 8,
  },
});
