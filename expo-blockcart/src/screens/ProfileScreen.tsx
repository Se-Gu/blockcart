import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Button, Card, Text, TextInput, useTheme } from "react-native-paper";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import type { ProfileStackParamList } from "../navigation/MainNavigator";
import type { Profile } from "../types";

const SEX_OPTIONS = ["male", "female", "non-binary", "prefer_not_to_say"] as const;

type Props = NativeStackScreenProps<ProfileStackParamList, "ProfileMain">;

type SexOption = (typeof SEX_OPTIONS)[number];

export default function ProfileScreen({ navigation }: Props) {
  const theme = useTheme();
  const { session, signOut } = useAuth();
  const [age, setAge] = useState<string>("");
  const [sex, setSex] = useState<SexOption | "">("");
  const [loading, setLoading] = useState(false);

  type ProfileRow = Pick<Profile, "age" | "sex" | "referral_code" | "referred_by">;

  const loadProfile = useCallback(async () => {
    if (!session?.user) {
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("age, sex, referral_code, referred_by")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const profileData = data as ProfileRow | null;
      setAge(profileData?.age ? String(profileData.age) : "");
      setSex(((profileData?.sex as SexOption | null) ?? "") as SexOption | "");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert("Unable to load profile", message);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

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
        id: session.user.id,
        age: age ? Number(age) : null,
        sex: sex || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("profiles").upsert(updates);
      if (error) {
        throw error;
      }

      Alert.alert("Profile updated", "Your information has been saved.");
      await loadProfile();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert("Unable to update profile", message);
    } finally {
      setLoading(false);
    }
  }, [age, loadProfile, session?.user?.id, sex]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Card>
        <Card.Content style={{ gap: 12 }}>
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
        <Card.Content style={{ gap: 12 }}>
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
            value={sex}
            onChangeText={(value) => setSex(value as SexOption | "")}
            placeholder={SEX_OPTIONS.join(", ")}
          />
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
        <Card.Content>
          <Button
            mode="text"
            textColor={theme.colors.error}
            onPress={() => {
              Alert.alert("Sign out", "Are you sure you want to sign out?", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Sign out",
                  style: "destructive",
                  onPress: () => {
                    void signOut();
                  },
                },
              ]);
            }}
          >
            Sign out
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}
