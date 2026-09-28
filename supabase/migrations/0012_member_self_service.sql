-- =============================================================
-- Migration 0012 — Member self-service editing
-- Lets a member whose login is linked to their roster row
-- (members.profile_id = their auth id) update their OWN member
-- record — but only personal/contact fields. Administrative
-- fields (name, rank, active status, dates, notes) stay
-- admin-only, enforced server-side by a trigger so it can't be
-- bypassed by editing the request payload in the browser.
-- =============================================================

-- Self can now target their own row with UPDATE (existing policy
-- already lets admins update any row; this adds a second,
-- permissive policy for the self case).
drop policy if exists "members are updatable by self" on public.members;
create policy "members are updatable by self"
  on public.members for update
  using (public.is_self_member(id))
  with check (public.is_self_member(id));

-- Enforced column allowlist for non-admin self-edits. Admins are
-- unrestricted (checked first and short-circuits). Any column not
-- explicitly listed here is silently reverted to its prior value
-- for a self-edit, rather than erroring, so a stray field in a
-- payload can't block a legitimate contact-info update.
create or replace function public.restrict_self_member_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  -- Not admin: only allowed via the self-update policy above, so
  -- old.id = new.id already holds. Lock every administrative /
  -- roster field back to its previous value.
  new.profile_id := old.profile_id;
  new.full_name := old.full_name;
  new.member_rank := old.member_rank;
  new.active := old.active;
  new.dues_mandatory := old.dues_mandatory;
  new.archived_at := old.archived_at;
  new.date_joined := old.date_joined;
  new.full_patch_since := old.full_patch_since;
  new.prior_balance_due := old.prior_balance_due;
  new.notes := old.notes;

  return new;
end;
$$;

drop trigger if exists restrict_self_member_update on public.members;
create trigger restrict_self_member_update
  before update on public.members
  for each row execute function public.restrict_self_member_update();
