import { useEffect, useState } from "react";
import { Image, ScrollView, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Card, Divider, Surface, Text, useTheme } from "react-native-paper";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import type { ReceiptsStackParamList } from "../navigation/MainNavigator";
import type { Receipt } from "../types";
import ReceiptStatusChip from "../components/ReceiptStatusChip";
import LoadingView from "../components/LoadingView";
import { spacing } from "../theme/colors";

const DETAIL_FIELDS: Array<{ label: string; key: keyof Receipt }> = [
  { label: "Store", key: "store" },
  { label: "Total", key: "total" },
  { label: "Receipt Date", key: "receipt_date" },
  { label: "Status", key: "status" },
];

type ReceiptRow = Pick<
  Receipt,
  | "id"
  | "created_at"
  | "store"
  | "total"
  | "status"
  | "parsed_json"
  | "image_url"
  | "receipt_date"
>;

type Props = NativeStackScreenProps<ReceiptsStackParamList, "ReceiptDetail">;

export default function ReceiptDetailScreen({ route }: Props) {
  const theme = useTheme();
  const { session } = useAuth();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchReceipt = async () => {
      if (!session?.user) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data, error: queryError } = await supabase
          .from("receipts")
          .select(
            "id, created_at, store, total, status, parsed_json, image_url, receipt_date"
          )
          .eq("id", route.params.receiptId)
          .eq("user_id", session.user.id)
          .single();

        if (queryError) {
          throw queryError;
        }

        if (!isMounted) {
          return;
        }

        const receiptData = data as ReceiptRow | null;
        setReceipt(receiptData ? (receiptData as Receipt) : null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchReceipt();

    return () => {
      isMounted = false;
    };
  }, [route.params.receiptId, session?.user?.id]);

  if (loading && !receipt) {
    return <LoadingView message="Loading receipt details" />;
  }

  if (error) {
    return (
      <Surface
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={{ color: theme.colors.error }}>{error}</Text>
      </Surface>
    );
  }

  if (!receipt) {
    return (
      <Surface
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        <Text>No receipt found.</Text>
      </Surface>
    );
  }

  const parsedFields = receipt.parsed_json
    ? Object.entries(receipt.parsed_json)
    : [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card>
        <Card.Content style={styles.cardContent}>
          <View style={styles.headerRow}>
            <Text variant="titleLarge">{receipt.store ?? "Pending OCR"}</Text>
            <ReceiptStatusChip status={receipt.status} />
          </View>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Submitted {new Date(receipt.created_at).toLocaleString()}
          </Text>
          {receipt.image_url ? (
            <Image
              source={{ uri: receipt.image_url }}
              style={{ width: "100%", height: 220, borderRadius: 12 }}
              resizeMode="cover"
            />
          ) : null}
          {DETAIL_FIELDS.map((field) => {
            const value = receipt[field.key];
            if (value === null || value === undefined) {
              return null;
            }

            const formattedValue = (() => {
              if (field.key === "total") {
                return `$${Number(value).toFixed(2)}`;
              }
              if (field.key === "reward_amount") {
                return `${Number(value).toFixed(2)} BCT$`;
              }
              if (field.key === "receipt_date") {
                const parsed = new Date(String(value));
                return isNaN(parsed.getTime())
                  ? String(value)
                  : parsed.toLocaleDateString();
              }
              return String(value);
            })();

            return (
              <View key={field.key}>
                <Text variant="labelLarge">{field.label}</Text>
                <Text variant="bodyLarge">{formattedValue}</Text>
              </View>
            );
          })}
        </Card.Content>
      </Card>

      <Card>
        <Card.Title title="Parsed Data" subtitle="OCR extracted fields" />
        <Card.Content style={styles.cardContent}>
          {parsedFields.length === 0 ? (
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              OCR results will appear here once processing completes.
            </Text>
          ) : (
            parsedFields.map(([key, value]) => (
              <View key={key} style={styles.parsedItem}>
                <Text variant="labelLarge">{key}</Text>
                <Text>{JSON.stringify(value)}</Text>
                <Divider style={{ marginTop: 8 }} />
              </View>
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
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  cardContent: {
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  parsedItem: {
    marginBottom: spacing.sm,
  },
});
