"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Search, Filter, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { ReceiptDetailDialog } from "@/components/receipt-detail-dialog"
import type { Receipt, ReceiptStatus, ReviewedFieldUpdates } from "@/lib/types"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"

const PAGE_SIZE = 10

interface SupabaseUserRow {
  id: string
  email: string | null
  full_name?: string | null
}

interface SupabaseReceiptRow {
  id: string
  user_id: string | null
  image_url: string
  store: string | null
  total: number | string | null
  receipt_date: string | null
  status: ReceiptStatus
  created_at: string
  updated_at?: string | null
  location?: string | null
  payment_method?: string | null
  receipt_time?: string | null
  reviewed_by?: string | null
  rejection_reason?: string | null
  reviewed_fields?: Record<string, unknown> | null
  extracted_fields?: Record<string, unknown> | null
  users?: SupabaseUserRow | null
  reviewer?: SupabaseUserRow | null
}

interface ReviewActionPayload {
  reviewedFields: ReviewedFieldUpdates
  comment: string
}

interface ReviewerOption {
  id: string
  label: string
}

const statusStyles: Record<ReceiptStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20",
  pending_review: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20",
  approved: "bg-green-500/10 text-green-600 hover:bg-green-500/20",
  rejected: "bg-red-500/10 text-red-600 hover:bg-red-500/20",
  flagged: "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20",
  error: "bg-destructive/10 text-destructive hover:bg-destructive/20",
}

function transformReceiptRow(row: SupabaseReceiptRow): Receipt {
  const totalNumber =
    typeof row.total === "number"
      ? Number(row.total)
      : row.total
      ? Number(row.total)
      : 0

  const reviewerName =
    row.reviewer?.full_name || row.reviewer?.email || row.reviewed_by || null

  const reviewerEmail = row.reviewer?.email || null

  const userEmail = row.users?.email || null
  const userName = row.users?.full_name || userEmail || row.user_id || "Unknown user"

  const reviewedFields = row.reviewed_fields ?? null
  const extractedFields = row.extracted_fields ?? null

  const purchaseDate = row.receipt_date || row.created_at
  const location =
    (typeof reviewedFields === "object" && reviewedFields && "location" in reviewedFields
      ? (reviewedFields as Record<string, unknown>).location
      : undefined) ??
    row.location ??
    (typeof extractedFields === "object" && extractedFields && "location" in extractedFields
      ? (extractedFields as Record<string, unknown>).location
      : undefined)

  const storeName =
    (typeof reviewedFields === "object" && reviewedFields && "store" in reviewedFields
      ? (reviewedFields as Record<string, unknown>).store
      : undefined) ??
    row.store ??
    (typeof extractedFields === "object" && extractedFields && "store" in extractedFields
      ? (extractedFields as Record<string, unknown>).store
      : undefined)

  const paymentMethod =
    (typeof reviewedFields === "object" && reviewedFields && "payment_method" in reviewedFields
      ? (reviewedFields as Record<string, unknown>).payment_method
      : undefined) ??
    row.payment_method ??
    (typeof extractedFields === "object" && extractedFields && "payment_method" in extractedFields
      ? (extractedFields as Record<string, unknown>).payment_method
      : undefined)

  const receiptTime =
    (typeof reviewedFields === "object" && reviewedFields && "receipt_time" in reviewedFields
      ? (reviewedFields as Record<string, unknown>).receipt_time
      : undefined) ??
    row.receipt_time ??
    (typeof extractedFields === "object" && extractedFields && "receipt_time" in extractedFields
      ? (extractedFields as Record<string, unknown>).receipt_time
      : undefined)

  return {
    id: row.id,
    user_id: row.user_id,
    user_email: userEmail,
    user_name: userName,
    image_url: row.image_url,
    total_amount: Number.isFinite(totalNumber) ? totalNumber : 0,
    store_name: typeof storeName === "string" ? storeName : row.store,
    purchase_date: purchaseDate,
    status: row.status,
    reviewer_id: row.reviewed_by ?? null,
    reviewer_name: typeof reviewerName === "string" ? reviewerName : null,
    reviewer_email: reviewerEmail,
    reviewed_at: row.updated_at ?? null,
    rejection_reason: row.rejection_reason ?? null,
    created_at: row.created_at,
    location: typeof location === "string" ? location : row.location ?? null,
    payment_method:
      typeof paymentMethod === "string" ? paymentMethod : row.payment_method ?? null,
    receipt_time: typeof receiptTime === "string" ? receiptTime : row.receipt_time ?? null,
    reviewed_fields: reviewedFields,
    extracted_fields: extractedFields,
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value || 0)
}

function formatDate(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleDateString()
}

