"use client"

import { useState } from "react"
import { Search, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ReceiptDetailDialog } from "@/components/receipt-detail-dialog"
import type { Receipt, ReceiptStatus } from "@/lib/types"

// Mock data - in production, fetch from Supabase
const mockReceipts: Receipt[] = [
  {
    id: "1",
    user_id: "u1",
    user_email: "john@example.com",
    user_name: "John Doe",
    image_url: "/receipts/1.jpg",
    total_amount: 45.67,
    store_name: "Whole Foods",
    purchase_date: "2025-01-15",
    status: "pending",
    created_at: "2025-01-15T10:30:00Z",
  },
  {
    id: "2",
    user_id: "u2",
    user_email: "jane@example.com",
    user_name: "Jane Smith",
    image_url: "/receipts/2.jpg",
    total_amount: 123.45,
    store_name: "Trader Joes",
    purchase_date: "2025-01-14",
    status: "approved",
    reviewer_id: "r1",
    reviewer_name: "Admin User",
    reviewed_at: "2025-01-14T15:20:00Z",
    created_at: "2025-01-14T12:00:00Z",
  },
  {
    id: "3",
    user_id: "u3",
    user_email: "bob@example.com",
    user_name: "Bob Johnson",
    image_url: "/receipts/3.jpg",
    total_amount: 67.89,
    store_name: "Safeway",
    purchase_date: "2025-01-14",
    status: "approved",
    reviewer_id: "r1",
    reviewer_name: "Admin User",
    reviewed_at: "2025-01-14T14:10:00Z",
    created_at: "2025-01-14T11:30:00Z",
  },
  {
    id: "4",
    user_id: "u4",
    user_email: "alice@example.com",
    user_name: "Alice Williams",
    image_url: "/receipts/4.jpg",
    total_amount: 234.56,
    store_name: "Costco",
    purchase_date: "2025-01-13",
    status: "rejected",
    reviewer_id: "r1",
    reviewer_name: "Admin User",
    reviewed_at: "2025-01-13T16:45:00Z",
    rejection_reason: "Receipt image unclear",
    created_at: "2025-01-13T09:15:00Z",
  },
  {
    id: "5",
    user_id: "u5",
    user_email: "charlie@example.com",
    user_name: "Charlie Brown",
    image_url: "/receipts/5.jpg",
    total_amount: 89.12,
    store_name: "Target",
    purchase_date: "2025-01-13",
    status: "pending",
    created_at: "2025-01-13T08:00:00Z",
  },
  {
    id: "6",
    user_id: "u6",
    user_email: "david@example.com",
    user_name: "David Lee",
    image_url: "/receipts/6.jpg",
    total_amount: 156.78,
    store_name: "Whole Foods",
    purchase_date: "2025-01-12",
    status: "approved",
    reviewer_id: "r1",
    reviewer_name: "Admin User",
    reviewed_at: "2025-01-12T17:30:00Z",
    created_at: "2025-01-12T14:20:00Z",
  },
]

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>(mockReceipts)
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<ReceiptStatus | "all">("all")

  const handleApprove = async (receiptId: string) => {
    console.log("[v0] Approving receipt:", receiptId)
    // Placeholder for Supabase update
    setReceipts((prev) =>
      prev.map((r) =>
        r.id === receiptId
          ? {
              ...r,
              status: "approved" as const,
              reviewer_name: "Current User",
              reviewed_at: new Date().toISOString(),
            }
          : r,
      ),
    )
  }

  const handleReject = async (receiptId: string, reason: string) => {
    console.log("[v0] Rejecting receipt:", receiptId, "Reason:", reason)
    // Placeholder for Supabase update
    setReceipts((prev) =>
      prev.map((r) =>
        r.id === receiptId
          ? {
              ...r,
              status: "rejected" as const,
              reviewer_name: "Current User",
              reviewed_at: new Date().toISOString(),
              rejection_reason: reason,
            }
          : r,
      ),
    )
  }

  const filteredReceipts = receipts.filter((receipt) => {
    const matchesSearch =
      receipt.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.store_name.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "all" || receipt.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: Receipt["status"]) => {
    const variants = {
      pending: "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20",
      approved: "bg-green-500/10 text-green-600 hover:bg-green-500/20",
      rejected: "bg-red-500/10 text-red-600 hover:bg-red-500/20",
    }
    return (
      <Badge variant="secondary" className={variants[status]}>
        {status}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Receipts</h1>
        <p className="text-muted-foreground mt-1">Review and manage submitted receipts</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by user, email, or store..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ReceiptStatus | "all")}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Receipts Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Purchase Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReceipts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground h-32">
                  No receipts found
                </TableCell>
              </TableRow>
            ) : (
              filteredReceipts.map((receipt) => (
                <TableRow key={receipt.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <div>
                      <p className="font-medium">{receipt.user_name}</p>
                      <p className="text-xs text-muted-foreground">{receipt.user_email}</p>
                    </div>
                  </TableCell>
                  <TableCell>{receipt.store_name}</TableCell>
                  <TableCell className="font-medium">${receipt.total_amount.toFixed(2)}</TableCell>
                  <TableCell>{new Date(receipt.purchase_date).toLocaleDateString()}</TableCell>
                  <TableCell>{getStatusBadge(receipt.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(receipt.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
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

      {/* Receipt Detail Dialog */}
      <ReceiptDetailDialog
        receipt={selectedReceipt}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  )
}
