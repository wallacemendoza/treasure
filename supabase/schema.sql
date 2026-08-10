-- =============================================================
-- Balaios MC Chapter Portal — schema v2
-- Addresses review feedback on v1:
--   1. No duplicated authoritative fields between profiles/members
--   2. No client-callable username -> email lookup (see the
--      username-login Edge Function instead)
--   3. Sensitive member/discipline fields are no longer readable
--      by every authenticated user
--   4. Soft delete via archived_at — no hard DELETE on members
--   5. events.organizer is a real FK to members
--   6. events use starts_at/ends_at timestamptz, not 4 columns
--   7. activity_log uses jsonb metadata, not a text blurb
--
-- This is a v2 of a schema that has not been used with real data
-- yet. Run it against a RESET database — see the note at the very
-- bottom of this file before running.
-- =============================================================

create extension if not exists "pgcrypto";

-- =============================================================
-- 1. profiles — SOLE source of truth for login/access data.
-- members never repeats username, access_role, or an "is this
-- login allowed" flag. One row per auth.users row.
-- =============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  access_role text not null default 'viewer' check (access_role in ('admin', 'viewer')),
  -- Whether this LOGIN is allowed to authenticate. This is an auth
  -- concept, distinct from members.active (club roster status) —
  -- a member can be an active club member with a disabled login,
  -- or vice versa (e.g. an alumni who keeps portal access).
  login_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================================
-- 2. members — SOLE source of truth for club/roster data.
-- No username, no access_role, no login-enabled flag here.
-- `active` here means "current club roster status", unrelated to
-- whether the linked login (if any) can authenticate.
-- =============================================================
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  full_name text not null,
  nickname text,
  email text,
  phone text,
  street_address text,
  city text,
  state text,
  zip text,
  photo_url text,
  emergency_contact_name text,
  emergency_contact_relationship text,
  emergency_contact_phone text,
  blood_type text,
  member_rank text not null check (member_rank in ('support', 'prospect', 'full_patch')),
  active boolean not null default true,
  -- Soft delete. Never hard-delete a member row — events, discipline
  -- records, and activity_log all reference members.id and would
  -- either cascade-destroy history or orphan on a hard delete.
  -- "Deleting" a member from the UI should set archived_at = now()
  -- and leave the row (and its history) intact.
  archived_at timestamptz,
  birth_date date,
  date_joined date,
  motorcycle_brand text,
  motorcycle_model text,
  motorcycle_color text,
  motorcycle_year int,
  motorcycle_plate text,
  prior_balance_due numeric(10, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists members_member_rank_idx on public.members (member_rank);
create index if not exists members_active_idx on public.members (active);
create index if not exists members_archived_at_idx on public.members (archived_at);

-- =============================================================
-- 3. events
-- organizer is a real FK now, and start/end are single timestamptz
-- columns (store the instant; render date/time split in the UI).
-- =============================================================
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  description text,
  location text,
  address text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  event_type text,
  organizer_member_id uuid references public.members (id),
  attendance_requirement text not null default 'optional' check (attendance_requirement in ('required', 'optional')),
  notes text,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled', 'completed')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_starts_at_idx on public.events (starts_at);

-- =============================================================
-- 4. event_attendees
-- =============================================================
create table if not exists public.event_attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  attendance_status text not null default 'invited'
    check (attendance_status in ('invited', 'confirmed', 'attended', 'excused', 'no_show')),
  created_at timestamptz not null default now(),
  unique (event_id, member_id)
);

-- =============================================================
-- 5. member_status_records — discipline / leave history.
-- Treated as sensitive; see RLS below.
-- =============================================================
create table if not exists public.member_status_records (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  type text not null check (type in ('suspension', 'leave', 'probation', 'temporary_restriction', 'other')),
  reason text,
  start_date date not null default current_date,
  expected_end_date date,
  actual_end_date date,
  duration_preset text check (
    duration_preset in ('30_days', '60_days', '90_days', '6_months', '1_year', 'indefinite', 'custom')
  ),
  status text not null default 'active' check (status in ('active', 'ended', 'cancelled')),
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists member_status_records_member_id_idx on public.member_status_records (member_id);
create index if not exists member_status_records_type_status_idx on public.member_status_records (type, status);

-- =============================================================
-- 6. activity_log
-- Structured jsonb metadata instead of a free-text blurb, so a
-- future UI can render "prospect -> full patch" from real fields
-- instead of parsing a sentence.
-- =============================================================
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_created_at_idx on public.activity_log (created_at desc);
create index if not exists activity_log_metadata_gin_idx on public.activity_log using gin (metadata);

-- =============================================================
-- updated_at maintenance
-- =============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.members;
create trigger set_updated_at before update on public.members
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.events;
create trigger set_updated_at before update on public.events
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.member_status_records;
create trigger set_updated_at before update on public.member_status_records
  for each row execute function public.set_updated_at();

-- =============================================================
-- Auto-create a profile row when a new auth user is created.
-- Defaults to viewer, login enabled. An admin promotes to admin
-- later by editing the profiles row directly (or via a future
-- "manage access" admin screen) — never via a member-table field,
-- since that field no longer exists.
-- =============================================================
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, access_role, login_enabled)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    'viewer',
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- =============================================================
-- Permission helpers used throughout RLS policies below.
-- =============================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and access_role = 'admin'
      and login_enabled = true
  );
