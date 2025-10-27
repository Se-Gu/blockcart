import { Suspense } from "react"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { deriveUserRoleFromMetadata, isWebUser } from "@/lib/roles"
import { StatsSection } from "./_components/stats-section"
import { StatsSectionSkeleton } from "./_components/stats-skeleton"
import { RecentReceiptsSection } from "./_components/recent-receipts-section"
import { RecentReceiptsSkeleton } from "./_components/recent-receipts-skeleton"
import { RecentActivitySection } from "./_components/recent-activity-section"
import { RecentActivitySkeleton } from "./_components/recent-activity-skeleton"

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    console.error("Failed to load authenticated user", error)
  }

  const role = isWebUser(user) ? deriveUserRoleFromMetadata(user) : "reviewer"

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-balance text-4xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-pretty text-base text-muted-foreground">Overview of your Blockcart operations</p>
      </div>

      <Suspense fallback={<StatsSectionSkeleton showAdminWidgets={role === "admin"} />}>
        <StatsSection role={role} />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<RecentReceiptsSkeleton />}>
          <RecentReceiptsSection />
        </Suspense>
        <Suspense fallback={<RecentActivitySkeleton />}>
          <RecentActivitySection />
        </Suspense>
      </div>
    </div>
  )
}
