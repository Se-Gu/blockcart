import { useCallback, useState } from "react";
import { RefreshControl, ScrollView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { List, Surface, Text, useTheme } from "react-native-paper";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import type { ReceiptsStackParamList } from "../navigation/MainNavigator";
import type { Receipt } from "../types";
import ReceiptStatusChip from "../components/ReceiptStatusChip";
import LoadingView from "../components/LoadingView";
import { useErrorHandler } from "../hooks/useErrorHandler";

const PAGE_LIMIT = 20;

type ReceiptRow = Pick<
  Receipt,
  "id" | "created_at" | "store" | "total" | "status" | "parsed_json"
>;

type Props = NativeStackScreenProps<ReceiptsStackParamList, "ReceiptList">;

export default function ReceiptListScreen({ navigation }: Props) {
  const theme = useTheme();
  const { session } = useAuth();
  const { handleError } = useErrorHandler({ context: "Receipt List" });
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReceipts = useCallback(async () => {
    if (!session?.user) {
      return;
    }
    setLoading(true);
    try {
      const { data, error: queryError } = await supabase
        .from("receipts")
        .select("id, created_at, store, total, status, parsed_json")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(PAGE_LIMIT);

      if (queryError) {
        throw queryError;
      }

      const receiptsRaw = data as unknown;
      const receiptsData = Array.isArray(receiptsRaw)
        ? (receiptsRaw as ReceiptRow[])
        : [];

      setReceipts(receiptsData as Receipt[]);
    } catch (err) {
      handleError(err, "Loading receipts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user?.id, handleError]);

  useFocusEffect(
    useCallback(() => {
      void fetchReceipts();
    }, [fetchReceipts])
  );

  const handleRefresh = useCallback(() => {
    if (refreshing) {
      return;
    }
    setRefreshing(true);
    void fetchReceipts();
  }, [fetchReceipts, refreshing]);

  if (loading && receipts.length === 0) {
    return <LoadingView message="Fetching your receipts" />;
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {receipts.length === 0 ? (
        <Surface
          style={{
            padding: 16,
            borderRadius: 16,
            backgroundColor: theme.colors.surfaceVariant,
          }}
        >
          <Text style={{ color: theme.colors.onSurfaceVariant }}>
            No receipts yet. Upload your first receipt to start earning rewards.
          </Text>
        </Surface>
      ) : (
        receipts.map((receipt) => (
          <Surface key={receipt.id} style={{ borderRadius: 12 }} elevation={1}>
            <List.Item
              title={receipt.store ?? "Pending OCR"}
              description={`$${receipt.total?.toFixed(2) ?? "--"} • ${new Date(
                receipt.created_at
              ).toLocaleString()}`}
              onPress={() =>
                navigation.navigate("ReceiptDetail", {
                  receiptId: receipt.id,
                })
              }
              right={() => <ReceiptStatusChip status={receipt.status} />}
            />
          </Surface>
        ))
      )}
    </ScrollView>
  );
}
