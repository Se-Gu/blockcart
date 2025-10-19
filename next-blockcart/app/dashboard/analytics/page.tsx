"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/stat-card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useAdminGuard } from "@/hooks/use-admin-guard"
import {
  type AnalyticsDashboardData,
  loadAnalyticsDashboard,
} from "@/lib/analytics"
import { CheckCircle, Clock, Gift, Receipt, AlertTriangle } from "lucide-react"

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
})

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="h-full">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[320px] w-full" />
          </CardContent>
        </Card>
        <Card className="h-full">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[320px] w-full" />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="grid gap-3 md:grid-cols-[2fr_1fr]">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AnalyticsPage() {
  const { isAdmin, loading: guardLoading } = useAdminGuard()
  const [analytics, setAnalytics] = useState<AnalyticsDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin || guardLoading) {
      return
    }

    let isMounted = true

    const load = async () => {
      setLoading(true)
      try {
        const data = await loadAnalyticsDashboard()
        if (isMounted) {
          setAnalytics(data)
          setError(null)
        }
      } catch (err) {
        console.error("Failed to load analytics dashboard", err)
        if (isMounted) {
          setError("Unable to load analytics data. Showing the last known snapshot.")
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [guardLoading, isAdmin])

  const metrics = useMemo(() => {
    if (!analytics) {
      return []
    }

    return [
      {
        title: "Total receipts",
        value: analytics.overview.totalReceipts.toLocaleString(),
        icon: Receipt,
        description: `${analytics.overview.pendingReceipts.toLocaleString()} awaiting review`,
      },
      {
        title: "Approval rate",
        value: percentFormatter.format(analytics.overview.approvalRate),
        icon: CheckCircle,
        description: "Across all verified submissions",
      },
      {
        title: "Avg. processing time",
        value: `${analytics.overview.avgProcessingTimeHours.toFixed(1)} hrs`,
        icon: Clock,
        description: "Submission → reviewer decision",
      },
      {
        title: "Rewards issued",
        value: currencyFormatter.format(analytics.overview.rewardsIssued),
        icon: Gift,
        description: "Total value delivered to shoppers",
      },
    ]
  }, [analytics])

  if (guardLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
        <Spinner className="h-6 w-6" />
        <p>Verifying administrator access…</p>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Detailed insight into receipt throughput, reviewer performance, and reward distribution
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Analytics snapshot only</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading || !analytics ? (
        <AnalyticsSkeleton />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric) => (
              <StatCard key={metric.title} {...metric} />
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Receipt lifecycle</CardTitle>
                <CardDescription>Submissions and outcomes over the last 7 active days</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <ChartContainer
                  config={{
                    submitted: { label: "Submitted", color: "hsl(var(--chart-1))" },
                    approved: { label: "Approved", color: "hsl(var(--chart-2))" },
                    rejected: { label: "Rejected", color: "hsl(var(--chart-3))" },
                  }}
                >
                  <AreaChart data={analytics.receiptTrends}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} dy={8} />
                    <YAxis tickLine={false} axisLine={false} width={40} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Area
                      type="monotone"
                      dataKey="submitted"
                      stroke="var(--color-submitted)"
                      fill="var(--color-submitted)"
                      fillOpacity={0.16}
                    />
                    <Area
                      type="monotone"
                      dataKey="approved"
                      stroke="var(--color-approved)"
                      fill="var(--color-approved)"
                      fillOpacity={0.16}
                    />
                    <Area
                      type="monotone"
                      dataKey="rejected"
                      stroke="var(--color-rejected)"
                      fill="var(--color-rejected)"
                      fillOpacity={0.16}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rewards mix</CardTitle>
                <CardDescription>Where shoppers are redeeming their savings</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <ChartContainer
                  config={{
                    value: {
                      label: "Reward value",
                      color: "hsl(var(--chart-5))",
                    },
                  }}
                >
                  <BarChart data={analytics.rewardBreakdown}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} dy={8} />
                    <YAxis tickLine={false} axisLine={false} width={40} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" fill="var(--color-value)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Reviewer performance</CardTitle>
              <CardDescription>Throughput and quality metrics per reviewer for the current month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reviewer</TableHead>
                    <TableHead className="text-right">Receipts processed</TableHead>
                    <TableHead className="text-right">Approval rate</TableHead>
                    <TableHead className="text-right">Avg. review time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.reviewerPerformance.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.reviewer}</TableCell>
                      <TableCell className="text-right">{row.reviewed.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {percentFormatter.format(row.approvalRate)}
                          </div>
                          <Progress value={Math.min(100, Math.round(row.approvalRate * 100))} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {row.avgReviewTimeMinutes.toFixed(1)} min
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
