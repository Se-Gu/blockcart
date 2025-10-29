import { useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ToastProvider";
import type { Campaign, CampaignEligibility, CampaignProgress } from "../types";

const FUNCTION_NAMES = ["eligible-campaigns"] as const;

const STORAGE_KEY_PREFIX = "blockcart:campaign-notifications";
const NEAR_LIMIT_THRESHOLD = 0.8;

type EligibleCampaignRecord = Record<string, unknown>;

type FetchCampaignOptions = {
  campaignId?: string;
};

type NotificationState = {
  seenCampaignIds: string[];
  nearLimitNotifiedAt: Record<string, string>;
};

const defaultNotificationState: NotificationState = {
  seenCampaignIds: [],
  nearLimitNotifiedAt: {},
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizeEligibility = (
  value: unknown,
): CampaignEligibility | null => {
  if (!isRecord(value)) {
    return null;
  }

  const qualifies =
    typeof value.qualifies === "boolean"
      ? value.qualifies
      : value.status === "eligible";
  const reasons = Array.isArray(value.reasons)
    ? (value.reasons.filter((item) => typeof item === "string") as string[])
    : undefined;
  const nextSteps =
    typeof value.nextSteps === "string"
      ? value.nextSteps
      : typeof value.next_steps === "string"
        ? (value.next_steps as string)
        : undefined;

  return {
    qualifies,
    reasons,
    nextSteps: nextSteps ?? null,
  };
};

const normalizeProgress = (value: unknown): CampaignProgress | null => {
  if (!isRecord(value)) {
    return null;
  }

  const percentComplete = parseNumber(
    value.percentComplete ?? value.percent_complete ?? value.progress,
  );

  return {
    percentComplete,
    receiptsSubmitted: parseNumber(
      value.receiptsSubmitted ?? value.receipts_submitted ?? value.submissions,
    ),
    receiptsRemaining: parseNumber(
      value.receiptsRemaining ?? value.receipts_remaining ?? value.remaining,
    ),
    remainingRewards: parseNumber(
      value.remainingRewards ?? value.remaining_rewards ?? value.remaining_bonus,
    ),
    remainingBudget: parseNumber(value.remainingBudget ?? value.remaining_budget),
    amountAwarded: parseNumber(
      value.amountAwarded ?? value.amount_awarded ?? value.earned_amount,
    ),
    amountRemaining: parseNumber(
      value.amountRemaining ?? value.amount_remaining ?? value.remaining_amount,
    ),
    isNearLimit:
      typeof value.isNearLimit === "boolean"
        ? value.isNearLimit
        : undefined,
  };
};

const normalizeCampaign = (record: EligibleCampaignRecord): Campaign | null => {
  if (!record.id) {
    return null;
  }

  const id = String(record.id);
  const brand =
    typeof record.brand === "string"
      ? record.brand
      : typeof record.name === "string"
        ? record.name
        : "Campaign";

  const campaign: Campaign = {
    id,
    brand,
    name: typeof record.name === "string" ? record.name : null,
    description:
      typeof record.description === "string" ? record.description : null,
    multiplier: parseNumber(record.multiplier),
    reward_amount:
      parseNumber(record.reward_amount ?? record.bonus_amount) ?? null,
    rule_json: isRecord(record.rule_json)
      ? (record.rule_json as Record<string, unknown>)
      : null,
    start_date:
      typeof record.start_date === "string" ? record.start_date : null,
    end_date: typeof record.end_date === "string" ? record.end_date : null,
    status:
      typeof record.status === "string"
        ? (record.status as Campaign["status"])
        : null,
    max_participants: parseNumber(record.max_participants),
    current_participants: parseNumber(record.current_participants),
    created_at:
      typeof record.created_at === "string" ? record.created_at : null,
    updated_at:
      typeof record.updated_at === "string" ? record.updated_at : null,
    highlight_text:
      typeof record.highlight_text === "string" ? record.highlight_text : null,
    bonus_text:
      typeof record.bonus_text === "string" ? record.bonus_text : null,
    eligibility: normalizeEligibility(
      record.eligibility ?? record.user_eligibility,
    ),
    progress: normalizeProgress(
      record.progress ?? record.user_progress ?? record.metrics,
    ),
  };

  return campaign;
};

const extractCampaignArray = (payload: unknown): EligibleCampaignRecord[] => {
  if (Array.isArray(payload)) {
    return payload.filter((item) => isRecord(item)) as EligibleCampaignRecord[];
  }

  if (isRecord(payload)) {
    const keys = [
      "campaigns",
      "data",
      "eligible_campaigns",
      "eligibleCampaigns",
      "active_campaigns",
    ];

    for (const key of keys) {
      const value = payload[key];
      if (Array.isArray(value)) {
        return value.filter((item) => isRecord(item)) as EligibleCampaignRecord[];
      }
    }
  }

  return [];
};

const formatCampaignBonus = (campaign: Campaign): string => {
  if (
    typeof campaign.reward_amount === "number" &&
    Number.isFinite(campaign.reward_amount) &&
    campaign.reward_amount > 0
  ) {
    return `${campaign.reward_amount.toFixed(2)} USDT$ bonus`;
  }

  if (
    typeof campaign.multiplier === "number" &&
    Number.isFinite(campaign.multiplier) &&
    campaign.multiplier > 1
  ) {
    return `${campaign.multiplier.toFixed(2)}x rewards`;
  }

  return "special rewards";
};

const getStorageKey = (userId: string) => `${STORAGE_KEY_PREFIX}:${userId}`;

const isNearLimit = (progress: CampaignProgress | null | undefined): boolean => {
  if (!progress) {
    return false;
  }

  if (typeof progress.isNearLimit === "boolean") {
    return progress.isNearLimit;
  }

  const percent = progress.percentComplete;
  if (typeof percent === "number" && Number.isFinite(percent)) {
    const normalized = percent > 1 ? percent / 100 : percent;
    if (normalized >= NEAR_LIMIT_THRESHOLD) {
      return true;
    }
  }

  const remaining = progress.receiptsRemaining;
  const submitted = progress.receiptsSubmitted;

  if (
    typeof remaining === "number" &&
    typeof submitted === "number" &&
    remaining >= 0
  ) {
    const total = submitted + remaining;
    if (total > 0) {
      const computedPercent = submitted / total;
      if (computedPercent >= NEAR_LIMIT_THRESHOLD) {
        return true;
      }
    }
  }

  return false;
};

export async function fetchEligibleCampaigns(
  userId: string,
  options: FetchCampaignOptions = {},
): Promise<Campaign[]> {
  const payload = {
    user_id: userId,
    campaign_id: options.campaignId ?? null,
  };

  const errors: unknown[] = [];

  for (const name of FUNCTION_NAMES) {
    try {
      const { data, error } = await supabase.functions.invoke(name, {
        body: payload,
      });

      if (error) {
        errors.push(error);
        continue;
      }

      const campaigns = extractCampaignArray(data).map((item) =>
        normalizeCampaign(item) as Campaign | null,
      );

      const normalized = campaigns.filter((item): item is Campaign => !!item);

      if (normalized.length > 0 || data) {
        return normalized;
      }
    } catch (error) {
      errors.push(error);
    }
  }

  try {
    if (options.campaignId) {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", options.campaignId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        return [];
      }

      const normalized = normalizeCampaign(data as EligibleCampaignRecord);
      return normalized ? [normalized] : [];
    }

    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("status", "active")
      .order("end_date", { ascending: true, nullsLast: false });

    if (error) {
      throw error;
    }

    const campaigns = Array.isArray(data) ? data : [];
    return campaigns
      .map((record) => normalizeCampaign(record as EligibleCampaignRecord))
      .filter((item): item is Campaign => !!item);
  } catch (error) {
    console.error("[fetchEligibleCampaigns] Fallback query failed", error);
    throw error;
  }
}

export function useActiveCampaigns(autoFetch = true) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    if (!userId) {
      setCampaigns([]);
      setError(null);
      return [] as Campaign[];
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchEligibleCampaigns(userId);
      setCampaigns(result);
      return result;
    } catch (err) {
      console.error("[useActiveCampaigns] Failed to load campaigns", err);
      const message =
        err instanceof Error ? err.message : "Failed to load campaigns";
      setError(message);
      setCampaigns([]);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!autoFetch) {
      return;
    }

    if (!userId) {
      setCampaigns([]);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const result = await fetchCampaigns();
        if (!cancelled) {
          setCampaigns(result);
        }
      } catch {
        // errors already handled in fetchCampaigns
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [autoFetch, fetchCampaigns, userId]);

  return useMemo(
    () => ({
      campaigns,
      loading,
      error,
      refresh: fetchCampaigns,
      hasCampaigns: campaigns.length > 0,
    }),
    [campaigns, error, fetchCampaigns, loading],
  );
}

