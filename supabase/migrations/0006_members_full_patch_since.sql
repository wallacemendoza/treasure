-- =============================================================
-- Migration 0006 — Full patch since date
-- Adds full_patch_since and updates member_directory so card UI can
-- show years as a full patch without querying full member rows.
-- =============================================================

alter table public.members
  add column if not exists full_patch_since date;

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
