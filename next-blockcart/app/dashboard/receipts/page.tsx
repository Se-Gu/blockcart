"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
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
import type {
  Receipt,
  ReceiptStatus,
  ReviewedFieldUpdates,
  ReceiptAssignmentStatus,
  ReceiptReview,
} from "@/lib/types"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"

const PAGE_SIZE = 10

interface SupabaseUserRow {
  id: string
  email: string | null
  full_name?: string | null
}

interface SupabaseWebUserRow {
  id: string
  email: string | null
  full_name?: string | null
  role?: string | null
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
}

interface SupabaseReceiptAssignmentRow {
  id: string
  status: ReceiptAssignmentStatus
  assigned_at: string
  completed_at?: string | null
  released_at?: string | null
  reviewer_id: string
  reviewer?: SupabaseWebUserRow | null
  receipt: SupabaseReceiptRow
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

function transformReceiptRow(row: SupabaseReceiptAssignmentRow): Receipt {
  const receipt = row.receipt

  const totalNumber =
    typeof receipt.total === "number"
      ? Number(receipt.total)
      : receipt.total
      ? Number(receipt.total)
      : 0

  const reviewedFields = receipt.reviewed_fields ?? null
  const extractedFields = receipt.extracted_fields ?? null

  const assignmentReviewerName =
    row.reviewer?.full_name || row.reviewer?.email || null

  const userEmail = receipt.users?.email || null
  const userName =
    receipt.users?.full_name || userEmail || receipt.user_id || "Unknown user"

  const purchaseDate = receipt.receipt_date || receipt.created_at
  const location =
    (typeof reviewedFields === "object" && reviewedFields && "location" in reviewedFields
      ? (reviewedFields as Record<string, unknown>).location
      : undefined) ??
    receipt.location ??
    (typeof extractedFields === "object" && extractedFields && "location" in extractedFields
      ? (extractedFields as Record<string, unknown>).location
      : undefined)

  const storeName =
    (typeof reviewedFields === "object" && reviewedFields && "store" in reviewedFields
      ? (reviewedFields as Record<string, unknown>).store
      : undefined) ??
    receipt.store ??
    (typeof extractedFields === "object" && extractedFields && "store" in extractedFields
      ? (extractedFields as Record<string, unknown>).store
      : undefined)

  const paymentMethod =
    (typeof reviewedFields === "object" && reviewedFields && "payment_method" in reviewedFields
      ? (reviewedFields as Record<string, unknown>).payment_method
      : undefined) ??
    receipt.payment_method ??
    (typeof extractedFields === "object" && extractedFields && "payment_method" in extractedFields
      ? (extractedFields as Record<string, unknown>).payment_method
      : undefined)

  const receiptTime =
    (typeof reviewedFields === "object" && reviewedFields && "receipt_time" in reviewedFields
      ? (reviewedFields as Record<string, unknown>).receipt_time
      : undefined) ??
    receipt.receipt_time ??
    (typeof extractedFields === "object" && extractedFields && "receipt_time" in extractedFields
      ? (extractedFields as Record<string, unknown>).receipt_time
      : undefined)

  const reviewerEmail = row.reviewer?.email || null

  const reviewerName = assignmentReviewerName

  return {
    id: receipt.id,
    user_id: receipt.user_id,
    user_email: userEmail,
    user_name: userName,
    image_url: receipt.image_url,
    total_amount: Number.isFinite(totalNumber) ? totalNumber : 0,
    store_name: typeof storeName === "string" ? storeName : receipt.store,
    purchase_date: purchaseDate,
    status: receipt.status,
    reviewer_id: receipt.reviewed_by ?? row.reviewer_id ?? null,
    reviewer_name: typeof reviewerName === "string" ? reviewerName : null,
    reviewer_email: reviewerEmail,
    reviewed_at: receipt.updated_at ?? null,
    rejection_reason: receipt.rejection_reason ?? null,
    created_at: receipt.created_at,
    location: typeof location === "string" ? location : receipt.location ?? null,
    payment_method:
      typeof paymentMethod === "string"
        ? paymentMethod
        : receipt.payment_method ?? null,
    receipt_time:
      typeof receiptTime === "string" ? receiptTime : receipt.receipt_time ?? null,
    reviewed_fields: reviewedFields,
    extracted_fields: extractedFields,
    assignment_id: row.id,
    assignment_status: row.status,
    assigned_at: row.assigned_at,
    assignment_completed_at: row.completed_at ?? null,
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
  const { user, userRole, loading } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [receiptReviews, setReceiptReviews] = useState<ReceiptReview[] | null>(null)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<ReceiptStatus | "all">("all")
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({})
  const [reviewerOptions, setReviewerOptions] = useState<ReviewerOption[]>([])
  const [storeOptions, setStoreOptions] = useState<string[]>([])
  const [reviewerFilter, setReviewerFilter] = useState<string | "all">("all")
  const [reviewerFilterInitialized, setReviewerFilterInitialized] = useState(false)
  const [storeFilter, setStoreFilter] = useState<string | "all">("all")
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [reviewActionLoading, setReviewActionLoading] = useState<string | null>(null)
  const [ocrLoadingId, setOcrLoadingId] = useState<string | null>(null)
  const [reviewsError, setReviewsError] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const pageStart = (page - 1) * PAGE_SIZE + (receipts.length === 0 ? 0 : 1)
  const pageEnd = (page - 1) * PAGE_SIZE + receipts.length
  const paginationSummary = (() => {
    if (totalCount === 0) return "No receipts to display"
    if (receipts.length === 0) return "No receipts found for this page"
    return `Showing ${pageStart}-${pageEnd} of ${totalCount}`
  })()

  const fetchReceipts = useCallback(async () => {
    if (loading) {
      return
    }

    if (!user || userRole !== "reviewer") {
      setReceipts([])
      setTotalCount(0)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      let query = supabase
        .from("receipt_assignments")
        .select(
          `id,status,assigned_at,completed_at,released_at,reviewer_id,reviewer:web_user_profiles(id,email,full_name,role),receipt:receipts(
            id,user_id,image_url,store,total,receipt_date,status,created_at,updated_at,location,payment_method,receipt_time,reviewed_by,rejection_reason,reviewed_fields,extracted_fields,
            users:user_id(id,email,full_name)
          )`,
          { count: "exact" },
        )
        .eq("status", "assigned")
        .is("released_at", null)
        .order("created_at", { referencedTable: "receipts", ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      const reviewerIdFilter =
        reviewerFilter === "all" ? null : reviewerFilter ?? null

      if (reviewerIdFilter) {
        query = query.eq("reviewer_id", reviewerIdFilter)
      } else if (!reviewerFilterInitialized && user?.id) {
        query = query.eq("reviewer_id", user.id)
      }

      if (statusFilter !== "all") {
        query = query.eq("receipts.status", statusFilter)
      }

      if (dateRange.from) {
        query = query.gte("receipts.receipt_date", dateRange.from)
      }

      if (dateRange.to) {
        query = query.lte("receipts.receipt_date", dateRange.to)
      }

      if (storeFilter !== "all") {
        query = query.eq("receipts.store", storeFilter)
      }

      if (searchQuery.trim()) {
        const term = `%${searchQuery.trim()}%`
        query = query.or(
          `receipts.id.ilike.${term},receipts.store.ilike.${term},receipts.location.ilike.${term},receipts.rejection_reason.ilike.${term}`,
        )
      }

      const { data, error, count } = await query

      if (error) throw error

      const mapped = (data ?? []).map((row) =>
        transformReceiptRow(row as unknown as SupabaseReceiptAssignmentRow),
      )

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
  }, [
    dateRange.from,
    dateRange.to,
    loading,
    page,
    reviewerFilter,
    reviewerFilterInitialized,
    searchQuery,
    statusFilter,
    storeFilter,
    supabase,
    toast,
    user?.id,
    userRole,
  ])

  useEffect(() => {
    if (!user?.id || reviewerFilterInitialized) {
      return
    }

    setReviewerFilter(user.id)
    setReviewerFilterInitialized(true)
  }, [reviewerFilterInitialized, user?.id])

  useEffect(() => {
    if (loading || reviewerFilterInitialized || user?.id) {
      return
    }

    setReviewerFilterInitialized(true)
  }, [loading, reviewerFilterInitialized, user?.id])

  useEffect(() => {
    let isMounted = true

    const loadReviewerOptions = async () => {
      try {
        const { data, error } = await supabase
          .from("web_user_profiles")
          .select("id,email,full_name")
          .order("full_name", { ascending: true })

        if (error) throw error

        if (!isMounted) return

        const options = ((data ?? []) as SupabaseWebUserRow[]).map((item) => ({
          id: item.id,
          label: item.full_name || item.email || item.id,
        }))

        setReviewerOptions(options)
      } catch (error) {
        console.error("Failed to load reviewer options", error)
      }
    }

    loadReviewerOptions()

    return () => {
      isMounted = false
    }
  }, [supabase])

  useEffect(() => {
    let isMounted = true

    const loadStoreOptions = async () => {
      try {
        const { data, error } = await supabase
          .from("receipts")
          .select("store", { distinct: true })
          .not("store", "is", null)
          .order("store", { ascending: true })

        if (error) throw error

        if (!isMounted) return

        const stores = Array.from(
          new Set(
            ((data ?? []) as { store: string | null }[])
              .map((item) => item.store)
              .filter((store): store is string => typeof store === "string" && store.trim().length > 0),
          ),
        )

        setStoreOptions(stores)
      } catch (error) {
        console.error("Failed to load store options", error)
      }
    }

    loadStoreOptions()

    return () => {
      isMounted = false
    }
  }, [supabase])

  useEffect(() => {
    if (!reviewerFilterInitialized) {
      return
    }

    fetchReceipts()
  }, [fetchReceipts, reviewerFilterInitialized])

  useEffect(() => {
    if (loading) {
      return
    }

    if (userRole === "admin") {
      router.replace("/dashboard")
    }
  }, [loading, router, userRole])

  useEffect(() => {
    const receiptId = selectedReceipt?.id

    if (!dialogOpen || !receiptId) {
      setReceiptReviews(null)
      setReviewsError(null)
      setReviewsLoading(false)
      return
    }

    let isActive = true

    const fetchReviews = async () => {
      setReviewsLoading(true)
      setReviewsError(null)
      const { data, error } = await supabase
        .from("receipt_reviews")
        .select("action, comment, created_at, reviewer:reviewer_id(email)")
        .eq("receipt_id", receiptId)
        .order("created_at", { ascending: false })

      if (!isActive) return

      if (error) {
        console.error("Failed to fetch receipt reviews", error)
        setReviewsError("Unable to load review history.")
        setReceiptReviews([])
      } else {
        setReceiptReviews(data ?? [])
      }
      setReviewsLoading(false)
    }

    fetchReviews()

    return () => {
      isActive = false
    }
  }, [dialogOpen, selectedReceipt?.id, supabase])
  const handleReview = useCallback(
    async (receipt: Receipt, approved: boolean, payload: ReviewActionPayload) => {
      if (!user || userRole !== "reviewer") {
        toast({
          variant: "destructive",
          title: "You are not allowed to review",
          description: "Only assigned reviewers can process receipts.",
        })
        return
      }

      setReviewActionLoading(receipt.id)
      const previousReceipts = receipts

      const reviewerDisplay =
        (user.user_metadata as { full_name?: string })?.full_name || user.email || user.id

      const completionTime = new Date().toISOString()

      const optimisticReceipt: Receipt = {
        ...receipt,
        status: approved ? "approved" : "rejected",
        reviewer_id: user.id,
        reviewer_name: reviewerDisplay,
        reviewer_email: user.email ?? null,
        reviewed_at: new Date().toISOString(),
        rejection_reason: approved ? null : payload.comment || null,
        reviewed_fields: payload.reviewedFields,
        assignment_status: "completed",
        assignment_completed_at: completionTime,
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

  const reviewerSelectOptions = useMemo(
    () => [
      { label: "All Reviewers", value: "all" as const },
      ...reviewerOptions.map((option) => ({ label: option.label, value: option.id })),
    ],
    [reviewerOptions],
  )

  const storeSelectOptions = useMemo(
    () => [
      { label: "All Stores", value: "all" as const },
      ...storeOptions.map((store) => ({ label: store, value: store })),
    ],
    [storeOptions],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Receipts</h1>
        <p className="text-muted-foreground mt-1">
          Review and manage submitted receipts
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="relative flex-1 md:col-span-2 lg:col-span-2">
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
            {reviewerSelectOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={storeFilter}
          onValueChange={(value) => {
            setStoreFilter(value as string | "all")
            setPage(1)
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Filter by store" />
          </SelectTrigger>
          <SelectContent>
            {storeSelectOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="grid gap-2 md:col-span-2 lg:col-span-2">
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
            {isLoading || loading ? (
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
        reviews={receiptReviews ?? []}
        reviewsLoading={reviewsLoading}
        reviewsError={reviewsError}
      />
    </div>
  )
}
