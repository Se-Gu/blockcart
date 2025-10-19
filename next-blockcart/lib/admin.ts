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

interface AdminSettingsResponse {
  reviewers?: Array<Record<string, unknown>>
  environment?: Record<string, unknown>
  maintenanceTasks?: Array<Record<string, unknown>>
  error?: string
}

function normalizeReviewer(entry: Record<string, unknown>): ReviewerAccount {
  const id = typeof entry.id === "string" ? entry.id : String(entry.id ?? "")
  const email = typeof entry.email === "string" ? entry.email : String(entry.email ?? "")
  const fullName = typeof entry.fullName === "string" ? entry.fullName : String(entry.full_name ?? email)
  const roleValue = (typeof entry.role === "string" ? entry.role : "reviewer").toLowerCase()
  const role: UserRole = roleValue === "admin" ? "admin" : "reviewer"
  const lastLogin =
    typeof entry.lastLogin === "string"
      ? entry.lastLogin
      : typeof entry.last_login === "string"
        ? entry.last_login
        : null
  const status = entry.status === "invited" || (!entry.email_confirmed_at && entry.status !== "active") ? "invited" : "active"

  return {
    id,
    email,
    fullName,
    role,
    lastLogin,
    status,
  }
}

function normalizeEnvironment(entry: Record<string, unknown> = {}): EnvironmentInfo {
  const environment = typeof entry.environment === "string" ? entry.environment : "development"
  const supabaseStatus = (entry.supabaseStatus ?? entry.supabase_status ?? "operational") as EnvironmentInfo["supabaseStatus"]
  const analyticsStatus = (entry.analyticsAggregatorStatus ?? entry.analytics_status ?? "offline") as EnvironmentInfo["analyticsAggregatorStatus"]
  const maintenanceMode = Boolean(entry.maintenanceMode ?? entry.maintenance_mode ?? false)
  const lastMaintenanceAt =
    typeof entry.lastMaintenanceAt === "string"
      ? entry.lastMaintenanceAt
      : typeof entry.last_maintenance_at === "string"
        ? entry.last_maintenance_at
        : new Date(0).toISOString()
  const appVersion = typeof entry.appVersion === "string" ? entry.appVersion : "0.1.0"
  const lastAggregatorSync =
    typeof entry.lastAggregatorSync === "string"
      ? entry.lastAggregatorSync
      : typeof entry.last_aggregator_sync === "string"
        ? entry.last_aggregator_sync
        : new Date(0).toISOString()

  return {
    environment,
    supabaseStatus,
    analyticsAggregatorStatus: analyticsStatus,
    maintenanceMode,
    lastMaintenanceAt,
    appVersion,
    lastAggregatorSync,
  }
}

function normalizeTask(entry: Record<string, unknown>): MaintenanceTask {
  const id = typeof entry.id === "string" ? entry.id : String(entry.id ?? "task")
  const name = typeof entry.name === "string" ? entry.name : String(entry.name ?? "Maintenance task")
  const description = typeof entry.description === "string" ? entry.description : ""
  const lastRunAt =
    typeof entry.lastRunAt === "string"
      ? entry.lastRunAt
      : typeof entry.last_run_at === "string"
        ? entry.last_run_at
        : new Date(0).toISOString()
  const statusValue = typeof entry.status === "string" ? entry.status : "idle"
  const status: MaintenanceTask["status"] =
    statusValue === "running" ? "running" : statusValue === "error" ? "error" : "idle"

  return {
    id,
    name,
    description,
    lastRunAt,
    status,
  }
}

function normalizeSettings(payload: AdminSettingsResponse): AdminSettingsData {
  const reviewersPayload = Array.isArray(payload.reviewers) ? payload.reviewers : []
  const maintenancePayload = Array.isArray(payload.maintenanceTasks) ? payload.maintenanceTasks : []

  return {
    reviewers: reviewersPayload.map((entry) => normalizeReviewer(entry)).filter((reviewer) => reviewer.id && reviewer.email),
    environment: normalizeEnvironment(payload.environment),
    maintenanceTasks: maintenancePayload.map((entry) => normalizeTask(entry)),
  }
}

export async function fetchAdminSettings(): Promise<AdminSettingsData> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.functions.invoke<AdminSettingsResponse>("admin-settings")

  if (error || !data || data.error) {
    throw new Error(data?.error ?? error?.message ?? "Unable to load admin settings")
  }

  return normalizeSettings(data)
}

export async function updateReviewerRole(userId: string, role: UserRole): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase
    .from("web_users")
    .update({ role })
    .eq("id", userId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function inviteReviewer(email: string, fullName?: string): Promise<ReviewerAccount> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.functions.invoke<{
    reviewer?: Record<string, unknown>
    error?: string
  }>("invite-reviewer", {
    body: { email, fullName },
  })

  if (error || !data || data.error) {
    throw new Error(data?.error ?? error?.message ?? "Unable to invite reviewer")
  }

  if (!data.reviewer) {
    throw new Error("Reviewer payload missing from response")
  }

  return normalizeReviewer(data.reviewer)
}

export async function setMaintenanceMode(enabled: boolean): Promise<EnvironmentInfo> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.functions.invoke<{
    environment?: Record<string, unknown>
    error?: string
  }>("set-maintenance-mode", {
    body: { maintenanceMode: enabled },
  })

  if (error || !data || data.error) {
    throw new Error(data?.error ?? error?.message ?? "Unable to update maintenance mode")
  }

  return normalizeEnvironment(data.environment)
}

export async function triggerMaintenanceTask(taskId: string): Promise<MaintenanceTask> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.functions.invoke<{
    task?: Record<string, unknown>
    error?: string
  }>("run-maintenance-task", {
    body: { taskId },
  })

  if (error || !data || data.error) {
    throw new Error(data?.error ?? error?.message ?? "Unable to run maintenance task")
  }

  if (!data.task) {
    throw new Error("Maintenance task payload missing from response")
  }

  return normalizeTask(data.task)
}
