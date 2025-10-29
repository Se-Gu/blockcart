"use client";

import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, View, StyleSheet, Pressable } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
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
import type { AppTabParamList, HomeStackParamList } from "../navigation/MainNavigator";
import type { Campaign, Receipt, ReceiptStatus, UserBalance } from "../types";
import ReceiptStatusChip from "../components/ReceiptStatusChip";
import { colors, spacing, borderRadius } from "../theme/colors";
import { useActiveCampaigns, useCampaignNotifications } from "../hooks/useCampaignPromotions";

const MAX_RECENT_RECEIPTS = 3;
const RECEIPT_STATUSES: ReceiptStatus[] = [
  "pending",
  "pending_review",
  "approved",
  "rejected",
  "flagged",
  "error",
];

const formatCampaignBonus = (campaign: Campaign): string => {
  if (
    typeof campaign.reward_amount === "number" &&
    Number.isFinite(campaign.reward_amount) &&
    campaign.reward_amount > 0
  ) {
    return `+${campaign.reward_amount.toFixed(2)} USDT$`;
  }

  if (
    typeof campaign.multiplier === "number" &&
    Number.isFinite(campaign.multiplier)
  ) {
    return `${campaign.multiplier.toFixed(2)}x rewards`;
  }

  return "Bonus available";
};

const formatCampaignExpiry = (campaign: Campaign): string => {
  if (!campaign.end_date) {
    return "Ongoing";
  }

  const endDate = new Date(campaign.end_date);
  if (Number.isNaN(endDate.getTime())) {
    return `Ends ${campaign.end_date}`;
  }

  const now = new Date();
  const diffMs = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return "Ended";
  }

  if (diffDays === 0) {
    return "Ends today";
  }

  if (diffDays === 1) {
    return "Ends tomorrow";
  }

  return `Ends in ${diffDays} days`;
};

const formatCampaignProgress = (campaign: Campaign): string | null => {
  const progress = campaign.progress;
  if (!progress) {
    return null;
  }

  if (
    typeof progress.percentComplete === "number" &&
    Number.isFinite(progress.percentComplete)
  ) {
    const value = progress.percentComplete > 1
      ? progress.percentComplete
      : progress.percentComplete * 100;
    return `${Math.min(100, Math.round(value))}% complete`;
  }

  if (
    typeof progress.receiptsSubmitted === "number" &&
    typeof progress.receiptsRemaining === "number"
  ) {
    const total = progress.receiptsSubmitted + progress.receiptsRemaining;
    if (total > 0) {
      return `${progress.receiptsSubmitted}/${total} receipts used`;
    }
  }

  if (
    typeof progress.amountAwarded === "number" &&
    typeof progress.amountRemaining === "number"
  ) {
    return `${progress.amountAwarded.toFixed(2)} USDT$ earned`;
  }

  return null;
};

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

type Props = NativeStackScreenProps<HomeStackParamList, "HomeMain">;
type TabNavigation = BottomTabNavigationProp<AppTabParamList>;

