import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export interface AnalyticsOverview {
  totalReceipts: number
  approvalRate: number
  avgProcessingTimeHours: number
  rewardsIssued: number
  pendingReceipts: number
}

export interface ReceiptTrendPoint {
  date: string
  submitted: number
  approved: number
  rejected: number
}

export interface RewardBreakdownItem {
  label: string
  value: number
}

export interface ReviewerPerformanceRow {
  id: string
  reviewer: string
  reviewed: number
  approvalRate: number
  avgReviewTimeMinutes: number
}

export interface AnalyticsDashboardData {
  overview: AnalyticsOverview
  receiptTrends: ReceiptTrendPoint[]
  rewardBreakdown: RewardBreakdownItem[]
  reviewerPerformance: ReviewerPerformanceRow[]
}

const FALLBACK_ANALYTICS: AnalyticsDashboardData = {
  overview: {
    totalReceipts: 0,
    approvalRate: 0,
    avgProcessingTimeHours: 0,
    rewardsIssued: 0,
    pendingReceipts: 0,
  },
  receiptTrends: [],
  rewardBreakdown: [],
  reviewerPerformance: [],
}

function parseNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseArray<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback
}

function normalizeAnalyticsPayload(payload: any): AnalyticsDashboardData | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const overviewPayload =
    (payload.overview as Record<string, unknown> | undefined) ||
    (payload.metrics as Record<string, unknown> | undefined)
  const trendsPayload =
    (payload.receiptTrends as unknown[]) ||
    (payload.trends as unknown[]) ||
    (payload.submission_trends as unknown[])
  const rewardsPayload =
    (payload.rewardBreakdown as unknown[]) ||
    (payload.rewards as unknown[])
  const reviewersPayload =
    (payload.reviewerPerformance as unknown[]) ||
    (payload.reviewers as unknown[])

  if (!overviewPayload) {
    return null
  }

  const overview: AnalyticsOverview = {
    totalReceipts: parseNumber(
      overviewPayload.totalReceipts ?? overviewPayload.total_receipts,
      FALLBACK_ANALYTICS.overview.totalReceipts,
    ),
    approvalRate:
      parseNumber(
        overviewPayload.approvalRate ?? overviewPayload.approval_rate,
        FALLBACK_ANALYTICS.overview.approvalRate,
      ) || FALLBACK_ANALYTICS.overview.approvalRate,
    avgProcessingTimeHours: parseNumber(
      overviewPayload.avgProcessingTimeHours ??
        overviewPayload.avg_processing_time_hours ??
        overviewPayload.averageProcessingTime ??
        overviewPayload.average_processing_time,
      FALLBACK_ANALYTICS.overview.avgProcessingTimeHours,
    ),
    rewardsIssued: parseNumber(
      overviewPayload.rewardsIssued ?? overviewPayload.totalRewards ?? overviewPayload.rewards_issued,
      FALLBACK_ANALYTICS.overview.rewardsIssued,
    ),
    pendingReceipts: parseNumber(
      overviewPayload.pendingReceipts ?? overviewPayload.pending_receipts,
      FALLBACK_ANALYTICS.overview.pendingReceipts,
    ),
  }

  const receiptTrends: ReceiptTrendPoint[] = parseArray(trendsPayload, []).map(
    (entry: any) => ({
      date: String(entry.date ?? entry.day ?? entry.label ?? ""),
      submitted: parseNumber(entry.submitted ?? entry.total ?? entry.count, 0),
      approved: parseNumber(entry.approved ?? entry.success ?? entry.accepted, 0),
      rejected: parseNumber(entry.rejected ?? entry.failed ?? entry.declined, 0),
    }),
  )

  const rewardBreakdown: RewardBreakdownItem[] = parseArray(rewardsPayload, []).map((entry: any) => ({
    label: String(entry.label ?? entry.category ?? entry.segment ?? "Unknown"),
    value: parseNumber(entry.value ?? entry.total ?? entry.amount, 0),
  }))

  const reviewerPerformance: ReviewerPerformanceRow[] = parseArray(reviewersPayload, []).map((entry: any, index) => ({
    id: String(entry.id ?? entry.reviewer_id ?? `reviewer-${index}`),
    reviewer: String(entry.reviewer ?? entry.name ?? entry.display_name ?? "Reviewer"),
    reviewed: parseNumber(entry.reviewed ?? entry.total ?? entry.count, 0),
    approvalRate:
      parseNumber(entry.approvalRate ?? entry.approval_rate ?? entry.acceptanceRate, 0) ||
      0,
    avgReviewTimeMinutes: parseNumber(
      entry.avgReviewTimeMinutes ?? entry.averageReviewTime ?? entry.avg_review_time_minutes,
      0,
    ),
  }))

  return {
    overview,
    receiptTrends,
    rewardBreakdown,
    reviewerPerformance,
  }
}

async function fetchFromAggregator(): Promise<AnalyticsDashboardData | null> {
  const aggregatorUrl = process.env.NEXT_PUBLIC_ANALYTICS_AGGREGATOR_URL
  if (!aggregatorUrl) {
    return null
  }

  try {
    const response = await fetch(`${aggregatorUrl.replace(/\/$/, "")}/dashboard`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    })

    if (!response.ok) {
      console.warn("[analytics] Aggregator responded with status", response.status)
      return null
    }

    const payload = await response.json()
    return normalizeAnalyticsPayload(payload)
  } catch (error) {
    console.warn("[analytics] Failed to reach analytics aggregator", error)
    return null
  }
}

async function fetchFromSupabase(): Promise<AnalyticsDashboardData | null> {
  try {
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase.functions.invoke("analytics-dashboard")

    if (error) {
      console.warn("[analytics] Supabase function analytics-dashboard returned an error", error)
      return null
    }

    return normalizeAnalyticsPayload(data)
  } catch (error) {
    console.warn("[analytics] Unable to fetch analytics data from Supabase", error)
    return null
  }
}

export async function loadAnalyticsDashboard(): Promise<AnalyticsDashboardData> {
  const supabaseData = await fetchFromSupabase()
  if (supabaseData) {
    return supabaseData
  }

  const aggregatorData = await fetchFromAggregator()
  if (aggregatorData) {
    return aggregatorData
  }

  throw new Error("Analytics service is unavailable")
}
