import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
      }
    });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, {
      error: "Method not allowed"
    });
  }
  try {
    const payload = await req.json();
    const email = payload.email?.trim().toLowerCase();
    if (!email) {
      return jsonResponse(400, {
        error: "Email is required"
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(500, {
        error: "Missing Supabase configuration"
      });
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    const { data: inviteResult, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: payload.fullName ? {
        full_name: payload.fullName
      } : undefined,
      redirectTo: "http://localhost:3000/reviewer-verify"
    });
    if (inviteError) {
      throw inviteError;
    }
    const invitedUser = inviteResult.user;
    if (!invitedUser) {
      return jsonResponse(500, {
        error: "Unable to create invited user"
      });
    }
    const { error: upsertError } = await supabase.from("web_users").upsert({
      id: invitedUser.id,
      email: invitedUser.email,
      role: "reviewer",
      updated_at: new Date().toISOString()
    }, {
      onConflict: "id"
    });
    if (upsertError) {
      throw upsertError;
    }
    return jsonResponse(200, {
      success: true,
      reviewer: {
        id: invitedUser.id,
        email: invitedUser.email,
        fullName: payload.fullName ?? invitedUser.email,
        status: invitedUser.email_confirmed_at ? "active" : "invited"
      }
    });
  } catch (error) {
    console.error("[invite-reviewer]", error);
    return jsonResponse(500, {
      error: "Failed to invite reviewer"
    });
  }
});
