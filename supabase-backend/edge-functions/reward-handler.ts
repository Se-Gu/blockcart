import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
type RewardStatus = "pending" | "approved" | "paid";

const VALID_REWARD_STATUSES = new Set<RewardStatus>(["pending", "approved", "paid"]);

const normalizeStatus = (value: unknown): RewardStatus => {
  if (typeof value === "string") {
    const normalized = value.toLowerCase() as RewardStatus;
    if (VALID_REWARD_STATUSES.has(normalized)) {
      return normalized;
    }
  }

  return "pending";
};

const toNumber = (value: unknown, fallback: number): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
};

const rewardSelect = "id, user_id, campaign_id, amount, status, created_at, paid_at, " + "users:user_id ( id, email, full_name ), " + "campaigns:campaign_id ( id, name, brand )";
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      }
    });
  }
  try {
    const payload = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    const action = payload?.action ?? "create_reward";
    if (action === "approve_reward") {
      const rewardId = payload?.reward_id;
      if (!rewardId) {
        return new Response(JSON.stringify({
          success: false,
          error: "Missing reward_id"
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      const updatedAt = new Date().toISOString();
      const { data, error } = await supabase.from("rewards").update({
        status: "approved",
        updated_at: updatedAt
      }).eq("id", rewardId).select(rewardSelect).single();
      if (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      return new Response(JSON.stringify({
        success: true,
        reward: data
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    if (action === "mark_reward_paid") {
      const rewardId = payload?.reward_id;
      if (!rewardId) {
        return new Response(JSON.stringify({
          success: false,
          error: "Missing reward_id"
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      const paidAt = new Date().toISOString();
      const { data, error } = await supabase.from("rewards").update({
        status: "paid",
        paid_at: paidAt,
        updated_at: paidAt
      }).eq("id", rewardId).select(rewardSelect).single();
      if (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      return new Response(JSON.stringify({
        success: true,
        reward: data
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const receiptId = payload?.receipt_id;
    const userId = payload?.user_id;
    const requestedCampaignId =
      typeof payload?.campaign_id === "string" && payload.campaign_id.length > 0
        ? payload.campaign_id
        : null;
    const requestedAmountValue = toNumber(payload?.amount, Number.NaN);
    const requestedAmount = Number.isFinite(requestedAmountValue)
      ? requestedAmountValue
      : null;
    const requestedDescription =
      typeof payload?.description === "string"
        ? payload.description.trim()
        : null;
    const defaultRewardAmount = 50;
    const defaultDescription = "Receipt approval reward";
    if (!receiptId || !userId) {
      return new Response(JSON.stringify({
        success: false,
        error: "Missing receipt_id or user_id"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const normalizedStatus = normalizeStatus(payload?.status);

    const fetchExistingReward = async () => {
      const { data: existingReward, error: existingError } = await supabase
        .from("rewards")
        .select(rewardSelect)
        .eq("receipt_id", receiptId)
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (existingError) {
        return { existingReward: null, existingError } as const;
      }

      return { existingReward, existingError: null } as const;
    };

    const { existingReward, existingError } = await fetchExistingReward();

    if (existingError) {
      return new Response(JSON.stringify({
        success: false,
        error: existingError.message
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }

    let campaignRecord:
      | (Record<string, unknown> & {
        id: string;
        status?: string | null;
        start_date?: string | null;
        end_date?: string | null;
        current_participants?: number | null;
        max_participants?: number | null;
        reward_amount?: number | null;
        multiplier?: number | null;
        description?: string | null;
        name?: string | null;
        brand?: string | null;
      })
      | null = null;

    if (requestedCampaignId) {
      const {
        data: fetchedCampaign,
        error: campaignError,
      } = await supabase
        .from("campaigns")
        .select(
          "id, status, start_date, end_date, current_participants, max_participants, reward_amount, multiplier, description, name, brand",
        )
        .eq("id", requestedCampaignId)
        .maybeSingle();

      if (campaignError) {
        console.warn(
          `[reward-handler] Failed to fetch campaign ${requestedCampaignId}`,
          campaignError,
        );
      } else if (fetchedCampaign) {
        const now = new Date();
        const startDate = fetchedCampaign.start_date
          ? new Date(fetchedCampaign.start_date)
          : null;
        const endDate = fetchedCampaign.end_date
          ? new Date(fetchedCampaign.end_date)
          : null;
        const isActive =
          fetchedCampaign.status === "active" &&
          (!startDate || startDate <= now) &&
          (!endDate || endDate >= now);
        const currentCount = fetchedCampaign.current_participants ?? 0;
        const maxCount = fetchedCampaign.max_participants;

        if (!isActive) {
          console.info(
            `[reward-handler] Campaign ${requestedCampaignId} is not active. Ignoring.`,
          );
        } else if (maxCount !== null && currentCount >= maxCount) {
          console.info(
            `[reward-handler] Campaign ${requestedCampaignId} is saturated (${currentCount}/${maxCount}). Ignoring.`,
          );
        } else {
          campaignRecord = fetchedCampaign;
        }
      }
    }

    let rewardAmount = existingReward
      ? toNumber(existingReward.amount, defaultRewardAmount)
      : defaultRewardAmount;

    let rewardDescription = existingReward?.description ?? defaultDescription;
    let campaignIdToApply: string | null = existingReward?.campaign_id ?? null;
    let incrementCampaignId: string | null = null;
    let decrementCampaignId: string | null = null;

    if (campaignRecord) {
      campaignIdToApply = campaignRecord.id;
      rewardAmount = requestedAmount ?? toNumber(campaignRecord.reward_amount, rewardAmount);

      if (!Number.isFinite(rewardAmount) || rewardAmount <= 0) {
        rewardAmount = defaultRewardAmount;
      }

      const fallbackDescription =
        campaignRecord.description ?? campaignRecord.name ?? campaignRecord.brand;
      rewardDescription = (requestedDescription && requestedDescription.length > 0)
        ? requestedDescription
        : fallbackDescription ?? defaultDescription;

      if (!existingReward) {
        incrementCampaignId = campaignRecord.id;
      } else if (existingReward.campaign_id !== campaignRecord.id) {
        incrementCampaignId = campaignRecord.id;
        if (existingReward.campaign_id) {
          decrementCampaignId = existingReward.campaign_id;
        }
      }
    } else if (!existingReward) {
      rewardAmount = requestedAmount ?? defaultRewardAmount;
      if (!Number.isFinite(rewardAmount) || rewardAmount <= 0) {
        rewardAmount = defaultRewardAmount;
      }
      rewardDescription = (requestedDescription && requestedDescription.length > 0)
        ? requestedDescription
        : defaultDescription;
      campaignIdToApply = null;
    } else if (existingReward && existingReward.campaign_id && !campaignIdToApply) {
      decrementCampaignId = existingReward.campaign_id;
      rewardAmount = toNumber(existingReward.amount, defaultRewardAmount);
      rewardDescription = existingReward.description ?? defaultDescription;
    }

    let incrementedParticipants = false;

    if (incrementCampaignId) {
      const { error: incrementError } = await supabase.rpc(
        "adjust_campaign_participants",
        { p_campaign_id: incrementCampaignId, p_delta: 1 },
      );

      if (incrementError) {
        console.warn(
          `[reward-handler] Unable to increment participants for campaign ${incrementCampaignId}. Falling back to base reward.`,
          incrementError,
        );
        if (existingReward) {
          campaignIdToApply = existingReward.campaign_id ?? null;
          rewardAmount = toNumber(existingReward.amount, defaultRewardAmount);
          rewardDescription = existingReward.description ?? defaultDescription;
          decrementCampaignId = null;
        } else {
          campaignIdToApply = null;
          rewardAmount = requestedAmount ?? defaultRewardAmount;
          if (!Number.isFinite(rewardAmount) || rewardAmount <= 0) {
            rewardAmount = defaultRewardAmount;
          }
          rewardDescription = (requestedDescription && requestedDescription.length > 0)
            ? requestedDescription
            : defaultDescription;
          decrementCampaignId = null;
        }
        incrementCampaignId = null;
      } else {
        incrementedParticipants = true;
      }
    }

    const baseRewardPayload = {
      user_id: userId,
      receipt_id: receiptId,
      campaign_id: campaignIdToApply,
      amount: rewardAmount,
      description: rewardDescription,
      status: normalizedStatus
    };

    let reward = existingReward;

    if (existingReward) {
      const updatePayload: Record<string, unknown> = {};

      if (existingReward.amount !== rewardAmount) {
        updatePayload.amount = rewardAmount;
      }

      if (existingReward.status !== normalizedStatus) {
        updatePayload.status = normalizedStatus;
      }

      if (existingReward.description !== baseRewardPayload.description) {
        updatePayload.description = baseRewardPayload.description;
      }

      if (existingReward.campaign_id !== baseRewardPayload.campaign_id) {
        updatePayload.campaign_id = baseRewardPayload.campaign_id;
      }

      if (Object.keys(updatePayload).length > 0) {
        updatePayload.updated_at = new Date().toISOString();

        const { data: updatedReward, error: updateError } = await supabase
          .from("rewards")
          .update(updatePayload)
          .eq("id", existingReward.id)
          .select(rewardSelect)
          .single();

        if (updateError) {
          if (incrementedParticipants && incrementCampaignId) {
            const { error: revertError } = await supabase.rpc(
              "adjust_campaign_participants",
              {
                p_campaign_id: incrementCampaignId,
                p_delta: -1,
              },
            );

            if (revertError) {
              console.warn(
                `[reward-handler] Failed to revert participant increment for campaign ${incrementCampaignId} after update error`,
                revertError,
              );
            }
          }
          return new Response(JSON.stringify({
            success: false,
            error: updateError.message
          }), {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          });
        }

        reward = updatedReward;
      }
    } else {
      const { data: insertedReward, error: insertError } = await supabase
        .from("rewards")
        .insert(baseRewardPayload)
        .select(rewardSelect)
        .single();

      if (insertError) {
        if (incrementedParticipants && incrementCampaignId) {
          const { error: revertError } = await supabase.rpc(
            "adjust_campaign_participants",
            {
              p_campaign_id: incrementCampaignId,
              p_delta: -1,
            },
          );

          if (revertError) {
            console.warn(
              `[reward-handler] Failed to revert participant increment for campaign ${incrementCampaignId} after insert error`,
              revertError,
            );
          }
        }
        const isConflict =
          insertError.code === "23505" ||
          insertError.details?.toLowerCase().includes("duplicate key") ||
          insertError.message?.toLowerCase().includes("duplicate key");

        if (isConflict) {
          const { existingReward: conflictReward, existingError: conflictError } = await fetchExistingReward();

          if (conflictError) {
            if (incrementedParticipants && incrementCampaignId) {
              const { error: revertError } = await supabase.rpc(
                "adjust_campaign_participants",
                {
                  p_campaign_id: incrementCampaignId,
                  p_delta: -1,
                },
              );

              if (revertError) {
                console.warn(
                  `[reward-handler] Failed to revert participant increment for campaign ${incrementCampaignId} after conflict lookup error`,
                  revertError,
                );
              }
            }
            return new Response(JSON.stringify({
              success: false,
              error: conflictError.message
            }), {
              status: 400,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json"
              }
            });
          }

          reward = conflictReward;
          if (incrementedParticipants && incrementCampaignId) {
            const { error: revertError } = await supabase.rpc(
              "adjust_campaign_participants",
              {
                p_campaign_id: incrementCampaignId,
                p_delta: -1,
              },
            );

            if (revertError) {
              console.warn(
                `[reward-handler] Failed to revert participant increment for campaign ${incrementCampaignId} after duplicate detection`,
                revertError,
              );
            }
          }
        } else {
          return new Response(JSON.stringify({
            success: false,
            error: insertError.message
          }), {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          });
        }
      } else {
        reward = insertedReward;
      }
    }

    if (decrementCampaignId) {
      const { error: decrementError } = await supabase.rpc(
        "adjust_campaign_participants",
        { p_campaign_id: decrementCampaignId, p_delta: -1 },
      );

      if (decrementError) {
        console.warn(
          `[reward-handler] Failed to decrement participants for campaign ${decrementCampaignId}`,
          decrementError,
        );
      }
    }

    if (!reward) {
      return new Response(JSON.stringify({
        success: false,
        error: "Unable to retrieve reward"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }

    await supabase.from("receipts").update({
      status: "approved",
      reward_amount: reward.amount
    }).eq("id", receiptId);
    return new Response(JSON.stringify({
      success: true,
      amount: reward.amount,
      reward
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("reward-handler error", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
