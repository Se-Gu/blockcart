"use client"

import { useState } from "react"
import { Search, DollarSign, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Reward } from "@/lib/types"

// Mock data - in production, fetch from Supabase
const mockRewards: Reward[] = [
  {
    id: "r1",
    user_id: "u1",
    user_email: "john@example.com",
    user_name: "John Doe",
    campaign_id: "c1",
    campaign_name: "Summer Grocery Rewards",
    amount: 10.0,
    status: "pending",
    created_at: "2025-01-15T10:30:00Z",
  },
  {
    id: "r2",
    user_id: "u2",
    user_email: "jane@example.com",
    user_name: "Jane Smith",
    campaign_id: "c1",
    campaign_name: "Summer Grocery Rewards",
    amount: 10.0,
    status: "approved",
    created_at: "2025-01-14T12:00:00Z",
  },
  {
    id: "r3",
    user_id: "u3",
    user_email: "bob@example.com",
    user_name: "Bob Johnson",
    campaign_id: "c1",
    campaign_name: "Summer Grocery Rewards",
    amount: 10.0,
    status: "paid",
    created_at: "2025-01-14T11:30:00Z",
    paid_at: "2025-01-15T09:00:00Z",
  },
  {
    id: "r4",
    user_id: "u4",
    user_email: "alice@example.com",
    user_name: "Alice Williams",
    campaign_id: "c3",
    campaign_name: "Spring Savings",
    amount: 8.0,
    status: "paid",
    created_at: "2025-01-10T14:20:00Z",
    paid_at: "2025-01-12T10:00:00Z",
  },
  {
    id: "r5",
    user_id: "u5",
    user_email: "charlie@example.com",
    user_name: "Charlie Brown",
    campaign_id: "c1",
    campaign_name: "Summer Grocery Rewards",
    amount: 10.0,
    status: "pending",
    created_at: "2025-01-13T08:00:00Z",
  },
  {
    id: "r6",
    user_id: "u1",
    user_email: "john@example.com",
    user_name: "John Doe",
    campaign_id: "c3",
    campaign_name: "Spring Savings",
    amount: 8.0,
    status: "approved",
    created_at: "2025-01-12T16:45:00Z",
  },
]

export default function RewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>(mockRewards)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<Reward["status"] | "all">("all")
  const [selectedRewards, setSelectedRewards] = useState<Set<string>>(new Set())

  const handleApprove = async (rewardId: string) => {
    console.log("[v0] Approving reward:", rewardId)
    // Placeholder for Supabase update
    setRewards((prev) => prev.map((r) => (r.id === rewardId ? { ...r, status: "approved" as const } : r)))
  }

  const handleMarkPaid = async (rewardId: string) => {
    console.log("[v0] Marking reward as paid:", rewardId)
    // Placeholder for Supabase update
    setRewards((prev) =>
      prev.map((r) => (r.id === rewardId ? { ...r, status: "paid" as const, paid_at: new Date().toISOString() } : r)),
    )
  }

  const handleBulkApprove = async () => {
    console.log("[v0] Bulk approving rewards:", Array.from(selectedRewards))
    // Placeholder for Supabase bulk update
    setRewards((prev) => prev.map((r) => (selectedRewards.has(r.id) ? { ...r, status: "approved" as const } : r)))
    setSelectedRewards(new Set())
  }

  const handleBulkMarkPaid = async () => {
    console.log("[v0] Bulk marking rewards as paid:", Array.from(selectedRewards))
    // Placeholder for Supabase bulk update
    setRewards((prev) =>
      prev.map((r) =>
        selectedRewards.has(r.id) ? { ...r, status: "paid" as const, paid_at: new Date().toISOString() } : r,
      ),
    )
    setSelectedRewards(new Set())
  }

  const toggleRewardSelection = (rewardId: string) => {
    setSelectedRewards((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(rewardId)) {
        newSet.delete(rewardId)
      } else {
        newSet.add(rewardId)
      }
      return newSet
    })
  }

  const filteredRewards = rewards.filter((reward) => {
    const matchesSearch =
      reward.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reward.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reward.campaign_name.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "all" || reward.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: Reward["status"]) => {
    const variants = {
      pending: "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20",
      approved: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20",
      paid: "bg-green-500/10 text-green-600 hover:bg-green-500/20",
    }
    return (
      <Badge variant="secondary" className={variants[status]}>
        {status}
      </Badge>
    )
  }

  const totalPending = rewards.filter((r) => r.status === "pending").reduce((sum, r) => sum + r.amount, 0)
  const totalApproved = rewards.filter((r) => r.status === "approved").reduce((sum, r) => sum + r.amount, 0)
  const totalPaid = rewards.filter((r) => r.status === "paid").reduce((sum, r) => sum + r.amount, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Rewards</h1>
        <p className="text-muted-foreground mt-1">Manage and process user rewards</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending Rewards</p>
              <p className="text-2xl font-bold">${totalPending.toFixed(2)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-yellow-600" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Approved Rewards</p>
              <p className="text-2xl font-bold">${totalApproved.toFixed(2)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Paid Rewards</p>
              <p className="text-2xl font-bold">${totalPaid.toFixed(2)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Filters and Bulk Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by user, email, or campaign..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as Reward["status"] | "all")}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>

          {selectedRewards.size > 0 && (
            <>
              <Button variant="outline" onClick={handleBulkApprove}>
                Approve Selected ({selectedRewards.size})
              </Button>
              <Button onClick={handleBulkMarkPaid}>Mark Paid ({selectedRewards.size})</Button>
            </>
          )}
        </div>
      </div>

      {/* Rewards Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  checked={selectedRewards.size === filteredRewards.length && filteredRewards.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedRewards(new Set(filteredRewards.map((r) => r.id)))
                    } else {
                      setSelectedRewards(new Set())
                    }
                  }}
                  className="h-4 w-4"
                />
              </TableHead>
              <TableHead>User</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRewards.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground h-32">
                  No rewards found
                </TableCell>
              </TableRow>
            ) : (
              filteredRewards.map((reward) => (
                <TableRow key={reward.id} className="hover:bg-muted/50">
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedRewards.has(reward.id)}
                      onChange={() => toggleRewardSelection(reward.id)}
                      className="h-4 w-4"
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{reward.user_name}</p>
                      <p className="text-xs text-muted-foreground">{reward.user_email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{reward.campaign_name}</TableCell>
                  <TableCell className="font-medium">${reward.amount.toFixed(2)}</TableCell>
                  <TableCell>{getStatusBadge(reward.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(reward.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {reward.status === "pending" && (
                        <Button variant="ghost" size="sm" onClick={() => handleApprove(reward.id)}>
                          Approve
                        </Button>
                      )}
                      {reward.status === "approved" && (
                        <Button size="sm" onClick={() => handleMarkPaid(reward.id)}>
                          <Check className="mr-1 h-3 w-3" />
                          Mark Paid
                        </Button>
                      )}
                      {reward.status === "paid" && reward.paid_at && (
                        <span className="text-xs text-muted-foreground">
                          Paid {new Date(reward.paid_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
