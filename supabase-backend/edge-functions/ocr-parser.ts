import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }
  const { receipt_id, image_url } = await req.json();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  );
  console.log("🧾 OCR invoked:", {
    receipt_id,
    image_url,
  });
  try {
    if (!receipt_id || !image_url)
      throw new Error("Missing receipt_id or image_url");
    const match = image_url.match(/receipts\/(.+)$/);
    if (!match) throw new Error("Invalid image URL");
    const objectPath = match[1];
    // 🔐 Signed URL
    const { data: signed, error: signErr } = await supabase.storage
      .from("receipts")
      .createSignedUrl(objectPath, 120);
    if (signErr || !signed?.signedUrl)
      throw new Error("Failed to create signed URL");
    // 🧠 GPT-4o parsing
    console.log("🔍 Sending image to GPT-4o...");
    const llmRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are a receipt parser. Return only valid JSON with keys: " +
              "store (string), location (string or null), date (ISO string), time (string or null), " +
              "payment_method (string or null), total (number), " +
              "items (array of {name: string, brand: string or null, price: number}). " +
              "If unknown, use null.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract structured data from this receipt image:",
              },
              {
                type: "image_url",
                image_url: {
                  url: signed.signedUrl,
                  detail: "high",
                },
              },
            ],
          },
        ],
        response_format: {
          type: "json_object",
        },
      }),
    });
    if (!llmRes.ok) throw new Error(`OpenAI API error: ${llmRes.status}`);
    const llmData = await llmRes.json();
    const content = llmData?.choices?.[0]?.message?.content ?? "";
    let extracted;
    try {
      extracted = JSON.parse(content);
    } catch {
      throw new Error("LLM returned non-JSON content");
    }
    // 🧹 Normalize fields
    const store = extracted.store ?? null;
    const total =
      typeof extracted.total === "number"
        ? extracted.total
        : Number(extracted.total) || null;
    const receipt_date = extracted.date ?? null;
    const receipt_time = extracted.time ?? null;
    const location = extracted.location ?? null;
    const payment_method = extracted.payment_method ?? null;
    // 💾 Update database
    const { error: updateErr } = await supabase
      .from("receipts")
      .update({
        extracted_fields: extracted,
        store,
        total,
        receipt_date,
        receipt_time,
        location,
        payment_method,
        status: "pending_review",
      })
      .eq("id", receipt_id);
    if (updateErr) throw new Error(updateErr.message);
    console.log("✅ OCR pipeline finished:", receipt_id);
    return new Response(
      JSON.stringify({
        success: true,
        extracted,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("❌ OCR parser failed:", err);
    await supabase
      .from("receipts")
      .update({
        status: "error",
      })
      .eq("id", receipt_id);
    return new Response(
      JSON.stringify({
        success: false,
        error: String(err?.message || err),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
