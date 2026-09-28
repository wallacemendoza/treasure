-- =============================================================
-- Migration 0013 — Discipline records visible to all members
-- Widens member_status_records SELECT so any authenticated user
-- (viewer or admin) can see the discipline/leave history, matching
-- the visibility model used for events and treasury data. Only
-- admins can still insert/update/delete these records — this
-- migration does not change who can write.
-- =============================================================

drop policy if exists "status records readable by admins or the affected member" on public.member_status_records;
drop policy if exists "status records readable by any authenticated user" on public.member_status_records;
create policy "status records readable by any authenticated user"
  on public.member_status_records for select
  using (auth.uid() is not null);
