import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
serve(async (req) => {
  const { receipt_id, user_id } = await req.json();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  );
  const amount = 50; // static for now
  await supabase.from("rewards").insert({
    user_id,
    receipt_id,
    amount,
    description: "Receipt approval reward",
  });
  await supabase
    .from("receipts")
    .update({
      status: "approved",
      reward_amount: amount,
    })
    .eq("id", receipt_id);
  return new Response(
    JSON.stringify({
      success: true,
      amount,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
});
