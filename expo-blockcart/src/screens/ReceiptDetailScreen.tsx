import { useEffect, useMemo, useState } from "react";
import { Image, ScrollView, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Card, Divider, Surface, Text, useTheme } from "react-native-paper";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import type { ReceiptsStackParamList } from "../navigation/MainNavigator";
import type { Receipt, ReceiptExtractedFields, ReceiptItem } from "../types";
import ReceiptStatusChip from "../components/ReceiptStatusChip";
import LoadingView from "../components/LoadingView";
import { spacing } from "../theme/colors";

const DETAIL_FIELDS: Array<{ label: string; key: keyof Receipt }> = [
  { label: "Store", key: "store" },
  { label: "Location", key: "location" },
  { label: "Payment Method", key: "payment_method" },
  { label: "Total", key: "total" },
  { label: "Receipt Date", key: "receipt_date" },
  { label: "Receipt Time", key: "receipt_time" },
  { label: "Status", key: "status" },
  { label: "Reward", key: "reward_amount" },
];

const EXTRACTED_FIELDS_EXCLUDED_KEYS = new Set([
  "items",
  "store",
  "location",
  "payment_method",
  "total",
]);

type ReceiptRow = Pick<
  Receipt,
  | "id"
  | "created_at"
  | "store"
  | "total"
  | "status"
  | "image_url"
  | "receipt_date"
  | "receipt_time"
  | "reward_amount"
  | "location"
  | "payment_method"
  | "extracted_fields"
  | "parsed_json"
>;

type Props = NativeStackScreenProps<ReceiptsStackParamList, "ReceiptDetail">;

export default function ReceiptDetailScreen({ route }: Props) {
  const theme = useTheme();
  const { session } = useAuth();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);

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
            "id, created_at, store, total, status, extracted_fields, parsed_json, image_url, receipt_date, receipt_time, reward_amount, location, payment_method"
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

  const extractedFields: ReceiptExtractedFields | null = useMemo(() => {
    if (!receipt) {
      return null;
    }
    if (receipt.extracted_fields) {
      return receipt.extracted_fields;
    }
    if (receipt.parsed_json) {
      return receipt.parsed_json as ReceiptExtractedFields;
    }
    return null;
  }, [receipt]);

  const extractedItems: ReceiptItem[] = useMemo(() => {
    if (!extractedFields?.items) {
      return [];
    }
    if (!Array.isArray(extractedFields.items)) {
      return [];
    }
    return extractedFields.items.filter((item): item is ReceiptItem =>
      Boolean(item)
    );
  }, [extractedFields]);

  const additionalFields = useMemo(
    () =>
      extractedFields
        ? Object.entries(extractedFields).filter(
            ([key, value]) =>
              !EXTRACTED_FIELDS_EXCLUDED_KEYS.has(key) &&
              value !== null &&
              value !== undefined
          )
        : [],
    [extractedFields]
  );

  useEffect(() => {
    let isActive = true;

    const resolveImageUrl = async () => {
      if (!receipt?.image_url) {
        if (isActive) {
          setResolvedImageUrl(null);
        }
        return;
      }

      if (isActive) {
        setResolvedImageUrl(null);
      }

      const rawUrl = receipt.image_url;
      const sanitized = rawUrl.split(/[?#]/)[0];
      const receiptsIndex = sanitized.lastIndexOf("receipts/");
      let objectPath: string | null = null;

      if (receiptsIndex !== -1) {
        const extracted = sanitized.slice(receiptsIndex + "receipts/".length);
        objectPath = extracted ? extracted.replace(/^\/+/, "") : null;
      } else if (!sanitized.startsWith("http")) {
        const trimmed = sanitized.replace(/^\/+/, "");
        objectPath = trimmed.startsWith("receipts/")
          ? trimmed.replace(/^receipts\//, "")
          : trimmed;
      }

      if (!objectPath) {
        if (isActive) {
          setResolvedImageUrl(rawUrl);
        }
        return;
      }

      try {
        const { data, error } = await supabase.storage
          .from("receipts")
          .createSignedUrl(objectPath, 60 * 60);

        if (!isActive) {
          return;
        }

        if (error) {
          console.warn("Failed to create signed receipt URL", error);
        }

        if (data?.signedUrl) {
          setResolvedImageUrl(data.signedUrl);
          return;
        }
      } catch (signError) {
        if (isActive) {
          console.warn("Unexpected error creating signed receipt URL", signError);
        }
      }

      if (!isActive) {
        return;
      }

      const { data: publicData } = supabase.storage
        .from("receipts")
        .getPublicUrl(objectPath);

      setResolvedImageUrl(publicData?.publicUrl ?? rawUrl);
    };

    resolveImageUrl();

    return () => {
      isActive = false;
    };
  }, [receipt?.image_url]);

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
          {resolvedImageUrl ? (
            <Image
              source={{ uri: resolvedImageUrl }}
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
              if (field.key === "receipt_time") {
                return String(value);
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
          {additionalFields.length === 0 && extractedItems.length === 0 ? (
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              OCR results will appear here once processing completes.
            </Text>
          ) : (
            <>
              {additionalFields.map(([key, value]) => (
                <View key={key} style={styles.parsedItem}>
                  <Text variant="labelLarge">{key}</Text>
                  <Text>{JSON.stringify(value)}</Text>
                  <Divider style={{ marginTop: 8 }} />
                </View>
              ))}
              {extractedItems.length > 0 ? (
                <View style={styles.parsedItem}>
                  <Text variant="labelLarge">Items</Text>
                  {extractedItems.map((item, index) => (
                    <View key={`${item.name ?? "item"}-${index}`}>
                      <Text variant="titleSmall">Item {index + 1}</Text>
                      <Text>
                        {item.name ?? "Unnamed item"}
                        {item.brand ? ` • ${item.brand}` : ""}
                      </Text>
                      <Text>
                        {item.price !== undefined && item.price !== null
                          ? `$${Number(item.price).toFixed(2)}`
                          : "--"}
                        {item.quantity
                          ? ` • Qty: ${Number(item.quantity)}`
                          : ""}
                      </Text>
                      <Divider style={{ marginVertical: 8 }} />
                    </View>
                  ))}
                </View>
              ) : null}
            </>
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
