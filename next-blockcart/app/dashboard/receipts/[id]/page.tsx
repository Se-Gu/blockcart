"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, Loader2, RefreshCw, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import type { Receipt, ReceiptReview, ReviewedFieldUpdates } from "@/lib/types"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { getSignedReceiptUrl } from "@/lib/storage"

const statusStyles = {
  pending: "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20",
  pending_review: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20",
  approved: "bg-green-500/10 text-green-600 hover:bg-green-500/20",
  rejected: "bg-red-500/10 text-red-600 hover:bg-red-500/20",
  flagged: "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20",
  error: "bg-destructive/10 text-destructive hover:bg-destructive/20",
}

export default function ReceiptReviewPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const { user, userRole } = useAuth()
  const { toast } = useToast()

  const receiptId = params.id as string

  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [loading, setLoading] = useState(true)
  const [reviews, setReviews] = useState<ReceiptReview[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [signedImageUrl, setSignedImageUrl] = useState<string | null>(null)

  const [store, setStore] = useState("")
  const [location, setLocation] = useState("")
  const [receiptDate, setReceiptDate] = useState("")
  const [receiptTime, setReceiptTime] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [total, setTotal] = useState("")
  const [comment, setComment] = useState("")

  useEffect(() => {
    const fetchReceipt = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from("receipts")
          .select(
            `
            *,
            users:user_id(id,email),
            reviewer:reviewed_by(id,email)
          `,
          )
          .eq("id", receiptId)
          .single()

        if (error) throw error

        const receiptData: Receipt = {
          id: data.id,
          user_id: data.user_id,
          user_email: data.users?.email || null,
          user_name: data.users?.email || "Unknown",
          image_url: data.image_url,
          total_amount: Number(data.total) || 0,
          store_name: data.store,
          purchase_date: data.receipt_date || data.created_at,
          status: data.status,
          reviewer_id: data.reviewed_by,
          reviewer_name: data.reviewer?.email || null,
          reviewer_email: data.reviewer?.email || null,
          reviewed_at: data.updated_at,
          rejection_reason: data.rejection_reason,
          created_at: data.created_at,
          location: data.location,
          payment_method: data.payment_method,
          receipt_time: data.receipt_time,
          reviewed_fields: data.reviewed_fields,
          extracted_fields: data.extracted_fields,
        }

        setReceipt(receiptData)

        const signedUrl = await getSignedReceiptUrl(supabase, receiptData.image_url)
        setSignedImageUrl(signedUrl)

        const reviewedFields = receiptData.reviewed_fields as Record<string, unknown> | null
        const extractedFields = receiptData.extracted_fields as Record<string, unknown> | null

        setStore(
          (reviewedFields?.store as string) || receiptData.store_name || (extractedFields?.store as string) || "",
        )
        setLocation(
          (reviewedFields?.location as string) || receiptData.location || (extractedFields?.location as string) || "",
        )
        setReceiptDate(
          (reviewedFields?.receipt_date as string) ||
            receiptData.purchase_date ||
            (extractedFields?.receipt_date as string) ||
            "",
        )
        setReceiptTime(
          (reviewedFields?.receipt_time as string) ||
            receiptData.receipt_time ||
            (extractedFields?.receipt_time as string) ||
            "",
        )
        setPaymentMethod(
          (reviewedFields?.payment_method as string) ||
            receiptData.payment_method ||
            (extractedFields?.payment_method as string) ||
            "",
        )
        setTotal(
          (reviewedFields?.total as number)?.toString() ||
            receiptData.total_amount?.toString() ||
            (extractedFields?.total as number)?.toString() ||
            "",
        )
      } catch (error) {
        console.error("Failed to load receipt", error)
        toast({
          variant: "destructive",
          title: "Failed to load receipt",
          description: error instanceof Error ? error.message : "Unknown error",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchReceipt()
  }, [receiptId, supabase, toast])

  useEffect(() => {
    const fetchReviews = async () => {
      setReviewsLoading(true)
      try {
        const { data, error } = await supabase
          .from("receipt_reviews")
          .select("action, comment, created_at, reviewer:web_users(email)")
          .eq("receipt_id", receiptId)
          .order("created_at", { ascending: false })

        if (error) throw error
        setReviews(data || [])
      } catch (error) {
        console.error("Failed to load reviews", error)
      } finally {
        setReviewsLoading(false)
      }
    }

    fetchReviews()
  }, [receiptId, supabase])

  const handleReview = useCallback(
    async (approved: boolean) => {
      if (!user || userRole !== "reviewer" || !receipt) {
        toast({
          variant: "destructive",
          title: "Not authorized",
          description: "Only reviewers can process receipts.",
        })
        return
      }

      setActionLoading(true)

      const reviewedFields: ReviewedFieldUpdates = {
        store: store || null,
        location: location || null,
        receipt_date: receiptDate || null,
        receipt_time: receiptTime || null,
        payment_method: paymentMethod || null,
        total: total ? Number(total) : null,
      }

      try {
        const { data, error } = await supabase.functions.invoke("review-handler", {
          body: {
            receipt_id: receipt.id,
            reviewer_id: user.id,
            approved,
            reviewed_fields: reviewedFields,
            comment: comment || null,
            user_id: receipt.user_id,
          },
        })

        if (error) throw error
        if (!data?.success) {
          throw new Error("Unexpected response from review handler")
        }

        toast({
          title: approved ? "Receipt approved" : "Receipt rejected",
          description: approved ? "The receipt has been marked as approved." : "The receipt has been rejected.",
        })

        router.push("/dashboard/receipts")
      } catch (error) {
        console.error("Failed to submit review", error)
        toast({
          variant: "destructive",
          title: "Review failed",
          description: error instanceof Error ? error.message : "Unknown error",
        })
      } finally {
        setActionLoading(false)
      }
    },
    [
      user,
      userRole,
      receipt,
      store,
      location,
      receiptDate,
      receiptTime,
      paymentMethod,
      total,
      comment,
      supabase,
      toast,
      router,
    ],
  )

  const handleReRunOcr = useCallback(async () => {
    if (!receipt) return

    setOcrLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke("ocr-parser", {
        body: {
          receipt_id: receipt.id,
          image_url: receipt.image_url,
        },
      })

      if (error) throw error
      if (!data?.success) {
        throw new Error("OCR function returned an unexpected response")
      }

      toast({
        title: "OCR re-run started",
        description: "Refreshing receipt data...",
      })

      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (error) {
      console.error("Failed to re-run OCR", error)
      toast({
        variant: "destructive",
        title: "Unable to re-run OCR",
        description: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setOcrLoading(false)
    }
  }, [receipt, supabase, toast])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading receipt...</span>
        </div>
      </div>
    )
  }

  if (!receipt) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Receipt not found</h2>
          <Button variant="outline" className="mt-4 bg-transparent" onClick={() => router.push("/dashboard/receipts")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Receipts
          </Button>
        </div>
      </div>
    )
  }

  const extractedFields = receipt.extracted_fields as Record<string, unknown> | null
  const extractedDate = extractedFields?.date as string | null
  const extractedDateOnly = extractedDate ? extractedDate.split("T")[0] : null
  const extractedTimeOnly = extractedDate
    ? new Date(extractedDate).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })
    : null

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-[1800px] space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/receipts")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Receipt Review</h1>
              <p className="text-sm text-muted-foreground">ID: {receipt.id}</p>
            </div>
          </div>
          <Badge variant="secondary" className={statusStyles[receipt.status]}>
            {receipt.status.replace("_", " ")}
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Receipt Image</CardTitle>
                  <Button variant="outline" size="sm" onClick={handleReRunOcr} disabled={ocrLoading}>
                    {ocrLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Re-run OCR
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border bg-muted">
                  {signedImageUrl ? (
                    <img
                      src={signedImageUrl || "/placeholder.svg"}
                      alt="Receipt"
                      className="h-auto w-full object-contain"
                      onError={(e) => {
                        console.error("[v0] Failed to load image:", signedImageUrl)
                        e.currentTarget.src = "/paper-receipt.png"
                      }}
                    />
                  ) : (
                    <div className="flex h-96 items-center justify-center text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Submission Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Submitted By</p>
                    <p className="font-medium">{receipt.user_name}</p>
                    <p className="text-xs text-muted-foreground">{receipt.user_email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Submitted At</p>
                    <p className="font-medium">{new Date(receipt.created_at).toLocaleString()}</p>
                  </div>
                  {receipt.reviewer_name && (
                    <>
                      <div>
                        <p className="text-muted-foreground">Reviewed By</p>
                        <p className="font-medium">{receipt.reviewer_name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Reviewed At</p>
                        <p className="font-medium">
                          {receipt.reviewed_at ? new Date(receipt.reviewed_at).toLocaleString() : "—"}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Review History</CardTitle>
              </CardHeader>
              <CardContent>
                {reviewsLoading ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading history...
                  </div>
                ) : reviews.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No review history available</p>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review, index) => (
                      <div key={index} className="rounded-lg border bg-muted/50 p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{review.action}</p>
                            <p className="text-xs text-muted-foreground">
                              {review.reviewer?.email || "Unknown reviewer"}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(review.created_at).toLocaleString()}
                          </p>
                        </div>
                        {review.comment && <p className="mt-2 text-sm text-muted-foreground">{review.comment}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Receipt Details</CardTitle>
                <p className="text-sm text-muted-foreground">Review and correct the extracted information below</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="store" className="text-base font-semibold">
                    Store Name
                  </Label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">OCR Extracted</Label>
                      <div className="mt-1 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                        {(extractedFields?.store as string) || "—"}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="store" className="text-xs text-muted-foreground">
                        Corrected Value
                      </Label>
                      <Input
                        id="store"
                        value={store}
                        onChange={(e) => setStore(e.target.value)}
                        placeholder="Enter store name"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label htmlFor="location" className="text-base font-semibold">
                    Location
                  </Label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">OCR Extracted</Label>
                      <div className="mt-1 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                        {(extractedFields?.location as string) || "—"}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="location" className="text-xs text-muted-foreground">
                        Corrected Value
                      </Label>
                      <Input
                        id="location"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Enter location"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-base font-semibold">Date & Time</Label>
                  <div className="grid gap-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">OCR Date</Label>
                        <div className="mt-1 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                          {extractedDateOnly || "—"}
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="receiptDate" className="text-xs text-muted-foreground">
                          Corrected Date
                        </Label>
                        <Input
                          id="receiptDate"
                          type="date"
                          value={receiptDate}
                          onChange={(e) => setReceiptDate(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">OCR Time</Label>
                        <div className="mt-1 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                          {extractedTimeOnly || "—"}
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="receiptTime" className="text-xs text-muted-foreground">
                          Corrected Time
                        </Label>
                        <Input
                          id="receiptTime"
                          type="time"
                          value={receiptTime}
                          onChange={(e) => setReceiptTime(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label htmlFor="paymentMethod" className="text-base font-semibold">
                    Payment Method
                  </Label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">OCR Extracted</Label>
                      <div className="mt-1 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                        {(extractedFields?.payment_method as string) || "—"}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="paymentMethod" className="text-xs text-muted-foreground">
                        Corrected Value
                      </Label>
                      <Input
                        id="paymentMethod"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        placeholder="Enter payment method"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label htmlFor="total" className="text-base font-semibold">
                    Total Amount
                  </Label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">OCR Extracted</Label>
                      <div className="mt-1 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                        ${(extractedFields?.total as number)?.toFixed(2) || "0.00"}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="total" className="text-xs text-muted-foreground">
                        Corrected Value
                      </Label>
                      <Input
                        id="total"
                        type="number"
                        step="0.01"
                        value={total}
                        onChange={(e) => setTotal(e.target.value)}
                        placeholder="0.00"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label htmlFor="comment" className="text-base font-semibold">
                    Review Comment
                  </Label>
                  <Textarea
                    id="comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add any notes or reasons for rejection..."
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button
                size="lg"
                variant="destructive"
                className="flex-1"
                onClick={() => handleReview(false)}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <X className="mr-2 h-5 w-5" />}
                Reject Receipt
              </Button>
              <Button
                size="lg"
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => handleReview(true)}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}
                Approve Receipt
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
