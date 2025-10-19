"use client"

import { useState } from "react"
import Image from "next/image"
import { X, Check } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import type { Receipt } from "@/lib/types"

interface ReceiptDetailDialogProps {
  receipt: Receipt | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApprove?: (receiptId: string) => void
  onReject?: (receiptId: string, reason: string) => void
}

export function ReceiptDetailDialog({ receipt, open, onOpenChange, onApprove, onReject }: ReceiptDetailDialogProps) {
  const [rejectionReason, setRejectionReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!receipt) return null

  const handleApprove = async () => {
    setIsSubmitting(true)
    await onApprove?.(receipt.id)
    setIsSubmitting(false)
    onOpenChange(false)
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) return
    setIsSubmitting(true)
    await onReject?.(receipt.id, rejectionReason)
    setIsSubmitting(false)
    setRejectionReason("")
    onOpenChange(false)
  }

  const getStatusBadge = (status: Receipt["status"]) => {
    const variants = {
      pending: "bg-yellow-500/10 text-yellow-600",
      approved: "bg-green-500/10 text-green-600",
      rejected: "bg-red-500/10 text-red-600",
    }
    return (
      <Badge variant="secondary" className={variants[status]}>
        {status}
      </Badge>
    )
  }

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
          {/* Receipt Image */}
          <div className="space-y-4">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-border bg-muted">
              <Image
                src={receipt.image_url || "/placeholder.svg?height=600&width=450&query=receipt"}
                alt="Receipt"
                fill
                className="object-contain"
              />
            </div>
          </div>

          {/* Receipt Information */}
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">User</Label>
                <p className="text-sm font-medium">{receipt.user_name}</p>
                <p className="text-xs text-muted-foreground">{receipt.user_email}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Store</Label>
                <p className="text-sm font-medium">{receipt.store_name}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Total Amount</Label>
                <p className="text-sm font-medium">${receipt.total_amount.toFixed(2)}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Purchase Date</Label>
                <p className="text-sm font-medium">
                  {new Date(receipt.purchase_date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>

              <div>
                <Label className="text-muted-foreground">Submitted</Label>
                <p className="text-sm font-medium">
                  {new Date(receipt.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              {receipt.reviewer_name && (
                <div>
                  <Label className="text-muted-foreground">Reviewed By</Label>
                  <p className="text-sm font-medium">{receipt.reviewer_name}</p>
                  {receipt.reviewed_at && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(receipt.reviewed_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              )}

              {receipt.rejection_reason && (
                <div>
                  <Label className="text-muted-foreground">Rejection Reason</Label>
                  <p className="text-sm font-medium text-destructive">{receipt.rejection_reason}</p>
                </div>
              )}
            </div>

            {/* Actions for pending receipts */}
            {receipt.status === "pending" && (
              <div className="space-y-4 border-t border-border pt-4">
                <div className="space-y-2">
                  <Label htmlFor="rejection-reason">Rejection Reason (optional)</Label>
                  <Textarea
                    id="rejection-reason"
                    placeholder="Enter reason for rejection..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleApprove}
                    disabled={isSubmitting}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    onClick={handleReject}
                    disabled={isSubmitting || !rejectionReason.trim()}
                    variant="destructive"
                    className="flex-1"
                  >
                    <X className="mr-2 h-4 w-4" />
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
