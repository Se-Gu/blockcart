import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { ActivityIndicator, Card, Divider, Text } from "react-native-paper";
import { ReceiptCard } from "../components/ReceiptCard";
import type { Receipt } from "../types";
import { formatCurrency, formatDate } from "../utils/format";
import { supabase } from "../utils/supabase";
import type { RootStackParamList } from "./types";

export const ReceiptDetailScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "ReceiptDetail">>();
  const { receiptId, initialReceipt } = route.params;
  const [receipt, setReceipt] = useState<Receipt | null>(initialReceipt ?? null);
  const [loading, setLoading] = useState(!initialReceipt);

  useEffect(() => {
    const fetchReceipt = async () => {
      if (initialReceipt) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("receipts")
          .select("id, user_id, store_name, total, status, created_at, parsed_json, image_url")
          .eq("id", receiptId)
          .single();
        if (error) throw error;
        setReceipt(data as Receipt);
      } catch (err) {
        console.warn("Failed to load receipt detail", err);
      } finally {
        setLoading(false);
      }
    };

    fetchReceipt();
  }, [initialReceipt, receiptId]);

  useEffect(() => {
    navigation.setOptions({ title: "Receipt Detail" });
  }, [navigation]);

  if (loading || !receipt) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <ReceiptCard receipt={receipt} />

      <Card mode="outlined" style={{ marginBottom: 16 }}>
        <Card.Content>
          <Text variant="titleLarge" style={{ color: "#0f172a", marginBottom: 12 }}>
            Receipt summary
          </Text>
          <View className="flex-row justify-between mb-2">
            <Text variant="bodyMedium" style={{ color: "#64748b" }}>
              Store
            </Text>
            <Text variant="bodyMedium" style={{ color: "#0f172a" }}>
              {receipt.store_name || "Pending"}
            </Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text variant="bodyMedium" style={{ color: "#64748b" }}>
              Date
            </Text>
            <Text variant="bodyMedium" style={{ color: "#0f172a" }}>
              {formatDate(receipt.created_at)}
            </Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text variant="bodyMedium" style={{ color: "#64748b" }}>
              Total
            </Text>
            <Text variant="bodyMedium" style={{ color: "#0f172a" }}>
              {formatCurrency(receipt.total)}
            </Text>
          </View>
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Content>
          <Text variant="titleLarge" style={{ color: "#0f172a", marginBottom: 12 }}>
            Parsed details
          </Text>
          {receipt.parsed_json ? (
            Object.entries(receipt.parsed_json).map(([key, value]) => (
              <View key={key}>
                <View className="flex-row justify-between py-2">
                  <Text
                    variant="bodyMedium"
                    style={{ color: "#64748b", textTransform: "capitalize" }}
                  >
                    {key.replace(/_/g, " ")}
                  </Text>
                  <Text variant="bodyMedium" style={{ color: "#0f172a" }}>
                    {String(value)}
                  </Text>
                </View>
                <Divider />
              </View>
            ))
          ) : (
            <Text variant="bodyMedium" style={{ color: "#64748b" }}>
              We're still parsing this receipt. Check back soon!
            </Text>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
};
