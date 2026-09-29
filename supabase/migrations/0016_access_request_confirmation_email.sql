alter table public.access_requests
  add column if not exists confirmation_sent_at timestamptz;
