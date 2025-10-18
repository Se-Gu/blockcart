"use client";

import { useCallback, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
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

type RewardRow = Reward & {
  receipt?: {
    store: string | null;
  } | null;
};

type BalanceRow = Pick<UserBalance, "total_balance">;

type Props = BottomTabScreenProps<AppTabParamList, "Wallet">;

export default function WalletScreen(_props: Props) {
  const { session } = useAuth();
  const theme = useTheme();
  const { handleError } = useErrorHandler({ context: "Wallet" });
  const [totalBalance, setTotalBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<RewardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadWallet = useCallback(async () => {
    if (!session?.user) {
      return;
    }
    setLoading(true);
    try {
      const [balanceResponse, rewardsResponse] = await Promise.all([
        supabase
          .from("user_balances")
          .select("total_balance")
          .eq("user_id", session.user.id)
          .maybeSingle(),
        supabase
          .from("rewards")
          .select("id, amount, created_at, receipt:receipts(store)")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(TRANSACTION_LIMIT),
      ]);

      if (balanceResponse.error) {
        throw balanceResponse.error;
      }
      if (rewardsResponse.error) {
        throw rewardsResponse.error;
      }

      const balanceData = balanceResponse.data as BalanceRow | null;
      const rewardsRaw = rewardsResponse.data as unknown;
      const rewardRows = Array.isArray(rewardsRaw)
        ? (rewardsRaw as RewardRow[])
        : [];

      setTotalBalance(balanceData?.total_balance ?? 0);
      setTransactions(rewardRows);
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

  if (loading && !transactions.length) {
    return <LoadingView message="Loading wallet" />;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.balanceCard}
      >
        <Text variant="titleMedium" style={styles.balanceLabel}>
          Total Balance
        </Text>
        <Text variant="displayMedium" style={styles.balanceAmount}>
          {totalBalance?.toFixed(2) ?? "0.00"} BCT$
        </Text>
        <Button
          mode="contained-tonal"
          style={styles.connectButton}
          buttonColor="rgba(255, 255, 255, 0.2)"
          textColor="#FFFFFF"
          onPress={() =>
            Alert.alert("Coming soon", "Wallet connection is on the roadmap.")
          }
        >
          Connect Wallet
        </Button>
      </LinearGradient>

      <Card style={styles.card}>
        <Card.Title
          title="Transaction History"
          subtitle={`${transactions.length} recent rewards`}
          titleStyle={{ fontWeight: "600" }}
        />
        <Card.Content style={{ gap: spacing.sm }}>
          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <IconButton
                icon="wallet-outline"
                size={64}
                iconColor={theme.colors.outline}
              />
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
                Upload receipts to start earning BCT$
              </Text>
            </View>
          ) : (
            transactions.map((reward) => (
              <Surface
                key={reward.id}
                style={styles.transactionItem}
                elevation={1}
              >
                <List.Item
                  title="Receipt Reward"
                  titleStyle={{ fontWeight: "600" }}
                  description={`${new Date(
                    reward.created_at
                  ).toLocaleDateString()} • ${
                    reward.receipt?.store ?? "Unknown store"
                  }`}
                  left={() => (
                    <View
                      style={[
                        styles.iconContainer,
                        { backgroundColor: `${colors.approved}20` },
                      ]}
                    >
                      <IconButton
                        icon="plus-circle"
                        size={24}
                        iconColor={colors.approved}
                      />
                    </View>
                  )}
                  right={() => (
                    <Text style={styles.rewardAmount}>
                      +{reward.amount.toFixed(2)} BCT$
                    </Text>
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

const styles = StyleSheet.create({
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
    color: "#FFFFFF",
    opacity: 0.9,
    fontWeight: "500",
  },
  balanceAmount: {
    color: "#FFFFFF",
    fontWeight: "700",
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
  emptyState: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
});
