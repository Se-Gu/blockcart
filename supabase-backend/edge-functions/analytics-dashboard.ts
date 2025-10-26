import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
function toNumber(value, fallback = 0) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  if (req.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders
    });
  }
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const [{ data: overviewData, error: overviewError }, { data: trendData, error: trendError }, { data: rewardData, error: rewardError }, { data: reviewerData, error: reviewerError }] = await Promise.all([
      supabase.from("analytics_overview").select().maybeSingle(),
      supabase.from("analytics_receipt_trends").select("*").order("bucket_date"),
      supabase.from("analytics_reward_breakdown").select("*"),
      supabase.from("analytics_reviewer_performance").select("*")
    ]);
    if (overviewError || trendError || rewardError || reviewerError) {
      const errors = [
        overviewError,
        trendError,
        rewardError,
        reviewerError
      ].filter(Boolean).map((err)=>err?.message).join("; ");
      console.error("[analytics-dashboard] Query error", errors);
      return new Response(JSON.stringify({
        error: "Failed to aggregate analytics",
        details: errors
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    if (!overviewData) {
      console.warn("[analytics-dashboard] No overview data returned");
      return new Response(JSON.stringify({
        error: "No analytics data available"
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const overview = overviewData;
    const receiptTrends = trendData ?? [];
    const rewardBreakdown = rewardData ?? [];
    const reviewerPerformance = reviewerData ?? [];
    return new Response(JSON.stringify({
      overview: {
        totalReceipts: toNumber(overview.total_receipts),
        approvalRate: toNumber(overview.approval_rate),
        avgProcessingTimeHours: toNumber(overview.avg_processing_time_hours),
        rewardsIssued: toNumber(overview.rewards_issued),
        pendingReceipts: toNumber(overview.pending_receipts)
      },
      receiptTrends: receiptTrends.map((trend)=>({
          date: trend.date_label,
          submitted: toNumber(trend.submitted),
          approved: toNumber(trend.approved),
          rejected: toNumber(trend.rejected)
        })),
      rewardBreakdown: rewardBreakdown.map((row)=>({
          label: row.label,
          value: toNumber(row.value)
        })),
      reviewerPerformance: reviewerPerformance.map((row)=>({
          id: row.reviewer_id,
          reviewer: row.reviewer_name,
          reviewed: toNumber(row.reviewed),
          approvalRate: toNumber(row.approval_rate, 0),
          avgReviewTimeMinutes: toNumber(row.avg_review_time_minutes, 0)
        }))
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("[analytics-dashboard] Unexpected error", error);
    return new Response(JSON.stringify({
      error: "Unexpected analytics error"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
