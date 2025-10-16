import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, HelperText, Text, TextInput } from "react-native-paper";
import { useAuth } from "../context/AuthContext";
import { StatusBar } from "expo-status-bar";

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
    <SafeAreaView className="flex-1 bg-slate-950">
      <StatusBar style="light" />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.select({ ios: "padding", android: undefined })}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 justify-center px-6 py-12">
            <Text
              variant="headlineMedium"
              style={{ color: "#f8fafc", marginBottom: 8, fontWeight: "600" }}
            >
              Welcome to Blockcart
            </Text>
            <Text
              variant="bodyMedium"
              style={{ color: "#cbd5f5", marginBottom: 24, lineHeight: 22 }}
            >
              Sign in with your email to start earning BCT$ from your everyday
              receipts.
            </Text>
            <View style={{ rowGap: 12 }}>
              <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                mode="outlined"
              />
              {!!error && <HelperText type="error">{error}</HelperText>}
              {!!message && <HelperText type="info">{message}</HelperText>}
            </View>
            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={{ marginTop: 24 }}
              contentStyle={{ paddingVertical: 6 }}
            >
              Send Magic Link
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
