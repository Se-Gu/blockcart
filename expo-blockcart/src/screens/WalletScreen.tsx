import { useCallback, useState } from "react";
import { Alert, RefreshControl, ScrollView } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import {
  Button,
  Card,
  List,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import type { AppTabParamList } from "../navigation/MainNavigator";
import type { Reward, UserBalance } from "../types";
import LoadingView from "../components/LoadingView";
import { useErrorHandler } from "../hooks/useErrorHandler";

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
  }, [session?.user?.id, handleError]);

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
      contentContainerStyle={{ padding: 16, gap: 16 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <Card>
        <Card.Content>
          <Text variant="titleMedium">Total Balance</Text>
          <Text variant="headlineLarge" style={{ marginTop: 8 }}>
            BCT$ {totalBalance?.toFixed(2) ?? "0.00"}
          </Text>
          <Button
            mode="outlined"
            style={{ marginTop: 16 }}
            onPress={() =>
              Alert.alert("Coming soon", "Wallet connection is on the roadmap.")
            }
          >
            Connect Wallet
          </Button>
        </Card.Content>
      </Card>

      <Card>
        <Card.Title title="Recent Rewards" subtitle="Last 10 transactions" />
        <Card.Content style={{ gap: 12 }}>
          {transactions.length === 0 ? (
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              No rewards yet. Upload receipts to earn BCT$.
            </Text>
          ) : (
            transactions.map((reward) => (
              <Surface
                key={reward.id}
                style={{ borderRadius: 12 }}
                elevation={1}
              >
                <List.Item
                  title="Receipt reward"
                  description={`${new Date(
                    reward.created_at
                  ).toLocaleString()} • ${
                    reward.receipt?.store ?? "Unknown store"
                  }`}
                  right={() => (
                    <Text style={{ fontWeight: "600" }}>
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
