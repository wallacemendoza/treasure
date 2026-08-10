-- =============================================================
-- Migration 0004 — Member motorcycle profile fields
-- Additive migration to support member motorcycle details in UI.
--
-- Includes:
--   - members.motorcycle_brand
--   - members.motorcycle_model
--   - members.motorcycle_color
--   - members.motorcycle_year
--   - members.motorcycle_plate
--
-- Also recreates member_directory() with the full safe field set.
-- We drop first to avoid the Postgres return-type mismatch error
-- when changing the function's table signature.
-- =============================================================

alter table public.members
  add column if not exists motorcycle_brand text,
  add column if not exists motorcycle_model text,
  add column if not exists motorcycle_color text,
  add column if not exists motorcycle_year int,
  add column if not exists motorcycle_plate text;

drop function if exists public.member_directory();

create function public.member_directory()
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
  prior_balance_due numeric,
  motorcycle_brand text,
  motorcycle_model text,
  motorcycle_color text,
  motorcycle_year int,
  motorcycle_plate text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    id,
    full_name,
    nickname,
    member_rank,
    active,
    city,
    state,
    photo_url,
    birth_date,
    date_joined,
    prior_balance_due,
    motorcycle_brand,
    motorcycle_model,
    motorcycle_color,
    motorcycle_year,
    motorcycle_plate
  from public.members
  where archived_at is null;
$$;

grant execute on function public.member_directory() to authenticated;
