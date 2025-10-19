"use client"

import { useEffect, useState } from "react"
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
import type { Receipt, ReviewedFieldUpdates, ReceiptStatus } from "@/lib/types"

interface ReceiptDetailDialogProps {
  receipt: Receipt | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApprove?: (receipt: Receipt, payload: ReviewActionPayload) => Promise<void> | void
  onReject?: (receipt: Receipt, payload: ReviewActionPayload) => Promise<void> | void
  onReRunOcr?: (receipt: Receipt) => Promise<void> | void
  actionLoading?: boolean
  reRunLoading?: boolean
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
}: ReceiptDetailDialogProps) {
  const [formState, setFormState] = useState<FormState>(emptyForm)
  const [comment, setComment] = useState("")
  const [activeAction, setActiveAction] = useState<"approve" | "reject" | null>(null)
  const [localOcrLoading, setLocalOcrLoading] = useState(false)

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

  const mergedActionLoading = actionLoading || activeAction !== null
  const mergedOcrLoading = reRunLoading || localOcrLoading
  const approveButtonBusy = activeAction === "approve"
  const rejectButtonBusy = activeAction === "reject"

  const handleApprove = async () => {
    if (!receipt) return
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
    if (!receipt || !comment.trim()) return
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
                src={receipt.image_url || "/placeholder.svg?height=600&width=450&query=receipt"}
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
              <h3 className="text-sm font-semibold">Corrected Fields</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="corrected-store">Store</Label>
                  <Input
                    id="corrected-store"
                    value={formState.store}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, store: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="corrected-location">Location</Label>
                  <Input
                    id="corrected-location"
                    value={formState.location}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, location: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="corrected-date">Purchase Date</Label>
                  <Input
                    id="corrected-date"
                    type="date"
                    value={formState.receipt_date}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, receipt_date: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="corrected-time">Purchase Time</Label>
                  <Input
                    id="corrected-time"
                    type="time"
                    value={formState.receipt_time}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, receipt_time: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="corrected-payment">Payment Method</Label>
                  <Input
                    id="corrected-payment"
                    value={formState.payment_method}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, payment_method: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="corrected-total">Total Amount</Label>
                  <Input
                    id="corrected-total"
                    type="number"
                    step="0.01"
                    value={formState.total}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, total: event.target.value }))
                    }
                  />
                </div>
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

            {(receipt.status === "pending" || receipt.status === "pending_review") && (
              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    onClick={handleApprove}
                    disabled={mergedActionLoading}
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
                    disabled={mergedActionLoading || !comment.trim()}
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
