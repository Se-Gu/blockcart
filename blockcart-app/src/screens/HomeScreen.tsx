import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { ActivityIndicator, Button, Card, Text } from "react-native-paper";
import { ReceiptCard } from "../components/ReceiptCard";
import { useAuth } from "../context/AuthContext";
import { formatCurrency } from "../utils/format";
import { supabase } from "../utils/supabase";
import type { Receipt } from "../types";
import type { RootStackParamList, TabParamList } from "./types";

type HomeNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, "Home">,
  NativeStackNavigationProp<RootStackParamList>
>;

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeNavigationProp>();
  const { session } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const userId = session?.user?.id;

  const fetchOverview = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
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

      const { data: receiptData, error: receiptError } = await supabase
        .from("receipts")
        .select("id, user_id, store_name, total, status, created_at, parsed_json, image_url")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (receiptError) {
        throw receiptError;
      }

      setReceipts(receiptData ?? []);
    } catch (err) {
      console.warn("Failed to fetch overview", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      fetchOverview();
    }, [fetchOverview]),
  );

  const handleUploadPress = () => {
    navigation.navigate("UploadReceipt");
  };

  const handleReferralPress = () => {
    navigation.navigate("Referral");
  };

  return (
    <ScrollView
      className="flex-1 bg-slate-100"
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchOverview} />}
    >
      <Card mode="elevated" style={{ marginBottom: 16 }}>
        <Card.Content>
          <Text variant="titleSmall" style={{ color: "#64748b" }}>
            Current Balance
          </Text>
          <Text variant="displaySmall" style={{ color: "#0f172a", marginTop: 8 }}>
            {formatCurrency(balance)}
          </Text>
          <Button mode="contained" style={{ marginTop: 24 }} onPress={handleUploadPress}>
            Upload Receipt
          </Button>
        </Card.Content>
      </Card>

      <Card mode="outlined" style={{ marginBottom: 16 }}>
        <Card.Title title="My Receipts" titleVariant="titleLarge" />
        <Card.Content>
          {loading ? (
            <View className="py-6 items-center">
              <ActivityIndicator />
            </View>
          ) : receipts.length === 0 ? (
            <Text variant="bodyMedium" style={{ color: "#64748b" }}>
              You haven't uploaded any receipts yet.
            </Text>
          ) : (
            receipts.slice(0, 3).map((receipt: Receipt) => (
              <ReceiptCard
                key={receipt.id}
                receipt={receipt}
                onPress={() => navigation.navigate("ReceiptDetail", { receiptId: receipt.id, initialReceipt: receipt })}
              />
            ))
          )}
          <Button
            mode="text"
            onPress={() => navigation.navigate("Receipts")}
            style={{ marginTop: 8 }}
          >
            View all receipts
          </Button>
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Content>
          <Text variant="titleLarge" style={{ color: "#0f172a", marginBottom: 12 }}>
            Bonuses & Referrals
          </Text>
          <Text variant="bodyMedium" style={{ color: "#64748b" }}>
            Invite friends and earn extra BCT$ when their receipts are approved.
          </Text>
          <Button
            mode="contained-tonal"
            style={{ marginTop: 16 }}
            onPress={handleReferralPress}
          >
            Referrals & Bonuses
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};
