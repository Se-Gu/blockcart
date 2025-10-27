import type { SupabaseClient } from "@supabase/supabase-js";

export interface ReceiptStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export interface RewardStats {
  totalAmount: number;
  pendingAmount: number;
}

export interface CampaignPerformance {
  id: string | null;
  name: string;
  totalRewards: number;
  paidRewards: number;
  rewardCount: number;
  paidCount: number;
  currentParticipants: number | null;
  maxParticipants: number | null;
  saturationRatio: number | null;
}

export interface ActivityEvent {
  id: string;
  type: "review" | "campaign";
  title: string;
  description: string;
  timestamp: string;
}

type CountResult = {
  count: number | null;
  error: { message: string } | null;
};

type CountResponse = Promise<CountResult>;

async function resolveCount(promise: CountResponse): Promise<number> {
  const { count, error } = await promise;
  if (error) {
    console.error("Failed to fetch count", error);
    return 0;
  }
  return count ?? 0;
}

export async function fetchReceiptStats(
  supabase: SupabaseClient
): Promise<ReceiptStats> {
  const [total, pending, approved, rejected] = await Promise.all([
    resolveCount(
      supabase
        .from("receipts")
        .select("id", { count: "exact", head: true }) as CountResponse
    ),
    resolveCount(
      supabase
        .from("receipts")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending") as CountResponse
    ),
    resolveCount(
      supabase
        .from("receipts")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved") as CountResponse
    ),
    resolveCount(
      supabase
        .from("receipts")
        .select("id", { count: "exact", head: true })
        .eq("status", "rejected") as CountResponse
    ),
  ]);

  return {
    total,
    pending,
    approved,
    rejected,
  };
}

export async function fetchActiveCampaignCount(
  supabase: SupabaseClient
): Promise<number> {
  const now = new Date().toISOString();

  const { count, error } = (await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .lte("start_date", now)
    .or(`end_date.is.null,end_date.gte.${now}`)) as CountResult;

  if (error) {
    console.error("Failed to fetch active campaign count", error);
    return 0;
  }

  return count ?? 0;
}

export async function fetchRewardStats(
  supabase: SupabaseClient
): Promise<RewardStats> {
  const [rewardsResult, pendingReceiptsResult] = await Promise.all([
    supabase.from("rewards").select("amount"),
    supabase
      .from("receipts")
      .select("reward_amount, status")
      .in("status", ["pending", "pending_review"]),
  ]);

  if (rewardsResult.error) {
    console.error("Failed to fetch rewards", rewardsResult.error);
  }

  if (pendingReceiptsResult.error) {
    console.error(
      "Failed to fetch pending rewards",
      pendingReceiptsResult.error
    );
  }

  const totalAmount = (rewardsResult.data ?? []).reduce(
    (sum: number, reward: any) => {
      const amount = Number(reward.amount ?? 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    },
    0
  );

  const pendingAmount = (pendingReceiptsResult.data ?? []).reduce(
    (sum: number, receipt: any) => {
      const amount = Number(
        (receipt as { reward_amount?: number | string | null }).reward_amount ??
          0
      );
      return sum + (Number.isFinite(amount) ? amount : 0);
    },
    0
  );

  return {
    totalAmount,
    pendingAmount,
  };
}

export async function fetchTopCampaigns(
  supabase: SupabaseClient
): Promise<CampaignPerformance[]> {
  const { data, error } = await supabase
    .from("analytics_campaign_summary")
    .select(
      "campaign_id, campaign_label, total_reward_amount, paid_reward_amount, rewards_issued, rewards_paid, current_participants, max_participants, saturation_ratio"
    )
    .order("total_reward_amount", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Failed to fetch campaign performance", error);
    return [];
  }

  return (data ?? [])
    .map((entry, index) => {
      const safeTotal = Number(
        (entry as { total_reward_amount?: number | string | null })
          .total_reward_amount ?? 0
      );

      const totalRewards = Number.isFinite(safeTotal) ? safeTotal : 0;

      const paidValue = Number(
        (entry as { paid_reward_amount?: number | string | null })
          .paid_reward_amount ?? 0
      );

      const rewardsIssued = Number(
        (entry as { rewards_issued?: number | string | null }).rewards_issued ?? 0
      );
      const rewardsPaid = Number(
        (entry as { rewards_paid?: number | string | null }).rewards_paid ?? 0
      );

      const campaignId = (entry as { campaign_id?: string | null }).campaign_id ?? null;
      const label =
        (entry as { campaign_label?: string | null }).campaign_label ??
        (campaignId
          ? `Campaign ${campaignId.slice(0, 4)}${campaignId.length > 4 ? "…" : ""}`
          : `Campaign ${index + 1}`);

      const currentParticipantsRaw = (entry as {
        current_participants?: number | string | null;
      }).current_participants;
      const maxParticipantsRaw = (entry as {
        max_participants?: number | string | null;
      }).max_participants;
      const saturationRaw = (entry as {
        saturation_ratio?: number | string | null;
      }).saturation_ratio;

      const currentParticipants =
        currentParticipantsRaw === null || currentParticipantsRaw === undefined
          ? null
          : Number(currentParticipantsRaw);
      const maxParticipants =
        maxParticipantsRaw === null || maxParticipantsRaw === undefined
          ? null
          : Number(maxParticipantsRaw);
      const saturationRatio =
        saturationRaw === null || saturationRaw === undefined
          ? null
          : Number(saturationRaw);

      return {
        id: campaignId,
        name: label,
        totalRewards,
        paidRewards: Number.isFinite(paidValue) ? paidValue : 0,
        rewardCount: Number.isFinite(rewardsIssued) ? rewardsIssued : 0,
        paidCount: Number.isFinite(rewardsPaid) ? rewardsPaid : 0,
        currentParticipants: Number.isFinite(currentParticipants ?? 0)
          ? currentParticipants
          : null,
        maxParticipants: Number.isFinite(maxParticipants ?? 0)
          ? maxParticipants
          : null,
        saturationRatio:
          typeof saturationRatio === "number" && Number.isFinite(saturationRatio)
            ? saturationRatio
            : null,
      } satisfies CampaignPerformance;
    })
    .filter((campaign) => campaign.totalRewards > 0)
    .slice(0, 3);
}

export async function fetchReferralBonusTotal(
  supabase: SupabaseClient
): Promise<number> {
  const { data, error } = await supabase.from("referrals").select("bonus");

  if (error) {
    console.error("Failed to fetch referral bonuses", error);
    return 0;
  }

  return (data ?? []).reduce((sum: number, referral: any) => {
    const bonus = Number(referral.bonus ?? 0);
    return sum + (Number.isFinite(bonus) ? bonus : 0);
  }, 0);
}

export async function fetchActiveUsers(
  supabase: SupabaseClient
): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { count, error } = (await supabase
    .from("receipts")
    .select("user_id", { count: "exact", head: true })
    .gte("created_at", since.toISOString())
    .not("user_id", "is", null)) as {
    count: number | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error("Failed to fetch active users", error);
    return 0;
  }

  return count ?? 0;
}

