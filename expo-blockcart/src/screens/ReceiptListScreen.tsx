"use client";

import { useCallback, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  View,
  StyleSheet,
  Pressable,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Surface, Text, useTheme, IconButton, FAB } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import type { ReceiptsStackParamList } from "../navigation/MainNavigator";
import type { Receipt } from "../types";
import ReceiptStatusChip from "../components/ReceiptStatusChip";
import LoadingView from "../components/LoadingView";
import { useErrorHandler } from "../hooks/useErrorHandler";
import { useFocusEffect } from "@react-navigation/native";
import { colors, spacing, borderRadius } from "../theme/colors";

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
  }, [session, handleError]);

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
    <>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {receipts.length === 0 ? (
          <Surface style={styles.emptyCard} elevation={2}>
            <LinearGradient
              colors={[`${colors.primary}10`, `${colors.accent}05`]}
              style={styles.emptyGradient}
            >
              <View style={styles.emptyIconContainer}>
                <IconButton
                  icon="receipt-text-outline"
                  size={64}
                  iconColor={colors.primary}
                  style={{ margin: 0 }}
                />
              </View>
              <Text variant="headlineSmall" style={styles.emptyTitle}>
                No Receipts Yet
              </Text>
              <Text variant="bodyLarge" style={styles.emptySubtitle}>
                Upload your first receipt to start earning BCT$ rewards
              </Text>
              <LinearGradient
                colors={[colors.primary, colors.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.emptyButtonGradient}
              >
                <IconButton
                  icon="camera-plus"
                  size={24}
                  iconColor={theme.colors.onPrimary}
                  style={{ margin: 0 }}
                  onPress={() => navigation.navigate("UploadReceipt")}
                />
              </LinearGradient>
            </LinearGradient>
          </Surface>
        ) : (
          <View style={styles.receiptsList}>
            {receipts.map((receipt) => (
              <Surface
                key={receipt.id}
                style={styles.receiptCard}
                elevation={2}
              >
                <Pressable
                  onPress={() =>
                    navigation.navigate("ReceiptDetail", {
                      receiptId: receipt.id,
                    })
                  }
                  style={styles.receiptPressable}
                >
                  <View style={styles.receiptContent}>
                    <View style={styles.receiptIconContainer}>
                      <LinearGradient
                        colors={[`${colors.primary}25`, `${colors.primary}10`]}
                        style={styles.receiptIconGradient}
                      >
                        <IconButton
                          icon="receipt"
                          size={28}
                          iconColor={colors.primary}
                          style={{ margin: 0 }}
                        />
                      </LinearGradient>
                    </View>

                    <View style={styles.receiptInfo}>
                      <Text variant="titleMedium" style={styles.receiptStore}>
                        {receipt.store ?? "Processing..."}
                      </Text>
                      <View style={styles.receiptMeta}>
                        <Text variant="bodyMedium" style={styles.receiptAmount}>
                          ${receipt.total?.toFixed(2) ?? "--"}
                        </Text>
                        <Text variant="bodySmall" style={styles.receiptDot}>
                          •
                        </Text>
                        <Text variant="bodySmall" style={styles.receiptDate}>
                          {new Date(receipt.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.receiptRight}>
                      <ReceiptStatusChip status={receipt.status} />
                      <IconButton
                        icon="chevron-right"
                        size={20}
                        iconColor={colors.textSecondary}
                        style={{ margin: 0 }}
                      />
                    </View>
                  </View>
                </Pressable>
              </Surface>
            ))}
          </View>
        )}
      </ScrollView>

      {receipts.length > 0 && (
        <LinearGradient
          colors={[colors.primary, colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <FAB
            icon="plus"
            style={styles.fab}
            onPress={() => navigation.navigate("UploadReceipt")}
            color={theme.colors.onPrimary}
            customSize={56}
          />
        </LinearGradient>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.md,
    paddingBottom: 100,
  },
  emptyCard: {
    borderRadius: borderRadius.xl,
    overflow: "hidden",
    marginTop: spacing.xl,
  },
  emptyGradient: {
    padding: spacing.xl * 2,
    alignItems: "center",
    gap: spacing.lg,
  },
  emptyIconContainer: {
    backgroundColor: `${colors.primary}15`,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
  },
  emptyTitle: {
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  emptySubtitle: {
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: spacing.lg,
  },
  emptyButtonGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  receiptsList: {
    gap: spacing.md,
  },
  receiptCard: {
    borderRadius: borderRadius.xl,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  receiptPressable: {
    padding: spacing.md,
  },
  receiptContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  receiptIconContainer: {
    borderRadius: borderRadius.lg,
    overflow: "hidden",
  },
  receiptIconGradient: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  receiptInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  receiptStore: {
    fontWeight: "700",
    color: colors.textPrimary,
  },
  receiptMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  receiptAmount: {
    fontWeight: "600",
    color: colors.primary,
  },
  receiptDot: {
    color: colors.textSecondary,
  },
  receiptDate: {
    color: colors.textSecondary,
  },
  receiptRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  fabGradient: {
    position: "absolute",
    right: spacing.md,
    bottom: spacing.md,
    borderRadius: 28,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fab: {
    backgroundColor: "transparent",
    margin: 0,
  },
});
