# Balaios MC — Treasure (monorepo)

React (Vite) web app + React Native (Expo) mobile app + shared Supabase
backend, sharing types, validation, and business logic through
`packages/shared`.

## Structure

```
treasure/
  apps/
    web/        React + Vite, TypeScript          (not yet configured)
    mobile/     React Native + Expo, TypeScript    (not yet configured)
  packages/
    shared/     types, validation, constants, Supabase helpers  (not yet configured)
  supabase/
    schema.sql              tables, RLS policies, triggers — shared by both apps unchanged
    functions/
      username-login/       Edge Function: server-side username->email resolution + sign-in
```

## Status: schema v2 — security review fixes applied

Before any UI got built on the v1 schema, it was reviewed and seven issues
were fixed. Since these are structural changes and no real data exists yet,
schema v2 replaces v1 rather than migrating it — see the note at the bottom
of `supabase/schema.sql` for the reset step.

1. **De-duplicated authoritative data.** `profiles` is now the sole source
   of truth for `username` / `access_role` / login status
   (`login_enabled`). `members` is the sole source of truth for club data
   and no longer repeats any of those three fields. The sync trigger
   between the two tables is gone entirely — there's nothing left to
   sync.
2. **Closed the username-enumeration hole.** The old `get_email_for_username`
   RPC was callable by anyone with the (public, by design) anon key and
   returned a real email for any username that existed — a direct
   enumeration oracle. It's replaced by `resolve_username_email`, grantable
   only to `service_role`, plus a new Edge Function
   (`supabase/functions/username-login`) that resolves the email
   server-side and returns one identical generic error for "unknown
   username" and "wrong password" alike. The client never sees an email
   during this flow.
3. **Tightened sensitive-field access.** Previously any authenticated
   viewer could read every member's home address, phone, blood type,
   emergency contact, notes, and full discipline history. Now:
   - Full-row `members` reads (including all sensitive fields) are
     admin-only, or the member reading their own row.
   - `member_status_records` (discipline/leave history) reads are
     admin-only, or the affected member reading their own record.
   - Everyone else gets safe, non-sensitive data through two new
     `SECURITY DEFINER` functions: `member_directory()` (name, rank,
     city/state, photo, join date — no address/phone/blood
     type/emergency contact) and `get_dashboard_counts()` (aggregate
     numbers only, never row-level discipline detail).
   - `activity_log`'s raw table (with full jsonb detail) is admin-only;
     everyone else gets `get_recent_activity_feed()`, a redacted feed
     with just the action type, actor username, and timestamp.
4. **No hard deletes.** `members` gained `archived_at timestamptz`. There
   is no DELETE policy on `members` for any role — "deleting" a member
   from the UI will be an admin UPDATE setting `archived_at = now()`,
   preserving every event/discipline/activity-log row that references
   them.
5. **Relational organizer.** `events.organizer` (free text) is now
   `events.organizer_member_id uuid references members(id)`.
6. **Single timestamps.** `events` now has `starts_at timestamptz` and
   `ends_at timestamptz` instead of four separate date/time columns —
   cleaner for sorting, timezones, and future calendar/notification
   features on mobile.
7. **Structured activity log.** `activity_log.details text` is now
   `activity_log.metadata jsonb`, so entries carry real fields (e.g.
   `{"member_id": "...", "field": "member_rank", "old_value": "prospect",
   "new_value": "full_patch"}`) instead of a sentence.

Known limitation still open, flagged rather than fixed silently: the
`username-login` function has no rate limiting of its own yet beyond
whatever Supabase Auth already applies to `signInWithPassword`. Noted as a
pre-launch follow-up in the function's source comments — not required to
develop locally.

## Build order (revised)

1. ✅ Inspect the old repo (delete / retain / replace / move)
2. ✅ Create the monorepo structure
3. ✅ Clean up the database/security model — **you are here**
4. ⬜ Configure `packages/shared`
5. ⬜ Create the React + Vite web app
6. ⬜ Create the Expo mobile app
7. ⬜ Connect both apps to Supabase
8. ⬜ Build authentication (web + mobile, both calling `username-login`)
9. ⬜ Test one shared member record on both platforms — the key milestone:
   create/edit a member on web, confirm it appears immediately on
   mobile (and vice versa). This is what proves the architecture, not
   any individual screen.
10. ⬜ Dashboard
11. ⬜ Members
12. ⬜ Events
13. ⬜ Discipline
14. ⬜ Settings / Profile

## Why `supabase/schema.sql` is still the single schema file

Postgres doesn't know or care whether the client is a browser or a phone —
the same tables, triggers, RLS policies, and now the same Edge Function
serve both apps unchanged.
