import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Button, Card, Text, TextInput, useTheme } from "react-native-paper";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import type { ProfileStackParamList } from "../navigation/MainNavigator";
import type { Profile } from "../types";
import { spacing } from "../theme/colors";

const REFERRALS_TABLE = "referrals";

type ReferralRewardRow = {
  bonus: number | null;
};
type ProfileRow = Pick<
  Profile,
  "referral_code" | "referred_by" | "bonus_total"
>;

type Props = NativeStackScreenProps<ProfileStackParamList, "Referral">;

export default function ReferralScreen(_props: Props) {
  const { session } = useAuth();
  const theme = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [referralInput, setReferralInput] = useState("");
  const [bonusEarned, setBonusEarned] = useState(0);

  const loadReferralData = useCallback(async () => {
    if (!session?.user) {
      return;
    }
    setLoading(true);
    try {
      const [profileResponse, rewardsResponse] = await Promise.all([
        supabase
          .from("users")
          .select("referral_code, referred_by")
          .eq("id", session.user.id)
          .maybeSingle(),
        supabase
          .from(REFERRALS_TABLE)
          .select("bonus")
          .eq("referrer", session.user.id)
          .eq("status", "completed"),
      ]);

      if (profileResponse.error) {
        throw profileResponse.error;
      }
      if (rewardsResponse.error && rewardsResponse.status !== 406) {
        throw rewardsResponse.error;
      }

      const profileData = profileResponse.data as ProfileRow | null;
      setProfile(profileData ? { id: session.user.id, ...profileData } : null);

      const rewardRows =
        (rewardsResponse.data as ReferralRewardRow[] | null) ?? [];
      const computedBonus = rewardRows.reduce(
        (acc, item) => acc + (item.bonus ?? 0),
        0
      );
      setBonusEarned(computedBonus);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert("Unable to load referrals", message);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  const submitReferralCode = useCallback(async () => {
    if (!session?.user) {
      return;
    }
    if (!referralInput) {
      Alert.alert("Missing code", "Please enter a referral code to submit.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({ referred_by: referralInput })
        .eq("id", session.user.id);

      if (error) {
        throw error;
      }

      Alert.alert("Referral saved", "Thanks for supporting a fellow earner!");
      setReferralInput("");
      await loadReferralData();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert("Unable to submit", message);
    } finally {
      setLoading(false);
    }
  }, [loadReferralData, referralInput, session?.user?.id]);

  useEffect(() => {
    void loadReferralData();
  }, [loadReferralData]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium">Your referral code</Text>
          <Text variant="headlineMedium">
            {profile?.referral_code ?? "Generating..."}
          </Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }}>
            Share this code with friends to earn bonus rewards when their
            receipts are approved.
          </Text>
        </Card.Content>
      </Card>

      <Card>
        <Card.Content style={styles.sectionContent}>
          <Text variant="titleMedium">Enter a referral code</Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }}>
            If someone invited you, enter their code below to link your account.
          </Text>
          <TextInput
            mode="outlined"
            placeholder="Referral code"
            value={referralInput}
            onChangeText={setReferralInput}
            autoCapitalize="characters"
          />
          <Button
            mode="contained"
            onPress={submitReferralCode}
            loading={loading}
            disabled={loading}
          >
            Submit code
          </Button>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Current referred by: {profile?.referred_by ?? "None"}
          </Text>
        </Card.Content>
      </Card>

      <Card>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium">Bonuses earned from referrals</Text>
          <Text variant="headlineSmall" style={{ marginTop: 8 }}>
            {bonusEarned.toFixed(2)} BCT$
          </Text>
          {profile?.bonus_total ? (
            <Text
              style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}
            >
              Platform reported total: {profile.bonus_total.toFixed(2)} BCT$
            </Text>
          ) : null}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  cardContent: {
    gap: spacing.xs,
  },
  sectionContent: {
    gap: spacing.sm,
  },
});
