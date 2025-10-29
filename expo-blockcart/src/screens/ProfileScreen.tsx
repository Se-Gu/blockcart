import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  Button,
  Card,
  HelperText,
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
import { borderRadius, spacing, colors } from "../theme/colors";
import { usePhantomWallet } from "../hooks/usePhantomWallet";

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
  const [walletOnFile, setWalletOnFile] = useState<string | null>(null);
  const [walletPersisting, setWalletPersisting] = useState(false);
  const lastPersistedWalletRef = useRef<string | null>(null);
  const {
    connect: connectWallet,
    disconnect: resetWalletLink,
    status: walletStatus,
    address: linkedWalletAddress,
    signature: walletSignature,
    error: walletError,
    clearError: clearWalletError,
  } = usePhantomWallet();
  const isWalletBusy = useMemo(
    () =>
      walletStatus === "connecting" ||
      walletStatus === "verifying" ||
      walletPersisting,
    [walletPersisting, walletStatus],
  );

  type ProfileRow = Pick<
    Profile,
    "kyc_age" | "kyc_sex" | "referral_code" | "referred_by" | "wallet_address"
  >;

  const loadProfile = useCallback(async () => {
    if (!session?.user) {
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("kyc_age, kyc_sex, referral_code, referred_by, wallet_address")
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
      const walletAddress =
        (profileData?.wallet_address as string | null | undefined) ?? null;
      setWalletOnFile(walletAddress);
      lastPersistedWalletRef.current = walletAddress ?? null;
    } catch (err) {
      handleError(err, "Loading profile");
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, handleError]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const persistWalletAddress = useCallback(
    async (nextAddress: string | null) => {
      if (!session?.user) {
        return;
      }

      setWalletPersisting(true);
      try {
        const { error } = await supabase
          .from("users")
          .update({ wallet_address: nextAddress })
          .eq("id", session.user.id);

        if (error) {
          throw error;
        }

        setWalletOnFile(nextAddress);
        lastPersistedWalletRef.current = nextAddress ?? null;
        if (nextAddress) {
          showSuccess("Wallet connected successfully.");
        } else {
          showSuccess("Wallet disconnected.");
        }
      } catch (err) {
        handleError(
          err,
          nextAddress ? "Linking wallet" : "Disconnecting wallet",
        );
      } finally {
        setWalletPersisting(false);
      }
    },
    [handleError, session?.user?.id, showSuccess],
  );

  useEffect(() => {
    if (walletStatus === "ready" && linkedWalletAddress) {
      if (lastPersistedWalletRef.current === linkedWalletAddress) {
        return;
      }
      void persistWalletAddress(linkedWalletAddress);
    }
  }, [linkedWalletAddress, persistWalletAddress, walletStatus]);

  const handleConnectWallet = useCallback(async () => {
    if (!session?.user) {
      return;
    }
    clearWalletError();
    const timestamp = new Date().toISOString();
    // Simplified message format for Phantom mobile compatibility
    const message = `Blockcart wallet verification User: ${session.user.id} Timestamp: ${timestamp}`;
    try {
      await connectWallet({ message });
    } catch (err) {
      handleError(err, "Launching wallet");
    }
  }, [clearWalletError, connectWallet, handleError, session?.user?.id]);

  const handleDisconnectWallet = useCallback(async () => {
    if (!session?.user) {
      return;
    }
    clearWalletError();
    await persistWalletAddress(null);
    resetWalletLink();
  }, [clearWalletError, persistWalletAddress, resetWalletLink, session?.user]);

  const walletStatusMessage = useMemo(() => {
    if (walletStatus === "connecting") {
      return "Approve the connection request in your wallet.";
    }
    if (walletStatus === "verifying") {
      return "Sign the verification message in Phantom to confirm ownership.";
    }
    if (walletPersisting) {
      return "Saving wallet address...";
    }
    if (walletOnFile) {
      return "Wallet connected for BTC$ payouts.";
    }
    return "No wallet connected.";
  }, [walletOnFile, walletPersisting, walletStatus]);

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
          <Text variant="titleMedium">Wallet</Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Connect a Solana wallet to receive BTC$ payouts directly.
          </Text>
          <View style={styles.walletInfo}>
            {walletOnFile ? (
              <>
                <Text variant="labelSmall" style={styles.walletLabel}>
                  Connected address
                </Text>
                <Text variant="bodyMedium" style={styles.walletAddress}>
                  {walletOnFile}
                </Text>
                <View style={styles.walletStatusRow}>
                  {isWalletBusy ? (
                    <ActivityIndicator animating size="small" />
                  ) : null}
                  <Text variant="bodySmall" style={styles.walletStatusText}>
                    {walletStatus === "ready" && walletSignature
                      ? "Signature verified. Wallet ready for payouts."
                      : walletStatusMessage}
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.walletStatusRow}>
                {isWalletBusy ? (
                  <ActivityIndicator animating size="small" />
                ) : null}
                <Text variant="bodySmall" style={styles.walletStatusText}>
                  {walletStatusMessage}
                </Text>
              </View>
            )}
          </View>
          {walletError ? (
            <HelperText type="error" visible>
              {walletError}
            </HelperText>
          ) : null}
          <Button
            mode="contained"
            onPress={handleConnectWallet}
            loading={isWalletBusy && !walletPersisting}
            disabled={isWalletBusy}
          >
            {walletOnFile ? "Update wallet" : "Connect Phantom Wallet"}
          </Button>
          {walletOnFile ? (
            <Button
              mode="outlined"
              onPress={handleDisconnectWallet}
              disabled={isWalletBusy}
            >
              Disconnect wallet
            </Button>
          ) : null}
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
  walletInfo: {
    gap: spacing.xs,
  },
  walletLabel: {
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  walletAddress: {
    fontFamily: "monospace",
    fontSize: 14,
    color: colors.textPrimary,
  },
  walletStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  walletStatusText: {
    flex: 1,
    color: colors.textSecondary,
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
