"use client"

import { useState } from "react"
import { Search, UserPlus, TrendingUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Referral } from "@/lib/types"

// Mock data - in production, fetch from Supabase
const mockReferrals: Referral[] = [
  {
    id: "ref1",
    referrer_id: "u1",
    referrer_email: "john@example.com",
    referee_id: "u6",
    referee_email: "david@example.com",
    status: "completed",
    reward_amount: 5.0,
    created_at: "2025-01-10T10:00:00Z",
    completed_at: "2025-01-12T14:20:00Z",
  },
  {
    id: "ref2",
    referrer_id: "u2",
    referrer_email: "jane@example.com",
    referee_id: "u7",
    referee_email: "emily@example.com",
    status: "pending",
    reward_amount: 5.0,
    created_at: "2025-01-14T09:30:00Z",
  },
  {
    id: "ref3",
    referrer_id: "u1",
    referrer_email: "john@example.com",
    referee_id: "u8",
    referee_email: "frank@example.com",
    status: "completed",
    reward_amount: 5.0,
    created_at: "2025-01-08T11:15:00Z",
    completed_at: "2025-01-10T16:45:00Z",
  },
  {
    id: "ref4",
    referrer_id: "u3",
    referrer_email: "bob@example.com",
    referee_id: "u9",
    referee_email: "grace@example.com",
    status: "pending",
    reward_amount: 5.0,
    created_at: "2025-01-15T13:20:00Z",
  },
  {
    id: "ref5",
    referrer_id: "u4",
    referrer_email: "alice@example.com",
    referee_id: "u10",
    referee_email: "henry@example.com",
    status: "completed",
    reward_amount: 5.0,
    created_at: "2025-01-05T08:00:00Z",
    completed_at: "2025-01-07T12:30:00Z",
  },
  {
    id: "ref6",
    referrer_id: "u2",
    referrer_email: "jane@example.com",
    referee_id: "u11",
    referee_email: "isabel@example.com",
    status: "completed",
    reward_amount: 5.0,
    created_at: "2025-01-03T14:45:00Z",
    completed_at: "2025-01-05T10:20:00Z",
  },
]

export default function ReferralsPage() {
  const [referrals] = useState<Referral[]>(mockReferrals)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<Referral["status"] | "all">("all")

  const filteredReferrals = referrals.filter((referral) => {
    const matchesSearch =
      referral.referrer_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      referral.referee_email.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "all" || referral.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: Referral["status"]) => {
    const variants = {
      pending: "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20",
      completed: "bg-green-500/10 text-green-600 hover:bg-green-500/20",
    }
    return (
      <Badge variant="secondary" className={variants[status]}>
        {status}
      </Badge>
    )
  }

  const totalReferrals = referrals.length
  const completedReferrals = referrals.filter((r) => r.status === "completed").length
  const pendingReferrals = referrals.filter((r) => r.status === "pending").length
  const totalRewards = referrals.filter((r) => r.status === "completed").reduce((sum, r) => sum + r.reward_amount, 0)

  // Calculate top referrers
  const referrerStats = referrals.reduce(
    (acc, ref) => {
      if (!acc[ref.referrer_email]) {
        acc[ref.referrer_email] = { total: 0, completed: 0 }
      }
      acc[ref.referrer_email].total++
      if (ref.status === "completed") {
        acc[ref.referrer_email].completed++
      }
      return acc
    },
    {} as Record<string, { total: number; completed: number }>,
  )

  const topReferrers = Object.entries(referrerStats)
    .sort((a, b) => b[1].completed - a[1].completed)
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Referrals</h1>
        <p className="text-muted-foreground mt-1">Track user referrals and rewards</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Referrals</p>
              <p className="text-2xl font-bold">{totalReferrals}</p>
            </div>
            <UserPlus className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold">{completedReferrals}</p>
            </div>
            <UserPlus className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">{pendingReferrals}</p>
            </div>
            <UserPlus className="h-8 w-8 text-yellow-600" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Rewards</p>
              <p className="text-2xl font-bold">${totalRewards.toFixed(2)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Top Referrers */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Top Referrers</h2>
        <div className="space-y-3">
          {topReferrers.map(([email, stats], index) => (
            <div key={email} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium">{email}</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.completed} completed of {stats.total} total
                  </p>
                </div>
              </div>
              <Badge variant="secondary">{stats.completed} referrals</Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by referrer or referee email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as Referral["status"] | "all")}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Referrals Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Referrer</TableHead>
              <TableHead>Referee</TableHead>
              <TableHead>Reward Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Completed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReferrals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground h-32">
                  No referrals found
                </TableCell>
              </TableRow>
            ) : (
              filteredReferrals.map((referral) => (
                <TableRow key={referral.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{referral.referrer_email}</TableCell>
                  <TableCell>{referral.referee_email}</TableCell>
                  <TableCell className="font-medium">${referral.reward_amount.toFixed(2)}</TableCell>
                  <TableCell>{getStatusBadge(referral.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(referral.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {referral.completed_at ? new Date(referral.completed_at).toLocaleDateString() : "-"}
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