export function useCampaignNotifications(campaigns: Campaign[]): void {
  const { session } = useAuth();
  const { showInfo, showWarning } = useToast();
  const userId = session?.user?.id ?? null;
  const [state, setState] = useState<NotificationState | null>(null);

  useEffect(() => {
    if (!userId) {
      setState(null);
      return;
    }

    let cancelled = false;

    const loadState = async () => {
      try {
        const stored = await AsyncStorage.getItem(getStorageKey(userId));
        if (cancelled) {
          return;
        }
        if (!stored) {
          setState(defaultNotificationState);
          return;
        }

        const parsed = JSON.parse(stored) as NotificationState;
        if (parsed && parsed.seenCampaignIds && parsed.nearLimitNotifiedAt) {
          setState(parsed);
        } else {
          setState(defaultNotificationState);
        }
      } catch (error) {
        console.warn("[useCampaignNotifications] Failed to parse state", error);
        if (!cancelled) {
          setState(defaultNotificationState);
        }
      }
    };

    void loadState();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !state) {
      return;
    }

    const storageKey = getStorageKey(userId);

    const persistState = async (nextState: NotificationState) => {
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(nextState));
      } catch (error) {
        console.warn("[useCampaignNotifications] Failed to persist state", error);
      }
    };

    const seen = new Set(state.seenCampaignIds);
    const nearLimitNotified = { ...state.nearLimitNotifiedAt };

    const newCampaigns = campaigns.filter(
      (campaign) => campaign.id && !seen.has(campaign.id),
    );

    if (newCampaigns.length > 0) {
      newCampaigns.forEach((campaign) => {
        const label = campaign.name ?? campaign.brand ?? "New campaign";
        showInfo(`${label} just launched — enjoy ${formatCampaignBonus(campaign)}!`, 6000);
      });

      const updatedState: NotificationState = {
        seenCampaignIds: Array.from(
          new Set([...state.seenCampaignIds, ...campaigns.map((item) => item.id)]),
        ),
        nearLimitNotifiedAt: nearLimitNotified,
      };

      setState(updatedState);
      void persistState(updatedState);
      return;
    }

    const nearLimitCampaigns = campaigns.filter((campaign) =>
      isNearLimit(campaign.progress),
    );

    const newlyNearLimit = nearLimitCampaigns.filter(
      (campaign) => !nearLimitNotified[campaign.id],
    );

    if (newlyNearLimit.length > 0) {
      newlyNearLimit.forEach((campaign) => {
        const label = campaign.name ?? campaign.brand ?? "campaign";
        showWarning(
          `You're close to maxing out the ${label} bonus — submit another receipt soon!`,
          6000,
        );
        nearLimitNotified[campaign.id] = new Date().toISOString();
      });

      const updatedState: NotificationState = {
        seenCampaignIds: state.seenCampaignIds,
        nearLimitNotifiedAt: nearLimitNotified,
      };

      setState(updatedState);
      void persistState(updatedState);
    }
  }, [campaigns, showInfo, showWarning, state, userId]);
}