function formatDateTime(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

export default function ReceiptsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const { user } = useAuth()
  const { toast } = useToast()

  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<ReceiptStatus | "all">("all")
  const [reviewerFilter, setReviewerFilter] = useState<string | "all">("all")
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({})
  const [reviewerOptions, setReviewerOptions] = useState<ReviewerOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [reviewActionLoading, setReviewActionLoading] = useState<string | null>(null)
  const [ocrLoadingId, setOcrLoadingId] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const pageStart = (page - 1) * PAGE_SIZE + (receipts.length === 0 ? 0 : 1)
  const pageEnd = (page - 1) * PAGE_SIZE + receipts.length
  const paginationSummary = (() => {
    if (totalCount === 0) return "No receipts to display"
    if (receipts.length === 0) return "No receipts found for this page"
    return `Showing ${pageStart}-${pageEnd} of ${totalCount}`
  })()

  const fetchReviewers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id,email")
        .order("email", { ascending: true })

      if (error) throw error

      const options = (data ?? []).map((row) => ({
        id: row.id,
        label: row.email ?? row.id,
      }))

      setReviewerOptions(options)
    } catch (error) {
      console.error("Failed to load reviewers", error)
      toast({
        variant: "destructive",
        title: "Unable to load reviewers",
        description: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }, [supabase, toast])

  const fetchReceipts = useCallback(async () => {
    setIsLoading(true)
    try {
      let query = supabase
        .from("receipts")
        .select(
          `id,user_id,image_url,store,total,receipt_date,status,created_at,updated_at,location,payment_method,receipt_time,reviewed_by,rejection_reason,reviewed_fields,extracted_fields,users:user_id(id,email),reviewer:reviewed_by(id,email)`,
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter)
      }

      if (reviewerFilter !== "all") {
        query = query.eq("reviewed_by", reviewerFilter)
      }

      if (dateRange.from) {
        query = query.gte("receipt_date", dateRange.from)
      }

      if (dateRange.to) {
        query = query.lte("receipt_date", dateRange.to)
      }

      if (searchQuery.trim()) {
        const term = `%${searchQuery.trim()}%`
        query = query.or(
          `id.ilike.${term},store.ilike.${term},location.ilike.${term},rejection_reason.ilike.${term}`,
        )
      }

      const { data, error, count } = await query

      if (error) throw error

      const mapped = (data ?? []).map((row) => transformReceiptRow(row as SupabaseReceiptRow))

      setReceipts(mapped)
      setTotalCount(count ?? 0)
      setSelectedReceipt((prev) => {
        if (!prev) return prev
        return mapped.find((item) => item.id === prev.id) ?? prev
      })
    } catch (error) {
      console.error("Failed to load receipts", error)
      toast({
        variant: "destructive",
        title: "Unable to load receipts",
        description: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setIsLoading(false)
    }
  }, [supabase, page, statusFilter, reviewerFilter, dateRange.from, dateRange.to, searchQuery, toast])

  useEffect(() => {
    fetchReviewers()
  }, [fetchReviewers])

  useEffect(() => {
    fetchReceipts()
  }, [fetchReceipts])

  const handleReview = useCallback(
    async (receipt: Receipt, approved: boolean, payload: ReviewActionPayload) => {
      if (!user) {
        toast({
          variant: "destructive",
          title: "You must be signed in",
          description: "Sign in to review receipts.",
        })
        return
      }

      setReviewActionLoading(receipt.id)
      const previousReceipts = receipts

      const reviewerDisplay =
        (user.user_metadata as { full_name?: string })?.full_name || user.email || user.id

      const optimisticReceipt: Receipt = {
        ...receipt,
        status: approved ? "approved" : "rejected",
        reviewer_id: user.id,
        reviewer_name: reviewerDisplay,
        reviewer_email: user.email ?? null,
        reviewed_at: new Date().toISOString(),
        rejection_reason: approved ? null : payload.comment || null,
        reviewed_fields: payload.reviewedFields,
      }

      setReceipts((prev) => prev.map((item) => (item.id === receipt.id ? optimisticReceipt : item)))
      setSelectedReceipt((prev) => (prev && prev.id === receipt.id ? optimisticReceipt : prev))

      try {
        const { data, error } = await supabase.functions.invoke("review-handler", {
          body: {
            receipt_id: receipt.id,
            reviewer_id: user.id,
            approved,
            reviewed_fields: payload.reviewedFields,
            comment: payload.comment,
            user_id: receipt.user_id,
          },
        })

        if (error) throw error
        if (!data?.success) {
          throw new Error("Unexpected response from review handler")
        }

        toast({
          title: approved ? "Receipt approved" : "Receipt rejected",
          description: approved
            ? "The receipt has been marked as approved."
            : "The receipt has been rejected.",
        })

        await fetchReceipts()
        setDialogOpen(false)
        setSelectedReceipt(null)
      } catch (error) {
        console.error("Failed to submit review", error)
        setReceipts(previousReceipts)
        setSelectedReceipt(receipt)
        toast({
          variant: "destructive",
          title: "Review failed",
          description: error instanceof Error ? error.message : "Unknown error",
        })
      } finally {
        setReviewActionLoading(null)
      }
    },
    [fetchReceipts, receipts, supabase, toast, user],
  )

  const handleApprove = useCallback(
    (receipt: Receipt, payload: ReviewActionPayload) => handleReview(receipt, true, payload),
    [handleReview],
  )

  const handleReject = useCallback(
    (receipt: Receipt, payload: ReviewActionPayload) => handleReview(receipt, false, payload),
    [handleReview],
  )

  const handleReRunOcr = useCallback(
    async (receipt: Receipt) => {
      setOcrLoadingId(receipt.id)
      const previousReceipts = receipts
      const optimistic: Receipt = {
        ...receipt,
        status: "pending_review",
      }
      setReceipts((prev) => prev.map((item) => (item.id === receipt.id ? optimistic : item)))
      setSelectedReceipt((prev) => (prev && prev.id === receipt.id ? optimistic : prev))

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
          description: "We will update the receipt once new data is available.",
        })

        await fetchReceipts()
      } catch (error) {
        console.error("Failed to re-run OCR", error)
        setReceipts(previousReceipts)
        setSelectedReceipt(receipt)
        toast({
          variant: "destructive",
          title: "Unable to re-run OCR",
          description: error instanceof Error ? error.message : "Unknown error",
        })
      } finally {
        setOcrLoadingId(null)
      }
    },
    [fetchReceipts, receipts, supabase, toast],
  )

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setSelectedReceipt(null)
    }
  }

  const statusOptions: { label: string; value: ReceiptStatus | "all" }[] = [
    { label: "All Status", value: "all" },
    { label: "Pending", value: "pending" },
    { label: "Pending Review", value: "pending_review" },
    { label: "Approved", value: "approved" },
    { label: "Rejected", value: "rejected" },
    { label: "Flagged", value: "flagged" },
    { label: "Error", value: "error" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Receipts</h1>
        <p className="text-muted-foreground mt-1">
          Review and manage submitted receipts
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="relative flex-1 md:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by store, ID, or location..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(1)
            }}
            className="pl-9"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value as ReceiptStatus | "all")
            setPage(1)
          }}
        >
          <SelectTrigger className="w-full">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={reviewerFilter}
          onValueChange={(value) => {
            setReviewerFilter(value as string | "all")
            setPage(1)
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Filter by reviewer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Reviewers</SelectItem>
            {reviewerOptions.map((reviewer) => (
              <SelectItem key={reviewer.id} value={reviewer.id}>
                {reviewer.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="grid gap-2 md:col-span-2 lg:col-span-1">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="date"
              value={dateRange.from ?? ""}
              onChange={(event) => {
                const value = event.target.value || undefined
                setDateRange((prev) => ({ ...prev, from: value }))
                setPage(1)
              }}
              placeholder="From"
            />
            <Input
              type="date"
              value={dateRange.to ?? ""}
              onChange={(event) => {
                const value = event.target.value || undefined
                setDateRange((prev) => ({ ...prev, to: value }))
                setPage(1)
              }}
              placeholder="To"
            />
          </div>
          {(dateRange.from || dateRange.to) && (
            <Button
              variant="ghost"
              className="justify-start px-2 text-sm"
              onClick={() => {
                setDateRange({})
                setPage(1)
              }}
            >
              Clear date range
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receipt ID</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Purchase Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reviewer</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading receipts...
                  </div>
                </TableCell>
              </TableRow>
            ) : receipts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                  No receipts found
                </TableCell>
              </TableRow>
            ) : (
              receipts.map((receipt) => (
                <TableRow
                  key={receipt.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    setSelectedReceipt(receipt)
                    setDialogOpen(true)
                  }}
                >
                  <TableCell className="font-mono text-xs">{receipt.id}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{receipt.user_name ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">
                        {receipt.user_email ?? "No email"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{receipt.store_name ?? "—"}</TableCell>
                  <TableCell>{receipt.location ?? "—"}</TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(receipt.total_amount)}
                  </TableCell>
                  <TableCell>{formatDate(receipt.purchase_date)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusStyles[receipt.status]}>
                      {receipt.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {receipt.reviewer_name || receipt.reviewer_email || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(receipt.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedReceipt(receipt)
                        setDialogOpen(true)
                      }}
                    >
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-muted-foreground">{paginationSummary}</p>
        <Pagination className="justify-end">
          <PaginationContent>
            <PaginationPrevious
              onClick={() => page > 1 && setPage((current) => current - 1)}
              className={page === 1 ? "pointer-events-none opacity-50" : undefined}
            />
            <PaginationItem>
              <PaginationLink isActive>{page}</PaginationLink>
            </PaginationItem>
            <PaginationNext
              onClick={() => page < totalPages && setPage((current) => current + 1)}
              className={page >= totalPages ? "pointer-events-none opacity-50" : undefined}
            />
          </PaginationContent>
        </Pagination>
      </div>

      <ReceiptDetailDialog
        receipt={selectedReceipt}
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        onApprove={handleApprove}
        onReject={handleReject}
        onReRunOcr={handleReRunOcr}
        actionLoading={
          !!selectedReceipt && reviewActionLoading === selectedReceipt.id
        }
        reRunLoading={!!selectedReceipt && ocrLoadingId === selectedReceipt.id}
      />
    </div>
  )
}
