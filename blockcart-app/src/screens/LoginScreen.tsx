import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { Button, HelperText, Text, TextInput } from "react-native-paper";
import { useAuth } from "../context/AuthContext";

export const LoginScreen: React.FC = () => {
  const { requestOtp } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email) {
      setError("Enter your email to continue.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await requestOtp(email.trim());
      setMessage("Check your email for the magic link to sign in.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-slate-950"
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      <View className="flex-1 justify-center px-6">
        <Text variant="headlineMedium" style={{ color: "#ffffff", marginBottom: 8 }}>
          Welcome to Blockcart
        </Text>
        <Text variant="bodyMedium" style={{ color: "#cbd5f5", marginBottom: 24 }}>
          Sign in with your email to start earning BCT$ from your everyday receipts.
        </Text>
        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          mode="outlined"
          style={{ marginBottom: 12 }}
        />
        {!!error && <HelperText type="error">{error}</HelperText>}
        {!!message && <HelperText type="info">{message}</HelperText>}
        <Button
          mode="contained"
          onPress={handleLogin}
          loading={loading}
          disabled={loading}
          style={{ marginTop: 8 }}
        >
          Send Magic Link
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
};
