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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const callerToken = authHeader.replace(/^Bearer\s+/i, "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!callerToken || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Your session is missing or the review service is not configured." }, 401);
  }

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${callerToken}` } },
  });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return json({ error: "Your session is invalid. Sign in again." }, 401);

  const { data: callerProfile, error: profileError } = await caller
    .from("profiles")
    .select("access_role, login_enabled")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError || !callerProfile || callerProfile.access_role !== "admin" || !callerProfile.login_enabled) {
    return json({ error: "Only enabled admin accounts can review access requests." }, 403);
  }

  let body: { request_id?: unknown; action?: unknown; member_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid review request." }, 400);
  }
  const requestId = String(body.request_id ?? "");
  const action = body.action === "approve" ? "approve" : body.action === "reject" ? "reject" : null;
  const memberId = body.member_id ? String(body.member_id) : null;
  if (!requestId || !action) return json({ error: "Choose approve or reject for a valid request." }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: accessRequest, error: requestError } = await admin
    .from("access_requests")
    .select("id, full_name, username, email, status")
    .eq("id", requestId)
    .maybeSingle();
  if (requestError || !accessRequest) return json({ error: "Access request not found." }, 404);
  if (accessRequest.status !== "pending") return json({ error: "This request has already been reviewed." }, 409);

  if (action === "reject") {
    const { error } = await admin
      .from("access_requests")
      .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: userData.user.id })
      .eq("id", requestId)
      .eq("status", "pending");
    if (error) return json({ error: "Unable to reject this request." }, 500);
    return json({ status: "rejected" });
  }

  const { data: existingProfile, error: usernameError } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", accessRequest.username)
    .maybeSingle();
  if (usernameError) return json({ error: "Unable to validate the requested username." }, 500);
  if (existingProfile) return json({ error: "That username is already in use. Reject this request and ask the applicant to submit a different username." }, 409);

  if (memberId) {
    const { data: member, error: memberError } = await admin
      .from("members")
      .select("id, profile_id")
      .eq("id", memberId)
      .maybeSingle();
    if (memberError || !member || member.profile_id) {
      return json({ error: "Choose an existing, unlinked member." }, 400);
    }
  }

  const appUrl = (Deno.env.get("APP_URL") ?? "https://treasure-orpin-kappa.vercel.app").replace(/\/$/, "");
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(accessRequest.email, {
    data: { username: accessRequest.username },
    redirectTo: `${appUrl}/update-password`,
  });
  if (inviteError || !invited.user) {
    return json({ error: inviteError?.message ?? "Unable to send the invitation email." }, 400);
  }

  const { error: profileUpdateError } = await admin
    .from("profiles")
    .update({ username: accessRequest.username, access_role: "viewer", login_enabled: true })
    .eq("id", invited.user.id);
  if (profileUpdateError) {
    return json({ error: "The invitation was sent, but profile setup failed. Contact an admin before retrying." }, 500);
  }

  if (memberId) {
    const { error: linkError } = await admin
      .from("members")
      .update({ profile_id: invited.user.id })
      .eq("id", memberId)
      .is("profile_id", null);
    if (linkError) {
      return json({ error: "The invitation was sent, but linking the member failed. Complete the link in Users." }, 500);
    }
  }

  const { error: reviewError } = await admin
    .from("access_requests")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: userData.user.id,
      created_profile_id: invited.user.id,
      linked_member_id: memberId,
    })
    .eq("id", requestId)
    .eq("status", "pending");
  if (reviewError) {
    return json({ error: "The invitation was sent, but the request status could not be updated. Check Users before retrying." }, 500);
  }

  return json({ status: "approved", email_sent: true });
});
