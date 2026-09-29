create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  username text not null,
  email text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id),
  created_profile_id uuid references public.profiles (id),
  linked_member_id uuid references public.members (id)
);

create index if not exists access_requests_pending_idx
  on public.access_requests (requested_at desc)
  where status = 'pending';

create unique index if not exists access_requests_one_pending_per_email_idx
  on public.access_requests (lower(email))
  where status = 'pending';

alter table public.access_requests enable row level security;

drop policy if exists "access requests readable by admins" on public.access_requests;
create policy "access requests readable by admins"
  on public.access_requests for select
  using (public.is_admin());

drop policy if exists "access requests reviewable by admins" on public.access_requests;
create policy "access requests reviewable by admins"
  on public.access_requests for update
  using (public.is_admin() and status = 'pending')
  with check (public.is_admin());
