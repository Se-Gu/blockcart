import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  const { user_id, image_url } = await req.json();
  const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  try {
    console.log("📥 Incoming upload:", {
      user_id,
      image_url
    });
    // Metadata
    const headRes = await fetch(image_url, {
      method: "HEAD"
    });
    const takenDate = headRes.headers.get("Last-Modified") || null;
    // Duplicate detection
    const buffer = await fetch(image_url).then((r)=>r.arrayBuffer());
    const hashArray = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)));
    const hash = hashArray.map((b)=>b.toString(16).padStart(2, "0")).join("");
    const { data: existing } = await supabase.from("receipts").select("id").eq("user_id", user_id).eq("image_hash", hash).maybeSingle();
    if (existing) {
      console.log("🚫 Duplicate receipt detected:", existing.id);
      return new Response(JSON.stringify({
        success: false,
        message: "Duplicate receipt already uploaded."
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Moderation
    const modResp = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input: image_url
      })
    });
    const moderation = await modResp.json();
    const flagged = moderation?.results?.[0]?.flagged ?? false;
    if (flagged) {
      console.log("🚫 Image failed moderation:", moderation);
      return new Response(JSON.stringify({
        success: false,
        message: "Image content failed moderation."
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    console.log("🧠 Moderation OK, inserting into receipts...");
    const { data: receipt, error: insertErr } = await supabase.from("receipts").insert({
      user_id,
      image_url,
      receipt_date: takenDate,
      image_hash: hash,
      status: "pending_review",
      moderation_result: moderation
    }).select().single();
    console.log("🧾 Receipt insert result:", {
      receipt,
      insertErr
    });
    if (insertErr || !receipt) {
      throw new Error("Receipt insertion failed");
    }
    console.log("✅ Created receipt:", receipt.id);
    // Trigger OCR parser — NOTE: correct endpoint + SRK auth
    const ocrUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ocr-parser`;
    console.log("🚀 Triggering OCR parser:", {
      ocrUrl
    });
    const triggerRes = await fetch(ocrUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`
      },
      body: JSON.stringify({
        receipt_id: receipt.id,
        image_url
      })
    });
    console.log("🔁 OCR trigger response:", {
      status: triggerRes.status,
      ok: triggerRes.ok
    });
    const eta = new Date(Date.now() + 60 * 60 * 1000);
    return new Response(JSON.stringify({
      success: true,
      message: `Receipt uploaded successfully. Pending review. Expected by ${eta.toLocaleString()}.`,
      status: "pending_review",
      eta: eta.toISOString()
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("❌ Upload-receipt error:", err);
    return new Response(JSON.stringify({
      success: false,
      message: "Internal error."
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
