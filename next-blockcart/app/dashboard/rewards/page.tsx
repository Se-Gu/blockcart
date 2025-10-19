"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Search,
  DollarSign,
  Check,
  Loader2,
  Download,
  LineChart,
} from "lucide-react"
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import type { Reward } from "@/lib/types"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { toast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"

const STATUS_VALUES: Reward["status"][] = ["pending", "approved", "paid"]

type SupabaseRewardRow = {
  id: string
  user_id: string | null
  campaign_id: string | null
  amount: number | string | null
  status?: string | null
  created_at: string
  paid_at?: string | null
  users?: {
    id: string
    email?: string | null
    full_name?: string | null
  } | null
  campaigns?: {
    id: string
    name?: string | null
    brand?: string | null
  } | null
}

const mapRewardRow = (row: SupabaseRewardRow): Reward => {
  const rawStatus =
    typeof row.status === "string"
      ? (row.status.toLowerCase() as Reward["status"])
      : null
  const status = rawStatus && STATUS_VALUES.includes(rawStatus) ? rawStatus : "pending"
  const amountNumber = typeof row.amount === "number" ? row.amount : Number(row.amount ?? 0)
  return {
    id: row.id,
    user_id: row.user_id ?? "",
    user_email: row.users?.email ?? "Unknown user",
    user_name: row.users?.full_name ?? row.users?.email ?? "Unknown user",
    campaign_id: row.campaign_id ?? "",
    campaign_name:
      row.campaigns?.name ??
      row.campaigns?.brand ??
      (row.campaign_id ? "Campaign" : "Unassigned campaign"),
    amount: Number.isFinite(amountNumber) ? amountNumber : 0,
    status,
    created_at: row.created_at,
    paid_at: row.paid_at ?? undefined,
  }
}

type RewardsOverTimeDatum = {
  date: string
  total: number
  approved: number
  paid: number
}

export default function RewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<Reward["status"] | "all">("all")
  const [selectedRewards, setSelectedRewards] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionLoadingIds, setActionLoadingIds] = useState<Set<string>>(new Set())
  const [bulkProcessing, setBulkProcessing] = useState<"approve" | "paid" | null>(null)
  const { user } = useAuth()

  const isAdmin = useMemo(() => {
    const appMetadata = (user?.app_metadata ?? {}) as Record<string, unknown>
    const userMetadata = (user?.user_metadata ?? {}) as Record<string, unknown>

    const hasAdminRole = (metadata: Record<string, unknown>) => {
      const metadataRole = metadata?.["role"]
      const metadataRoles = metadata?.["roles"]

      if (typeof metadataRole === "string" && metadataRole === "admin") {
        return true
      }

      if (
        Array.isArray(metadataRoles) &&
        metadataRoles.map((role) => `${role}`).includes("admin")
      ) {
        return true
      }

      return false
    }

    if (hasAdminRole(appMetadata) || hasAdminRole(userMetadata)) {
      return true
    }

    // Fallback: the dashboard layout currently assumes authenticated users are admins
    return true
  }, [user])

  const fetchRewards = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase
      .from("rewards")
      .select(
        `
        id,
        user_id,
        campaign_id,
        amount,
        status,
        created_at,
        paid_at,
        users:user_id (
          id,
          email,
          full_name
        ),
        campaigns:campaign_id (
          id,
          name,
          brand
        )
      `,
      )
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Failed to load rewards", error)
      setLoadError(error.message)
      setRewards([])
      toast({
        variant: "destructive",
        title: "Unable to load rewards",
        description: error.message,
      })
      setIsLoading(false)
      return
    }

    const mappedRewards = (data ?? []).map(mapRewardRow)
    setRewards(mappedRewards)
    setSelectedRewards(new Set())
    setIsLoading(false)
  }, [])

  useEffect(() => {
    void fetchRewards()
  }, [fetchRewards])

  const filteredRewards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return rewards.filter((reward) => {
      const matchesSearch =
        query.length === 0 ||
        reward.user_name.toLowerCase().includes(query) ||
        reward.user_email.toLowerCase().includes(query) ||
        reward.campaign_name.toLowerCase().includes(query)

      const matchesStatus = statusFilter === "all" || reward.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [rewards, searchQuery, statusFilter])

  const totals = useMemo(() => {
    return rewards.reduce(
      (acc, reward) => {
        acc.total += reward.amount
        if (reward.status === "pending") acc.pending += reward.amount
        if (reward.status === "approved") acc.approved += reward.amount
        if (reward.status === "paid") acc.paid += reward.amount
        return acc
      },
      { total: 0, pending: 0, approved: 0, paid: 0 },
    )
  }, [rewards])

  const rewardsOverTime = useMemo<RewardsOverTimeDatum[]>(() => {
    const totalsByDate = new Map<string, RewardsOverTimeDatum>()

    for (const reward of rewards) {
      const dateKey = new Date(reward.created_at).toISOString().split("T")[0]
      if (!totalsByDate.has(dateKey)) {
        totalsByDate.set(dateKey, {
          date: dateKey,
          total: 0,
          approved: 0,
          paid: 0,
        })
      }

      const entry = totalsByDate.get(dateKey)!
      entry.total += reward.amount
      if (reward.status === "approved") {
        entry.approved += reward.amount
      }
      if (reward.status === "paid") {
        entry.paid += reward.amount
      }
    }

    return Array.from(totalsByDate.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [rewards])

  const toggleRewardSelection = (rewardId: string) => {
    setSelectedRewards((prev) => {
      const updated = new Set(prev)
      if (updated.has(rewardId)) {
        updated.delete(rewardId)
      } else {
        updated.add(rewardId)
      }
      return updated
    })
  }

  const handleApprove = async (rewardId: string) => {
    setActionLoadingIds((prev) => {
      const updated = new Set(prev)
      updated.add(rewardId)
      return updated
    })
    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.functions.invoke("reward-handler", {
        body: { action: "approve_reward", reward_id: rewardId },
      })

      if (error || !data?.success) {
        throw new Error(error?.message ?? data?.error ?? "Unable to approve reward")
      }

      toast({
        title: "Reward approved",
        description: "Reward has been marked as approved.",
      })

      setSelectedRewards((prev) => {
        const updated = new Set(prev)
        updated.delete(rewardId)
        return updated
      })

      await fetchRewards()
    } catch (error) {
      console.error("Failed to approve reward", error)
      toast({
        variant: "destructive",
        title: "Failed to approve reward",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
      })
    } finally {
      setActionLoadingIds((prev) => {
        const updated = new Set(prev)
        updated.delete(rewardId)
        return updated
      })
    }
  }

  const handleMarkPaid = async (rewardId: string) => {
    setActionLoadingIds((prev) => {
      const updated = new Set(prev)
      updated.add(rewardId)
      return updated
    })
    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.functions.invoke("reward-handler", {
        body: { action: "mark_reward_paid", reward_id: rewardId },
      })

      if (error || !data?.success) {
        throw new Error(error?.message ?? data?.error ?? "Unable to mark reward as paid")
      }

      toast({
        title: "Reward marked as paid",
        description: "The reward has been recorded as paid.",
      })

      setSelectedRewards((prev) => {
        const updated = new Set(prev)
        updated.delete(rewardId)
        return updated
      })

      await fetchRewards()
    } catch (error) {
      console.error("Failed to mark reward paid", error)
      toast({
        variant: "destructive",
        title: "Failed to update reward",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
      })
    } finally {
      setActionLoadingIds((prev) => {
        const updated = new Set(prev)
        updated.delete(rewardId)
        return updated
      })
    }
  }

  const handleBulkApprove = async () => {
    const rewardIds = Array.from(selectedRewards)
    if (rewardIds.length === 0) return

    setBulkProcessing("approve")
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase
        .from("rewards")
        .update({ status: "approved", updated_at: new Date().toISOString() })
        .in("id", rewardIds)

      if (error) {
        throw error
      }

      toast({
        title: "Rewards approved",
        description: `${rewardIds.length} reward${rewardIds.length === 1 ? "" : "s"} marked as approved.`,
      })

      setSelectedRewards(new Set())
      await fetchRewards()
    } catch (error) {
      console.error("Failed to approve rewards", error)
      toast({
        variant: "destructive",
        title: "Failed to approve rewards",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
      })
    } finally {
      setBulkProcessing(null)
    }
  }

  const handleBulkMarkPaid = async () => {
    const rewardIds = Array.from(selectedRewards)
    if (rewardIds.length === 0) return

    setBulkProcessing("paid")
    try {
      const supabase = getSupabaseBrowserClient()
      const paidAt = new Date().toISOString()
      const { error } = await supabase
        .from("rewards")
        .update({ status: "paid", paid_at: paidAt, updated_at: paidAt })
        .in("id", rewardIds)

      if (error) {
        throw error
      }

      toast({
        title: "Rewards marked paid",
        description: `${rewardIds.length} reward${rewardIds.length === 1 ? "" : "s"} marked as paid.`,
      })

      setSelectedRewards(new Set())
      await fetchRewards()
    } catch (error) {
      console.error("Failed to mark rewards paid", error)
      toast({
        variant: "destructive",
        title: "Failed to update rewards",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
      })
    } finally {
      setBulkProcessing(null)
    }
  }

  const handleExportCsv = () => {
    if (!rewards.length) {
      toast({
        variant: "destructive",
        title: "No rewards to export",
        description: "Add rewards before exporting to CSV.",
      })
      return
    }

    const escapeValue = (value: string | number | undefined) => {
      if (value === undefined || value === null) return ""
      const stringValue = `${value}`
      if (stringValue.includes(",") || stringValue.includes("\"")) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    }

    const header = [
      "Reward ID",
      "User",
      "User Email",
      "Campaign",
      "Amount",
      "Status",
      "Created At",
      "Paid At",
    ]

    const rows = rewards.map((reward) => [
      escapeValue(reward.id),
      escapeValue(reward.user_name),
      escapeValue(reward.user_email),
      escapeValue(reward.campaign_name),
      escapeValue(reward.amount.toFixed(2)),
      escapeValue(reward.status),
      escapeValue(new Date(reward.created_at).toISOString()),
      escapeValue(reward.paid_at ? new Date(reward.paid_at).toISOString() : ""),
    ])

    const csvContent = [header, ...rows].map((row) => row.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `rewards-${new Date().toISOString().split("T")[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: "Export started",
      description: "Your CSV download has begun.",
    })
  }

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

  const isAnySelected = selectedRewards.size > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Rewards</h1>
        <p className="text-muted-foreground mt-1">Manage and process user rewards</p>
      </div>

      {loadError && (
        <div className="border border-destructive/20 bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
          {loadError}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending Rewards</p>
              <p className="text-2xl font-bold">${totals.pending.toFixed(2)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-yellow-600" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Approved Rewards</p>
              <p className="text-2xl font-bold">${totals.approved.toFixed(2)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Paid Rewards</p>
              <p className="text-2xl font-bold">${totals.paid.toFixed(2)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
        </div>
      </div>

      {rewardsOverTime.length > 0 && (
        <Card className="border border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-lg font-semibold">Rewards over time</CardTitle>
              <CardDescription>Track issued and paid rewards by day.</CardDescription>
            </div>
            <LineChart className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <ChartContainer
              className="h-[300px]"
              config={{
                total: {
                  label: "Total issued",
                  color: "hsl(var(--chart-1))",
                },
                approved: {
                  label: "Approved",
                  color: "hsl(var(--chart-2))",
                },
                paid: {
                  label: "Paid",
                  color: "hsl(var(--chart-3))",
                },
              }}
            >
              <AreaChart data={rewardsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} dy={8} fontSize={12} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
                  width={72}
                  fontSize={12}
                />
                <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--color-total)"
                  fill="var(--color-total)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                  name="Total issued"
                />
                <Area
                  type="monotone"
                  dataKey="approved"
                  stroke="var(--color-approved)"
                  fill="var(--color-approved)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                  name="Approved"
                />
                <Area
                  type="monotone"
                  dataKey="paid"
                  stroke="var(--color-paid)"
                  fill="var(--color-paid)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                  name="Paid"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Filters and Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by user, email, or campaign..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as Reward["status"] | "all")}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={!rewards.length}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          )}

          {isAnySelected && (
            <>
              <Button
                variant="outline"
                onClick={handleBulkApprove}
                disabled={bulkProcessing !== null}
              >
                {bulkProcessing === "approve" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>Approve Selected ({selectedRewards.size})</>
                )}
              </Button>
              <Button onClick={handleBulkMarkPaid} disabled={bulkProcessing !== null}>
                {bulkProcessing === "paid" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Marking Paid...
                  </>
                ) : (
                  <>Mark Paid ({selectedRewards.size})</>
                )}
              </Button>
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
                  checked={
                    filteredRewards.length > 0 &&
                    selectedRewards.size === filteredRewards.length
                  }
                  onChange={(e) => {
                    if (isLoading) return
                    if (e.target.checked) {
                      setSelectedRewards(new Set(filteredRewards.map((r) => r.id)))
                    } else {
                      setSelectedRewards(new Set())
                    }
                  }}
                  className="h-4 w-4"
                  disabled={isLoading || filteredRewards.length === 0}
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
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading rewards...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredRewards.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  No rewards found
                </TableCell>
              </TableRow>
            ) : (
              filteredRewards.map((reward) => {
                const isRowProcessing = actionLoadingIds.has(reward.id)
                return (
                  <TableRow key={reward.id} className="hover:bg-muted/50">
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedRewards.has(reward.id)}
                        onChange={() => {
                          if (isLoading || isRowProcessing) return
                          toggleRewardSelection(reward.id)
                        }}
                        className="h-4 w-4"
                        disabled={isLoading || isRowProcessing}
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApprove(reward.id)}
                            disabled={isRowProcessing}
                          >
                            {isRowProcessing ? (
                              <>
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                Approving...
                              </>
                            ) : (
                              <>Approve</>
                            )}
                          </Button>
                        )}
                        {reward.status === "approved" && (
                          <Button
                            size="sm"
                            onClick={() => handleMarkPaid(reward.id)}
                            disabled={isRowProcessing}
                          >
                            {isRowProcessing ? (
                              <>
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                Marking...
                              </>
                            ) : (
                              <>
                                <Check className="mr-1 h-3 w-3" />
                                Mark Paid
                              </>
                            )}
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
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
