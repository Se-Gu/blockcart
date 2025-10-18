import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import {
  Avatar,
  Button,
  Card,
  List,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useErrorHandler } from "../hooks/useErrorHandler";
import type { AppTabParamList } from "../navigation/MainNavigator";
import type { Receipt, UserBalance } from "../types";
import ReceiptStatusChip from "../components/ReceiptStatusChip";

const MAX_RECENT_RECEIPTS = 3;

type BalanceRow = Pick<UserBalance, "total_balance">;
type RecentReceiptRow = Pick<
  Receipt,
  "id" | "created_at" | "store" | "total" | "status" | "parsed_json"
>;

type Props = BottomTabScreenProps<AppTabParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const { session } = useAuth();
  const theme = useTheme();
  const { handleError } = useErrorHandler({ context: "Loading Home Data" });
  const [balance, setBalance] = useState<number | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!session?.user) {
      return;
    }
    setLoading(true);
    try {
      const [balanceResponse, receiptsResponse] = await Promise.all([
        supabase
          .from("user_balances")
          .select("total_balance")
          .eq("user_id", session.user.id)
          .maybeSingle(),
        supabase
          .from("receipts")
          .select("id, created_at, store, total, status, parsed_json")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(MAX_RECENT_RECEIPTS),
      ]);

      if (balanceResponse.error) {
        throw balanceResponse.error;
      }
      if (receiptsResponse.error) {
        throw receiptsResponse.error;
      }

      const balanceData = balanceResponse.data as BalanceRow | null;
      const receiptsRaw = receiptsResponse.data as unknown;
      const receiptsData = Array.isArray(receiptsRaw)
        ? (receiptsRaw as RecentReceiptRow[])
        : [];

      setBalance(balanceData?.total_balance ?? 0);
      setReceipts(receiptsData as Receipt[]);
    } catch (err) {
      handleError(err, "Loading home data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user?.id, handleError]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const handleRefresh = useCallback(() => {
    if (refreshing) {
      return;
    }
    setRefreshing(true);
    void loadData();
  }, [loadData, refreshing]);

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 16 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <Card>
        <Card.Content>
          <Text
            variant="titleMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Current Balance
          </Text>
          <Text variant="headlineLarge" style={{ marginTop: 8 }}>
            BCT$ {balance?.toFixed(2) ?? "0.00"}
          </Text>
          <Button
            mode="contained"
            style={{ marginTop: 16 }}
            onPress={() =>
              navigation.navigate("Receipts", { screen: "UploadReceipt" })
            }
            loading={loading && !balance}
          >
            Upload Receipt
          </Button>
        </Card.Content>
      </Card>

      <Card>
        <Card.Title title="My Receipts" subtitle="Recent activity" />
        <Card.Content>
          {receipts.length === 0 ? (
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              You haven't uploaded any receipts yet.
            </Text>
          ) : (
            <View style={{ gap: 12 }}>
              {receipts.map((receipt) => (
                <Surface
                  key={receipt.id}
                  style={{
                    borderRadius: 12,
                    padding: 12,
                    elevation: 1,
                  }}
                >
                  <List.Item
                    title={receipt.store ?? "Pending OCR"}
                    description={`$${
                      receipt.total?.toFixed(2) ?? "--"
                    } • ${new Date(receipt.created_at).toLocaleDateString()}`}
                    left={() => (
                      <Avatar.Icon
                        icon="store"
                        size={40}
                        style={{ backgroundColor: "transparent" }}
                      />
                    )}
                    right={() => <ReceiptStatusChip status={receipt.status} />}
                    onPress={() =>
                      navigation.navigate("Receipts", {
                        screen: "ReceiptDetail",
                        params: { receiptId: receipt.id },
                      })
                    }
                  />
                </Surface>
              ))}
              <Button
                mode="text"
                onPress={() =>
                  navigation.navigate("Receipts", { screen: "ReceiptList" })
                }
              >
                View all receipts
              </Button>
            </View>
          )}
        </Card.Content>
      </Card>

      <Card>
        <Card.Content>
          <Text variant="titleMedium">Referrals & Bonuses</Text>
          <Text variant="bodyMedium" style={{ marginTop: 8 }}>
            Share your referral code with friends and earn extra BCT$ when their
            receipts are approved.
          </Text>
          <Button
            mode="outlined"
            style={{ marginTop: 16 }}
            onPress={() =>
              navigation.navigate("Profile", { screen: "Referral" })
            }
          >
            Manage referrals
          </Button>
        </Card.Content>
      </Card>

      {loading && (
        <Surface style={{ padding: 16, borderRadius: 12 }}>
          <Text variant="bodyMedium" style={{ textAlign: "center" }}>
            Loading your data...
          </Text>
        </Surface>
      )}
    </ScrollView>
  );
}
