-- =============================================================
-- Migration 0007 — Mandatory vs optional dues flag per member
-- Ensures every member can be listed automatically in treasury
-- while allowing non-mandatory members to be marked optional.
-- =============================================================

alter table public.members
  add column if not exists dues_mandatory boolean not null default true;

drop function if exists public.member_directory();

create function public.member_directory()
returns table (
  id uuid,
  full_name text,
  nickname text,
  member_rank text,
  active boolean,
  dues_mandatory boolean,
  city text,
  state text,
  photo_url text,
  birth_date date,
  date_joined date,
  full_patch_since date,
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
    dues_mandatory,
    city,
    state,
    photo_url,
    birth_date,
    date_joined,
    full_patch_since,
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
