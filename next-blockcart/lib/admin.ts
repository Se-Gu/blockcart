import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import type { UserRole } from "@/lib/types"

export interface ReviewerAccount {
  id: string
  email: string
  fullName: string
  role: UserRole
  lastLogin?: string | null
  status: "active" | "invited"
}

export interface EnvironmentInfo {
  environment: string
  supabaseStatus: "operational" | "degraded" | "down"
  analyticsAggregatorStatus: "operational" | "degraded" | "offline"
  maintenanceMode: boolean
  lastMaintenanceAt: string
  appVersion: string
  lastAggregatorSync: string
}

export interface MaintenanceTask {
  id: string
  name: string
  description: string
  lastRunAt: string
  status: "idle" | "running" | "error"
}

export interface AdminSettingsData {
  reviewers: ReviewerAccount[]
  environment: EnvironmentInfo
  maintenanceTasks: MaintenanceTask[]
}

const FALLBACK_SETTINGS: AdminSettingsData = {
  reviewers: [
    {
      id: "rev-1",
      email: "alex.johnson@blockcart.com",
      fullName: "Alex Johnson",
      role: "admin",
      lastLogin: "2025-01-15T12:30:00Z",
      status: "active",
    },
    {
      id: "rev-2",
      email: "maria.chen@blockcart.com",
      fullName: "Maria Chen",
      role: "reviewer",
      lastLogin: "2025-01-15T09:05:00Z",
      status: "active",
    },
    {
      id: "rev-3",
      email: "samuel.green@blockcart.com",
      fullName: "Samuel Green",
      role: "reviewer",
      lastLogin: "2025-01-14T17:45:00Z",
      status: "active",
    },
  ],
  environment: {
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
    supabaseStatus: "operational",
    analyticsAggregatorStatus: process.env.NEXT_PUBLIC_ANALYTICS_AGGREGATOR_URL ? "operational" : "offline",
    maintenanceMode: false,
    lastMaintenanceAt: "2025-01-12T08:30:00Z",
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
    lastAggregatorSync: "2025-01-15T23:55:00Z",
  },
  maintenanceTasks: [
    {
      id: "refresh-analytics",
      name: "Refresh analytics cache",
      description: "Rebuilds materialized views used by the analytics dashboard",
      lastRunAt: "2025-01-15T23:00:00Z",
      status: "idle",
    },
    {
      id: "sync-reviewers",
      name: "Sync reviewer permissions",
      description: "Ensures Supabase roles match the configured reviewer permissions",
      lastRunAt: "2025-01-14T18:45:00Z",
      status: "idle",
    },
    {
      id: "purge-temp",
      name: "Purge temporary uploads",
      description: "Removes temporary receipt uploads older than 48 hours",
      lastRunAt: "2025-01-13T05:15:00Z",
      status: "idle",
    },
  ],
}

function sanitizeReviewer(entry: any, fallback: ReviewerAccount): ReviewerAccount {
  return {
    id: String(entry.id ?? fallback.id),
    email: String(entry.email ?? entry.user_email ?? fallback.email),
    fullName: String(entry.fullName ?? entry.full_name ?? entry.name ?? fallback.fullName),
    role: ((entry.role ?? fallback.role) as string).toLowerCase() === "admin" ? "admin" : "reviewer",
    lastLogin: entry.lastLogin ?? entry.last_login ?? fallback.lastLogin ?? null,
    status: (entry.status === "invited" ? "invited" : "active") as "active" | "invited",
  }
}

function sanitizeSettingsPayload(payload: any): AdminSettingsData | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const reviewersPayload = Array.isArray(payload.reviewers) ? payload.reviewers : payload.users
  const environmentPayload = payload.environment ?? payload.metadata
  const maintenancePayload = Array.isArray(payload.maintenanceTasks)
    ? payload.maintenanceTasks
    : payload.tasks

  const reviewers = Array.isArray(reviewersPayload)
    ? reviewersPayload.map((entry: any, index: number) =>
        sanitizeReviewer(entry, FALLBACK_SETTINGS.reviewers[index] ?? FALLBACK_SETTINGS.reviewers[0]),
      )
    : FALLBACK_SETTINGS.reviewers

  const environment: EnvironmentInfo = {
    environment: String(environmentPayload?.environment ?? FALLBACK_SETTINGS.environment.environment),
    supabaseStatus: (environmentPayload?.supabaseStatus ?? FALLBACK_SETTINGS.environment.supabaseStatus) as EnvironmentInfo["supabaseStatus"],
    analyticsAggregatorStatus: (environmentPayload?.analyticsAggregatorStatus ??
      FALLBACK_SETTINGS.environment.analyticsAggregatorStatus) as EnvironmentInfo["analyticsAggregatorStatus"],
    maintenanceMode: Boolean(environmentPayload?.maintenanceMode ?? FALLBACK_SETTINGS.environment.maintenanceMode),
    lastMaintenanceAt: String(environmentPayload?.lastMaintenanceAt ?? FALLBACK_SETTINGS.environment.lastMaintenanceAt),
    appVersion: String(environmentPayload?.appVersion ?? FALLBACK_SETTINGS.environment.appVersion),
    lastAggregatorSync: String(
      environmentPayload?.lastAggregatorSync ?? FALLBACK_SETTINGS.environment.lastAggregatorSync,
    ),
  }

  const maintenanceTasks: MaintenanceTask[] = Array.isArray(maintenancePayload)
    ? maintenancePayload.map((entry: any, index: number) => ({
        id: String(entry.id ?? FALLBACK_SETTINGS.maintenanceTasks[index]?.id ?? `task-${index}`),
        name: String(entry.name ?? entry.title ?? FALLBACK_SETTINGS.maintenanceTasks[index]?.name ?? "Task"),
        description: String(
          entry.description ??
            entry.detail ??
            FALLBACK_SETTINGS.maintenanceTasks[index]?.description ??
            "Maintenance task",
        ),
        lastRunAt: String(
          entry.lastRunAt ??
            entry.last_run_at ??
            entry.updated_at ??
            FALLBACK_SETTINGS.maintenanceTasks[index]?.lastRunAt ??
            new Date().toISOString(),
        ),
        status: (entry.status ?? FALLBACK_SETTINGS.maintenanceTasks[index]?.status ?? "idle") as MaintenanceTask["status"],
      }))
    : FALLBACK_SETTINGS.maintenanceTasks

  return {
    reviewers,
    environment,
    maintenanceTasks,
  }
}

