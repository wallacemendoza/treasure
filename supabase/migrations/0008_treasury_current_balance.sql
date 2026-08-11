-- Seed a current_balance key in chapter_settings so admins can
-- record the chapter's actual cash-on-hand balance.
insert into public.chapter_settings (key, value)
values ('current_balance', '0'::jsonb)
on conflict (key) do nothing;
