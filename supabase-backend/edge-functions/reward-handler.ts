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
    const amountFromPayload = payload?.amount;
    const rewardAmount = typeof amountFromPayload === "number" ? amountFromPayload : 50;
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

    const baseRewardPayload = {
      user_id: userId,
      receipt_id: receiptId,
      campaign_id: payload?.campaign_id ?? null,
      amount: rewardAmount,
      description: payload?.description ?? "Receipt approval reward",
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
        const isConflict =
          insertError.code === "23505" ||
          insertError.details?.toLowerCase().includes("duplicate key") ||
          insertError.message?.toLowerCase().includes("duplicate key");

        if (isConflict) {
          const { existingReward: conflictReward, existingError: conflictError } = await fetchExistingReward();

          if (conflictError) {
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
