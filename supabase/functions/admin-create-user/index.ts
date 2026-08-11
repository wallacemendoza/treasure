// supabase/functions/admin-create-user/index.ts
//
// Lets an admin create a brand-new login (auth user + profile) for
// a club member, and choose whether they're an admin or a viewer.
// This has to run server-side: creating another person's auth
// account requires the service_role key, which must never reach
// the browser bundle. The caller's own access token is checked
// against the profiles table before anything is created, so a
// non-admin (or an unauthenticated request) can't use this to
// mint accounts.
//
// SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY
// are injected automatically into every Edge Function's runtime —
// no manual secret configuration needed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function extractProjectRefFromSupabaseUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    return host.split(".")[0] || null;
  } catch {
    return null;
  }
}

function extractProjectRefFromJwt(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1])) as { iss?: string };
    if (!payload.iss) return null;
    const host = new URL(payload.iss).hostname;
    return host.split(".")[0] || null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: CORS_HEADERS });
    }
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const callerToken = authHeader.replace(/^Bearer\s+/i, "");
    if (!callerToken) {
      return json({ error: "Missing Authorization header." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "Function configuration is incomplete (missing Supabase env vars)." }, 500);
    }

    const functionProjectRef = extractProjectRefFromSupabaseUrl(supabaseUrl);
    const tokenProjectRef = extractProjectRefFromJwt(callerToken);
    if (functionProjectRef && tokenProjectRef && functionProjectRef !== tokenProjectRef) {
      return json(
        {
          error: `Session/project mismatch. Your app session belongs to project '${tokenProjectRef}', but this function is deployed on '${functionProjectRef}'. Update app Supabase URL/anon key to match.`,
        },
        401,
      );
    }

    // Identify the caller using their own token against the anon
    // client — this never uses the service role to impersonate them.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${callerToken}` } },
    });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerData?.user) {
      return json({ error: callerError?.message ?? "Invalid session." }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check the caller is actually an admin — service role bypasses
    // RLS, so this is a real permission check, not a UI-only one.
    const { data: callerProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("access_role, login_enabled")
      .eq("id", callerData.user.id)
      .maybeSingle();

    if (profileError || !callerProfile || callerProfile.access_role !== "admin") {
      return json(
        {
          error: profileError
            ? profileError.message
            : !callerProfile
              ? "No profile row found for the signed-in user."
              : `Only admins can create users (current role: ${callerProfile.access_role}).`,
        },
        403,
      );
    }

    let body: {
      username?: string;
      email?: string;
      password?: string;
      access_role?: string;
      full_name?: string;
      member_rank?: string;
      create_member?: boolean;
    };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid request body." }, 400);
    }

    const username = String(body.username ?? "").trim();
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");
    const accessRole = body.access_role === "admin" ? "admin" : "viewer";
    const fullName = String(body.full_name ?? "").trim();
    const memberRank = body.member_rank === "prospect" || body.member_rank === "full_patch" ? body.member_rank : "support";
    const createMember = body.create_member !== false;

    if (!username || !email || password.length < 8) {
      return json({ error: "Username, email, and an 8+ character password are required." }, 400);
    }

    if (createMember && !fullName) {
      return json({ error: "Full name is required when creating a member roster entry." }, 400);
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
    });

    if (createError || !created?.user) {
      return json({ error: createError?.message ?? "Unable to create the user." }, 400);
    }

    // The on_auth_user_created trigger already inserted a default
    // profiles row (viewer, username derived from email). Set the
    // real username and requested role now that we know them.
    const { error: updateError } = await adminClient
      .from("profiles")
      .update({ username, access_role: accessRole })
      .eq("id", created.user.id);

    if (updateError) {
      return json({ error: `User created, but profile setup failed: ${updateError.message}` }, 500);
    }

    if (createMember) {
      const { error: memberError } = await adminClient.from("members").insert({
        profile_id: created.user.id,
        full_name: fullName,
        email,
        member_rank: memberRank,
        active: true,
      });

      if (memberError) {
        return json({ error: `User created, but member setup failed: ${memberError.message}` }, 500);
      }
    }

    return json({ id: created.user.id, username, email, access_role: accessRole, member_created: createMember });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected function failure.";
    return json({ error: message }, 500);
  }
});
