-- =============================================================
-- Migration 0003 — Member nickname and birth date
-- Additive only. Extends the members roster data and safe directory
-- output so the web members page can show nickname, birthday, and
-- computed age without duplicating data elsewhere.
-- =============================================================

alter table public.members
  add column if not exists nickname text,
  add column if not exists birth_date date;

create or replace function public.member_directory()
returns table (
  id uuid,
  full_name text,
  nickname text,
  member_rank text,
  active boolean,
  city text,
  state text,
  photo_url text,
  birth_date date,
  date_joined date,
  prior_balance_due numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select id, full_name, nickname, member_rank, active, city, state, photo_url, birth_date, date_joined, prior_balance_due
  from public.members
  where archived_at is null;
$$;

grant execute on function public.member_directory() to authenticated;
