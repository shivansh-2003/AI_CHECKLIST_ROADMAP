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

-- Account-specific curriculum, settings and progress. Safe to run for existing installations.
-- Existing topic_progress rows are imported on first use; they remain available as a backup.
create table if not exists public.account_checklists (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.account_checklists enable row level security;
drop policy if exists "Read own checklist" on public.account_checklists;
drop policy if exists "Create own checklist" on public.account_checklists;
drop policy if exists "Update own checklist" on public.account_checklists;
create policy "Read own checklist" on public.account_checklists for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own checklist" on public.account_checklists for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own checklist" on public.account_checklists for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.account_checklists from anon;
grant select, insert, update on public.account_checklists to authenticated;

-- Refresh the REST API schema cache after setup.
NOTIFY pgrst, 'reload schema';
