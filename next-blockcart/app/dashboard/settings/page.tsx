"use client"

import { useEffect, useMemo, useState } from "react"
import { ShieldCheck, AlertTriangle, MailPlus, RefreshCw } from "lucide-react"

import { useAdminGuard } from "@/hooks/use-admin-guard"
import {
  type AdminSettingsData,
  fetchAdminSettings,
  inviteReviewer,
  setMaintenanceMode,
  triggerMaintenanceTask,
  updateReviewerRole,
} from "@/lib/admin"
import type { UserRole } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
})

type BannerState = {
  type: "success" | "error"
  message: string
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 3 }).map((__, idx) => (
                <div key={idx} className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="grid gap-3 md:grid-cols-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-32" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SettingsPage() {
  const { isAdmin, loading: guardLoading } = useAdminGuard()
  const [settings, setSettings] = useState<AdminSettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [banner, setBanner] = useState<BannerState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteLoading, setInviteLoading] = useState(false)
  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null)
  const [maintenanceUpdating, setMaintenanceUpdating] = useState(false)
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const refreshSettings = async () => {
    setRefreshing(true)
    try {
      const data = await fetchAdminSettings()
      setSettings(data)
      setError(null)
      return true
    } catch (err) {
      console.error("Failed to refresh admin settings", err)
      setError("Unable to refresh settings. Displaying cached values.")
      return false
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!isAdmin || guardLoading) {
      return
    }

    let isMounted = true

    const load = async () => {
      setLoading(true)
      try {
        const data = await fetchAdminSettings()
        if (isMounted) {
          setSettings(data)
          setError(null)
        }
      } catch (err) {
        console.error("Failed to load admin settings", err)
        if (isMounted) {
          setError("Unable to load the latest settings.")
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

  const environmentBadges = useMemo(() => {
    if (!settings) {
      return null
    }

    const { supabaseStatus, analyticsAggregatorStatus } = settings.environment
    const badgeClass = (status: "operational" | "degraded" | "down" | "offline") => {
      switch (status) {
        case "operational":
          return "bg-emerald-500/10 text-emerald-600"
        case "degraded":
          return "bg-amber-500/10 text-amber-600"
        default:
          return "bg-destructive/10 text-destructive"
      }
    }

    return {
      supabase: {
        label: `Supabase · ${supabaseStatus}`,
        className: badgeClass(supabaseStatus),
      },
      aggregator: {
        label: `Analytics service · ${analyticsAggregatorStatus}`,
        className: badgeClass(
          analyticsAggregatorStatus === "offline" ? "down" : analyticsAggregatorStatus,
        ),
      },
    }
  }, [settings])

  if (guardLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
        <Spinner className="h-6 w-6" />
        <p>Verifying administrator access…</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
        <AlertTriangle className="h-5 w-5" />
        <div className="text-center text-sm">
          <p className="font-medium text-foreground">Admin access required</p>
          <p>You do not have permission to manage platform settings.</p>
        </div>
      </div>
    )
  }

  const handleRoleChange = async (userId: string, role: UserRole) => {
    setRoleUpdatingId(userId)
    try {
      await updateReviewerRole(userId, role)
      await refreshSettings()
      setBanner({ type: "success", message: "Reviewer role updated." })
    } catch (err) {
      console.error("Failed to update reviewer role", err)
      setBanner({
        type: "error",
        message: err instanceof Error ? err.message : "Unable to update reviewer role.",
      })
    } finally {
      setRoleUpdatingId(null)
    }
  }

  const handleInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!inviteEmail) {
      return
    }

    setInviteLoading(true)
    try {
      const reviewer = await inviteReviewer(inviteEmail)
      setInviteEmail("")
      setBanner({ type: "success", message: `Invitation sent to ${reviewer.email}.` })
      await refreshSettings()
    } catch (err) {
      console.error("Failed to invite reviewer", err)
      setBanner({
        type: "error",
        message: err instanceof Error ? err.message : "Unable to send reviewer invitation.",
      })
    } finally {
      setInviteLoading(false)
    }
  }

  const handleMaintenanceToggle = async (enabled: boolean) => {
    if (!settings) {
      return
    }

    setMaintenanceUpdating(true)
    try {
      const environment = await setMaintenanceMode(enabled)
      setSettings((prev) => (prev ? { ...prev, environment } : prev))
      await refreshSettings()
      setBanner({
        type: "success",
        message: enabled ? "Maintenance mode enabled." : "Maintenance mode disabled.",
      })
    } catch (err) {
      console.error("Failed to toggle maintenance mode", err)
      setBanner({
        type: "error",
        message: err instanceof Error ? err.message : "Unable to update maintenance mode.",
      })
    } finally {
      setMaintenanceUpdating(false)
    }
  }

  const handleRunTask = async (taskId: string) => {
    setRunningTaskId(taskId)
    try {
      const task = await triggerMaintenanceTask(taskId)
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              maintenanceTasks: prev.maintenanceTasks.map((existing) =>
                existing.id === task.id ? task : existing,
              ),
            }
          : prev,
      )
      await refreshSettings()
      setBanner({ type: "success", message: "Maintenance task triggered." })
    } catch (err) {
      console.error("Failed to run maintenance task", err)
      setBanner({
        type: "error",
        message: err instanceof Error ? err.message : "Unable to trigger maintenance task.",
      })
    } finally {
      setRunningTaskId(null)
    }
  }


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage reviewer access, environment metadata, and maintenance operations
        </p>
      </div>

      {banner && (
        <Alert variant={banner.type === "error" ? "destructive" : "default"}>
          {banner.type === "error" ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          <AlertTitle>{banner.type === "error" ? "Action required" : "Action completed"}</AlertTitle>
          <AlertDescription>{banner.message}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Showing cached settings</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {refreshing && !loading && (
        <Alert>
          <Spinner className="h-4 w-4" />
          <AlertTitle>Refreshing settings</AlertTitle>
          <AlertDescription>Loading the latest configuration…</AlertDescription>
        </Alert>
      )}

      {loading || !settings ? (
        <SettingsSkeleton />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Environment</CardTitle>
                <CardDescription>Live configuration and operational signals</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">App environment</p>
                    <p className="text-lg font-medium capitalize">
                      {settings.environment.environment}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">App version</p>
                    <p className="text-lg font-medium">{settings.environment.appVersion}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {environmentBadges?.supabase && (
                    <Badge variant="secondary" className={environmentBadges.supabase.className}>
                      {environmentBadges.supabase.label}
                    </Badge>
                  )}
                  {environmentBadges?.aggregator && (
                    <Badge variant="secondary" className={environmentBadges.aggregator.className}>
                      {environmentBadges.aggregator.label}
                    </Badge>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Last maintenance</p>
                    <p className="text-base font-medium">
                      {dateTimeFormatter.format(new Date(settings.environment.lastMaintenanceAt))}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Analytics sync</p>
                    <p className="text-base font-medium">
                      {dateTimeFormatter.format(new Date(settings.environment.lastAggregatorSync))}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Maintenance mode</p>
                    <p className="text-sm text-muted-foreground">
                      Temporarily restricts reviewer and shopper activity
                    </p>
                  </div>
                  <Switch
                    checked={settings.environment.maintenanceMode}
                    onCheckedChange={handleMaintenanceToggle}
                    disabled={maintenanceUpdating}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Invite reviewer</CardTitle>
                <CardDescription>Provision a new reviewer account with the default role</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleInvite} className="space-y-4">
                  <div className="space-y-1">
                    <label htmlFor="invite-email" className="text-sm font-medium text-foreground">
                      Reviewer email
                    </label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="reviewer@blockcart.com"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={inviteLoading} className="gap-2">
                    {inviteLoading ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <MailPlus className="h-4 w-4" />
                    )}
                    Send invite
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Reviewer access control</CardTitle>
              <CardDescription>Adjust reviewer roles and monitor activity</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last login</TableHead>
                    <TableHead className="text-right">Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settings.reviewers.map((reviewer) => (
                    <TableRow key={reviewer.id}>
                      <TableCell className="font-medium">{reviewer.fullName}</TableCell>
                      <TableCell>{reviewer.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            reviewer.status === "invited"
                              ? "bg-blue-500/10 text-blue-600"
                              : "bg-emerald-500/10 text-emerald-600"
                          }
                        >
                          {reviewer.status === "invited" ? "invited" : "active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {reviewer.lastLogin
                          ? dateTimeFormatter.format(new Date(reviewer.lastLogin))
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Select
                          value={reviewer.role}
                          onValueChange={(value) => handleRoleChange(reviewer.id, value as UserRole)}
                          disabled={roleUpdatingId === reviewer.id}
                        >
                          <SelectTrigger className="w-[140px] justify-between">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="reviewer">Reviewer</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Maintenance operations</CardTitle>
              <CardDescription>Execute platform tasks that support the analytics pipeline</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings.maintenanceTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex flex-col gap-3 rounded-lg border border-border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-base font-medium">{task.name}</p>
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Last run {dateTimeFormatter.format(new Date(task.lastRunAt))}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleRunTask(task.id)}
                    disabled={runningTaskId === task.id}
                  >
                    {runningTaskId === task.id ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Run now
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
