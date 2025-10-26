"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { X, Check, RefreshCw, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import type {
  Receipt,
  ReviewedFieldUpdates,
  ReceiptStatus,
  ReceiptReview,
} from "@/lib/types"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { getSignedReceiptUrl } from "@/lib/storage"

interface ReceiptDetailDialogProps {
  receipt: Receipt | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApprove?: (receipt: Receipt, payload: ReviewActionPayload) => Promise<void> | void
  onReject?: (receipt: Receipt, payload: ReviewActionPayload) => Promise<void> | void
  onReRunOcr?: (receipt: Receipt) => Promise<void> | void
  actionLoading?: boolean
  reRunLoading?: boolean
  reviews?: ReceiptReview[]
  reviewsLoading?: boolean
  reviewsError?: string | null
}

interface ReviewActionPayload {
  reviewedFields: ReviewedFieldUpdates
  comment: string
}

interface FormState {
  store: string
  location: string
  receipt_date: string
  receipt_time: string
  payment_method: string
  total: string
}

type ParsedValues = Record<keyof FormState, string>

const reviewFieldConfigs: Array<{
  key: keyof FormState
  label: string
  type?: string
  step?: string
}> = [
  { key: "store", label: "Store" },
  { key: "location", label: "Location" },
  { key: "receipt_date", label: "Purchase Date", type: "date" },
  { key: "receipt_time", label: "Purchase Time", type: "time" },
  { key: "payment_method", label: "Payment Method" },
  { key: "total", label: "Total Amount", type: "number", step: "0.01" },
]

const statusStyles: Record<ReceiptStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-600",
  pending_review: "bg-blue-500/10 text-blue-600",
  approved: "bg-green-500/10 text-green-600",
  rejected: "bg-red-500/10 text-red-600",
  flagged: "bg-orange-500/10 text-orange-600",
  error: "bg-destructive/10 text-destructive",
}

