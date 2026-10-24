-- Run once in Supabase Dashboard → SQL Editor.
create table if not exists public.topic_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id text not null check (topic_id ~ '^[0-9]{1,2}[.][0-9]+[.][0-9]+$'),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);
create index if not exists topic_progress_user_updated_idx on public.topic_progress(user_id, updated_at desc);
alter table public.topic_progress enable row level security;
-- Idempotent policy setup
 drop policy if exists "Read own progress" on public.topic_progress;
 drop policy if exists "Create own progress" on public.topic_progress;
 drop policy if exists "Update own progress" on public.topic_progress;
create policy "Read own progress" on public.topic_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own progress" on public.topic_progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own progress" on public.topic_progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.topic_progress from anon;
grant select, insert, update on public.topic_progress to authenticated;
