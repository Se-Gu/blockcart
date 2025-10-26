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
  const { user_id, image_url } = await req.json();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  );
  try {
    console.log("📥 Incoming upload:", {
      user_id,
      image_url,
    });
    // Metadata
    const headRes = await fetch(image_url, {
      method: "HEAD",
    });
    const takenDate = headRes.headers.get("Last-Modified") || null;
    // Duplicate detection
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
    if (existing) {
      console.log("🚫 Duplicate receipt detected:", existing.id);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Duplicate receipt already uploaded.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    // Moderation
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
    const flagged = moderation?.results?.[0]?.flagged ?? false;
    if (flagged) {
      console.log("🚫 Image failed moderation:", moderation);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Image content failed moderation.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    console.log("🧠 Moderation OK, inserting into receipts...");
    const { data: receipt, error: insertErr } = await supabase
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
    console.log("🧾 Receipt insert result:", {
      receipt,
      insertErr,
    });
    if (insertErr || !receipt) {
      throw new Error("Receipt insertion failed");
    }
    console.log("✅ Created receipt:", receipt.id);
    console.log("👀 Checking for existing assignments...");
    const {
      data: existingAssignment,
      error: existingAssignmentErr,
    } = await supabase
      .from("receipt_assignments")
      .select("id, reviewer_id, status, assigned_at, reviewer:web_users(email)")
      .eq("receipt_id", receipt.id)
      .in("status", ["assigned", "returned"])
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingAssignmentErr) {
      throw existingAssignmentErr;
    }
    let assignment = existingAssignment ?? null;
    if (assignment) {
      console.log("🔁 Reusing existing assignment:", assignment);
    } else {
      console.log("🧑‍⚖️ Selecting reviewer for assignment...");
      const { data: reviewers, error: reviewersErr } = await supabase
        .from("web_users")
        .select("id, email")
        .eq("role", "reviewer")
        .order("created_at", { ascending: true });
      if (reviewersErr) {
        throw reviewersErr;
      }
      if (!reviewers || reviewers.length === 0) {
        console.warn("⚠️ No reviewers available for assignment.");
      } else {
        const { data: lastAssignment, error: lastAssignmentErr } = await supabase
          .from("receipt_assignments")
          .select("reviewer_id")
          .order("assigned_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastAssignmentErr) {
          throw lastAssignmentErr;
        }
        const lastReviewerId = lastAssignment?.reviewer_id ?? null;
        const currentIndex = reviewers.findIndex((r) => r.id === lastReviewerId);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % reviewers.length : 0;
        const nextReviewer = reviewers[nextIndex];
        console.log("🗂️ Assigning to reviewer:", nextReviewer);
        const { data: insertedAssignment, error: assignmentErr } = await supabase
          .from("receipt_assignments")
          .insert({
            receipt_id: receipt.id,
            reviewer_id: nextReviewer.id,
            status: "assigned",
          })
          .select("id, reviewer_id, status, assigned_at")
          .single();
        if (assignmentErr) {
          throw assignmentErr;
        }
        assignment = {
          ...insertedAssignment,
          reviewer: {
            email: nextReviewer.email,
          },
        };
      }
    }
    // Trigger OCR parser — NOTE: correct endpoint + SRK auth
    const ocrUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ocr-parser`;
    console.log("🚀 Triggering OCR parser:", {
      ocrUrl,
    });
    const triggerRes = await fetch(ocrUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      },
      body: JSON.stringify({
        receipt_id: receipt.id,
        image_url,
      }),
    });
    console.log("🔁 OCR trigger response:", {
      status: triggerRes.status,
      ok: triggerRes.ok,
    });
    const eta = new Date(Date.now() + 60 * 60 * 1000);
    let message = `Receipt uploaded successfully. Pending review. Expected by ${eta.toLocaleString()}.`;
    if (!assignment) {
      message =
        "Receipt uploaded successfully. Awaiting reviewer availability before assignment.";
    }
    return new Response(
      JSON.stringify({
        success: true,
        message,
        status: assignment ? "pending_review" : "queued",
        eta: eta.toISOString(),
        assignment,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("❌ Upload-receipt error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Internal error.",
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
