"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { X, Check, RefreshCw, Loader2, Copy } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Receipt, ReviewedFieldUpdates, ReceiptStatus, ReceiptReview, ReceiptItem } from "@/lib/types"
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
  items: ReceiptItem[]
}

type ParsedValues = {
  store: string
  location: string
  receipt_date: string
  receipt_time: string
  payment_method: string
  total: string
  items: ReceiptItem[]
}

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
  items: [],
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
    total: totalNumber !== null && !Number.isNaN(totalNumber) ? Number(totalNumber.toFixed(2)) : null,
    items: form.items.length > 0 ? form.items : null,
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

function getStringField(source: Record<string, unknown> | null | undefined, key: string, fallback?: string | null) {
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

    const extractedFields = receipt.extracted_fields as Record<string, unknown> | null | undefined

    // Extract items from extracted_fields
    let items: ReceiptItem[] = []
    if (extractedFields && typeof extractedFields === "object" && "items" in extractedFields) {
      const extractedItems = extractedFields.items
      if (Array.isArray(extractedItems)) {
        items = extractedItems.filter((item): item is ReceiptItem => 
          typeof item === "object" &&
          item !== null &&
          "name" in item &&
          typeof item.name === "string" &&
          "price" in item &&
          typeof item.price === "number"
        )
      }
    }

    return {
      store: getStringField(extractedFields, "store", receipt.store_name),
      location: getStringField(extractedFields, "location", receipt.location),
      receipt_date: getStringField(extractedFields, "receipt_date", receipt.purchase_date),
      receipt_time: getStringField(extractedFields, "receipt_time", receipt.receipt_time),
      payment_method: getStringField(extractedFields, "payment_method", receipt.payment_method),
      total: getNumericField(extractedFields, "total", receipt.total_amount),
      items,
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

    // Extract items from reviewed_fields or extracted_fields
    let items: ReceiptItem[] = []
    if (reviewedFields && typeof reviewedFields === "object" && "items" in reviewedFields) {
      const reviewedItems = reviewedFields.items
      if (Array.isArray(reviewedItems)) {
        items = reviewedItems.filter((item): item is ReceiptItem => 
          typeof item === "object" &&
          item !== null &&
          "name" in item &&
          typeof item.name === "string" &&
          "price" in item &&
          typeof item.price === "number"
        )
      }
    } else if (extractedFields && typeof extractedFields === "object" && "items" in extractedFields) {
      const extractedItems = extractedFields.items
      if (Array.isArray(extractedItems)) {
        items = extractedItems.filter((item): item is ReceiptItem => 
          typeof item === "object" &&
          item !== null &&
          "name" in item &&
          typeof item.name === "string" &&
          "price" in item &&
          typeof item.price === "number"
        )
      }
    }

    setFormState({
      store: getStringField(reviewedFields, "store", getStringField(extractedFields, "store", receipt.store_name)),
      location: getStringField(
        reviewedFields,
        "location",
        getStringField(extractedFields, "location", receipt.location),
      ),
      receipt_date: normalizeDateInput(getStringField(reviewedFields, "receipt_date", receipt.purchase_date)),
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
      items,
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
  const assignmentLocked = !!receipt?.assignment_status && receipt.assignment_status !== "assigned"

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
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-xl">
            <span>Receipt Review</span>
            {getStatusBadge(receipt.status)}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Receipt Image</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-border bg-muted">
                  <Image
                    src={
                      resolvedImageUrl ??
                      receipt.image_url ??
                      ("/placeholder.svg?height=600&width=450&query=receipt" || "/placeholder.svg")
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
                  className="mt-4 w-full bg-transparent"
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Receipt Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Submitted By
                  </Label>
                  <p className="mt-1 text-sm font-medium">{receipt.user_name ?? "Unknown user"}</p>
                  <p className="text-xs text-muted-foreground">{receipt.user_email ?? "No email"}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Submitted
                    </Label>
                    <p className="mt-1 text-sm font-medium">{formatLongDateTime(receipt.created_at)}</p>
                  </div>
                  {receipt.reviewer_name && (
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Reviewed By
                      </Label>
                      <p className="mt-1 text-sm font-medium">{receipt.reviewer_name}</p>
                      {receipt.reviewed_at && (
                        <p className="text-xs text-muted-foreground">{formatLongDateTime(receipt.reviewed_at)}</p>
                      )}
                    </div>
                  )}
                </div>

                {receipt.rejection_reason && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-destructive">
                      Previous Comment
                    </Label>
                    <p className="mt-1 text-sm leading-relaxed">{receipt.rejection_reason}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Review & Correct Fields</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Compare OCR-parsed values with your corrections. Click "Use Parsed" to copy the extracted value.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {reviewFieldConfigs.map((field) => {
                  const parsedValue = parsedValues[field.key]
                  const displayValue = formatParsedComparisonValue(field.key, parsedValue)

                  // Insert Items section before Total field
                  const renderItemsBeforeTotal = field.key === "total"

                  return (
                    <div key={field.key}>
                      {renderItemsBeforeTotal && (
                        <div className="mb-6">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-semibold">Receipt Items</Label>
                            </div>
                            {parsedValues.items.length > 0 || formState.items.length > 0 ? (
                              <div className="space-y-3">
                                {formState.items.map((item, index) => (
                                  <div key={index} className="grid gap-3 rounded-lg border border-border bg-card p-4">
                                    <div className="grid gap-3 sm:grid-cols-[1fr_100px]">
                                      <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                          Item Name
                                        </Label>
                                        <Input
                                          value={item.name}
                                          onChange={(event) => {
                                            const newItems = [...formState.items]
                                            newItems[index] = { ...item, name: event.target.value }
                                            setFormState((prev) => ({ ...prev, items: newItems }))
                                          }}
                                          className="h-10 text-sm"
                                          placeholder="Item name"
                                        />
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                          Price
                                        </Label>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          value={item.price}
                                          onChange={(event) => {
                                            const newItems = [...formState.items]
                                            newItems[index] = { ...item, price: Number(event.target.value) || 0 }
                                            setFormState((prev) => ({ ...prev, items: newItems }))
                                          }}
                                          className="h-10 text-sm"
                                          placeholder="0.00"
                                        />
                                      </div>
                                    </div>
                                    {item.brand && (
                                      <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                          Brand
                                        </Label>
                                        <Input
                                          value={item.brand}
                                          onChange={(event) => {
                                            const newItems = [...formState.items]
                                            newItems[index] = { ...item, brand: event.target.value || null }
                                            setFormState((prev) => ({ ...prev, items: newItems }))
                                          }}
                                          className="h-10 text-sm"
                                          placeholder="Brand name"
                                        />
                                      </div>
                                    )}
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const newItems = formState.items.filter((_, i) => i !== index)
                                        setFormState((prev) => ({ ...prev, items: newItems }))
                                      }}
                                      className="w-full text-destructive hover:text-destructive"
                                    >
                                      <X className="mr-2 h-4 w-4" />
                                      Remove Item
                                    </Button>
                                  </div>
                                ))}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const newItems = formState.items.concat({
                                      name: "",
                                      brand: null,
                                      price: 0,
                                    })
                                    setFormState((prev) => ({ ...prev, items: newItems }))
                                  }}
                                  className="w-full"
                                >
                                  Add Item
                                </Button>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">No items found in the receipt.</p>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label htmlFor={`corrected-${field.key}`} className="text-sm font-semibold">
                            {field.label}
                          </Label>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleApplyParsedValue(field.key)}
                            disabled={!parsedValue}
                            className="h-8 gap-1.5"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Use Parsed
                          </Button>
                        </div>
                        <div className="grid gap-3 lg:grid-cols-2">
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              OCR Extracted
                            </p>
                            <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/50 p-4">
                              <p className="text-sm font-medium leading-relaxed">{displayValue}</p>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Corrected Value
                            </p>
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
                              className="h-12 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Reviewer Comments</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  id="review-comment"
                  placeholder="Add notes or reasons for approval/rejection..."
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  rows={4}
                  className="resize-none text-sm"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Review History</CardTitle>
              </CardHeader>
              <CardContent>
                {reviewsLoading ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading review history...
                  </p>
                ) : reviewsError ? (
                  <p className="text-sm text-destructive">{reviewsError}</p>
                ) : reviews.length > 0 ? (
                  <div className="space-y-3">
                    {reviews.map((review, index) => {
                      const trimmedComment = review.comment?.trim()
                      return (
                        <div
                          key={`${review.created_at}-${index}`}
                          className="space-y-2 rounded-lg border border-border bg-muted/30 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-semibold">{formatReviewAction(review.action)}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatLongDateTime(review.created_at)}
                            </span>
                          </div>
                          {review.reviewer?.email && (
                            <p className="text-xs text-muted-foreground">{review.reviewer.email}</p>
                          )}
                          {trimmedComment && (
                            <p className="text-sm leading-relaxed text-foreground">{trimmedComment}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No review history yet.</p>
                )}
              </CardContent>
            </Card>

            {(receipt.status === "pending" || receipt.status === "pending_review") && (
              <div className="flex gap-3 border-t border-border pt-6">
                <Button
                  onClick={handleApprove}
                  disabled={mergedActionLoading || assignmentLocked}
                  className="flex-1 h-11 bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  {approveButtonBusy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Approve Receipt
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={mergedActionLoading || !comment.trim() || assignmentLocked}
                  variant="destructive"
                  className="flex-1 h-11"
                  size="lg"
                >
                  {rejectButtonBusy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <X className="mr-2 h-4 w-4" />
                  )}
                  Reject Receipt
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
