-- Existing project upgrade: run this entire file in Supabase SQL Editor.
-- Creates only the personal checklist table and its policies; retains existing progress.
begin;

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

-- Refresh the API schema cache after creating the table.
NOTIFY pgrst, 'reload schema';
commit;
