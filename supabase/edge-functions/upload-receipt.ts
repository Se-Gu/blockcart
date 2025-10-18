import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
serve(async (req) => {
  const { user_id, image_url } = await req.json();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  );
  try {
    // 1️⃣ Metadata check (fetch Last-Modified header)
    const headRes = await fetch(image_url, {
      method: "HEAD",
    });
    const takenDate = headRes.headers.get("Last-Modified") || null;
    // 2️⃣ Compute SHA-256 hash for duplicate detection
    const buffer = await fetch(image_url).then((r) => r.arrayBuffer());
    const hashArray = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))
    );
    const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    const { data: existing } = await supabase
      .from("receipts")
      .select("id")
      .eq("user_id", user_id)
      .eq("image_hash", hash)
      .maybeSingle();
    if (existing)
      return new Response(
        JSON.stringify({
          success: false,
          message: "Duplicate receipt already uploaded.",
        }),
        {
          status: 400,
        }
      );
    // 3️⃣ Moderation check (OpenAI)
    const modResp = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: image_url,
      }),
    });
    const moderation = await modResp.json();
    if (moderation.results[0].flagged) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Image content failed moderation.",
        }),
        {
          status: 400,
        }
      );
    }
    // 4️⃣ Create receipt record
    const eta = new Date();
    eta.setHours(eta.getHours() + 2);
    const { data: receipt } = await supabase
      .from("receipts")
      .insert({
        user_id,
        image_url,
        receipt_date: takenDate,
        image_hash: hash,
        status: "pending_review",
        moderation_result: moderation,
      })
      .select()
      .single();
    // 5️⃣ Trigger OCR parsing asynchronously
    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ocr-parser`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        receipt_id: receipt.id,
        image_url,
      }),
    }).catch(console.error);
    return new Response(
      JSON.stringify({
        success: true,
        message: `Receipt uploaded successfully. Pending review. Expected by ${eta.toLocaleString()}.`,
        status: "pending_review",
        eta,
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Internal error.",
      }),
      {
        status: 500,
      }
    );
  }
});
