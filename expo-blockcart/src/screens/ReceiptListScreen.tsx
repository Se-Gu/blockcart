"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Button,
  FAB,
  IconButton,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import type { ReceiptsStackParamList } from "../navigation/MainNavigator";
import type { Receipt, ReceiptStatus } from "../types";
import ReceiptStatusChip from "../components/ReceiptStatusChip";
import LoadingView from "../components/LoadingView";
import { useErrorHandler } from "../hooks/useErrorHandler";
import { colors, spacing, borderRadius } from "../theme/colors";

const PAGE_LIMIT = 20;

type ReceiptListItem = Pick<
  Receipt,
  "id" | "created_at" | "store" | "total" | "status" | "receipt_date"
>;

type Props = NativeStackScreenProps<ReceiptsStackParamList, "ReceiptList">;

const formatCurrency = (value: number | null | undefined) => {
  if (typeof value === "number") {
    return `$${value.toFixed(2)}`;
  }
  return "--";
};

const formatDateValue = (value: string | null | undefined) => {
  if (!value) {
    return "--";
  }
  const timestamp = Date.parse(value);
  if (isNaN(timestamp)) {
    return "--";
  }
  return new Date(timestamp).toLocaleDateString();
};

const isWarningStatus = (status: ReceiptStatus) =>
  status === "flagged" || status === "error";

export default function ReceiptListScreen({ navigation }: Props) {
  const theme = useTheme();
  const { session } = useAuth();
  const { handleError } = useErrorHandler({ context: "Receipt List" });
  const [receipts, setReceipts] = useState<ReceiptListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReceipts = useCallback(async () => {
    if (!session?.user) {
      setReceipts([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("receipts")
        .select("id, created_at, store, total, status, receipt_date")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(PAGE_LIMIT);

      if (error) {
        throw error;
      }

      const rows = Array.isArray(data)
        ? (data as ReceiptListItem[])
        : ([] as ReceiptListItem[]);
      setReceipts(rows);
    } catch (error) {
      handleError(error, "Loading receipts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user, handleError]);

  useEffect(() => {
    if (!session?.user) {
      setReceipts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    void fetchReceipts();
  }, [session?.user, fetchReceipts]);

  const handleRefresh = useCallback(() => {
    if (refreshing) {
      return;
    }
    setRefreshing(true);
    void fetchReceipts();
  }, [refreshing, fetchReceipts]);

  useEffect(() => {
    if (!session?.user) {
      return;
    }

    const channel = supabase
      .channel(`receipts-list-${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "receipts",
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload: RealtimePostgresChangesPayload<ReceiptListItem>) => {
          if (payload.eventType === "DELETE") {
            const oldRow = (payload.old as { id?: string } | null)?.id;
            if (oldRow) {
              setReceipts((prev) =>
                prev.filter((receipt) => receipt.id !== oldRow)
              );
            }
            return;
          }

          const newRow = payload.new as ReceiptListItem | null;
          if (!newRow) {
            return;
          }

          setReceipts((prev) => {
            const existingIndex = prev.findIndex(
              (receipt) => receipt.id === newRow.id
            );
            const next = [...prev];
            if (existingIndex === -1) {
              next.unshift(newRow);
            } else {
              next[existingIndex] = { ...next[existingIndex], ...newRow };
            }
            next.sort(
              (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
            );
            return next.slice(0, PAGE_LIMIT);
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session?.user]);

  const renderReceipt = useCallback(
    ({ item }: { item: ReceiptListItem }) => {
      const displayDate = item.receipt_date ?? item.created_at;

      return (
        <Surface style={styles.receiptCard} elevation={1}>
          <Pressable
            onPress={() =>
              navigation.navigate("ReceiptDetail", { receiptId: item.id })
            }
            style={styles.receiptPressable}
          >
            <View style={styles.receiptContent}>
              <View style={styles.receiptInfo}>
                <Text variant="titleMedium" style={styles.receiptTitle}>
                  {item.store ?? "Processing receipt"}
                </Text>
                <Text variant="bodySmall" style={styles.receiptSubtitle}>
                  {formatCurrency(item.total)} • {formatDateValue(displayDate)}
                </Text>
              </View>

              <View style={styles.receiptStatus}>
                {isWarningStatus(item.status) ? (
                  <IconButton
                    icon="alert-circle"
                    size={18}
                    iconColor={theme.colors.error}
                    style={styles.warningIcon}
                  />
                ) : null}
                <ReceiptStatusChip status={item.status} />
                <IconButton
                  icon="chevron-right"
                  size={18}
                  iconColor={theme.colors.onSurfaceVariant}
                  style={styles.chevronIcon}
                />
              </View>
            </View>
          </Pressable>
        </Surface>
      );
    },
    [navigation, theme.colors.error, theme.colors.onSurfaceVariant]
  );

  const keyExtractor = useCallback((item: ReceiptListItem) => item.id, []);

  const renderEmpty = useCallback(() => {
    if (loading) {
      return null;
    }
    return (
      <Surface style={styles.emptyState} elevation={0}>
        <Text variant="titleMedium" style={styles.emptyTitle}>
          No receipts yet
        </Text>
        <Text variant="bodyMedium" style={styles.emptySubtitle}>
          Upload a receipt to start tracking your rewards.
        </Text>
        <Button
          mode="contained"
          icon="camera-plus"
          onPress={() => navigation.navigate("UploadReceipt")}
        >
          Upload receipt
        </Button>
      </Surface>
    );
  }, [loading, navigation]);

  if (loading && receipts.length === 0) {
    return <LoadingView message="Fetching your receipts" />;
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={receipts}
        keyExtractor={keyExtractor}
        renderItem={renderReceipt}
        contentContainerStyle={
          receipts.length === 0
            ? [styles.listContent, styles.emptyContent]
            : styles.listContent
        }
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={renderEmpty}
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate("UploadReceipt")}
        color={theme.colors.onPrimary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  receiptCard: {
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  receiptPressable: {
    padding: spacing.md,
  },
  receiptContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  receiptInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  receiptTitle: {
    fontWeight: "600",
    color: colors.textPrimary,
  },
  receiptSubtitle: {
    color: colors.textSecondary,
  },
  receiptStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  warningIcon: {
    margin: 0,
  },
  chevronIcon: {
    margin: 0,
  },
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    backgroundColor: colors.primary,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
  },
  emptyTitle: {
    fontWeight: "600",
    color: colors.textPrimary,
  },
  emptySubtitle: {
    textAlign: "center",
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
  },
});