export async function fetchTotalUsers(
  supabase: SupabaseClient
): Promise<number> {
  const [webUsersResult, mobileUsersResult] = await Promise.all([
    supabase
      .from("web_users")
      .select("id", { count: "exact", head: true }) as CountResponse,
    supabase
      .from("mobile_users")
      .select("id", { count: "exact", head: true }) as CountResponse,
  ]);

  let total = 0;

  if (webUsersResult.error) {
    console.warn("Failed to count web users", webUsersResult.error);
  } else {
    total += webUsersResult.count ?? 0;
  }

  if (mobileUsersResult.error) {
    console.warn("Failed to count mobile users", mobileUsersResult.error);
  } else {
    total += mobileUsersResult.count ?? 0;
  }

  if (total > 0 || (!webUsersResult.error && !mobileUsersResult.error)) {
    return total;
  }

  const usersResult = (await supabase
    .from("users")
    .select("id", { count: "exact", head: true })) as {
    count: number | null;
    error: { message: string } | null;
  };

  if (usersResult.error) {
    console.error("Failed to fetch total users", usersResult.error);
    return total;
  }

  return total + (usersResult.count ?? 0);
}

export async function fetchRecentReceipts(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("receipts")
    .select(
      "id, user_id, image_url, total, store, receipt_date, status, created_at, reviewed_by, rejection_reason, reward_amount, users:users!receipts_user_id_fkey(email, wallet_address), reviewer:web_users!receipts_reviewed_by_fkey(email, role)"
    )
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Failed to fetch recent receipts", error);
    return [];
  }

  return data ?? [];
}

export async function fetchActivityEvents(
  supabase: SupabaseClient
): Promise<ActivityEvent[]> {
  const [reviewsResult, campaignsResult] = await Promise.all([
    supabase
      .from("receipt_reviews")
      .select("id, action, created_at, receipt_id, reviewer_id")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("campaigns")
      .select("id, brand, updated_at, start_date, end_date")
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  const events: ActivityEvent[] = [];

  if (!reviewsResult.error) {
    for (const review of reviewsResult.data ?? []) {
      events.push({
        id: `review-${review.id}`,
        type: "review",
        title: `Receipt ${review.action ?? "update"}`,
        description: `Reviewer ${review.reviewer_id ?? "unknown"} ${
          review.action ?? "updated"
        } receipt ${review.receipt_id ?? ""}`,
        timestamp: review.created_at,
      });
    }
  } else {
    console.error("Failed to fetch receipt review events", reviewsResult.error);
  }

  if (!campaignsResult.error) {
    for (const campaign of campaignsResult.data ?? []) {
      events.push({
        id: `campaign-${campaign.id}`,
        type: "campaign",
        title:
          (campaign as { brand?: string | null }).brand ?? "Campaign update",
        description: "Campaign schedule updated",
        timestamp:
          campaign.updated_at ??
          campaign.start_date ??
          new Date().toISOString(),
      });
    }
  } else {
    console.error("Failed to fetch campaign events", campaignsResult.error);
  }

  return events
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, 8);
}
