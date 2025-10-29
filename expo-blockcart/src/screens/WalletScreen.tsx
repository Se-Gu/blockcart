"use client";

import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import {
  Button,
  Card,
  List,
  Surface,
  Text,
  useTheme,
  IconButton,
} from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import type { AppTabParamList } from "../navigation/MainNavigator";
import type { Reward, UserBalance } from "../types";
import LoadingView from "../components/LoadingView";
import { useErrorHandler } from "../hooks/useErrorHandler";
import { colors, spacing, borderRadius } from "../theme/colors";

const TRANSACTION_LIMIT = 10;

const parseNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const formatCurrency = (value: number | null | undefined): string => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0.00";
  }
  return value.toFixed(2);
};

const getCampaignLabel = (reward: RewardRow): string | null => {
  if (typeof reward.campaign_name === "string" && reward.campaign_name.trim()) {
    return reward.campaign_name;
  }

  const campaign = reward.campaign;
  if (!campaign) {
    return null;
  }

  if (campaign.name && campaign.name.trim()) {
    return campaign.name;
  }

  if (campaign.brand && campaign.brand.trim()) {
    return campaign.brand;
  }

  return null;
};

type RewardRow = Reward & {
  receipt?: {
    store: string | null;
  } | null;
  campaign?: {
    id?: string | null;
    name?: string | null;
    brand?: string | null;
    multiplier?: number | null;
    reward_amount?: number | null;
  } | null;
};

type RewardRowWithDetails = RewardRow & {
  amount: number;
  campaignBonus: number | null;
  campaignLabel: string | null;
  campaignMultiplier: number | null;
};

type BalanceRow = Pick<UserBalance, "total_balance">;

type Props = BottomTabScreenProps<AppTabParamList, "Wallet">;