$$;

-- True when the currently authenticated user IS the member in
-- question (via their linked profile), used to let a member read
-- their own sensitive fields without being an admin.
create or replace function public.is_self_member(target_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members
    where id = target_member_id
      and profile_id = auth.uid()
  );
$$;

-- =============================================================
-- Username -> email resolution, LOCKED DOWN.
--
-- v1 shipped this as an anon-callable RPC that returned a real
-- email for any username, which is a username-enumeration oracle
-- (an attacker can script through usernames and harvest emails,
-- and can distinguish "exists" from "doesn't exist" directly from
-- the response shape). It is not granted to anon or authenticated
-- here — only to service_role, which means it can only be called
-- from a trusted server context: the username-login Edge Function
-- (supabase/functions/username-login), which resolves the email
-- server-side and NEVER returns it to the browser. The Edge
-- Function returns one generic "invalid username/email or
-- password" response whether the username didn't exist or the
-- password was wrong, so the client can't tell which happened.
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
  where p.username = lookup_username
    and p.login_enabled = true
  limit 1;
$$;

revoke all on function public.resolve_username_email(text) from public, anon, authenticated;
grant execute on function public.resolve_username_email(text) to service_role;

-- =============================================================
-- Safe aggregate stats for the Dashboard. Runs as SECURITY
-- DEFINER so it can see suspension/leave counts even though the
-- underlying member_status_records rows are locked down below —
-- it returns only counts, never row-level discipline detail.
-- =============================================================
create or replace function public.get_dashboard_counts()
returns table (
  active_members bigint,
  full_patch bigint,
  prospects bigint,
  support bigint,
  suspended bigint,
  on_leave bigint,
  upcoming_events bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.members where active = true and archived_at is null),
    (select count(*) from public.members where active = true and archived_at is null and member_rank = 'full_patch'),
    (select count(*) from public.members where active = true and archived_at is null and member_rank = 'prospect'),
    (select count(*) from public.members where active = true and archived_at is null and member_rank = 'support'),
    (select count(*) from public.member_status_records where type = 'suspension' and status = 'active'),
    (select count(*) from public.member_status_records where type = 'leave' and status = 'active'),
    (select count(*) from public.events where starts_at >= now());
$$;

grant execute on function public.get_dashboard_counts() to authenticated;