function formatLongDate(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function formatLongDateTime(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatReviewAction(action?: string | null) {
  if (!action) return "Updated"
  return action
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

const emptyForm: FormState = {
  store: "",
  location: "",
  receipt_date: "",
  receipt_time: "",
  payment_method: "",
  total: "",
}

function normalizeDateInput(value?: string | null) {
  if (!value) return ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  return date.toISOString().slice(0, 10)
}

function getStatusBadge(status: ReceiptStatus) {
  return (
    <Badge variant="secondary" className={statusStyles[status]}>
      {status.replace("_", " ")}
    </Badge>
  )
}

function buildReviewedFields(form: FormState): ReviewedFieldUpdates {
  const totalNumber = form.total.trim() ? Number(form.total) : null
  return {
    store: form.store.trim() || null,
    location: form.location.trim() || null,
    receipt_date: form.receipt_date.trim() || null,
    receipt_time: form.receipt_time.trim() || null,
    payment_method: form.payment_method.trim() || null,
    total:
      totalNumber !== null && !Number.isNaN(totalNumber) ? Number(totalNumber.toFixed(2)) : null,
  }
}

function formatParsedComparisonValue(field: keyof FormState, value: string) {
  if (!value) return "—"

  if (field === "total") {
    const numeric = Number(value)
    if (!Number.isNaN(numeric)) {
      return `$${numeric.toFixed(2)}`
    }
    return value
  }

  if (field === "receipt_date") {
    return formatLongDate(value)
  }

  return value
}

function getStringField(
  source: Record<string, unknown> | null | undefined,
  key: string,
  fallback?: string | null,
) {
  if (source && typeof source === "object" && key in source) {
    const value = (source as Record<string, unknown>)[key]
    if (typeof value === "string") return value
  }
  return fallback ?? ""
}

function getNumericField(
  source: Record<string, unknown> | null | undefined,
  key: string,
  fallback?: number | string | null,
) {
  if (source && typeof source === "object" && key in source) {
    const value = (source as Record<string, unknown>)[key]
    if (typeof value === "number") return value.toString()
    if (typeof value === "string") return value
  }
  if (typeof fallback === "number") return fallback.toString()
  if (typeof fallback === "string") return fallback
  return ""
}

export function ReceiptDetailDialog({
  receipt,
  open,
  onOpenChange,
  onApprove,
  onReject,
  onReRunOcr,
  actionLoading = false,
  reRunLoading = false,
  reviews = [],
  reviewsLoading = false,
  reviewsError = null,
}: ReceiptDetailDialogProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null)
  const [formState, setFormState] = useState<FormState>(emptyForm)
  const [comment, setComment] = useState("")
  const [activeAction, setActiveAction] = useState<"approve" | "reject" | null>(null)
  const [localOcrLoading, setLocalOcrLoading] = useState(false)

  const parsedValues = useMemo<ParsedValues>(() => {
    if (!receipt) {
      return { ...emptyForm }
    }

    const extractedFields = receipt.extracted_fields as
      | Record<string, unknown>
      | null
      | undefined

    return {
      store: getStringField(extractedFields, "store", receipt.store_name),
      location: getStringField(extractedFields, "location", receipt.location),
      receipt_date: getStringField(
        extractedFields,
        "receipt_date",
        receipt.purchase_date,
      ),
      receipt_time: getStringField(
        extractedFields,
        "receipt_time",
        receipt.receipt_time,
      ),
      payment_method: getStringField(
        extractedFields,
        "payment_method",
        receipt.payment_method,
      ),
      total: getNumericField(extractedFields, "total", receipt.total_amount),
    }
  }, [receipt])

  useEffect(() => {
    if (!receipt) {
      setFormState(emptyForm)
      setComment("")
      return
    }

    const reviewedFields = receipt.reviewed_fields as Record<string, unknown> | null | undefined
    const extractedFields = receipt.extracted_fields as Record<string, unknown> | null | undefined

    setFormState({
      store: getStringField(reviewedFields, "store", getStringField(extractedFields, "store", receipt.store_name)),
      location: getStringField(
        reviewedFields,
        "location",
        getStringField(extractedFields, "location", receipt.location),
      ),
      receipt_date: normalizeDateInput(
        getStringField(reviewedFields, "receipt_date", receipt.purchase_date),
      ),
      receipt_time: getStringField(
        reviewedFields,
        "receipt_time",
        getStringField(extractedFields, "receipt_time", receipt.receipt_time),
      ),
      payment_method: getStringField(
        reviewedFields,
        "payment_method",
        getStringField(extractedFields, "payment_method", receipt.payment_method),
      ),
      total: getNumericField(reviewedFields, "total", receipt.total_amount),
    })
    setComment(receipt.rejection_reason ?? "")
  }, [receipt])

  useEffect(() => {
    let isMounted = true

    const resolveImageUrl = async () => {
      if (!receipt?.image_url) {
        if (isMounted) {
          setResolvedImageUrl(null)
        }
        return
      }

      const signedUrl = await getSignedReceiptUrl(supabase, receipt.image_url)

      if (!isMounted) {
        return
      }

      setResolvedImageUrl(signedUrl ?? receipt.image_url)
    }

    resolveImageUrl()

    return () => {
      isMounted = false
    }
  }, [receipt?.image_url, supabase])

  const mergedActionLoading = actionLoading || activeAction !== null
  const mergedOcrLoading = reRunLoading || localOcrLoading
  const approveButtonBusy = activeAction === "approve"
  const rejectButtonBusy = activeAction === "reject"
  const assignmentLocked =
    !!receipt?.assignment_status && receipt.assignment_status !== "assigned"

  const handleApplyParsedValue = (field: keyof FormState) => {
    const parsedValue = parsedValues[field]
    setFormState((prev) => ({ ...prev, [field]: parsedValue || "" }))
  }

  const handleApprove = async () => {
    if (!receipt || assignmentLocked) return
    setActiveAction("approve")
    try {
      await onApprove?.(receipt, {
        reviewedFields: buildReviewedFields(formState),
        comment,
      })
    } finally {
      setActiveAction(null)
    }
  }

  const handleReject = async () => {
    if (!receipt || !comment.trim() || assignmentLocked) return
    setActiveAction("reject")
    try {
      await onReject?.(receipt, {
        reviewedFields: buildReviewedFields(formState),
        comment,
      })
    } finally {
      setActiveAction(null)
    }
  }

  const handleReRunOcr = async () => {
    if (!receipt) return
    setLocalOcrLoading(true)
    try {
      await onReRunOcr?.(receipt)
    } finally {
      setLocalOcrLoading(false)
    }
  }

  if (!receipt) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Receipt Details</span>
            {getStatusBadge(receipt.status)}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-border bg-muted">
              <Image
                src={
                  resolvedImageUrl ??
                  receipt.image_url ??
                  "/placeholder.svg?height=600&width=450&query=receipt"
                }
                alt="Receipt"
                fill
                className="object-contain"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleReRunOcr}
              disabled={mergedOcrLoading}
              className="w-full"
            >
              {mergedOcrLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Re-running OCR
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Re-run OCR
                </>
              )}
            </Button>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">User</Label>
                <p className="text-sm font-medium">{receipt.user_name ?? "Unknown user"}</p>
                <p className="text-xs text-muted-foreground">{receipt.user_email ?? "No email"}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Store</Label>
                <p className="text-sm font-medium">{receipt.store_name ?? "—"}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Total Amount</Label>
                  <p className="text-sm font-medium">
                    ${receipt.total_amount.toFixed(2)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Purchase Date</Label>
                  <p className="text-sm font-medium">{formatLongDate(receipt.purchase_date)}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Location</Label>
                  <p className="text-sm font-medium">{receipt.location ?? "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Payment Method</Label>
                  <p className="text-sm font-medium">{receipt.payment_method ?? "—"}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Receipt Time</Label>
                  <p className="text-sm font-medium">{receipt.receipt_time ?? "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Submitted</Label>
                  <p className="text-sm font-medium">{formatLongDateTime(receipt.created_at)}</p>
                </div>
              </div>

              {receipt.reviewer_name && (
                <div>
                  <Label className="text-muted-foreground">Reviewed By</Label>
                  <p className="text-sm font-medium">{receipt.reviewer_name}</p>
                  {receipt.reviewed_at && (
                    <p className="text-xs text-muted-foreground">
                      {formatLongDateTime(receipt.reviewed_at)}
                    </p>
                  )}
                </div>
              )}

              {receipt.rejection_reason && (
                <div>
                  <Label className="text-muted-foreground">Previous Comment</Label>
                  <p className="text-sm font-medium text-destructive">{receipt.rejection_reason}</p>
                </div>
              )}
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <h3 className="text-sm font-semibold">Review Parsed Fields</h3>
              <p className="text-xs text-muted-foreground">
                Compare the parsed values against your corrections and copy them with
                a single click.
              </p>
              <div className="space-y-4">
                {reviewFieldConfigs.map((field) => {
                  const parsedValue = parsedValues[field.key]
                  const displayValue = formatParsedComparisonValue(
                    field.key,
                    parsedValue,
                  )

                  return (
                    <div key={field.key} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor={`corrected-${field.key}`}>
                          {field.label}
                        </Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleApplyParsedValue(field.key)}
                          disabled={!parsedValue}
                        >
                          Use parsed
                        </Button>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/40 p-3 text-sm">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Parsed
                          </p>
                          <p className="mt-1 break-words font-medium text-foreground">
                            {displayValue}
                          </p>
                        </div>
                        <Input
                          id={`corrected-${field.key}`}
                          type={field.type}
                          step={field.step}
                          value={formState[field.key]}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              [field.key]: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <Label htmlFor="review-comment">Reviewer Comments</Label>
              <Textarea
                id="review-comment"
                placeholder="Add notes for this review..."
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <h3 className="text-sm font-semibold">Review History</h3>
              {reviewsLoading ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading review history...
                </p>
              ) : reviewsError ? (
                <p className="text-sm text-destructive">{reviewsError}</p>
              ) : reviews.length > 0 ? (
                <ul className="space-y-3">
                  {reviews.map((review, index) => {
                    const trimmedComment = review.comment?.trim()
                    return (
                      <li
                        key={`${review.created_at}-${index}`}
                        className="space-y-1 rounded-md border border-border p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {formatReviewAction(review.action)}
                          </span>
                          <span>{formatLongDateTime(review.created_at)}</span>
                        </div>
                        {review.reviewer?.email && (
                          <p className="text-xs text-muted-foreground">{review.reviewer.email}</p>
                        )}
                        {trimmedComment && (
                          <p className="text-sm leading-relaxed text-foreground">
                            {trimmedComment}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No review history yet.</p>
              )}
            </div>

            {(receipt.status === "pending" || receipt.status === "pending_review") && (
              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    onClick={handleApprove}
                    disabled={mergedActionLoading || assignmentLocked}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {approveButtonBusy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    Approve
                  </Button>
                  <Button
                    onClick={handleReject}
                    disabled={
                      mergedActionLoading || !comment.trim() || assignmentLocked
                    }
                    variant="destructive"
                    className="flex-1"
                  >
                    {rejectButtonBusy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <X className="mr-2 h-4 w-4" />
                    )}
                    Reject
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
