import { getSupabaseServerClient } from "@/lib/supabase/server"
import { fetchActivityEvents } from "@/lib/supabase/dashboard"
import { RecentActivityPanel } from "@/components/recent-activity-panel"

export async function RecentActivitySection() {
  const supabase = await getSupabaseServerClient()
  const events = await fetchActivityEvents(supabase)
  return <RecentActivityPanel events={events} />
}
