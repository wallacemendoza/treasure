-- =============================================================
-- Migration 0002 — Treasury ledger
-- Run this AFTER supabase/schema.sql has already been applied.
-- Additive only: no existing table is altered destructively.
--
-- Adds:
--   - members.prior_balance_due   (debt carried from before the
--     tracked ledger started — the old static site's "2025 DEBT"
--     column, now a real editable field instead of a spreadsheet)
--   - chapter_settings            (key/value store; seeded with
--     monthly_dues_amount so it's editable without a redeploy)
--   - dues_payments                (one row per member per
--     year/month: paid / na / opt / out / unpaid, with an amount)
--
-- Visibility model matches events, not members: dues status is
-- shared chapter financial data, readable by every authenticated
-- member (admin or viewer), writable by admins only — same as the
-- read-only ledger the old static site showed everyone.
-- =============================================================

alter table public.members
  add column if not exists prior_balance_due numeric(10, 2) not null default 0;

-- member_directory() is redefined (not just re-granted) so it also
-- returns prior_balance_due. Treasury/dues data is treated like
-- events, not like address/blood-type/emergency-contact — shared
-- chapter financial info any authenticated member can see, not
-- locked to admins/self. This intentionally widens what the
-- existing function returns; nothing about who can WRITE changes.
create or replace function public.member_directory()
returns table (
  id uuid,
  full_name text,
  member_rank text,
  active boolean,
  city text,
  state text,
  photo_url text,
  date_joined date,
  prior_balance_due numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select id, full_name, member_rank, active, city, state, photo_url, date_joined, prior_balance_due
  from public.members
  where archived_at is null;
$$;

grant execute on function public.member_directory() to authenticated;

create table if not exists public.chapter_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.chapter_settings (key, value)
values ('monthly_dues_amount', '30'::jsonb)
on conflict (key) do nothing;

drop trigger if exists set_updated_at on public.chapter_settings;
create trigger set_updated_at before update on public.chapter_settings
  for each row execute function public.set_updated_at();

create table if not exists public.dues_payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  status text not null default 'unpaid' check (status in ('paid', 'na', 'opt', 'out', 'unpaid')),
  amount numeric(10, 2),
  paid_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, year, month)
);

create index if not exists dues_payments_member_year_idx on public.dues_payments (member_id, year);

drop trigger if exists set_updated_at on public.dues_payments;
create trigger set_updated_at before update on public.dues_payments
  for each row execute function public.set_updated_at();

-- Log dues activity into the existing activity_log, same jsonb-metadata
-- pattern as the other trigger functions in schema.sql.
create or replace function public.log_dues_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into public.activity_log (actor_id, action, metadata)
    values (
      auth.uid(), 'dues_payment_updated',
      jsonb_build_object('member_id', new.member_id, 'year', new.year, 'month', new.month, 'status', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists log_dues_activity on public.dues_payments;
create trigger log_dues_activity
  after insert or update on public.dues_payments
  for each row execute function public.log_dues_activity();

alter table public.chapter_settings enable row level security;
alter table public.dues_payments enable row level security;

drop policy if exists "chapter settings readable by authenticated" on public.chapter_settings;
create policy "chapter settings readable by authenticated"
  on public.chapter_settings for select
  using (auth.uid() is not null);

drop policy if exists "chapter settings writable by admins" on public.chapter_settings;
create policy "chapter settings writable by admins"
  on public.chapter_settings for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "dues payments readable by authenticated" on public.dues_payments;
create policy "dues payments readable by authenticated"
  on public.dues_payments for select
  using (auth.uid() is not null);

drop policy if exists "dues payments writable by admins" on public.dues_payments;
create policy "dues payments writable by admins"
  on public.dues_payments for all
  using (public.is_admin())
  with check (public.is_admin());
