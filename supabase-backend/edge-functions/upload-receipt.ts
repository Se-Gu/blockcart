import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ReviewerAssignmentEmailOptions {
  to: string;
  receipt: {
    id: string;
    user_id: string | null;
    image_url: string;
    receipt_date: string | null;
    created_at: string | null;
    status: string;
  };
  assignment: {
    id: string;
    assigned_at: string | null;
  };
  metadata?: Record<string, unknown>;
}

function buildReceiptLink(receiptId: string): string | null {
  const baseUrl =
    Deno.env.get("REVIEWER_DASHBOARD_URL") ??
    Deno.env.get("NEXT_PUBLIC_SITE_URL") ??
    null;

  if (!baseUrl) {
    return null;
  }

  const normalizedBase = baseUrl.endsWith("/")
    ? baseUrl.slice(0, -1)
    : baseUrl;

  return `${normalizedBase}/dashboard/receipts/${receiptId}`;
}

function buildEmailPayload(options: ReviewerAssignmentEmailOptions) {
  const { receipt, metadata } = options;
  const submittedAt = receipt.receipt_date ?? receipt.created_at ?? "recently";
  const receiptLink = buildReceiptLink(receipt.id);

  const subject = `New receipt assigned (${receipt.id})`;

  const lines = [
    "Hello,",
    "",
    `A new receipt has been assigned to you for review (ID: ${receipt.id}).`,
    `Status: ${receipt.status ?? "pending_review"}.`,
    `Submitted: ${submittedAt}.`,
  ];

  if (metadata && Object.keys(metadata).length > 0) {
    const formattedEntries = Object.entries(metadata).filter(([, value]) =>
      value !== null && value !== undefined && value !== ""
    );

    if (formattedEntries.length > 0) {
      lines.push("", "Additional details:");
      for (const [key, value] of formattedEntries) {
        lines.push(`- ${key}: ${value}`);
      }
    }
  }

  if (receiptLink) {
    lines.push("", `Review the receipt: ${receiptLink}`);
  }

  lines.push("", "Thank you!", "— Blockcart Team");

  const text = lines.join("\n");

  const htmlLines = [
    "<p>Hello,</p>",
    `<p>A new receipt has been assigned to you for review (ID: <strong>${receipt.id}</strong>).</p>`,
    `<p>Status: <strong>${receipt.status ?? "pending_review"}</strong><br/>Submitted: <strong>${submittedAt}</strong></p>`,
  ];

  if (metadata && Object.keys(metadata).length > 0) {
    const detailsItems = Object.entries(metadata)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([key, value]) => `<li><strong>${key}:</strong> ${String(value)}</li>`)
      .join("");
    if (detailsItems) {
      htmlLines.push(`<p>Additional details:</p><ul>${detailsItems}</ul>`);
    }
  }

  if (receiptLink) {
    htmlLines.push(
      `<p><a href="${receiptLink}" target="_blank" rel="noopener noreferrer">Review the receipt</a></p>`
    );
  }

  htmlLines.push("<p>Thank you!<br/>— Blockcart Team</p>");

  const html = htmlLines.join("");

  return { subject, text, html };
}

