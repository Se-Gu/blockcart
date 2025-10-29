"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  ProgressBar,
  Surface,
  Text,
  useTheme,
  IconButton,
} from "react-native-paper";
import { useAuth } from "../context/AuthContext";
import { useErrorHandler } from "../hooks/useErrorHandler";
import { fetchEligibleCampaigns } from "../hooks/useCampaignPromotions";
import type { Campaign } from "../types";
import { colors, spacing, borderRadius } from "../theme/colors";
import type { AppTabParamList, HomeStackParamList } from "../navigation/MainNavigator";

const formatCampaignBonus = (campaign: Campaign): string => {
  if (
    typeof campaign.reward_amount === "number" &&
    Number.isFinite(campaign.reward_amount) &&
    campaign.reward_amount > 0
  ) {
    return `Earn +${campaign.reward_amount.toFixed(2)} BTC$ per receipt`;
  }

  if (
    typeof campaign.multiplier === "number" &&
    Number.isFinite(campaign.multiplier) &&
    campaign.multiplier > 1
  ) {
    return `${campaign.multiplier.toFixed(2)}x rewards on eligible receipts`;
  }

  return "Exclusive bonus available";
};

const formatCampaignDates = (campaign: Campaign | null): string => {
  if (!campaign) {
    return "";
  }

  const { start_date: startDate, end_date: endDate } = campaign;
  if (!startDate && !endDate) {
    return "Ongoing campaign";
  }

  const format = (value: string | null | undefined) => {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return parsed.toLocaleDateString();
  };

  const start = format(startDate);
  const end = format(endDate);

  if (start && end) {
    return `${start} – ${end}`;
  }
  if (start) {
    return `Starts ${start}`;
  }
  if (end) {
    const daysLeft = Math.ceil(
      (new Date(end).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    if (daysLeft < 0) {
      return `Ended ${end}`;
    }
    if (daysLeft === 0) {
      return `Ends today (${end})`;
    }
    if (daysLeft === 1) {
      return `Ends tomorrow (${end})`;
    }
    return `Ends ${end}`;
  }
  return "Ongoing campaign";
};

const getProgressPercent = (campaign: Campaign | null): number | null => {
  const progress = campaign?.progress;
  if (!progress) {
    return null;
  }

  if (
    typeof progress.percentComplete === "number" &&
    Number.isFinite(progress.percentComplete)
  ) {
    const value = progress.percentComplete;
    return value > 1 ? Math.min(100, value) / 100 : value;
  }

  if (
    typeof progress.receiptsSubmitted === "number" &&
    typeof progress.receiptsRemaining === "number"
  ) {
    const total = progress.receiptsSubmitted + progress.receiptsRemaining;
    if (total > 0) {
      return progress.receiptsSubmitted / total;
    }
  }

  return null;
};

type Props = NativeStackScreenProps<HomeStackParamList, "CampaignDetail">;
type TabNavigation = BottomTabNavigationProp<AppTabParamList>;

export default function CampaignDetailScreen({ route, navigation }: Props) {
  const { campaignId, campaign: initialCampaign } = route.params;
  const { session } = useAuth();
  const tabNavigation = navigation.getParent<TabNavigation>();
  const theme = useTheme();
  const { handleError } = useErrorHandler({ context: "Campaign Detail" });
  const [campaign, setCampaign] = useState<Campaign | null>(initialCampaign ?? null);
  const [loading, setLoading] = useState(false);

  const loadCampaign = useCallback(async () => {
    if (!session?.user?.id) {
      return;
    }
    setLoading(true);
    try {
      const result = await fetchEligibleCampaigns(session.user.id, {
        campaignId,
      });
      if (result.length > 0) {
        setCampaign(result[0]);
      }
    } catch (error) {
      handleError(error, "Loading campaign");
    } finally {
      setLoading(false);
    }
  }, [campaignId, handleError, session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) {
      return;
    }

    if (initialCampaign?.progress) {
      // We already have detailed data
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const result = await fetchEligibleCampaigns(session.user!.id, {
          campaignId,
        });
        if (!cancelled && result.length > 0) {
          setCampaign(result[0]);
        }
      } catch (error) {
        handleError(error, "Loading campaign");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [campaignId, handleError, initialCampaign?.progress, session?.user?.id]);

  const ruleEntries = useMemo(() => {
    if (!campaign?.rule_json || typeof campaign.rule_json !== "object") {
      return [] as string[];
    }

    const result: string[] = [];
    for (const [key, value] of Object.entries(campaign.rule_json)) {
      if (value == null) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item == null) continue;
          result.push(`${key}: ${String(item)}`);
        }
        continue;
      }
      if (typeof value === "object") {
        result.push(`${key}: ${JSON.stringify(value)}`);
        continue;
      }
      result.push(`${key}: ${String(value)}`);
    }

    return result.slice(0, 8);
  }, [campaign?.rule_json]);

  const progressPercent = getProgressPercent(campaign);
  const bonusText = campaign ? formatCampaignBonus(campaign) : "";
  const dateRange = formatCampaignDates(campaign);
  const statusLabel = campaign?.status ?? "active";

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          padding: spacing.md,
          paddingBottom: spacing.xl,
          gap: spacing.md,
        },
        headerGradient: {
          borderRadius: borderRadius.xl,
          padding: spacing.xl,
          gap: spacing.md,
        },
        statusChip: {
          alignSelf: "flex-start",
          backgroundColor: `${colors.surfaceVariant}`,
        },
        bonusCard: {
          borderRadius: borderRadius.lg,
          padding: spacing.lg,
          gap: spacing.sm,
        },
        section: {
          gap: spacing.sm,
        },
        ruleCard: {
          borderRadius: borderRadius.lg,
        },
        ruleItem: {
          paddingVertical: spacing.xs,
        },
        ruleText: {
          color: colors.textSecondary,
        },
        buttonRow: {
          flexDirection: "row",
          gap: spacing.md,
        },
        footer: {
          gap: spacing.sm,
        },
      }),
    [theme],
  );

  const handleUpload = useCallback(() => {
    tabNavigation?.navigate("Receipts", { screen: "UploadReceipt" });
  }, [tabNavigation]);

  const handleRefresh = useCallback(() => {
    void loadCampaign();
  }, [loadCampaign]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <LinearGradient
        colors={["#5C6BC0", "#26C6DA", "#43A047"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View>
          <Text variant="labelLarge" style={{ color: "#FFFFFF" }}>
            {campaign?.brand ?? "Campaign"}
          </Text>
          <Text variant="headlineMedium" style={{ color: "#FFFFFF", fontWeight: "700" }}>
            {campaign?.name ?? "Bonus Details"}
          </Text>
        </View>

        <Chip
          icon="calendar"
          style={styles.statusChip}
          textStyle={{ fontWeight: "600" }}
        >
          {dateRange}
        </Chip>

        <Text variant="bodyLarge" style={{ color: "#FFFFFF" }}>
          {bonusText}
        </Text>

        {progressPercent != null ? (
          <View style={{ gap: spacing.xs }}>
            <ProgressBar progress={progressPercent} color="#FFFFFF" style={{ height: 8, borderRadius: 4 }} />
            <Text style={{ color: "#FFFFFF" }}>
              {Math.round(progressPercent * 100)}% of your personal goal reached
            </Text>
          </View>
        ) : null}
      </LinearGradient>

      <Card style={styles.bonusCard}>
        <Card.Title title="Campaign summary" right={(props) => (
          <IconButton {...props} icon="refresh" onPress={handleRefresh} disabled={loading} />
        )} />
        <Card.Content style={styles.section}>
          {loading ? (
            <View style={{ alignItems: "center", padding: spacing.md }}>
              <ActivityIndicator animating color={theme.colors.primary} />
              <Text style={{ marginTop: spacing.sm, color: colors.textSecondary }}>
                Updating campaign details…
              </Text>
            </View>
          ) : (
            <>
              <Text variant="bodyLarge" style={{ color: colors.textPrimary }}>
                Status: {statusLabel}
              </Text>
              <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
                {campaign?.description ?? "Upload receipts that match the rules below to earn extra BTC$."}
              </Text>
            </>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.ruleCard}>
        <Card.Title title="How to participate" />
        <Card.Content style={styles.section}>
          {ruleEntries.length === 0 ? (
            <Text style={{ color: colors.textSecondary }}>
              Campaign rules will be shared soon. For now, submit receipts that match the brand to earn rewards.
            </Text>
          ) : (
            ruleEntries.map((rule) => (
              <View key={rule} style={styles.ruleItem}>
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      <Surface style={[styles.bonusCard, styles.footer]} elevation={1}>
        <Text variant="titleMedium" style={{ color: colors.textPrimary }}>
          Ready to earn more?
        </Text>
        <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
          Upload a qualifying receipt before the campaign ends to secure this bonus.
        </Text>
        <View style={styles.buttonRow}>
          <Button mode="contained" icon="camera" onPress={handleUpload}>
            Upload receipt
          </Button>
          <Button mode="outlined" icon="refresh" onPress={handleRefresh} disabled={loading}>
            Refresh
          </Button>
        </View>
      </Surface>
    </ScrollView>
  );
}