-- =============================================================
-- Safe, redacted activity feed for the Dashboard. Any
-- authenticated user can see THAT something happened and roughly
-- what kind of action it was, without seeing the jsonb detail
-- (old/new values, which member was disciplined, etc). Admins
-- read the full public.activity_log table directly for detail.
-- =============================================================
create or replace function public.get_recent_activity_feed(feed_limit int default 10)
returns table (
  id uuid,
  action text,
  actor_username text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.action, p.username, l.created_at
  from public.activity_log l
  left join public.profiles p on p.id = l.actor_id
  order by l.created_at desc
  limit feed_limit;
$$;

grant execute on function public.get_recent_activity_feed(int) to authenticated;

-- =============================================================
-- Safe roster directory: non-sensitive columns only, all active
-- non-archived members, regardless of who's asking. This is what
-- the Members list / event organizer picker / "who's a member"
-- UI should query — never the base members table for a general
-- roster view. SECURITY DEFINER lets it return every member's
-- safe fields even though the base table restricts full-row reads
-- to admins/self (see RLS below).
-- =============================================================
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
  select id, full_name, nickname, member_rank, active, city, state, photo_url, birth_date, date_joined, prior_balance_due, motorcycle_brand, motorcycle_model, motorcycle_color, motorcycle_year, motorcycle_plate
  from public.members
  where archived_at is null;
$$;

grant execute on function public.member_directory() to authenticated;

-- =============================================================
-- Activity logging triggers
-- =============================================================
create or replace function public.log_member_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_log (actor_id, action, metadata)
    values (auth.uid(), 'member_created', jsonb_build_object('member_id', new.id, 'full_name', new.full_name));
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.member_rank is distinct from old.member_rank then
      insert into public.activity_log (actor_id, action, metadata)
      values (
        auth.uid(), 'rank_changed',
        jsonb_build_object('member_id', new.id, 'field', 'member_rank', 'old_value', old.member_rank, 'new_value', new.member_rank)
      );
    end if;

    if new.archived_at is distinct from old.archived_at and new.archived_at is not null then
      insert into public.activity_log (actor_id, action, metadata)
      values (auth.uid(), 'member_archived', jsonb_build_object('member_id', new.id, 'full_name', new.full_name));
    end if;

    insert into public.activity_log (actor_id, action, metadata)
    values (auth.uid(), 'member_edited', jsonb_build_object('member_id', new.id, 'full_name', new.full_name));
  end if;

  return new;
end;
$$;

drop trigger if exists log_member_activity on public.members;
create trigger log_member_activity
  after insert or update on public.members
  for each row execute function public.log_member_activity();

-- Permission changes now happen on profiles.access_role, since
-- that's the only place access_role lives.
create or replace function public.log_profile_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.access_role is distinct from old.access_role then
    insert into public.activity_log (actor_id, action, metadata)
    values (
      auth.uid(), 'permissions_changed',
      jsonb_build_object('profile_id', new.id, 'username', new.username, 'old_value', old.access_role, 'new_value', new.access_role)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists log_profile_activity on public.profiles;
create trigger log_profile_activity
  after update on public.profiles
  for each row execute function public.log_profile_activity();

create or replace function public.log_event_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_log (actor_id, action, metadata)
    values (auth.uid(), 'event_created', jsonb_build_object('event_id', new.id, 'event_name', new.event_name));
  elsif tg_op = 'UPDATE' then
    insert into public.activity_log (actor_id, action, metadata)
    values (auth.uid(), 'event_edited', jsonb_build_object('event_id', new.id, 'event_name', new.event_name));
  end if;
  return new;
end;
$$;

drop trigger if exists log_event_activity on public.events;
create trigger log_event_activity
  after insert or update on public.events
  for each row execute function public.log_event_activity();

create or replace function public.log_status_record_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_log (actor_id, action, metadata)
    values (
      auth.uid(),
      case when new.type = 'suspension' then 'suspension_created'
           when new.type = 'leave' then 'leave_created'
           else 'status_record_created' end,
      jsonb_build_object('member_id', new.member_id, 'status_record_id', new.id, 'type', new.type)
    );
  elsif tg_op = 'UPDATE' and new.status = 'ended' and old.status is distinct from 'ended' then
    insert into public.activity_log (actor_id, action, metadata)
    values (
      auth.uid(),
      case when new.type = 'suspension' then 'suspension_ended'
           when new.type = 'leave' then 'leave_ended'
           else 'status_record_ended' end,
      jsonb_build_object('member_id', new.member_id, 'status_record_id', new.id, 'type', new.type)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists log_status_record_activity on public.member_status_records;
create trigger log_status_record_activity
  after insert or update on public.member_status_records
  for each row execute function public.log_status_record_activity();

-- =============================================================
-- Row Level Security
-- =============================================================
alter table public.profiles enable row level security;
alter table public.members enable row level security;
alter table public.events enable row level security;
alter table public.event_attendees enable row level security;
alter table public.member_status_records enable row level security;
alter table public.activity_log enable row level security;

-- ---- profiles ----
-- A user can read their own profile (to know their own role) plus
-- admins can read every profile (to manage access). Nobody else's
-- username/role is exposed to a general viewer.
drop policy if exists "profiles are readable by admins or self" on public.profiles;
create policy "profiles are readable by admins or self"
  on public.profiles for select
  using (public.is_admin() or id = auth.uid());

drop policy if exists "profiles are updatable only by admins" on public.profiles;
create policy "profiles are updatable only by admins"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- No public insert/delete policy: rows are created by the
-- on_auth_user_created trigger and removed via cascade only.

-- ---- members ----
-- Full-row read (including sensitive fields: address, phone,
-- blood type, emergency contact, notes) is admin-or-self only.
-- Everyone else uses public.member_directory() for the safe subset.
drop policy if exists "members are readable by any authenticated user" on public.members;
drop policy if exists "members full row readable by admins or self" on public.members;
create policy "members full row readable by admins or self"
  on public.members for select
  using (public.is_admin() or profile_id = auth.uid());

drop policy if exists "members are insertable by admins" on public.members;
create policy "members are insertable by admins"
  on public.members for insert
  with check (public.is_admin());

drop policy if exists "members are updatable by admins" on public.members;
create policy "members are updatable by admins"
  on public.members for update
  using (public.is_admin())
  with check (public.is_admin());

-- Intentionally no DELETE policy for anyone. "Deleting" a member
-- from the UI is an admin UPDATE that sets archived_at = now().
drop policy if exists "members are deletable by admins" on public.members;

-- ---- events ----
-- Events themselves aren't sensitive (name, date, location), so
-- general authenticated read is fine.
drop policy if exists "events are readable by any authenticated user" on public.events;
create policy "events are readable by any authenticated user"
  on public.events for select
  using (auth.uid() is not null);

drop policy if exists "events are insertable by admins" on public.events;
create policy "events are insertable by admins"
  on public.events for insert
  with check (public.is_admin());

drop policy if exists "events are updatable by admins" on public.events;
create policy "events are updatable by admins"
  on public.events for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "events are deletable by admins" on public.events;
create policy "events are deletable by admins"
  on public.events for delete
  using (public.is_admin());

-- ---- event_attendees ----
drop policy if exists "event attendees are readable by any authenticated user" on public.event_attendees;
create policy "event attendees are readable by any authenticated user"
  on public.event_attendees for select
  using (auth.uid() is not null);

drop policy if exists "event attendees are writable by admins" on public.event_attendees;
create policy "event attendees are writable by admins"
  on public.event_attendees for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---- member_status_records ----
-- Discipline history is sensitive: admin, or the affected member
-- reading their own record, only. General viewers get aggregate
-- counts from get_dashboard_counts(), never row-level detail
-- about someone else.
drop policy if exists "status records are readable by any authenticated user" on public.member_status_records;
drop policy if exists "status records readable by admins or the affected member" on public.member_status_records;
create policy "status records readable by admins or the affected member"
  on public.member_status_records for select
  using (public.is_admin() or public.is_self_member(member_id));

drop policy if exists "status records are insertable by admins" on public.member_status_records;
create policy "status records are insertable by admins"
  on public.member_status_records for insert
  with check (public.is_admin());

drop policy if exists "status records are updatable by admins" on public.member_status_records;
create policy "status records are updatable by admins"
  on public.member_status_records for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "status records are deletable by admins" on public.member_status_records;
create policy "status records are deletable by admins"
  on public.member_status_records for delete
  using (public.is_admin());

-- ---- activity_log ----
-- Raw log (with jsonb detail) is admin-only. Everyone else uses
-- get_recent_activity_feed() for the redacted dashboard feed.
drop policy if exists "activity log is readable by any authenticated user" on public.activity_log;
drop policy if exists "activity log is readable by admins only" on public.activity_log;
create policy "activity log is readable by admins only"
  on public.activity_log for select
  using (public.is_admin());

-- No INSERT/UPDATE/DELETE policy for any client role — rows are
-- written only by the SECURITY DEFINER trigger functions above,
-- so the log is append-only and tamper resistant from the browser.

-- =============================================================
-- Storage: profile photos bucket
-- Run once. Create the bucket first in the dashboard (Storage >
-- New bucket > "profile-photos", private), then apply these.
-- =============================================================
-- insert into storage.buckets (id, name, public) values ('profile-photos', 'profile-photos', false)
--   on conflict (id) do nothing;

drop policy if exists "profile photos are readable by authenticated users" on storage.objects;
create policy "profile photos are readable by authenticated users"
  on storage.objects for select
  using (bucket_id = 'profile-photos' and auth.uid() is not null);

drop policy if exists "profile photos are writable by admins" on storage.objects;
create policy "profile photos are writable by admins"
  on storage.objects for insert
  with check (bucket_id = 'profile-photos' and public.is_admin());

drop policy if exists "profile photos are updatable by admins" on storage.objects;
create policy "profile photos are updatable by admins"
  on storage.objects for update
  using (bucket_id = 'profile-photos' and public.is_admin());

drop policy if exists "profile photos are deletable by admins" on storage.objects;
create policy "profile photos are deletable by admins"
  on storage.objects for delete
  using (bucket_id = 'profile-photos' and public.is_admin());

-- =============================================================
-- IMPORTANT — this is schema v2, replacing v1's table shapes
-- (dropped columns: members.username, members.access_role,
-- members.active-sync trigger; changed: events date/time columns
-- -> starts_at/ends_at; activity_log.details -> metadata).
-- Since no real data has been entered against v1 yet, the
-- straightforward path is to reset before running this file:
--
--   Supabase Dashboard > Project Settings > General >
--   "Reset database" (or, in the SQL editor, run:
--   drop schema public cascade; create schema public;
--   grant all on schema public to postgres, anon, authenticated, service_role;
--   before pasting this file)
--
-- Do NOT run this against a project with real member data without
-- writing an explicit migration first — several of these changes
-- drop columns.
-- =============================================================
