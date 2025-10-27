import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CampaignRecord = {
  id: string;
  brand: string;
  name?: string | null;
  description?: string | null;
  multiplier?: number | null;
  reward_amount?: number | null;
  rule_json?: Record<string, unknown> | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  max_participants?: number | null;
  current_participants?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type RewardRecord = {
  campaign_id: string | null;
  amount: number | null;
  status: string | null;
};

const asDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isActiveForDate = (campaign: CampaignRecord, reference: Date): boolean => {
  if ((campaign.status ?? "active") !== "active") {
    return false;
  }

  const startDate = asDate(campaign.start_date ?? null);
  if (startDate && startDate > reference) {
    return false;
  }

  const endDate = asDate(campaign.end_date ?? null);
  if (endDate && endDate < reference) {
    return false;
  }

  if (
    typeof campaign.max_participants === "number" &&
    typeof campaign.current_participants === "number" &&
    campaign.max_participants > 0 &&
    campaign.current_participants >= campaign.max_participants
  ) {
    return false;
  }

  return true;
};

const buildEligibility = (campaign: CampaignRecord): Record<string, unknown> => {
  const reasons: string[] = [];

  if (
    typeof campaign.max_participants === "number" &&
    typeof campaign.current_participants === "number" &&
    campaign.max_participants > 0 &&
    campaign.current_participants >= campaign.max_participants
  ) {
    reasons.push("Campaign is full");
  }

  return {
    qualifies: reasons.length === 0,
    reasons: reasons.length > 0 ? reasons : undefined,
    nextSteps: null,
  };
};

const aggregateProgress = (
  rewards: RewardRecord[],
): Record<string, unknown> | null => {
  if (!rewards.length) {
    return null;
  }

  let approvedAmount = 0;
  let pendingAmount = 0;
  let approvedCount = 0;
  let pendingCount = 0;

  for (const reward of rewards) {
    const amount = typeof reward.amount === "number" ? reward.amount : 0;
    const status = (reward.status ?? "").toLowerCase();

    if (status === "approved" || status === "paid") {
      approvedAmount += amount;
      approvedCount += 1;
      continue;
    }

    pendingAmount += amount;
    pendingCount += 1;
  }

  return {
    percentComplete: null,
    receiptsSubmitted: approvedCount + pendingCount,
    receiptsRemaining: null,
    remainingRewards: null,
    remainingBudget: pendingAmount > 0 ? pendingAmount : null,
    amountAwarded: approvedAmount,
    amountRemaining: pendingAmount > 0 ? pendingAmount : null,
    isNearLimit: null,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await req.json()) ?? {};
  } catch {
    payload = {};
  }

  const userIdRaw = payload?.user_id;
  const campaignIdRaw = payload?.campaign_id;
  const userId =
    typeof userIdRaw === "string" && userIdRaw.trim().length > 0
      ? userIdRaw.trim()
      : null;
  const campaignId =
    typeof campaignIdRaw === "string" && campaignIdRaw.trim().length > 0
      ? campaignIdRaw.trim()
      : null;

  if (!userId) {
    return new Response(JSON.stringify({ error: "Missing user_id" }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Service not configured" }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let query = supabase
    .from("campaigns")
    .select(
      "id, brand, name, description, multiplier, reward_amount, rule_json, start_date, end_date, status, max_participants, current_participants, created_at, updated_at",
    );

  if (campaignId) {
    query = query.eq("id", campaignId).limit(1);
  } else {
    query = query.eq("status", "active");
  }

  const { data: campaignRows, error: campaignError } = await query;

  if (campaignError) {
    console.error("[eligible-campaigns] Failed to load campaigns", campaignError);
    return new Response(JSON.stringify({ error: campaignError.message }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  const campaignsData = Array.isArray(campaignRows) ? campaignRows : [];
  const now = new Date();
  const campaigns = campaignId
    ? campaignsData
    : campaignsData.filter((campaign) => isActiveForDate(campaign, now));

  if (campaigns.length === 0) {
    return new Response(JSON.stringify({ eligible_campaigns: [] }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  const campaignIds = campaigns
    .map((campaign) => campaign.id)
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  const rewardMap = new Map<string, RewardRecord[]>();

  if (campaignIds.length > 0) {
    const { data: rewardRows, error: rewardError } = await supabase
      .from("rewards")
      .select("campaign_id, amount, status")
      .eq("user_id", userId)
      .in("campaign_id", campaignIds);

    if (rewardError) {
      console.error("[eligible-campaigns] Failed to load reward progress", rewardError);
    } else if (Array.isArray(rewardRows)) {
      for (const reward of rewardRows) {
        if (!reward?.campaign_id) continue;
        if (!rewardMap.has(reward.campaign_id)) {
          rewardMap.set(reward.campaign_id, []);
        }
        rewardMap.get(reward.campaign_id)!.push(reward);
      }
    }
  }

  const result = campaigns.map((campaign) => {
    const rewards = rewardMap.get(campaign.id) ?? [];
    return {
      ...campaign,
      eligibility: buildEligibility(campaign),
      progress: aggregateProgress(rewards),
    };
  });

  return new Response(JSON.stringify({ eligible_campaigns: result }), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
});