async function fetchSettingsFromAggregator(): Promise<AdminSettingsData | null> {
  const aggregatorUrl = process.env.NEXT_PUBLIC_ANALYTICS_AGGREGATOR_URL
  if (!aggregatorUrl) {
    return null
  }

  try {
    const response = await fetch(`${aggregatorUrl.replace(/\/$/, "")}/admin/settings`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    })

    if (!response.ok) {
      console.warn("[admin-settings] Aggregator returned status", response.status)
      return null
    }

    const payload = await response.json()
    return sanitizeSettingsPayload(payload)
  } catch (error) {
    console.warn("[admin-settings] Failed to reach analytics aggregator", error)
    return null
  }
}

async function fetchSettingsFromSupabase(): Promise<AdminSettingsData | null> {
  try {
    const supabase = getSupabaseBrowserClient()
    const { data, error } = await supabase.functions.invoke("admin-settings")

    if (error) {
      console.warn("[admin-settings] Supabase function admin-settings returned an error", error)
      return null
    }

    return sanitizeSettingsPayload(data)
  } catch (error) {
    console.warn("[admin-settings] Unable to fetch settings from Supabase", error)
    return null
  }
}

export async function fetchAdminSettings(): Promise<AdminSettingsData> {
  const aggregator = await fetchSettingsFromAggregator()
  if (aggregator) {
    return aggregator
  }

  const supabase = await fetchSettingsFromSupabase()
  if (supabase) {
    return supabase
  }

  return FALLBACK_SETTINGS
}

async function postToAggregator(endpoint: string, body: Record<string, unknown>) {
  const aggregatorUrl = process.env.NEXT_PUBLIC_ANALYTICS_AGGREGATOR_URL
  if (!aggregatorUrl) {
    return false
  }

  try {
    const response = await fetch(`${aggregatorUrl.replace(/\/$/, "")}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      console.warn("[admin-settings] Aggregator mutation failed", response.status)
      return false
    }

    return true
  } catch (error) {
    console.warn("[admin-settings] Failed to call aggregator", error)
    return false
  }
}

export async function updateReviewerRole(userId: string, role: UserRole): Promise<boolean> {
  const aggregatorUpdated = await postToAggregator("/admin/reviewers/update-role", {
    userId,
    role,
  })

  if (aggregatorUpdated) {
    return true
  }

  try {
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.from("reviewers").update({ role }).eq("id", userId)

    if (error) {
      console.warn("[admin-settings] Failed to update reviewer role via Supabase", error)
      return false
    }

    return true
  } catch (error) {
    console.warn("[admin-settings] Unable to reach Supabase to update role", error)
    return false
  }
}

export async function inviteReviewer(email: string): Promise<boolean> {
  const aggregatorInvited = await postToAggregator("/admin/reviewers/invite", { email })
  if (aggregatorInvited) {
    return true
  }

  try {
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.functions.invoke("invite-reviewer", {
      body: { email },
    })

    if (error) {
      console.warn("[admin-settings] Supabase invite reviewer failed", error)
      return false
    }

    return true
  } catch (error) {
    console.warn("[admin-settings] Unable to send reviewer invite via Supabase", error)
    return false
  }
}

export async function setMaintenanceMode(enabled: boolean): Promise<boolean> {
  const aggregatorUpdated = await postToAggregator("/admin/maintenance/mode", {
    maintenanceMode: enabled,
  })

  if (aggregatorUpdated) {
    return true
  }

  try {
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.functions.invoke("set-maintenance-mode", {
      body: { maintenanceMode: enabled },
    })

    if (error) {
      console.warn("[admin-settings] Supabase maintenance mode toggle failed", error)
      return false
    }

    return true
  } catch (error) {
    console.warn("[admin-settings] Unable to toggle maintenance mode via Supabase", error)
    return false
  }
}

export async function triggerMaintenanceTask(taskId: string): Promise<boolean> {
  const aggregatorTriggered = await postToAggregator("/admin/maintenance/run", {
    taskId,
  })

  if (aggregatorTriggered) {
    return true
  }

  try {
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.functions.invoke("run-maintenance-task", {
      body: { taskId },
    })

    if (error) {
      console.warn("[admin-settings] Supabase maintenance task trigger failed", error)
      return false
    }

    return true
  } catch (error) {
    console.warn("[admin-settings] Unable to trigger maintenance task via Supabase", error)
    return false
  }
}
