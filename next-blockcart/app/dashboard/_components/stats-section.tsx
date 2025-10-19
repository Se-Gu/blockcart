import { Receipt, Users, CheckCircle, XCircle, DollarSign, UserCheck, Trophy } from "lucide-react"
import { StatCard } from "@/components/stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { UserRole } from "@/lib/types"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import {
  fetchReceiptStats,
  fetchRewardStats,
  fetchTopCampaigns,
  fetchReferralBonusTotal,
  fetchActiveUsers,
  fetchTotalUsers,
} from "@/lib/supabase/dashboard"
import { cn } from "@/lib/utils"

interface StatsSectionProps {
  role: UserRole
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount)
}

export async function StatsSection({ role }: StatsSectionProps) {
  const supabase = await getSupabaseServerClient()

  const [receiptStats, rewardStats, activeUsers, topCampaigns] = await Promise.all([
    fetchReceiptStats(supabase),
    fetchRewardStats(supabase),
    fetchActiveUsers(supabase),
    fetchTopCampaigns(supabase),
  ])

  let totalUsers = 0
  let referralBonusTotal = 0

  if (role === "admin") {
    ;[totalUsers, referralBonusTotal] = await Promise.all([
      fetchTotalUsers(supabase),
      fetchReferralBonusTotal(supabase),
    ])
  }

  const approvalRate = receiptStats.total
    ? ((receiptStats.approved / receiptStats.total) * 100).toFixed(1)
    : "0.0"
  const rejectionRate = receiptStats.total
    ? ((receiptStats.rejected / receiptStats.total) * 100).toFixed(1)
    : "0.0"

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "grid gap-4 md:grid-cols-2",
          role === "admin" ? "lg:grid-cols-4" : "lg:grid-cols-3"
        )}
      >
        <StatCard
          title="Total Receipts"
          value={receiptStats.total}
          icon={Receipt}
          trend={{ value: 0, isPositive: true }}
        />
        <StatCard
          title="Pending Review"
          value={receiptStats.pending}
          icon={Receipt}
          description="Awaiting verification"
        />
        {role === "admin" && (
          <StatCard
            title="Total Users"
            value={totalUsers}
            icon={Users}
            trend={{ value: 0, isPositive: true }}
          />
        )}
        <StatCard
          title="Active Users"
          value={activeUsers}
          icon={UserCheck}
          description="Last 30 days"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Approved"
          value={receiptStats.approved}
          icon={CheckCircle}
          description={`${approvalRate}% approval rate`}
        />
        <StatCard
          title="Rejected"
          value={receiptStats.rejected}
          icon={XCircle}
          description={`${rejectionRate}% rejection rate`}
        />
        <StatCard
          title="Total Rewards"
          value={formatCurrency(rewardStats.totalAmount)}
          icon={DollarSign}
          trend={{ value: 0, isPositive: true }}
        />
        <StatCard
          title="Pending Rewards"
          value={formatCurrency(rewardStats.pendingAmount)}
          icon={DollarSign}
          description="Awaiting payment"
        />
      </div>

      <div className={cn("grid gap-4", role === "admin" && "lg:grid-cols-2")}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Trophy className="h-4 w-4" /> Top Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topCampaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No campaign performance data available.</p>
            ) : (
              topCampaigns.map((campaign) => (
                <div key={campaign.id} className="flex items-center justify-between text-sm">
                  <div className="font-medium">{campaign.name}</div>
                  <div className="text-muted-foreground">{formatCurrency(campaign.totalRewards)}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        {role === "admin" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Referral Bonuses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(referralBonusTotal)}</div>
              <p className="text-sm text-muted-foreground">Total bonuses awarded through referrals</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
