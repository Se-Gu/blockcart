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

export async function sendReviewerAssignmentEmail(
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