export default function WalletScreen({ navigation }: Props) {
  const { session } = useAuth();
  const theme = useTheme();
  const { handleError } = useErrorHandler({ context: "Wallet" });
  const [totalBalance, setTotalBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<RewardRowWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const loadWallet = useCallback(async () => {
    if (!session?.user) {
      return;
    }
    setLoading(true);
    try {
      const [balanceResponse, rewardsResponse, profileResponse] = await Promise.all([
        supabase
          .from("user_balances")
          .select("total_balance")
          .eq("user_id", session.user.id)
          .maybeSingle(),
        supabase
          .from("rewards")
          .select(
            `id, amount, created_at, description, campaign_id, receipt:receipts(store), campaign:campaigns!rewards_campaign_id_fkey ( id, name, brand, multiplier, reward_amount )`
          )
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(TRANSACTION_LIMIT),
        supabase
          .from("users")
          .select("wallet_address")
          .eq("id", session.user.id)
          .maybeSingle(),
      ]);

      if (balanceResponse.error) {
        throw balanceResponse.error;
      }
      if (rewardsResponse.error) {
        throw rewardsResponse.error;
      }
      if (profileResponse.error) {
        throw profileResponse.error;
      }

      const balanceData = balanceResponse.data as BalanceRow | null;
      const rewardsRaw = rewardsResponse.data as unknown;
      const rewardRows = Array.isArray(rewardsRaw)
        ? (rewardsRaw as RewardRow[])
        : [];

      const normalizedRewards = rewardRows.map((reward) => {
        const amount = parseNumber(reward.amount) ?? 0;
        const campaignLabel = getCampaignLabel(reward);
        const campaignBonus =
          parseNumber(reward.bonus_amount) ??
          (reward.campaign ? parseNumber(reward.campaign.reward_amount) : null);
        const campaignMultiplier =
          parseNumber(reward.campaign_multiplier) ??
          (reward.campaign ? parseNumber(reward.campaign.multiplier) : null);

        return {
          ...reward,
          amount,
          campaignLabel,
          campaignBonus,
          campaignMultiplier,
        };
      });

      setTotalBalance(balanceData?.total_balance ?? 0);
      setTransactions(normalizedRewards);
      const profileData = profileResponse.data as { wallet_address?: string | null } | null;
      setWalletAddress(
        profileData?.wallet_address && typeof profileData.wallet_address === "string"
          ? profileData.wallet_address
          : null,
      );
    } catch (err) {
      handleError(err, "Loading wallet");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user, handleError]);

  useFocusEffect(
    useCallback(() => {
      void loadWallet();
    }, [loadWallet])
  );

  const handleRefresh = useCallback(() => {
    if (refreshing) {
      return;
    }
    setRefreshing(true);
    void loadWallet();
  }, [loadWallet, refreshing]);

  const dynamicStyles = StyleSheet.create({
    container: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.lg,
      gap: spacing.md,
    },
    balanceCard: {
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 6,
      gap: spacing.sm,
    },
    balanceLabel: {
      color: theme.colors.onPrimary,
      opacity: 0.9,
      fontWeight: "500",
    },
    balanceAmount: {
      color: theme.colors.onPrimary,
      fontWeight: "700",
    },
    balanceSubtext: {
      color: theme.colors.onPrimary,
      opacity: 0.85,
    },
    connectButton: {
      marginTop: spacing.md,
      borderRadius: borderRadius.md,
    },
    card: {
      borderRadius: borderRadius.lg,
      elevation: 2,
    },
    transactionItem: {
      borderRadius: borderRadius.md,
      overflow: "hidden",
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.sm,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: spacing.sm,
    },
    rewardAmount: {
      fontWeight: "700",
      fontSize: 16,
      color: colors.approved,
      alignSelf: "center",
      marginRight: spacing.sm,
    },
    rewardAmountWrapper: {
      alignItems: "flex-end",
      justifyContent: "center",
      marginRight: spacing.sm,
      gap: 2,
    },
    rewardBonus: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    emptyState: {
      paddingVertical: spacing.xl,
      alignItems: "center",
    },
  });

  if (loading && !transactions.length) {
    return <LoadingView message="Loading wallet" />;
  }

  return (
    <ScrollView
      contentContainerStyle={dynamicStyles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing}USDTRefresh={handleRefresh} />
      }
    >
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={dynamicStyles.balanceCard}
      >
        <Text variant="titleMedium" style={dynamicStyles.balanceLabel}>
          Total Balance
        </Text>
        <Text variant="displayMedium" style={dynamicStyles.balanceAmount}>
          {totalBalance?.toFixed(2) ?? "0.00"} BTC$
        </Text>
        <Text variant="bodyMedium" style={dynamicStyles.balanceSubtext}>
          {walletAddress
            ? "Payouts will be routed to your connected Solana wallet."
            : "Add a Solana wallet to withdraw your BTC$ rewards."}
        </Text>
        <Button
          mode="contained-tonal"
          style={dynamicStyles.connectButton}
          buttonColor="rgba(255, 255, 255, 0.2)"
          textColor={theme.colors.onPrimary}
          onPress={() =>
            navigation.navigate("Profile", { screen: "ProfileMain" })
          }
        >
          {walletAddress ? "Manage wallet" : "Connect wallet"}
        </Button>
      </LinearGradient>

      <Card style={dynamicStyles.card}>
        <Card.Title
          title="Transaction History"
          subtitle={`${transactions.length} recent rewards`}
          titleStyle={{ fontWeight: "600" }}
        />
        <Card.Content style={{ gap: spacing.sm }}>
          {transactions.length === 0 ? (
            <View style={dynamicStyles.emptyState}>
              <IconButton
                icon="wallet-outline"
                size={64}
                iconColor={theme.colors.outline}
              />USDT
              <Text
                variant="bodyLarge"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  textAlign: "center",
                }}
              >
                No rewards yet
              </Text>
              <Text
                variant="bodyMedium"
                style={{
                  color: theme.colors.outline,
                  textAlign: "center",
                  marginTop: spacing.xs,
                }}
              >
                Upload receipts to start earning BTC$
              </Text>
              {!walletAddress ? (
                <Text
                  variant="bodySmall"
                  style={{
                    color: theme.colors.outline,
                    textAlign: "center",
                    marginTop: spacing.xs,
                  }}
                >
                  Connect your wallet in Profile to receive payouts automatically.
                </Text>
              ) : null}
            </View>
          ) : (
            transactions.map((reward) => (
              <Surface
                key={reward.id}
                style={dynamicStyles.transactionItem}
                elevation={1}
              >
                <List.Item
                  title={reward.campaignLabel ?? "Receipt Reward"}
                  titleStyle={{ fontWeight: "600" }}
                  description={[USDT
                    new Date(reward.created_at).toLocaleDateString(),
                    reward.receipt?.store ?? "Unknown store",
                    reward.description ?? null,
                  ]USDT
                    .filter(Boolean)
                    .join(" • ")}
                  left={() => (
                    <View
                      style={[
                        dynamicStyles.iconContainer,
                        {
                          backgroundColor: reward.campaignLabel
                            ? `${colors.accent}25`
                            : `${colors.approved}20`,
                        },
                      ]}
                    >
                      <IconButton
                        icon={reward.campaignLabel ? "bullhorn" : "plus-circle"}
                        size={24}
                        iconColor={
                          reward.campaignLabel ? colors.accent : colors.approved
                        }
                      />
                    </View>
                  )}
                  right={() => (
                    <View style={dynamicStyles.rewardAmountWrapper}>
                      <Text style={dynamicStyles.rewardAmount}>
                        +{formatCurrency(reward.amount)} BTC$
                      </Text>
                      {reward.campaignBonus ? (
                        <Text style={dynamicStyles.rewardBonus}>
                          Bonus +{formatCurrency(reward.campaignBonus)} BTC$
                        </Text>
                      ) : null}
                      {reward.campaignMultiplier && reward.campaignMultiplier > 1 ? (
                        <Text style={dynamicStyles.rewardBonus}>
                          {reward.campaignMultiplier.toFixed(2)}x multiplier
                        </Text>
                      ) : null}
                    </View>
                  )}
                />
              </Surface>
            ))
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}
