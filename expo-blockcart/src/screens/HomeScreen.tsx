"use client";

import { useCallback, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  View,
  StyleSheet,
  Pressable,
} from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import {
  Button,
  Card,
  Surface,
  Text,
  useTheme,
  FAB,
  IconButton,
} from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useErrorHandler } from "../hooks/useErrorHandler";
import type { AppTabParamList } from "../navigation/MainNavigator";
import type { Receipt, ReceiptStatus, UserBalance } from "../types";
import ReceiptStatusChip from "../components/ReceiptStatusChip";
import { colors, spacing, borderRadius } from "../theme/colors";

const MAX_RECENT_RECEIPTS = 3;
const RECEIPT_STATUSES: ReceiptStatus[] = [
  "pending",
  "pending_review",
  "approved",
  "rejected",
  "flagged",
  "error",
];

type BalanceRow = Pick<UserBalance, "total_balance">;
type RecentReceiptRow = Pick<
  Receipt,
  | "id"
  | "created_at"
  | "store"
  | "total"
  | "status"
  | "extracted_fields"
  | "location"
  | "payment_method"
  | "receipt_date"
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
          .select(
            "id, created_at, store, total, status, extracted_fields, location, payment_method, receipt_date"
          )
          .eq("user_id", session.user.id)
          .in("status", RECEIPT_STATUSES)
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
  }, [session?.user, handleError]);

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

  const dynamicStyles = StyleSheet.create({
    container: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.lg,
      gap: spacing.md,
      paddingBottom: 100,
    },
    balanceCardContainer: {
      marginBottom: spacing.xs,
    },
    balanceCard: {
      borderRadius: borderRadius.xl,
      padding: spacing.xl,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 8,
      overflow: "hidden",
    },
    patternOverlay: {
      position: "absolute",
      top: 0,
      right: 0,
      width: "100%",
      height: "100%",
      opacity: 0.1,
    },
    balanceHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: spacing.md,
    },
    balanceLabel: {
      color: "rgba(255, 255, 255, 0.9)",
      fontWeight: "500",
      marginBottom: spacing.xs,
    },
    balanceAmount: {
      color: theme.colors.onPrimary,
      fontWeight: "800",
      fontSize: 48,
      lineHeight: 56,
    },
    balanceCurrency: {
      color: "rgba(255, 255, 255, 0.9)",
      fontWeight: "600",
      marginTop: spacing.xs,
    },
    walletIconContainer: {
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      borderRadius: borderRadius.lg,
      overflow: "hidden",
    },
    walletIcon: {
      margin: 0,
    },
    balanceSubtext: {
      color: theme.colors.onPrimary,
      marginBottom: spacing.lg,
    },
    quickActions: {
      flexDirection: "row",
      gap: spacing.md,
    },
    quickActionButton: {
      flex: 1,
      backgroundColor: "rgba(255, 255, 255, 0.15)",
      borderRadius: borderRadius.md,
      padding: spacing.sm,
      alignItems: "center",
      gap: spacing.xs,
    },
    quickActionText: {
      color: theme.colors.onPrimary,
      fontSize: 12,
      fontWeight: "600",
    },
    card: {
      borderRadius: borderRadius.xl,
      backgroundColor: colors.surface,
    },
    cardTitle: {
      fontWeight: "700",
      fontSize: 18,
    },
    emptyState: {
      paddingVertical: spacing.xl,
      alignItems: "center",
      gap: spacing.md,
    },
    emptyIconContainer: {
      backgroundColor: `${colors.primary}15`,
      borderRadius: borderRadius.xl,
      padding: spacing.md,
    },
    emptyTitle: {
      fontWeight: "600",
      color: colors.textPrimary,
    },
    emptySubtitle: {
      color: colors.textSecondary,
      textAlign: "center",
      paddingHorizontal: spacing.lg,
    },
    emptyButton: {
      marginTop: spacing.sm,
      borderRadius: borderRadius.md,
    },
    receiptsList: {
      gap: spacing.sm,
    },
    receiptItem: {
      borderRadius: borderRadius.lg,
      backgroundColor: colors.surfaceVariant,
      overflow: "hidden",
    },
    receiptContent: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.md,
      gap: spacing.md,
    },
    receiptIconContainer: {
      borderRadius: borderRadius.md,
      overflow: "hidden",
    },
    receiptIconGradient: {
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
    },
    receiptInfo: {
      flex: 1,
      gap: spacing.xs,
    },
    receiptStore: {
      fontWeight: "600",
      color: colors.textPrimary,
    },
    receiptDetails: {
      color: colors.textSecondary,
      fontSize: 13,
    },
    viewAllButton: {
      marginTop: spacing.sm,
    },
    referralGradient: {
      borderRadius: borderRadius.xl,
      padding: spacing.xl,
    },
    referralContent: {
      gap: spacing.md,
    },
    referralIconContainer: {
      alignSelf: "flex-start",
      borderRadius: borderRadius.lg,
      overflow: "hidden",
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    referralIconGradient: {
      width: 56,
      height: 56,
      alignItems: "center",
      justifyContent: "center",
    },
    referralText: {
      gap: spacing.sm,
    },
    referralTitle: {
      fontWeight: "700",
      color: colors.textPrimary,
    },
    referralSubtitle: {
      color: colors.textSecondary,
      lineHeight: 20,
    },
    referralButton: {
      borderRadius: borderRadius.md,
      alignSelf: "flex-start",
    },
    fabWrapper: {
      position: "absolute",
      right: spacing.md,
      bottom: spacing.lg * 2,
    },
    fabGradient: {
      borderRadius: 28,
      overflow: "hidden",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
    fab: {
      backgroundColor: "transparent",
      margin: 0,
      borderRadius: 28,
    },
  });

  return (
    <>
      <ScrollView
        contentContainerStyle={dynamicStyles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={dynamicStyles.balanceCardContainer}>
          <LinearGradient
            colors={["#1E88E5", "#00BCD4", "#00C48C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={dynamicStyles.balanceCard}
          >
            <View style={dynamicStyles.patternOverlay} />

            <View style={dynamicStyles.balanceHeader}>
              <View>
                <Text variant="labelLarge" style={dynamicStyles.balanceLabel}>
                  Total Balance
                </Text>
                <Text
                  variant="displayLarge"
                  style={dynamicStyles.balanceAmount}
                >
                  {balance?.toFixed(2) ?? "0.00"}
                </Text>
                <Text
                  variant="titleMedium"
                  style={dynamicStyles.balanceCurrency}
                >
                  BTC$
                </Text>
              </View>

              <View style={dynamicStyles.walletIconContainer}>
                <IconButton
                  icon="wallet"
                  size={32}
                  iconColor="#FFFFFF"
                  style={dynamicStyles.walletIcon}
                />
              </View>
            </View>

            <Text variant="bodyMedium" style={dynamicStyles.balanceSubtext}>
              Keep uploading receipts to earn more rewards
            </Text>

            <View style={dynamicStyles.quickActions}>
              <Pressable
                style={dynamicStyles.quickActionButton}
                onPress={() =>
                  navigation.navigate("Receipts", { screen: "UploadReceipt" })
                }
              >
                <IconButton
                  icon="upload"
                  size={20}
                  iconColor="#FFFFFF"
                  style={{ margin: 0 }}
                />
                <Text style={dynamicStyles.quickActionText}>Upload</Text>
              </Pressable>

              <Pressable
                style={dynamicStyles.quickActionButton}
                onPress={() => navigation.navigate("Wallet")}
              >
                <IconButton
                  icon="history"
                  size={20}
                  iconColor="#FFFFFF"
                  style={{ margin: 0 }}
                />
                <Text style={dynamicStyles.quickActionText}>History</Text>
              </Pressable>

              <Pressable
                style={dynamicStyles.quickActionButton}
                onPress={() =>
                  navigation.navigate("Profile", { screen: "Referral" })
                }
              >
                <IconButton
                  icon="share-variant"
                  size={20}
                  iconColor="#FFFFFF"
                  style={{ margin: 0 }}
                />
                <Text style={dynamicStyles.quickActionText}>Refer</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </View>

        <Card style={dynamicStyles.card} elevation={2}>
          <Card.Title
            title="Recent Receipts"
            subtitle="Your latest activity"
            titleStyle={dynamicStyles.cardTitle}
            right={(props) => (
              <IconButton
                {...props}
                icon="chevron-right"
                onPress={() =>
                  navigation.navigate("Receipts", { screen: "ReceiptList" })
                }
              />
            )}
          />
          <Card.Content>
            {receipts.length === 0 ? (
              <View style={dynamicStyles.emptyState}>
                <View style={dynamicStyles.emptyIconContainer}>
                  <IconButton
                    icon="receipt-text-outline"
                    size={48}
                    iconColor={colors.primary}
                  />
                </View>
                <Text variant="titleMedium" style={dynamicStyles.emptyTitle}>
                  No receipts yet
                </Text>
                <Text variant="bodyMedium" style={dynamicStyles.emptySubtitle}>
                  Upload your first receipt to start earning BTC$
                </Text>
                <Button
                  mode="contained"
                  onPress={() =>
                    navigation.navigate("Receipts", { screen: "UploadReceipt" })
                  }
                  style={dynamicStyles.emptyButton}
                  icon="camera-plus"
                >
                  Upload Receipt
                </Button>
              </View>
            ) : (
              <View style={dynamicStyles.receiptsList}>
                {receipts.map((receipt) => (
                  <Surface
                    key={receipt.id}
                    style={dynamicStyles.receiptItem}
                    elevation={0}
                  >
                    <Pressable
                      onPress={() =>
                        navigation.navigate("Receipts", {
                          screen: "ReceiptDetail",
                          params: { receiptId: receipt.id },
                        })
                      }
                    >
                      <View style={dynamicStyles.receiptContent}>
                        <View style={dynamicStyles.receiptIconContainer}>
                          <LinearGradient
                            colors={[
                              `${colors.primary}30`,
                              `${colors.primary}10`,
                            ]}
                            style={dynamicStyles.receiptIconGradient}
                          >
                            <IconButton
                              icon="receipt"
                              size={24}
                              iconColor={colors.primary}
                              style={{ margin: 0 }}
                            />
                          </LinearGradient>
                        </View>

                        <View style={dynamicStyles.receiptInfo}>
                          <Text
                            variant="titleMedium"
                            style={dynamicStyles.receiptStore}
                          >
                            {receipt.store ?? "Processing..."}
                          </Text>
                          <Text
                            variant="bodyMedium"
                            style={dynamicStyles.receiptDetails}
                          >
                            ${receipt.total?.toFixed(2) ?? "--"} • {(
                              receipt.receipt_date
                                ? new Date(receipt.receipt_date).toLocaleDateString()
                                : new Date(receipt.created_at).toLocaleDateString()
                            )}
                          </Text>
                        </View>

                        <ReceiptStatusChip status={receipt.status} />
                      </View>
                    </Pressable>
                  </Surface>
                ))}
                <Button
                  mode="text"
                  onPress={() =>
                    navigation.navigate("Receipts", { screen: "ReceiptList" })
                  }
                  style={dynamicStyles.viewAllButton}
                  icon="arrow-right"
                  contentStyle={{ flexDirection: "row-reverse" }}
                >
                  View all receipts
                </Button>
              </View>
            )}
          </Card.Content>
        </Card>

        <Card style={dynamicStyles.card} elevation={2}>
          <LinearGradient
            colors={["rgba(30, 136, 229, 0.05)", "rgba(0, 196, 140, 0.05)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={dynamicStyles.referralGradient}
          >
            <View style={dynamicStyles.referralContent}>
              <View style={dynamicStyles.referralIconContainer}>
                <LinearGradient
                  colors={[colors.accent, colors.accentDark]}
                  style={dynamicStyles.referralIconGradient}
                >
                  <IconButton
                    icon="account-multiple"
                    size={28}
                    iconColor="#FFFFFF"
                    style={{ margin: 0 }}
                  />
                </LinearGradient>
              </View>

              <View style={dynamicStyles.referralText}>
                <Text variant="titleLarge" style={dynamicStyles.referralTitle}>
                  Earn More with Referrals
                </Text>
                <Text
                  variant="bodyMedium"
                  style={dynamicStyles.referralSubtitle}
                >
                  Share your code and earn bonus BTC$ when friends join
                </Text>
              </View>

              <Button
                mode="contained"
                onPress={() =>
                  navigation.navigate("Profile", { screen: "Referral" })
                }
                style={dynamicStyles.referralButton}
                icon="arrow-right"
                contentStyle={{ flexDirection: "row-reverse" }}
              >
                Get Started
              </Button>
            </View>
          </LinearGradient>
        </Card>
      </ScrollView>

      <View style={dynamicStyles.fabWrapper}>
        <LinearGradient
          colors={[colors.primary, colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={dynamicStyles.fabGradient}
        >
          <FAB
            icon="camera-plus"
            style={dynamicStyles.fab}
            onPress={() =>
              navigation.navigate("Receipts", { screen: "UploadReceipt" })
            }
            label="Upload"
            color="#FFFFFF"
            customSize={56}
          />
        </LinearGradient>
      </View>
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
  balanceCardContainer: {
    marginBottom: spacing.xs,
  },
  balanceCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    overflow: "hidden",
  },
  patternOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    width: "100%",
    height: "100%",
    opacity: 0.1,
  },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  balanceLabel: {
    color: "rgba(255, 255, 255, 0.9)",
    fontWeight: "500",
    marginBottom: spacing.xs,
  },
  balanceAmount: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 48,
    lineHeight: 56,
  },
  balanceCurrency: {
    color: "rgba(255, 255, 255, 0.9)",
    fontWeight: "600",
    marginTop: spacing.xs,
  },
  walletIconContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: borderRadius.lg,
    overflow: "hidden",
  },
  walletIcon: {
    margin: 0,
  },
  balanceSubtext: {
    color: "#FFFFFF",
    marginBottom: spacing.lg,
  },
  quickActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: "center",
    gap: spacing.xs,
  },
  quickActionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  card: {
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    fontWeight: "700",
    fontSize: 18,
  },
  emptyState: {
    paddingVertical: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  emptyIconContainer: {
    backgroundColor: `${colors.primary}15`,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
  },
  emptyTitle: {
    fontWeight: "600",
    color: colors.textPrimary,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
  emptyButton: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
  },
  receiptsList: {
    gap: spacing.sm,
  },
  receiptItem: {
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceVariant,
    overflow: "hidden",
  },
  receiptContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.md,
  },
  receiptIconContainer: {
    borderRadius: borderRadius.md,
    overflow: "hidden",
  },
  receiptIconGradient: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  receiptInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  receiptStore: {
    fontWeight: "600",
    color: colors.textPrimary,
  },
  receiptDetails: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  viewAllButton: {
    marginTop: spacing.sm,
  },
  referralGradient: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
  },
  referralContent: {
    gap: spacing.md,
  },
  referralIconContainer: {
    alignSelf: "flex-start",
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  referralIconGradient: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  referralText: {
    gap: spacing.sm,
  },
  referralTitle: {
    fontWeight: "700",
    color: colors.textPrimary,
  },
  referralSubtitle: {
    color: colors.textSecondary,
    lineHeight: 20,
  },
  referralButton: {
    borderRadius: borderRadius.md,
    alignSelf: "flex-start",
  },
  fabWrapper: {
    position: "absolute",
    right: spacing.md,
    bottom: spacing.lg * 2,
  },
  fabGradient: {
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fab: {
    backgroundColor: "transparent",
    margin: 0,
    borderRadius: 28,
  },
});
