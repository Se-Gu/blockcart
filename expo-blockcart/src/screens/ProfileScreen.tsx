import { useCallback, useEffect, useState } from "react";
import { ScrollView, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Button,
  Card,
  Text,
  TextInput,
  useTheme,
  List,
} from "react-native-paper";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useErrorHandler } from "../hooks/useErrorHandler";
import { useToast } from "../components/ToastProvider";
import type { ProfileStackParamList } from "../navigation/MainNavigator";
import type { Profile } from "../types";
import { borderRadius, spacing } from "../theme/colors";

const SEX_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non-binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

type Props = NativeStackScreenProps<ProfileStackParamList, "ProfileMain">;

type SexOption = (typeof SEX_OPTIONS)[number]["value"];

export default function ProfileScreen({ navigation }: Props) {
  const theme = useTheme();
  const { session, signOut } = useAuth();
  const { handleError } = useErrorHandler({ context: "Profile Management" });
  const { showSuccess } = useToast();
  const [age, setAge] = useState<string>("");
  const [sex, setSex] = useState<SexOption | "">("");
  const [loading, setLoading] = useState(false);
  const [showSexOptions, setShowSexOptions] = useState(false);

  type ProfileRow = Pick<
    Profile,
    "kyc_age" | "kyc_sex" | "referral_code" | "referred_by"
  >;

  const loadProfile = useCallback(async () => {
    if (!session?.user) {
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("kyc_age, kyc_sex, referral_code, referred_by")
        .eq("id", session.user.id)
        .maybeSingle();

      console.log("Load profile - Session user ID:", session.user.id);
      console.log("Load profile - Query result:", data);
      console.log("Load profile - Error:", error);

      if (error) {
        throw error;
      }

      const profileData = data as ProfileRow | null;
      setAge(profileData?.kyc_age ? String(profileData.kyc_age) : "");
      setSex(
        ((profileData?.kyc_sex as SexOption | null) ?? "") as SexOption | ""
      );
    } catch (err) {
      handleError(err, "Loading profile");
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, handleError]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleSave = useCallback(async () => {
    if (!session?.user) {
      return;
    }
    setLoading(true);
    try {
      const updates = {
        kyc_age: age ? Number(age) : null,
        kyc_sex: sex || null,
      };

      const { data, error } = await supabase
        .from("users")
        .update(updates)
        .eq("id", session.user.id)
        .select("kyc_age, kyc_sex");

      if (error) {
        throw error;
      }

      console.log("Update result:", data);
      console.log("Session user ID:", session.user.id);
      console.log("Updates being sent:", updates);

      if (!data || data.length === 0) {
        throw new Error("No rows were updated. Check RLS policies.");
      }

      showSuccess("Your profile information has been saved.");
      await loadProfile();
    } catch (err) {
      handleError(err, "Updating profile");
    } finally {
      setLoading(false);
    }
  }, [age, loadProfile, session?.user?.id, sex, showSuccess, handleError]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium">Account</Text>
          <TextInput
            label="Email"
            value={session?.user?.email ?? ""}
            disabled
            mode="outlined"
          />
          <Button
            mode="outlined"
            onPress={() => navigation.navigate("Referral")}
          >
            Manage referrals & bonuses
          </Button>
        </Card.Content>
      </Card>

      <Card>
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium">KYC Information</Text>
          <TextInput
            label="Age"
            keyboardType="number-pad"
            mode="outlined"
            value={age}
            onChangeText={setAge}
          />
          <TextInput
            label="Sex"
            mode="outlined"
            value={
              SEX_OPTIONS.find((option) => option.value === sex)?.label || ""
            }
            editable={false}
            right={
              <TextInput.Icon
                icon={showSexOptions ? "chevron-up" : "chevron-down"}
                onPress={() => setShowSexOptions(!showSexOptions)}
              />
            }
          />
          {showSexOptions && (
            <View
              style={[
                styles.sexOptionsContainer,
                { backgroundColor: theme.colors.surface },
              ]}
            >
              {SEX_OPTIONS.map((option) => (
                <List.Item
                  key={option.value}
                  title={option.label}
                  onPress={() => {
                    setSex(option.value);
                    setShowSexOptions(false);
                  }}
                  style={styles.sexOption}
                />
              ))}
            </View>
          )}
          <Button
            mode="contained"
            onPress={handleSave}
            loading={loading}
            disabled={loading}
          >
            Save changes
          </Button>
        </Card.Content>
      </Card>

      <Card>
        <Card.Content style={styles.signOutContent}>
          <Button
            mode="text"
            textColor={theme.colors.error}
            onPress={async () => {
              try {
                await signOut();
              } catch (error) {
                console.error("Sign out error:", error);
              }
            }}
          >
            Sign out
          </Button>
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
    gap: spacing.sm,
  },
  sexOptionsContainer: {
    marginTop: spacing.xs,
    borderRadius: borderRadius.md,
    elevation: 2,
  },
  sexOption: {
    paddingHorizontal: spacing.md,
  },
  signOutContent: {
    alignItems: "flex-start",
  },
});
