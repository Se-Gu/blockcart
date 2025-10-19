import { serve } from "https://deno.land/std/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

type TaskPayload = {
  taskId?: string
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
    const payload = (await req.json()) as TaskPayload
    const taskId = payload.taskId?.trim()

    if (!taskId) {
      return jsonResponse(400, { error: "taskId is required" })
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

    const startedAt = new Date().toISOString()

    const { data: existingTask, error: loadError } = await supabase
      .from("maintenance_tasks")
      .select("id")
      .eq("id", taskId)
      .maybeSingle()

    if (loadError) {
      throw loadError
    }

    if (!existingTask) {
      return jsonResponse(404, { error: "Task not found" })
    }

    const { error: updateError } = await supabase
      .from("maintenance_tasks")
      .update({
        status: "running",
        updated_at: startedAt,
      })
      .eq("id", taskId)

    if (updateError) {
      throw updateError
    }

    const completedAt = new Date().toISOString()

    const { data: completedTask, error: completeError } = await supabase
      .from("maintenance_tasks")
      .update({
        status: "idle",
        last_run_at: completedAt,
        updated_at: completedAt,
      })
      .eq("id", taskId)
      .select("id, name, description, status, last_run_at, updated_at")
      .single()

    if (completeError) {
      throw completeError
    }

    await supabase
      .from("maintenance_state")
      .update({ last_maintenance_at: completedAt, updated_at: completedAt })
      .eq("id", 1)

    return jsonResponse(200, {
      success: true,
      task: {
        id: completedTask.id,
        name: completedTask.name,
        description: completedTask.description,
        status: completedTask.status,
        lastRunAt: completedTask.last_run_at ?? completedAt,
      },
    })
  } catch (error) {
    console.error("[run-maintenance-task]", error)
    return jsonResponse(500, { error: "Failed to run maintenance task" })
  }
})
