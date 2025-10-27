import {
  Receipt,
  Users,
  CheckCircle,
  XCircle,
  DollarSign,
  UserCheck,
  Trophy,
  Megaphone,
} from "lucide-react"
import { StatCard } from "@/components/stat-card"
import { Button } from "@/components/ui/button"
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
  fetchActiveCampaignCount,
} from "@/lib/supabase/dashboard"
import { cn } from "@/lib/utils"
import Link from "next/link"

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

  const receiptStatsPromise = fetchReceiptStats(supabase)

  let receiptStats = await receiptStatsPromise
  let rewardStats = { totalAmount: 0, pendingAmount: 0 }
  let activeUsers = 0
  let topCampaigns: Awaited<ReturnType<typeof fetchTopCampaigns>> = []
  let activeCampaigns = 0
  let totalUsers = 0
  let referralBonusTotal = 0

  if (role === "admin") {
    ;[
      receiptStats,
      rewardStats,
      activeUsers,
      topCampaigns,
      activeCampaigns,
      totalUsers,
      referralBonusTotal,
    ] = await Promise.all([
      receiptStatsPromise,
      fetchRewardStats(supabase),
      fetchActiveUsers(supabase),
      fetchTopCampaigns(supabase),
      fetchActiveCampaignCount(supabase),
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

  // Prepare action cards array outside the render to avoid JS expression in JSX error
  const actionCards =
    role === "admin"
      ? [
          {
            title: "Manage Campaigns",
            description: "Launch new promotions or update existing campaigns.",
            href: "/dashboard/campaigns",
            buttonLabel: "Go to campaigns",
            buttonVariant: "secondary" as const,
          },
          {
            title: "Review Rewards",
            description: "Track payouts and approve pending rewards.",
            href: "/dashboard/rewards",
            buttonLabel: "Manage rewards",
            buttonVariant: "outline" as const,
          },
        ]
      : [
          {
            title: "Pending Reviews",
            description: "View and approve receipts awaiting review.",
            href: "/dashboard/receipts?status=pending_review",
            buttonLabel: "Go to pending receipts",
            buttonVariant: undefined,
          },
        ]

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "grid gap-4 md:grid-cols-2",
          role === "admin" ? "lg:grid-cols-4 xl:grid-cols-5" : "lg:grid-cols-2"
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
          <>
            <StatCard
              title="Total Users"
              value={totalUsers}
              icon={Users}
              trend={{ value: 0, isPositive: true }}
            />
            <StatCard
              title="Active Users"
              value={activeUsers}
              icon={UserCheck}
              description="Last 30 days"
            />
            <StatCard
              title="Active Campaigns"
              value={activeCampaigns}
              icon={Megaphone}
              description="Currently running"
            />
          </>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {actionCards.map((action) => (
          <Card key={action.title} className="flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="text-base font-semibold">{action.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{action.description}</p>
              <Button
                asChild
                variant={action.buttonVariant ?? "default"}
              >
                <Link href={action.href}>{action.buttonLabel}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div
        className={cn(
          "grid gap-4 md:grid-cols-2",
          role === "admin" ? "lg:grid-cols-4" : "lg:grid-cols-2"
        )}
      >
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
        {role === "admin" && (
          <>
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
          </>
        )}
      </div>

      {role === "admin" && (
        <div className="grid gap-4 lg:grid-cols-2">
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
                topCampaigns.map((campaign, index) => {
                  const participantCopy = campaign.maxParticipants
                    ? `${Math.round(
                        Math.min(Math.max((campaign.saturationRatio ?? 0) * 100, 0), 100)
                      )}% capacity`
                    : "Open";

                  return (
                    <div
                      key={campaign.id ?? `campaign-${index}`}
                      className="flex items-center justify-between gap-4 text-sm"
                    >
                      <div className="space-y-1">
                        <div className="font-medium leading-none">{campaign.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {campaign.rewardCount} payouts · {campaign.paidCount} redeemed · {participantCopy}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium leading-none">
                          {formatCurrency(campaign.totalRewards)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(campaign.paidRewards)} paid
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Referral Bonuses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(referralBonusTotal)}</div>
              <p className="text-sm text-muted-foreground">Total bonuses awarded through referrals</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
