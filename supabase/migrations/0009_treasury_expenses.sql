-- =============================================================
-- Migration 0009 — Treasury expense log
-- Additive only. Adds a chapter expenses ledger (date, reason,
-- amount, notes) so admins can track outgoing treasury spend
-- alongside the existing dues/balance tracking.
--
-- Visibility model matches dues_payments/chapter_settings: shared
-- chapter financial data, readable by every authenticated member,
-- writable by admins only.
-- =============================================================

create table if not exists public.treasury_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  reason text not null,
  amount numeric(10, 2) not null check (amount >= 0),
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists treasury_expenses_expense_date_idx on public.treasury_expenses (expense_date desc);

drop trigger if exists set_updated_at on public.treasury_expenses;
create trigger set_updated_at before update on public.treasury_expenses
  for each row execute function public.set_updated_at();

create or replace function public.log_expense_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_log (actor_id, action, metadata)
    values (
      auth.uid(), 'treasury_expense_added',
      jsonb_build_object('expense_id', new.id, 'reason', new.reason, 'amount', new.amount)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists log_expense_activity on public.treasury_expenses;
create trigger log_expense_activity
  after insert on public.treasury_expenses
  for each row execute function public.log_expense_activity();

alter table public.treasury_expenses enable row level security;

drop policy if exists "treasury expenses readable by authenticated" on public.treasury_expenses;
create policy "treasury expenses readable by authenticated"
  on public.treasury_expenses for select
  using (auth.uid() is not null);

drop policy if exists "treasury expenses writable by admins" on public.treasury_expenses;
create policy "treasury expenses writable by admins"
  on public.treasury_expenses for all
  using (public.is_admin())
  with check (public.is_admin());
