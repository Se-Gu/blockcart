import { Clock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { ActivityEvent } from "@/lib/supabase/dashboard"

interface RecentActivityPanelProps {
  events: ActivityEvent[]
}

function formatTimestamp(timestamp: string) {
  try {
    return new Date(timestamp).toLocaleString()
  } catch (error) {
    console.error("Failed to format timestamp", error)
    return timestamp
  }
}

export function RecentActivityPanel({ events }: RecentActivityPanelProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
          <p className="text-sm text-muted-foreground">Latest review and campaign updates</p>
        </div>
        <Clock className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity to display.</p>
        ) : (
          events.map((event) => (
            <div key={event.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="uppercase">
                  {event.type}
                </Badge>
                <span className="text-sm font-medium">{event.title}</span>
              </div>
              <p className="text-sm text-muted-foreground">{event.description}</p>
              <p className="text-xs text-muted-foreground">{formatTimestamp(event.timestamp)}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
