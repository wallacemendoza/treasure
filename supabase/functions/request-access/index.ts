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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Request service is not configured." }, 500);

  let body: { full_name?: unknown; username?: unknown; email?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Enter your name, username, and email." }, 400);
  }

  const fullName = String(body.full_name ?? "").trim();
  const username = String(body.username ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!fullName || fullName.length > 120 || !/^[a-zA-Z0-9_.-]{3,32}$/.test(username) || !/^\S+@\S+\.\S+$/.test(email)) {
    return json({ error: "Enter a valid name, username (3–32 letters/numbers), and email." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: existingUsername, error: usernameError } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  if (usernameError) return json({ error: "Unable to submit the request right now." }, 500);
  if (existingUsername) return json({ accepted: true });

  const { error } = await admin.from("access_requests").insert({ full_name: fullName, username, email });
  if (error && !error.message.toLowerCase().includes("duplicate key")) {
    return json({ error: "Unable to submit the request right now." }, 500);
  }

  return json({ accepted: true });
});
