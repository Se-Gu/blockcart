import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const rewardSelect =
  "id, user_id, campaign_id, amount, status, created_at, paid_at, " +
  "users:user_id ( id, email, full_name ), " +
  "campaigns:campaign_id ( id, name, brand )";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  try {
    const payload = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    );

    const action = payload?.action ?? "create_reward";

    if (action === "approve_reward") {
      const rewardId: string | undefined = payload?.reward_id;
      if (!rewardId) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing reward_id" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const updatedAt = new Date().toISOString();
      const { data, error } = await supabase
        .from("rewards")
        .update({ status: "approved", updated_at: updatedAt })
        .eq("id", rewardId)
        .select(rewardSelect)
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true, reward: data }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "mark_reward_paid") {
      const rewardId: string | undefined = payload?.reward_id;
      if (!rewardId) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing reward_id" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const paidAt = new Date().toISOString();
      const { data, error } = await supabase
        .from("rewards")
        .update({
          status: "paid",
          paid_at: paidAt,
          updated_at: paidAt,
        })
        .eq("id", rewardId)
        .select(rewardSelect)
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true, reward: data }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const receiptId: string | undefined = payload?.receipt_id;
    const userId: string | undefined = payload?.user_id;
    const amountFromPayload = payload?.amount;
    const rewardAmount =
      typeof amountFromPayload === "number" ? amountFromPayload : 50;

    if (!receiptId || !userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing receipt_id or user_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const insertPayload = {
      user_id: userId,
      receipt_id: receiptId,
      campaign_id: payload?.campaign_id ?? null,
      amount: rewardAmount,
      description: payload?.description ?? "Receipt approval reward",
      status: payload?.status ?? "pending",
    };

    const { data: reward, error: insertError } = await supabase
      .from("rewards")
      .insert(insertPayload)
      .select(rewardSelect)
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ success: false, error: insertError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    await supabase
      .from("receipts")
      .update({
        status: "approved",
        reward_amount: rewardAmount,
      })
      .eq("id", receiptId);

    return new Response(
      JSON.stringify({ success: true, amount: rewardAmount, reward }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("reward-handler error", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
