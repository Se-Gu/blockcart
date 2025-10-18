import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
serve(async (req) => {
  const {
    receipt_id,
    reviewer_id,
    approved,
    reviewed_fields,
    comment,
    user_id,
  } = await req.json();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  );
  await supabase
    .from("receipts")
    .update({
      reviewed_by: reviewer_id,
      reviewed_fields,
      status: approved ? "approved" : "rejected",
    })
    .eq("id", receipt_id);
  await supabase.from("receipt_reviews").insert({
    receipt_id,
    reviewer_id,
    action: approved ? "approve" : "reject",
    new_fields: reviewed_fields,
    comment,
  });
  if (approved) {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/reward-handler`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        receipt_id,
        user_id,
      }),
    });
  }
  return new Response(
    JSON.stringify({
      success: true,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
});
