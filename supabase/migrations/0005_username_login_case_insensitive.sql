-- =============================================================
-- Migration 0005 — Case-insensitive username login resolution
-- Prevents username login failures caused by casing differences.
-- =============================================================

create or replace function public.resolve_username_email(lookup_username text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(trim(p.username)) = lower(trim(lookup_username))
    and p.login_enabled = true
  limit 1;
$$;

revoke all on function public.resolve_username_email(text) from public, anon, authenticated;
grant execute on function public.resolve_username_email(text) to service_role;
