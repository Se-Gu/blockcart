import { serve } from "https://deno.land/std/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  })
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
        "Access-Control-Allow-Headers": "content-type",
      },
    })
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(500, { error: "Missing Supabase configuration" })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: reviewerRows, error: reviewerError } = await supabase
      .from("web_user_profiles")
      .select("id, email, full_name, role, last_login, invited_at, email_confirmed_at")
      .order("email", { ascending: true })

    if (reviewerError) {
      throw reviewerError
    }

    const { data: maintenanceState, error: maintenanceError } = await supabase
      .from("maintenance_state")
      .select("maintenance_mode, last_maintenance_at, last_aggregator_sync, supabase_status, analytics_status, app_version")
      .eq("id", 1)
      .maybeSingle()

    if (maintenanceError) {
      throw maintenanceError
    }

    const { data: maintenanceTasks, error: tasksError } = await supabase
      .from("maintenance_tasks")
      .select("id, name, description, last_run_at, status")
      .order("name", { ascending: true })

    if (tasksError) {
      throw tasksError
    }

    const fallbackTimestamp = new Date(0).toISOString()

    const environment = {
      environment: Deno.env.get("APP_ENV") ?? "development",
      supabaseStatus: (maintenanceState?.supabase_status ?? "operational") as
        | "operational"
        | "degraded"
        | "down",
      analyticsAggregatorStatus: (maintenanceState?.analytics_status ?? "offline") as
        | "operational"
        | "degraded"
        | "offline",
      maintenanceMode: Boolean(maintenanceState?.maintenance_mode ?? false),
      lastMaintenanceAt: (maintenanceState?.last_maintenance_at ?? fallbackTimestamp) as string,
      appVersion:
        maintenanceState?.app_version ?? Deno.env.get("APP_VERSION") ?? "0.1.0",
      lastAggregatorSync: (maintenanceState?.last_aggregator_sync ?? fallbackTimestamp) as string,
    }

    const reviewers = (reviewerRows ?? []).map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.full_name ?? row.email,
      role: row.role === "admin" ? "admin" : "reviewer",
      lastLogin: row.last_login,
      status: row.email_confirmed_at ? "active" : "invited",
    }))

    const tasks = (maintenanceTasks ?? []).map((task) => ({
      id: task.id,
      name: task.name,
      description: task.description ?? "",
      lastRunAt: task.last_run_at ?? fallbackTimestamp,
      status: (task.status ?? "idle") as "idle" | "running" | "error",
    }))

    return jsonResponse(200, {
      reviewers,
      environment,
      maintenanceTasks: tasks,
    })
  } catch (error) {
    console.error("[admin-settings]", error)
    return jsonResponse(500, { error: "Failed to load admin settings" })
  }
})
