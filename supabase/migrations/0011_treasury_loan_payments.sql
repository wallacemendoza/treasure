-- =============================================================
-- Migration 0011 — Loan payments (partial repayment tracking)
-- Additive only. Lets a member pay down a loan in installments
-- instead of only being able to mark it fully repaid at once.
--
-- A loan's remaining balance = amount - sum(its payments). A
-- trigger keeps treasury_loans.status in sync automatically:
-- once payments cover the full amount, status flips to 'repaid'
-- (and back to 'outstanding' if a payment is later deleted/edited
-- and the balance is no longer fully covered).
--
-- Visibility model matches treasury_loans: shared chapter
-- financial data, readable by every authenticated member,
-- writable by admins only.
-- =============================================================

create table if not exists public.treasury_loan_payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.treasury_loans (id) on delete cascade,
  payment_date date not null default current_date,
  amount numeric(10, 2) not null check (amount > 0),
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists treasury_loan_payments_loan_id_idx on public.treasury_loan_payments (loan_id);

create or replace function public.sync_loan_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_loan_id uuid := coalesce(new.loan_id, old.loan_id);
  loan_amount numeric;
  total_paid numeric;
begin
  select amount into loan_amount from public.treasury_loans where id = target_loan_id;

  if loan_amount is not null then
    select coalesce(sum(amount), 0) into total_paid
    from public.treasury_loan_payments
    where loan_id = target_loan_id;

    if total_paid >= loan_amount then
      update public.treasury_loans
        set status = 'repaid', repaid_at = coalesce(repaid_at, current_date)
        where id = target_loan_id and status <> 'repaid';
    else
      update public.treasury_loans
        set status = 'outstanding', repaid_at = null
        where id = target_loan_id and status <> 'outstanding';
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists sync_loan_status on public.treasury_loan_payments;
create trigger sync_loan_status
  after insert or update or delete on public.treasury_loan_payments
  for each row execute function public.sync_loan_status();

create or replace function public.log_loan_payment_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_log (actor_id, action, metadata)
    values (
      auth.uid(), 'treasury_loan_payment_added',
      jsonb_build_object('loan_id', new.loan_id, 'payment_id', new.id, 'amount', new.amount)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists log_loan_payment_activity on public.treasury_loan_payments;
create trigger log_loan_payment_activity
  after insert on public.treasury_loan_payments
  for each row execute function public.log_loan_payment_activity();

alter table public.treasury_loan_payments enable row level security;

drop policy if exists "loan payments readable by authenticated" on public.treasury_loan_payments;
create policy "loan payments readable by authenticated"
  on public.treasury_loan_payments for select
  using (auth.uid() is not null);

drop policy if exists "loan payments writable by admins" on public.treasury_loan_payments;
create policy "loan payments writable by admins"
  on public.treasury_loan_payments for all
  using (public.is_admin())
  with check (public.is_admin());
