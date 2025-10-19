import { serve } from "https://deno.land/std/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

type MaintenancePayload = {
  maintenanceMode?: boolean
}

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
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "content-type",
      },
    })
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" })
  }

  try {
    const payload = (await req.json()) as MaintenancePayload
    if (typeof payload.maintenanceMode !== "boolean") {
      return jsonResponse(400, { error: "maintenanceMode must be provided" })
    }

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

    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from("maintenance_state")
      .upsert(
        {
          id: 1,
          maintenance_mode: payload.maintenanceMode,
          last_maintenance_at: payload.maintenanceMode ? now : undefined,
          updated_at: now,
        },
        { onConflict: "id" },
      )
      .select("maintenance_mode, last_maintenance_at, supabase_status, analytics_status, app_version, last_aggregator_sync")
      .single()

    if (error) {
      throw error
    }

    return jsonResponse(200, {
      success: true,
      environment: {
        maintenanceMode: data.maintenance_mode,
        lastMaintenanceAt: data.last_maintenance_at ?? now,
        supabaseStatus: data.supabase_status,
        analyticsAggregatorStatus: data.analytics_status,
        appVersion: data.app_version,
        lastAggregatorSync: data.last_aggregator_sync,
      },
    })
  } catch (error) {
    console.error("[set-maintenance-mode]", error)
    return jsonResponse(500, { error: "Failed to update maintenance mode" })
  }
})
