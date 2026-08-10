// supabase/functions/username-login/index.ts
//
// Deployed as a Supabase Edge Function. Called by both the web and
// mobile apps instead of ever resolving a username to an email in
// the browser/app.
//
// Why this exists: v1 had a client-callable RPC that took a
// username and returned its email. That's a username-enumeration
// oracle — anyone with the anon key (which is public by design)
// could script through usernames and learn which ones exist, and
// harvest real email addresses in the process. This function moves
// that resolution entirely server-side and returns exactly one
// generic error for every failure mode (unknown username, wrong
// password, disabled login) so the client can never distinguish
// them.
//
// SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY
// are injected automatically into every Edge Function's runtime by
// Supabase — you do not need to set them as secrets yourself.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const GENERIC_ERROR = { error: 'Invalid username/email or password.' }
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let identifier = ''
  let password = ''
  try {
    const body = await req.json()
    identifier = String(body.identifier ?? '').trim()
    password = String(body.password ?? '')
  } catch {
    return json(GENERIC_ERROR, 400)
  }

  if (!identifier || !password) {
    return json(GENERIC_ERROR, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  let email = identifier

  if (!identifier.includes('@')) {
    // Service-role client: the only caller allowed to execute
    // resolve_username_email (see supabase/schema.sql — the grant
    // is service_role only, nothing else).
    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data, error } = await adminClient.rpc('resolve_username_email', {
      lookup_username: identifier,
    })

    if (error || !data) {
      // Same shape as a wrong password below — no signal about
      // whether the username existed.
      return json(GENERIC_ERROR, 401)
    }
    email = data as string
  }

  const authClient = createClient(supabaseUrl, anonKey)
  const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
    email,
    password,
  })

  if (signInError || !signInData.session) {
    return json(GENERIC_ERROR, 401)
  }

  return json({
    access_token: signInData.session.access_token,
    refresh_token: signInData.session.refresh_token,
  })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// Known limitation, flagged rather than silently left out: this
// function isn't rate-limited yet, so brute-forcing passwords
// against a *known* email is still only as protected as Supabase
// Auth's own built-in rate limiting on signInWithPassword. Before
// launch, consider adding a simple attempts table (identifier + ip
// + window) with backoff, or fronting this function with a
// platform-level rate limiter (Cloudflare, Vercel Edge Config,
// etc). Not required to unblock local development.
