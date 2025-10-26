import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ReviewedFieldsPayload = {
  store?: string | null;
  location?: string | null;
  receipt_date?: string | null;
  receipt_time?: string | null;
  payment_method?: string | null;
  total?: number | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalizeNumeric(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function sanitizeReviewedFields(input: unknown): ReviewedFieldsPayload | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const source = input as Record<string, unknown>;
  const sanitized: ReviewedFieldsPayload = {};

  const stringKeys: Array<keyof ReviewedFieldsPayload> = [
    "store",
    "location",
    "receipt_date",
    "receipt_time",
    "payment_method",
  ];

  for (const key of stringKeys) {
    if (!(key in source)) continue;
    const raw = source[key as string];
    if (raw === undefined) continue;
    if (raw === null) {
      sanitized[key] = null;
      continue;
    }
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      sanitized[key] = trimmed.length > 0 ? trimmed : null;
      continue;
    }
    if (typeof raw === "number" || typeof raw === "boolean") {
      sanitized[key] = String(raw);
    }
  }

  if ("total" in source) {
    const rawTotal = source.total;
    if (rawTotal !== undefined) {
      if (rawTotal === null) {
        sanitized.total = null;
      } else if (typeof rawTotal === "number") {
        sanitized.total = Number.isFinite(rawTotal)
          ? Math.round(rawTotal * 100) / 100
          : null;
      } else if (typeof rawTotal === "string") {
        const trimmed = rawTotal.trim();
        if (trimmed.length === 0) {
          sanitized.total = null;
        } else {
          const parsed = Number(trimmed);
          sanitized.total = Number.isFinite(parsed)
            ? Math.round(parsed * 100) / 100
            : null;
        }
      }
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

async function sendReviewOutcomeEmail({
  to,
  subject,
  text,
  html,
}: EmailPayload) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL");

  if (!resendApiKey || !resendFromEmail) {
    console.warn(
      "[review-handler] RESEND_API_KEY or RESEND_FROM_EMAIL not configured. Skipping email notification.",
    );
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to,
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(
      `Failed to send review outcome email (status ${response.status}): ${responseBody}`,
    );
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      receipt_id,
      reviewer_id,
      approved,
      reviewed_fields,
      comment,
      user_id,
    } = await req.json();

    if (!receipt_id || !reviewer_id || typeof approved !== "boolean") {
      console.error("[review-handler] Missing or invalid review payload", {
        receipt_id,
        reviewer_id,
        approved,
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid review payload",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        "[review-handler] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars",
      );
      throw new Error("Service configuration error");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const hasReviewedFields = reviewed_fields !== undefined;
    const sanitizedFields = hasReviewedFields
      ? sanitizeReviewedFields(reviewed_fields)
      : null;
    const now = new Date().toISOString();
    const trimmedComment = typeof comment === "string" ? comment.trim() : "";
    let rewardAmount: number | null = null;

    const receiptUpdate: Record<string, unknown> = {
      reviewed_by: reviewer_id,
      status: approved ? "approved" : "rejected",
      updated_at: now,
      rejection_reason: !approved && trimmedComment.length > 0 ? trimmedComment : null,
    };

    let previousFields: ReviewedFieldsPayload | null = null;

    if (sanitizedFields) {
      const trackedKeys: Array<keyof ReviewedFieldsPayload> = [
        "store",
        "location",
        "payment_method",
        "receipt_date",
        "receipt_time",
        "total",
      ];

      const { data: existingReceipt, error: receiptFetchError } = await supabase
        .from("receipts")
        .select(trackedKeys.join(", "))
        .eq("id", receipt_id)
        .maybeSingle();

      if (receiptFetchError) {
        console.error(
          `[review-handler] Failed to fetch current receipt values for ${receipt_id}`,
          receiptFetchError,
        );
        throw new Error("Unable to fetch current receipt details");
      }

      if (existingReceipt) {
        previousFields = {};
        const existingReceiptRecord =
          existingReceipt as Record<string, unknown>;

        for (const key of trackedKeys) {
          const nextValue = sanitizedFields[key];
          if (nextValue !== undefined) {
            previousFields[key] =
              (existingReceiptRecord[key] as string | number | null | undefined) ??
              null;
          }
        }

        if (Object.keys(previousFields).length === 0) {
          previousFields = null;
        }
      }
    }

    if (hasReviewedFields) {
      receiptUpdate.reviewed_fields = sanitizedFields ?? null;

      if (sanitizedFields) {
        for (const [key, value] of Object.entries(sanitizedFields)) {
          if (value !== undefined) {
            receiptUpdate[key] = value;
          }
        }
      }
    }

    const { error: receiptError } = await supabase
      .from("receipts")
      .update(receiptUpdate)
      .eq("id", receipt_id);

    if (receiptError) {
      console.error(
        `[review-handler] Failed to update receipt ${receipt_id}`,
        receiptError,
      );
      throw new Error("Unable to update receipt with reviewed data");
    }

    const { error: assignmentError } = await supabase
      .from("receipt_assignments")
      .update({
        status: "completed",
        completed_at: now,
      })
      .eq("receipt_id", receipt_id)
      .eq("reviewer_id", reviewer_id)
      .eq("status", "assigned");

    if (assignmentError) {
      console.error(
        `[review-handler] Failed to update assignment for receipt ${receipt_id}`,
        assignmentError,
      );
    }

    const reviewRecord: Record<string, unknown> = {
      receipt_id,
      reviewer_id,
      action: approved ? "approve" : "reject",
      new_fields: hasReviewedFields ? sanitizedFields ?? null : null,
      comment: trimmedComment || null,
    };

    if (previousFields) {
      reviewRecord.previous_fields = previousFields;
    }

    const { error: reviewInsertError } = await supabase
      .from("receipt_reviews")
      .insert(reviewRecord);

    if (reviewInsertError) {
      console.error(
        `[review-handler] Failed to insert review record for receipt ${receipt_id}`,
        reviewInsertError,
      );
      throw new Error("Unable to record review history");
    }

    if (approved) {
      try {
        const rewardUrl = `${supabaseUrl}/functions/v1/reward-handler`;
        const rewardResponse = await fetch(
          rewardUrl,
          {
            method: "POST",
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              receipt_id,
              user_id,
            }),
          },
        );

        if (!rewardResponse.ok) {
          if (rewardResponse.status === 409) {
            console.warn(
              `[review-handler] Reward handler reported existing reward for receipt ${receipt_id}. Treating as success.`,
            );
          } else {
            const rewardErrorBody = await rewardResponse.text();
            console.error(
              `[review-handler] Reward handler returned ${rewardResponse.status} for receipt ${receipt_id}`,
              rewardErrorBody,
            );
            return new Response(
              JSON.stringify({
                success: false,
                error:
                  "Failed to create reward for approved receipt. Please try again or contact support.",
              }),
              {
                status: 502,
                headers: {
                  ...corsHeaders,
                  "Content-Type": "application/json",
                },
              },
            );
          }
        } else {
          try {
            const rewardPayload = await rewardResponse.json();
            const extractedAmount =
              rewardPayload?.amount ?? rewardPayload?.reward?.amount ?? null;
            const parsedAmount = normalizeNumeric(extractedAmount);
            if (parsedAmount !== null) {
              rewardAmount = parsedAmount;
            }
          } catch (parseError) {
            console.warn(
              `[review-handler] Unable to parse reward handler response for receipt ${receipt_id}`,
              parseError,
            );
          }
        }
      } catch (error) {
        console.error(
          `[review-handler] Failed to invoke reward handler for receipt ${receipt_id}`,
          error,
        );
        return new Response(
          JSON.stringify({
            success: false,
            error:
              "Failed to create reward for approved receipt. Please try again or contact support.",
          }),
          {
            status: 502,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }
    }

    if (user_id) {
      const {
        data: receiptDetails,
        error: receiptDetailsError,
      } = await supabase
        .from("receipts")
        .select(
          "id, store, total, reward_amount, rejection_reason, users:user_id(email)",
        )
        .eq("id", receipt_id)
        .maybeSingle();

      if (receiptDetailsError) {
        console.error(
          `[review-handler] Failed to fetch receipt details for notifications ${receipt_id}`,
          receiptDetailsError,
        );
        throw new Error("Unable to retrieve receipt information for notifications");
      }

      const receiptRecord = receiptDetails as
        | (Record<string, unknown> & {
            users?: { email?: string | null } | null;
          })
        | null;

      const receiptStoreRaw =
        typeof receiptRecord?.store === "string" ? receiptRecord.store : null;
      const receiptStore =
        receiptStoreRaw && receiptStoreRaw.trim().length > 0
          ? receiptStoreRaw.trim()
          : "your recent receipt";
      const storedRewardAmount = normalizeNumeric(
        receiptRecord?.reward_amount,
      );
      const finalRewardAmount =
        rewardAmount ?? storedRewardAmount ?? normalizeNumeric(receiptUpdate.reward_amount);
      const receiptTotal = normalizeNumeric(receiptRecord?.total);
      const rejectionDetail =
        trimmedComment.length > 0
          ? trimmedComment
          : typeof receiptRecord?.rejection_reason === "string"
            ? receiptRecord.rejection_reason
            : null;

      const notificationTitle = approved
        ? "Receipt approved 🎉"
        : "Receipt review update";

      const notificationMessage = approved
        ? `Your receipt from ${receiptStore} was approved${
            finalRewardAmount ? ` and earned ${finalRewardAmount.toFixed(2)} BTC$` : ""
          }.`
        : `Your receipt from ${receiptStore} was not approved${
            rejectionDetail ? `: ${rejectionDetail}` : "."
          }`;

      const notificationPayload: Record<string, unknown> = {
        user_id,
        receipt_id,
        status: "unread",
        title: notificationTitle,
        message: notificationMessage,
        metadata: {
          approved,
          store: receiptStore,
          reward_amount: finalRewardAmount,
          receipt_total: receiptTotal,
          rejection_reason: rejectionDetail,
        },
      };

      const { error: notificationError } = await supabase
        .from("review_notifications")
        .insert(notificationPayload);

      if (notificationError) {
        console.error(
          `[review-handler] Failed to persist notification for receipt ${receipt_id}`,
          notificationError,
        );
        throw new Error("Unable to create review notification");
      }

      const userEmailRaw = receiptRecord?.users?.email;
      const userEmail =
        typeof userEmailRaw === "string" && userEmailRaw.includes("@")
          ? userEmailRaw
          : null;

      if (userEmail) {
        const subject = approved
          ? "Your receipt was approved"
          : "Update on your receipt review";
        const greeting = `Hi there,`;
        const bodyLines = approved
          ? [
              `Good news! Your receipt from ${receiptStore} was approved.`,
              finalRewardAmount
                ? `You've earned ${finalRewardAmount.toFixed(2)} BTC$ as a reward.`
                : "Thanks for helping keep the Blockcart community running!",
              "Rewards will appear in your wallet shortly.",
            ]
          : [
              `We reviewed your receipt from ${receiptStore}, but it couldn't be approved.`,
              rejectionDetail
                ? `Reason: ${rejectionDetail}`
                : "Unfortunately we couldn't verify the details provided.",
              "You can try submitting a clearer photo if you'd like us to take another look.",
            ];
        const closing = "— The Blockcart Team";

        const textContent = [greeting, "", ...bodyLines, "", closing].join("\n");
        const htmlContent = `
          <p>${greeting}</p>
          ${bodyLines.map((line) => `<p>${line}</p>`).join("")}
          <p>${closing}</p>
        `;

        try {
          await sendReviewOutcomeEmail({
            to: userEmail,
            subject,
            text: textContent,
            html: htmlContent,
          });
        } catch (emailError) {
          console.error(
            `[review-handler] Failed to send review outcome email for receipt ${receipt_id}`,
            emailError,
          );
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("[review-handler] Unexpected error", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