export default function HomeScreen({ navigation }: Props) {
  const tabNavigation = navigation.getParent<TabNavigation>();
  const { session } = useAuth();
  const theme = useTheme();
  const { handleError } = useErrorHandler({ context: "Loading Home Data" });
  const [balance, setBalance] = useState<number | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const {
    campaigns,
    loading: campaignsLoading,
    refresh: refreshCampaigns,
    hasCampaigns,
  } = useActiveCampaigns();

  useCampaignNotifications(campaigns);

  const loadData = useCallback(async () => {
    if (!session?.user) {
      return;
    }
    setLoading(true);
    try {
      const [balanceResponse, receiptsResponse, profileResponse] = await Promise.all([
        supabase
          .from("user_balances")
          .select("total_balance")
          .eq("user_id", session.user.id)
          .maybeSingle(),
        supabase
          .from("receipts")
          .select(
            "id, created_at, store, total, status, extracted_fields, location, payment_method, receipt_date",
          )
          .eq("user_id", session.user.id)
          .in("status", RECEIPT_STATUSES)
          .order("created_at", { ascending: false })
          .limit(MAX_RECENT_RECEIPTS),
        supabase
          .from("users")
          .select("wallet_address")
          .eq("id", session.user.id)
          .maybeSingle(),
      ]);

      if (balanceResponse.error) {
        throw balanceResponse.error;
      }
      if (receiptsResponse.error) {
        throw receiptsResponse.error;
      }
      if (profileResponse.error) {
        throw profileResponse.error;
      }

      const balanceData = balanceResponse.data as BalanceRow | null;
      const receiptsRaw = receiptsResponse.data as unknown;
      const receiptsData = Array.isArray(receiptsRaw)
        ? (receiptsRaw as RecentReceiptRow[])
        : [];

      setBalance(balanceData?.total_balance ?? 0);
      setReceipts(receiptsData as Receipt[]);
      const profileData = profileResponse.data as { wallet_address?: string | null } | null;
      setWalletAddress(
        profileData?.wallet_address && typeof profileData.wallet_address === "string"
          ? profileData.wallet_address
          : null,
      );
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
    }, [loadData]),
  );

  const handleRefresh = useCallback(() => {
    if (refreshing) {
      return;
    }
    setRefreshing(true);
    void Promise.all([loadData(), refreshCampaigns()]).finally(() => {
      setRefreshing(false);
    });
  }, [loadData, refreshCampaigns, refreshing]);

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
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
        campaignSection: {
          gap: spacing.sm,
        },
        sectionHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        sectionTitle: {
          fontWeight: "700",
          fontSize: 18,
          color: colors.textPrimary,
        },
        campaignScroll: {
          flexDirection: "row",
          gap: spacing.md,
        },
        campaignCard: {
          width: 260,
          borderRadius: borderRadius.xl,
          overflow: "hidden",
        },
        campaignGradient: {
          padding: spacing.lg,
          gap: spacing.sm,
        },
        campaignBrand: {
          fontWeight: "600",
          color: "rgba(255, 255, 255, 0.85)",
          textTransform: "uppercase",
          letterSpacing: 1,
          fontSize: 12,
        },
        campaignName: {
          fontWeight: "700",
          color: "#FFFFFF",
          fontSize: 20,
          flexWrap: "wrap",
        },
        campaignMeta: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        campaignBonus: {
          color: "#FFFFFF",
          fontWeight: "700",
        },
        campaignExpiry: {
          color: "rgba(255, 255, 255, 0.8)",
          fontSize: 12,
        },
        campaignProgress: {
          color: "rgba(255, 255, 255, 0.85)",
          fontSize: 12,
        },
        campaignPlaceholder: {
          borderRadius: borderRadius.lg,
          padding: spacing.lg,
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          backgroundColor: colors.surfaceVariant,
        },
        campaignEmptyText: {
          color: colors.textSecondary,
          textAlign: "center",
        },
        campaignEmptyButton: {
          alignSelf: "center",
          marginTop: spacing.xs,
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
      }),
    [theme],
  );

  const handleNavigateToUpload = useCallback(() => {
    tabNavigation?.navigate("Receipts", { screen: "UploadReceipt" });
  }, [tabNavigation]);

  const handleNavigateToReceipts = useCallback(
    (receiptId?: string) => {
      tabNavigation?.navigate("Receipts", {
        screen: receiptId ? "ReceiptDetail" : "ReceiptList",
        params: receiptId ? { receiptId } : undefined,
      });
    },
    [tabNavigation],
  );

  const handleNavigateToWallet = useCallback(() => {
    tabNavigation?.navigate("Wallet");
  }, [tabNavigation]);

  const handleNavigateToReferrals = useCallback(() => {
    tabNavigation?.navigate("Profile", { screen: "Referral" });
  }, [tabNavigation]);

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
                  USDT$
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
              {walletAddress
                ? "Payouts flow to your connected Solana wallet."
                : "Add a Solana wallet to cash out your USDT$ rewards."}
            </Text>

            <View style={dynamicStyles.quickActions}>
              <Pressable
                style={dynamicStyles.quickActionButton}
                onPress={handleNavigateToUpload}
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
                onPress={handleNavigateToWallet}
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
                onPress={handleNavigateToReferrals}
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

        <View style={dynamicStyles.campaignSection}>
          <View style={dynamicStyles.sectionHeader}>
            <Text variant="titleLarge" style={dynamicStyles.sectionTitle}>
              Active Campaigns
            </Text>
            <Button
              mode="text"
              compact
              onPress={() => void refreshCampaigns()}
            >
              Refresh
            </Button>
          </View>

          {campaignsLoading ? (
            <Surface style={dynamicStyles.campaignPlaceholder} elevation={0}>
              <ActivityIndicator animating color={theme.colors.primary} />
              <Text style={dynamicStyles.campaignEmptyText}>
                Checking for promotions…
              </Text>
            </Surface>
          ) : hasCampaigns ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={dynamicStyles.campaignScroll}
            >
              {campaigns.map((campaign) => (
                <Pressable
                  key={campaign.id}
                  style={dynamicStyles.campaignCard}
                  onPress={() =>
                    navigation.navigate("CampaignDetail", {
                      campaignId: campaign.id,
                      campaign,
                    })
                  }
                >
                  <LinearGradient
                    colors={["#5C6BC0", "#26C6DA", "#43A047"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={dynamicStyles.campaignGradient}
                  >
                    <Text style={dynamicStyles.campaignBrand} numberOfLines={1}>
                      {campaign.brand}
                    </Text>
                    <Text style={dynamicStyles.campaignName} numberOfLines={2}>
                      {campaign.name ?? "Receipt bonus"}
                    </Text>
                    <View style={dynamicStyles.campaignMeta}>
                      <Text style={dynamicStyles.campaignBonus}>
                        {formatCampaignBonus(campaign)}
                      </Text>
                      <Text style={dynamicStyles.campaignExpiry}>
                        {formatCampaignExpiry(campaign)}
                      </Text>
                    </View>
                    {formatCampaignProgress(campaign) ? (
                      <Text style={dynamicStyles.campaignProgress}>
                        {formatCampaignProgress(campaign)}
                      </Text>
                    ) : null}
                  </LinearGradient>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Surface style={dynamicStyles.campaignPlaceholder} elevation={0}>
              <IconButton
                icon="bullhorn"
                size={36}
                iconColor={theme.colors.primary}
              />
              <Text style={dynamicStyles.campaignEmptyText}>
                New promotions will appear here as soon as they launch.
              </Text>
              <Button
                mode="contained"
                compact
                style={dynamicStyles.campaignEmptyButton}
                onPress={handleNavigateToUpload}
              >
                Upload a receipt
              </Button>
            </Surface>
          )}
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
                onPress={() => handleNavigateToReceipts()}
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
                  Upload your first receipt to start earning USDT$
                </Text>
                <Button
                  mode="contained"
                  onPress={handleNavigateToUpload}
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
                      onPress={() => handleNavigateToReceipts(receipt.id)}
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
                            ${receipt.total?.toFixed(2) ?? "--"} • {
                              receipt.receipt_date
                                ? new Date(receipt.receipt_date).toLocaleDateString()
                                : new Date(receipt.created_at).toLocaleDateString()
                            }
                          </Text>
                        </View>

                        <ReceiptStatusChip status={receipt.status} />
                      </View>
                    </Pressable>
                  </Surface>
                ))}
              </View>
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      <View style={dynamicStyles.fabWrapper}>
        <LinearGradient
          colors={["#1E88E5", "#00BCD4"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={dynamicStyles.fabGradient}
        >
          <FAB
            icon="camera"
            style={dynamicStyles.fab}
            color="#FFFFFF"
            onPress={handleNavigateToUpload}
          />
        </LinearGradient>
      </View>
    </>
  );
}
