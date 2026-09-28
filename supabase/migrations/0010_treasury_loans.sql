-- =============================================================
-- Migration 0010 — Treasury loans
-- Additive only. Tracks money the chapter has lent out to a
-- member: reason, date, amount, notes, and who is responsible for
-- repaying it. Outstanding loans count toward that member's total
-- amount owed, same as dues debt and prior balance.
--
-- Visibility model matches dues_payments/treasury_expenses: shared
-- chapter financial data, readable by every authenticated member,
-- writable by admins only.
-- =============================================================

create table if not exists public.treasury_loans (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  reason text not null,
  loan_date date not null default current_date,
  amount numeric(10, 2) not null check (amount >= 0),
  notes text,
  status text not null default 'outstanding' check (status in ('outstanding', 'repaid')),
  repaid_at date,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists treasury_loans_member_id_idx on public.treasury_loans (member_id);
create index if not exists treasury_loans_status_idx on public.treasury_loans (status);

drop trigger if exists set_updated_at on public.treasury_loans;
create trigger set_updated_at before update on public.treasury_loans
  for each row execute function public.set_updated_at();

create or replace function public.log_loan_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_log (actor_id, action, metadata)
    values (
      auth.uid(), 'treasury_loan_added',
      jsonb_build_object('loan_id', new.id, 'member_id', new.member_id, 'amount', new.amount)
    );
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.activity_log (actor_id, action, metadata)
    values (
      auth.uid(), 'treasury_loan_status_changed',
      jsonb_build_object('loan_id', new.id, 'member_id', new.member_id, 'status', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists log_loan_activity on public.treasury_loans;
create trigger log_loan_activity
  after insert or update on public.treasury_loans
  for each row execute function public.log_loan_activity();

alter table public.treasury_loans enable row level security;

drop policy if exists "treasury loans readable by authenticated" on public.treasury_loans;
create policy "treasury loans readable by authenticated"
  on public.treasury_loans for select
  using (auth.uid() is not null);

drop policy if exists "treasury loans writable by admins" on public.treasury_loans;
create policy "treasury loans writable by admins"
  on public.treasury_loans for all
  using (public.is_admin())
  with check (public.is_admin());
