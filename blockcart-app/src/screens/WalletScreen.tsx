import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { ActivityIndicator, Button, Card, Text } from "react-native-paper";
import { RewardCard } from "../components/RewardCard";
import { useAuth } from "../context/AuthContext";
import type { Reward } from "../types";
import { formatCurrency } from "../utils/format";
import { supabase } from "../utils/supabase";

export const WalletScreen: React.FC = () => {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWallet = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data: balanceData, error: balanceError } = await supabase
        .from("user_balances")
        .select("total_balance")
        .eq("user_id", userId)
        .single();

      if (balanceError && balanceError.code !== "PGRST116") {
        throw balanceError;
      }
      setBalance(balanceData?.total_balance ?? 0);

      const { data: rewardData, error: rewardError } = await supabase
        .from("rewards")
        .select("id, user_id, receipt_id, amount, description, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (rewardError) {
        throw rewardError;
      }

      setTransactions(rewardData ?? []);
    } catch (err) {
      console.warn("Failed to load wallet", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadWallet();
    }, [loadWallet]),
  );

  return (
    <ScrollView className="flex-1 bg-slate-100" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Card mode="elevated" style={{ marginBottom: 16 }}>
        <Card.Content>
          <Text variant="titleSmall" style={{ color: "#64748b" }}>
            Total balance
          </Text>
          <Text variant="displaySmall" style={{ color: "#0f172a", marginTop: 8 }}>
            {formatCurrency(balance)}
          </Text>
          <Button mode="outlined" style={{ marginTop: 16 }} onPress={() => {}}>
            Connect Wallet
          </Button>
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Title title="Recent activity" titleVariant="titleLarge" />
        <Card.Content>
          {loading ? (
            <View className="py-6 items-center">
              <ActivityIndicator />
            </View>
          ) : transactions.length === 0 ? (
            <Text variant="bodyMedium" style={{ color: "#64748b" }}>
              No rewards yet. Upload receipts to earn BCT$ rewards.
            </Text>
          ) : (
            transactions.map((reward: Reward) => <RewardCard key={reward.id} reward={reward} />)
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
};
