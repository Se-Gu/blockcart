import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
serve(async (req) => {
  const { receipt_id, image_url } = await req.json();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  );
  try {
    // 1️⃣ OCR API call
    const form = new FormData();
    form.append("url", image_url);
    form.append("language", "auto");
    form.append("isOverlayRequired", "true");
    form.append("isTable", "true");
    form.append("OCREngine", "2");
    const ocrRes = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: {
        apikey: Deno.env.get("OCR_SPACE_API_KEY"),
      },
      body: form,
    });
    const ocr = await ocrRes.json();
    const parsedText = ocr.ParsedResults?.[0]?.ParsedText || "";
    // 2️⃣ Send to LLM for structured extraction
    const llmRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a receipt parser. Extract the store name, date, total, and items (array of name+price). Output valid JSON only.",
          },
          {
            role: "user",
            content: parsedText,
          },
        ],
        response_format: {
          type: "json_object",
        },
      }),
    });
    const llmData = await llmRes.json();
    const extracted = JSON.parse(llmData.choices[0].message.content);
    // 3️⃣ Save to database
    await supabase
      .from("receipts")
      .update({
        ocr_json: ocr,
        ocr_text: parsedText,
        extracted_fields: extracted,
        store: extracted.store,
        total: extracted.total,
        receipt_date: extracted.date,
        status: "pending_review",
      })
      .eq("id", receipt_id);
    return new Response(
      JSON.stringify({
        success: true,
        parsedText,
        extracted,
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error(err);
    await supabase
      .from("receipts")
      .update({
        status: "error",
      })
      .eq("id", receipt_id);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message,
      }),
      {
        status: 500,
      }
    );
  }
});
