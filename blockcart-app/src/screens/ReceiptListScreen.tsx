import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import React, { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { ReceiptCard } from "../components/ReceiptCard";
import { useAuth } from "../context/AuthContext";
import type { Receipt } from "../types";
import { supabase } from "../utils/supabase";
import type { RootStackParamList, TabParamList } from "./types";

type ReceiptListNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, "Receipts">,
  NativeStackNavigationProp<RootStackParamList>
>;

export const ReceiptListScreen: React.FC = () => {
  const { session } = useAuth();
  const navigation = useNavigation<ReceiptListNavigationProp>();
  const userId = session?.user?.id;
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReceipts = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from("receipts")
        .select("id, user_id, store_name, total, status, created_at, parsed_json, image_url")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReceipts(data ?? []);
    } catch (err) {
      console.warn("Failed to load receipts", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadReceipts();
    }, [loadReceipts]),
  );

  return (
    <ScrollView
      className="flex-1 bg-slate-100"
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadReceipts} />}
    >
      {loading ? (
        <View className="py-10 items-center">
          <ActivityIndicator />
        </View>
      ) : receipts.length === 0 ? (
        <Text variant="bodyLarge" style={{ color: "#64748b" }}>
          No receipts yet. Start by uploading one from the Home tab.
        </Text>
      ) : (
        receipts.map((receipt: Receipt) => (
          <ReceiptCard
            key={receipt.id}
            receipt={receipt}
            onPress={() =>
              navigation.navigate("ReceiptDetail", { receiptId: receipt.id, initialReceipt: receipt })
            }
          />
        ))
      )}
    </ScrollView>
  );
};