async function sendReviewerAssignmentEmail(
  options: ReviewerAssignmentEmailOptions
): Promise<void> {
  const { to, receipt, assignment, metadata } = options;
  if (!to) {
    console.warn("⚠️ Missing recipient email for reviewer assignment notification.");
    return;
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.warn(
      "⚠️ RESEND_API_KEY is not configured. Skipping reviewer assignment email for",
      to
    );
    return;
  }

  const from =
    Deno.env.get("NOTIFICATIONS_EMAIL_FROM") ??
    Deno.env.get("RESEND_FROM") ??
    "Blockcart <no-reply@blockcart.com>";

  const payload = buildEmailPayload({
    to,
    receipt,
    assignment,
    metadata,
  });

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
        tags: [
          { name: "notification", value: "reviewer_assignment" },
          { name: "receipt_id", value: receipt.id },
          { name: "assignment_id", value: assignment.id },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        "❌ Failed to send reviewer assignment email:",
        response.status,
        errorBody
      );
    }
  } catch (err) {
    console.error("❌ Error while sending reviewer assignment email:", err);
  }
}


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const { user_id, image_url, storage_path, bucket } = await req.json();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  );

  try {
    console.log("📥 Incoming upload:", { user_id, image_url });

    if (!bucket || !storage_path) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing storage location for receipt image.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const storage = supabase.storage.from(bucket);

    // Metadata
    let takenDate: string | null = null;
    try {
      const pathParts = storage_path.split("/");
      const fileName = pathParts.pop();
      const folderPath = pathParts.join("/");
      if (fileName) {
        const { data: metadataList, error: metadataError } = await storage.list(
          folderPath || undefined,
          {
            limit: 1,
            search: fileName,
          }
        );
        if (!metadataError && metadataList && metadataList.length > 0) {
          takenDate = metadataList[0]?.updated_at ?? null;
        }
      }
    } catch (metadataErr) {
      console.warn("⚠️ Unable to retrieve metadata for receipt:", metadataErr);
    }

    // Duplicate detection
    const { data: downloadData, error: downloadError } = await storage.download(
      storage_path
    );

    if (downloadError || !downloadData) {
      console.error("❌ Failed to download receipt from storage:", downloadError);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Unable to access uploaded receipt image for verification.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const buffer = await downloadData.arrayBuffer();
    const hashArray = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)));
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      body: JSON.stringify({ input: image_url }),
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    if (insertErr || !receipt) throw new Error("Receipt insertion failed");
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

    if (existingAssignmentErr) throw existingAssignmentErr;

    let assignment = existingAssignment ?? null;
    let createdNotificationAssignmentId: string | null = null;
    const emailMetadata: Record<string, unknown> = {
      receipt_date: receipt.receipt_date ?? null,
      uploaded_at: receipt.created_at ?? null,
      image_url: receipt.image_url,
      bucket,
      storage_path,
      total: receipt.total ?? null,
      store_name: receipt.store ?? null,
    };

    if (assignment) {
      console.log("🔁 Reusing existing assignment:", assignment);
    } else {
      console.log("🧑‍⚖️ Selecting reviewer for assignment...");
      const { data: reviewers, error: reviewersErr } = await supabase
        .from("web_users")
        .select("id, email")
        .eq("role", "reviewer")
        .order("created_at", { ascending: true });

      if (reviewersErr) throw reviewersErr;

      if (!reviewers || reviewers.length === 0) {
        console.warn("⚠️ No reviewers available for assignment.");
      } else {
        const { data: lastAssignment, error: lastAssignmentErr } = await supabase
          .from("receipt_assignments")
          .select("reviewer_id")
          .order("assigned_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastAssignmentErr) throw lastAssignmentErr;

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

        if (assignmentErr) throw assignmentErr;

        assignment = {
          ...insertedAssignment,
          reviewer: { email: nextReviewer.email },
        };

        const { error: notificationErr } = await supabase
          .from("reviewer_notifications")
          .insert({
            reviewer_id: nextReviewer.id,
            receipt_id: receipt.id,
            assignment_id: insertedAssignment.id,
            metadata: emailMetadata,
          });

        if (notificationErr) {
          console.error(
            "⚠️ Failed to persist reviewer notification:",
            notificationErr
          );
        } else {
          createdNotificationAssignmentId = insertedAssignment.id;
        }
      }
    }

    if (assignment?.reviewer?.email) {
      try {
        await sendReviewerAssignmentEmail({
          to: assignment.reviewer.email,
          receipt: {
            id: receipt.id,
            user_id: receipt.user_id,
            image_url: receipt.image_url,
            receipt_date: receipt.receipt_date,
            created_at: receipt.created_at,
            status: receipt.status,
          },
          assignment: {
            id: assignment.id,
            assigned_at: assignment.assigned_at ?? null,
          },
          metadata: {
            ...emailMetadata,
            ...(assignment.reviewer?.email
              ? { reviewer_email: assignment.reviewer.email }
              : {}),
            ...(createdNotificationAssignmentId
              ? { notification_assignment_id: createdNotificationAssignmentId }
              : {}),
          },
        });
      } catch (emailErr) {
        console.error(
          "⚠️ Failed to send reviewer assignment email notification:",
          emailErr
        );
      }
    }

    // Trigger OCR parser
    const ocrUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ocr-parser`;
    console.log("🚀 Triggering OCR parser:", { ocrUrl });
    const triggerRes = await fetch(ocrUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      },
      body: JSON.stringify({ receipt_id: receipt.id, image_url }),
    });

    console.log("🔁 OCR trigger response:", { status: triggerRes.status, ok: triggerRes.ok });

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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
