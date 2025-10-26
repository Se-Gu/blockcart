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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const hasReviewedFields = reviewed_fields !== undefined;
    const sanitizedFields = hasReviewedFields
      ? sanitizeReviewedFields(reviewed_fields)
      : null;
    const now = new Date().toISOString();
    const trimmedComment = typeof comment === "string" ? comment.trim() : "";

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
        const rewardResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/reward-handler`,
          {
            method: "POST",
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              receipt_id,
              user_id,
            }),
          },
        );

        if (!rewardResponse.ok) {
          console.error(
            `[review-handler] Reward handler returned ${rewardResponse.status} for receipt ${receipt_id}`,
          );
        }
      } catch (error) {
        console.error(
          `[review-handler] Failed to invoke reward handler for receipt ${receipt_id}`,
          error,
        );
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
