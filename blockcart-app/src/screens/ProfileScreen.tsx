import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { ActivityIndicator, Button, Card, Text, TextInput } from "react-native-paper";
import { useAuth } from "../context/AuthContext";
import type { UserProfile } from "../types";
import { supabase } from "../utils/supabase";

export const ProfileScreen: React.FC = () => {
  const { session, signOut } = useAuth();
  const userId = session?.user?.id;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [age, setAge] = useState<string>("");
  const [sex, setSex] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, email, referral_code, kyc_age, kyc_sex")
        .eq("id", userId)
        .single();
      if (error) throw error;
      const typed = data as UserProfile;
      setProfile(typed);
      setAge(typed.kyc_age ? String(typed.kyc_age) : "");
      setSex(typed.kyc_sex ?? "");
    } catch (err) {
      console.warn("Failed to load profile", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const kyc_age = age ? Number(age) : null;
      const { error } = await supabase
        .from("users")
        .update({ kyc_age, kyc_sex: sex || null })
        .eq("id", userId);
      if (error) throw error;
      Alert.alert("Profile", "Profile updated successfully.");
      loadProfile();
    } catch (err) {
      Alert.alert("Profile", (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-100" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Card mode="elevated" style={{ marginBottom: 16 }}>
        <Card.Content>
          <Text variant="titleLarge" style={{ color: "#0f172a" }}>
            {profile?.email}
          </Text>
          <Text variant="bodyMedium" style={{ color: "#64748b", marginTop: 4 }}>
            Referral code: {profile?.referral_code ?? "—"}
          </Text>
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Content>
          <Text variant="titleLarge" style={{ color: "#0f172a", marginBottom: 12 }}>
            KYC details
          </Text>
          <TextInput
            label="Age"
            value={age}
            onChangeText={setAge}
            keyboardType="numeric"
            mode="outlined"
            style={{ marginBottom: 12 }}
          />
          <TextInput
            label="Gender"
            value={sex}
            onChangeText={setSex}
            mode="outlined"
            style={{ marginBottom: 16 }}
          />
          <Button
            mode="contained"
            onPress={handleSave}
            loading={saving}
            disabled={saving}
          >
            Save changes
          </Button>
        </Card.Content>
      </Card>

      <Button
        mode="outlined"
        onPress={() => {
          void signOut();
        }}
        style={{ marginTop: 24, borderColor: "#ef4444" }}
        textColor="#ef4444"
      >
        Sign out
      </Button>
    </ScrollView>
  );
};
