import type { SupabaseClient } from "@supabase/supabase-js"
import type { UserRole } from "@/lib/types"

export interface ReceiptStats {
  total: number
  pending: number
  approved: number
  rejected: number
}

export interface RewardStats {
  totalAmount: number
  pendingAmount: number
}

export interface CampaignPerformance {
  id: string
  name: string
  totalRewards: number
}

export interface ActivityEvent {
  id: string
  type: "review" | "campaign"
  title: string
  description: string
  timestamp: string
}

type CountResponse = Promise<{ count: number | null; error: { message: string } | null }>

async function resolveCount(promise: CountResponse): Promise<number> {
  const { count, error } = await promise
  if (error) {
    console.error("Failed to fetch count", error)
    return 0
  }
  return count ?? 0
}

export async function fetchReceiptStats(
  supabase: SupabaseClient
): Promise<ReceiptStats> {
  const [total, pending, approved, rejected] = await Promise.all([
    resolveCount(
      supabase.from("receipts").select("id", { count: "exact", head: true }) as CountResponse
    ),
    resolveCount(
      supabase
        .from("receipts")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending") as CountResponse
    ),
    resolveCount(
      supabase
        .from("receipts")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved") as CountResponse
    ),
    resolveCount(
      supabase
        .from("receipts")
        .select("id", { count: "exact", head: true })
        .eq("status", "rejected") as CountResponse
    ),
  ])

  return {
    total,
    pending,
    approved,
    rejected,
  }
}

export async function fetchRewardStats(
  supabase: SupabaseClient
): Promise<RewardStats> {
  const [{ data: rewards, error: rewardsError }, { data: pendingRewards, error: pendingError }] =
    await Promise.all([
      supabase.from("rewards").select("amount"),
      supabase.from("rewards").select("amount, status").eq("status", "pending"),
    ])

  if (rewardsError) {
    console.error("Failed to fetch rewards", rewardsError)
  }
  if (pendingError) {
    console.error("Failed to fetch pending rewards", pendingError)
  }

  const totalAmount = (rewards ?? []).reduce((sum: number, reward: any) => {
    const amount = Number(reward.amount ?? 0)
    return sum + (Number.isFinite(amount) ? amount : 0)
  }, 0)

  const pendingAmount = (pendingRewards ?? []).reduce((sum: number, reward: any) => {
    const amount = Number(reward.amount ?? 0)
    return sum + (Number.isFinite(amount) ? amount : 0)
  }, 0)

  return {
    totalAmount,
    pendingAmount,
  }
}

export async function fetchTopCampaigns(
  supabase: SupabaseClient
): Promise<CampaignPerformance[]> {
  const { data, error } = await supabase
    .from("rewards")
    .select("campaign_id, amount, campaigns(name)")
    .not("campaign_id", "is", null)

  if (error) {
    console.error("Failed to fetch top campaigns", error)
    return []
  }

  const totals = new Map<string, { name: string; total: number }>()

  for (const reward of data ?? []) {
    const campaignId = reward.campaign_id as string | null
    if (!campaignId) continue
    const name = (reward as any).campaigns?.name ?? "Unnamed Campaign"
    const amount = Number((reward as any).amount ?? 0)
    if (!totals.has(campaignId)) {
      totals.set(campaignId, { name, total: 0 })
    }
    const entry = totals.get(campaignId)!
    entry.total += Number.isFinite(amount) ? amount : 0
  }

  return Array.from(totals.entries())
    .map(([id, value]) => ({ id, name: value.name, totalRewards: value.total }))
    .sort((a, b) => b.totalRewards - a.totalRewards)
    .slice(0, 3)
}

export async function fetchReferralBonusTotal(
  supabase: SupabaseClient
): Promise<number> {
  const { data, error } = await supabase.from("referrals").select("bonus")

  if (error) {
    console.error("Failed to fetch referral bonuses", error)
    return 0
  }

  return (data ?? []).reduce((sum: number, referral: any) => {
    const bonus = Number(referral.bonus ?? 0)
    return sum + (Number.isFinite(bonus) ? bonus : 0)
  }, 0)
}

export async function fetchActiveUsers(
  supabase: SupabaseClient
): Promise<number> {
  const since = new Date()
  since.setDate(since.getDate() - 30)

  const { count, error } = (await supabase
    .from("receipts")
    .select("user_id", { count: "exact", head: true })
    .gte("created_at", since.toISOString())
    .not("user_id", "is", null)) as { count: number | null; error: { message: string } | null }

  if (error) {
    console.error("Failed to fetch active users", error)
    return 0
  }

  return count ?? 0
}

export async function fetchTotalUsers(supabase: SupabaseClient): Promise<number> {
  const profilesResult = (await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })) as {
    count: number | null
    error: { message: string } | null
  }

  if (!profilesResult.error) {
    return profilesResult.count ?? 0
  }

  console.warn("Falling back to users table for total user count", profilesResult.error)

  const usersResult = (await supabase
    .from("users")
    .select("id", { count: "exact", head: true })) as {
    count: number | null
    error: { message: string } | null
  }

  if (usersResult.error) {
    console.error("Failed to fetch total users", usersResult.error)
    return 0
  }

  return usersResult.count ?? 0
}

export async function fetchUserRole(
  supabase: SupabaseClient,
  userId: string | undefined
): Promise<UserRole> {
  if (!userId) {
    return "reviewer"
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    console.error("Failed to fetch user role", error)
    return "reviewer"
  }

  const role = (data as { role?: string } | null)?.role
  return role === "admin" ? "admin" : "reviewer"
}

export async function fetchRecentReceipts(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("receipts")
    .select(
      "id, user_id, image_url, total, store, receipt_date, status, created_at, reviewed_by, rejection_reason, profiles(full_name, email)"
    )
    .order("created_at", { ascending: false })
    .limit(5)

  if (error) {
    console.error("Failed to fetch recent receipts", error)
    return []
  }

  return data ?? []
}

export async function fetchActivityEvents(
  supabase: SupabaseClient
): Promise<ActivityEvent[]> {
  const [reviewsResult, campaignsResult] = await Promise.all([
    supabase
      .from("receipt_reviews")
      .select("id, action, created_at, receipt_id, reviewer_id")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("campaigns")
      .select("id, name, updated_at, start_date, end_date")
      .order("updated_at", { ascending: false })
      .limit(5),
  ])

  const events: ActivityEvent[] = []

  if (!reviewsResult.error) {
    for (const review of reviewsResult.data ?? []) {
      events.push({
        id: `review-${review.id}`,
        type: "review",
        title: `Receipt ${review.action ?? "update"}`,
        description: `Reviewer ${review.reviewer_id ?? "unknown"} ${review.action ?? "updated"} receipt ${
          review.receipt_id ?? ""
        }`,
        timestamp: review.created_at,
      })
    }
  } else {
    console.error("Failed to fetch receipt review events", reviewsResult.error)
  }

  if (!campaignsResult.error) {
    for (const campaign of campaignsResult.data ?? []) {
      events.push({
        id: `campaign-${campaign.id}`,
        type: "campaign",
        title: campaign.name ?? "Campaign update",
        description: "Campaign schedule updated",
        timestamp: campaign.updated_at ?? campaign.start_date ?? new Date().toISOString(),
      })
    }
  } else {
    console.error("Failed to fetch campaign events", campaignsResult.error)
  }

  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 8)
}
