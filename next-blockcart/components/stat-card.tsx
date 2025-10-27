import type { LucideIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  description?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  className?: string
}

export function StatCard({ title, value, icon: Icon, description, trend, className }: StatCardProps) {
  return (
    <Card className={cn("transition-shadow hover:shadow-md", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        {description && <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>}
        {trend && (
          <p className={cn("text-sm font-medium", trend.isPositive ? "text-success" : "text-destructive")}>
            {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}% from last month
          </p>
        )}
      </CardContent>
    </Card>
  )
}
