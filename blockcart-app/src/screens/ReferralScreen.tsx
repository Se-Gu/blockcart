import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { Button, Card, Text, TextInput } from "react-native-paper";
import { useAuth } from "../context/AuthContext";
import type { UserProfile } from "../types";
import { supabase } from "../utils/supabase";

export const ReferralScreen: React.FC = () => {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [bonusTotal, setBonusTotal] = useState<number>(0);
  const [inputCode, setInputCode] = useState("");
  const [loading, setLoading] = useState(false);

  const loadReferralData = useCallback(async () => {
    if (!userId) return;
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("users")
        .select("id, email, referral_code, referred_by")
        .eq("id", userId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData as UserProfile);

      const { data: referralData, error: referralError } = await supabase
        .from("referrals")
        .select("bonus_amount")
        .eq("referrer_id", userId);

      if (referralError) throw referralError;
      const total = (referralData ?? []).reduce(
        (sum: number, referral: { bonus_amount?: number | null }) =>
          sum + (referral.bonus_amount ?? 0),
        0,
      );
      setBonusTotal(total);
    } catch (err) {
      console.warn("Failed to load referral data", err);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadReferralData();
    }, [loadReferralData]),
  );

  const handleSubmitCode = async () => {
    if (!userId || !inputCode.trim()) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({ referred_by: inputCode.trim() })
        .eq("id", userId);

      if (error) throw error;

      Alert.alert("Referral", "Referral code saved! Start earning together.");
      setInputCode("");
      loadReferralData();
    } catch (err) {
      Alert.alert("Referral", (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-slate-100" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Card mode="elevated" style={{ marginBottom: 16 }}>
        <Card.Content>
          <Text variant="titleLarge" style={{ color: "#0f172a", marginBottom: 8 }}>
            Share your invite code
          </Text>
          <Text variant="bodyMedium" style={{ color: "#64748b", marginBottom: 16 }}>
            Send this code to friends. When their receipts are approved, you both earn BCT$!
          </Text>
          <View className="flex-row items-center justify-between bg-slate-100 rounded-xl px-4 py-3">
            <Text variant="titleMedium" style={{ color: "#0f172a" }}>
              {profile?.referral_code || "Generating..."}
            </Text>
          </View>
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Content>
          <Text variant="titleLarge" style={{ color: "#0f172a", marginBottom: 8 }}>
            Redeem a friend's code
          </Text>
          <Text variant="bodyMedium" style={{ color: "#64748b", marginBottom: 16 }}>
            Enter a referral code from another Blockcart member to unlock bonuses.
          </Text>
          <TextInput
            label="Referral code"
            value={inputCode}
            onChangeText={setInputCode}
            mode="outlined"
            style={{ marginBottom: 12 }}
          />
          <Button
            mode="contained"
            loading={loading}
            disabled={loading}
            onPress={handleSubmitCode}
          >
            Save code
          </Button>
        </Card.Content>
      </Card>

      <Card mode="outlined" style={{ marginTop: 16 }}>
        <Card.Content>
          <Text variant="titleLarge" style={{ color: "#0f172a" }}>
            Referral bonuses earned
          </Text>
          <Text variant="displaySmall" style={{ color: "#10b981", marginTop: 12 }}>
            BCT$ {bonusTotal.toFixed(2)}
          </Text>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};
