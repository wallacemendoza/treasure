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
  const usernamePattern = username.replace(/[\\%_]/g, "\\$&");
  const { data: existingUsername, error: usernameError } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", usernamePattern)
    .maybeSingle();
  if (usernameError) {
    console.error("request-access username lookup failed", usernameError.message);
    return json({ error: "Unable to validate that username right now. Please try again." }, 500);
  }
  if (existingUsername) return json({ accepted: true });

  const { data: insertedRequest, error: insertError } = await admin
    .from("access_requests")
    .insert({ full_name: fullName, username, email })
    .select("id, full_name, email, confirmation_sent_at")
    .single();

  let accessRequest = insertedRequest;
  if (insertError?.code === "23505") {
    const { data: pendingRequest, error: pendingError } = await admin
      .from("access_requests")
      .select("id, full_name, email, confirmation_sent_at")
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();
    if (pendingError) {
      console.error("request-access duplicate lookup failed", pendingError.message);
      return json({ error: "Unable to submit the request right now." }, 500);
    }
    accessRequest = pendingRequest;
  } else if (insertError) {
    console.error("request-access insert failed", insertError.message, insertError.code);
    return json({ error: "Unable to submit the request right now." }, 500);
  }

  if (!accessRequest) return json({ accepted: true, email_sent: false });

  let emailSent = Boolean(accessRequest.confirmation_sent_at);
  if (!emailSent) {
    emailSent = await sendRequestConfirmation(accessRequest.email, accessRequest.full_name);
    if (emailSent) {
      const { error: updateError } = await admin
        .from("access_requests")
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq("id", accessRequest.id)
        .is("confirmation_sent_at", null);
      if (updateError) console.error("request-access email timestamp update failed", updateError.message);
    }
  }

  return json({ accepted: true, email_sent: emailSent });
});

async function sendRequestConfirmation(email: string, fullName: string): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM");
  if (!apiKey || !from) {
    console.error("request-access confirmation email is not configured");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "We received your portal access request",
        text: `Hello ${fullName},\n\nWe received your request for access to the Balaios MC USA Chapter Portal. An administrator will review it. If approved, you will receive another email with a secure link to finish setting up your account.\n\nYou do not need to submit another request.`,
      }),
    });

    if (!response.ok) {
      console.error("request-access confirmation email failed", response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error("request-access confirmation email request failed", error instanceof Error ? error.message : "network error");
    return false;
  }
}
