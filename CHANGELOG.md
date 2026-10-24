# Changes

## 24 October 2026 — Missing account checklist table setup

- Added `supabase/migrations/202610240001_account_checklists.sql` as a standalone upgrade for existing projects. Run the entire file in the Supabase SQL Editor for the project configured in the app.
- The migration creates `account_checklists`, enables row-level security, installs per-user policies and grants, and refreshes the PostgREST schema cache. It is transactional and safe to rerun; existing checklist and legacy progress rows are retained.
- Added schema-cache refresh to the full setup script as well.
- The workspace has only the public Supabase URL/anon key, with no database administration connection or Supabase CLI available. The migration has been prepared but has not been applied remotely or verified against PostgreSQL.
- After running the migration successfully, reload the app. If the table already exists and the error persists, confirm the SQL was run in the same Supabase project configured by `NEXT_PUBLIC_SUPABASE_URL`.
- Reference: [Supabase schema-cache refresh](https://supabase.com/kb/troubleshooting/refresh-postgrest-schema).

## 24 October 2026 — Extension-injected root attribute warning

- The reported hydration mismatch shows an extra `data-scribe-recorder-ready="true"` attribute on `<html>`. The application does not render that attribute; its name suggests a browser recorder extension added it before hydration.
- Added `suppressHydrationWarning` only to the root `<html>` element in `app/layout.js`. This suppresses attribute mismatch warnings at that element without disabling hydration checks in descendant components. It does not remove the injected attribute or change checklist behavior.
- Verification: production build passed. The user's extension environment was not reproduced locally. Reload the page to confirm the reported warning is gone; disabling the recorder extension for localhost is another way to prevent the attribute injection.
- Reference: [Next.js hydration error guidance](https://nextjs.org/docs/messages/react-hydration-error).

## 24 October 2026 — Personal checklists for each account

### What changed

- Added **Customize checklist** to the signed-in dashboard. Users can choose their current focus, set each domain's priority and self-rating, and add, rename, or remove domains, modules, and topics.
- Edits stay in a draft until **Save my checklist**. Cancel discards the draft. Domain and module removal asks for confirmation.
- Each account starts with its own copy of the original 11-domain curriculum. Ratings start unrated and focus starts unselected, rather than assigning the original hardcoded profile to every user.
- Added `account_checklists`, a Supabase table with one JSON document per user and read/insert/update row-level security policies. All account settings, checklist content, and progress save together in one atomic database write.
- Existing `topic_progress` completions are carried into an account's initial checklist. The initial state is persisted on its first save. Existing progress rows remain as a backup; subsequent writes use `account_checklists`.
- Added revision checks: stale writes from another tab or device return HTTP 409 and the UI asks the user to reload. Mutations are serialized in the UI, and responses from previous accounts are ignored.
- Progress totals use the complete personal domain even when filters hide modules. Empty checklists show 0%, and empty domains do not count as completed.
- New version-2 JSON exports include the personal checklist, focus, priorities, ratings, and progress. Imports restore that document after confirmation. Older arrays / `checked` / `completedIds` backups are still supported when every ID exists in the current checklist. Unknown IDs cause an error instead of being silently removed.
- Added visible keyboard focus for checkboxes and expanded-state attributes for domain buttons.

### Required setup before testing

1. Run the entire updated `supabase/schema.sql` in your existing Supabase project's SQL Editor. It is safe to rerun: it creates the new table and recreates the named policies. Existing progress is retained.
2. Configure `.env.local` with your Supabase URL and publishable/anon key using `.env.example`.
3. Run `npm install`, then `npm run dev`.
4. Sign in and use **Customize checklist**. Save edits before closing the editor.

A missing table produces a visible setup error. Saving stays disabled until the checklist loads successfully.

### API

- `GET /api/progress` returns `{plan, revision}`. A plan contains `domains`, `focusId`, and `completedIds`. Each domain includes `id`, `name`, `priority`, `rating`, and `groups`.
- `PATCH /api/progress` accepts `{revision, topicId, completed}` for one topic, or `{revision, plan}` for the full checklist.
- `PUT /api/progress` accepts `{revision, completedIds}` to replace all completion flags while retaining content/settings.
- Bearer authentication is required. User identity is derived from the validated token, never from the request body.
- Revision 0 represents an account without a persisted checklist. The first save inserts revision 1. Subsequent saves compare the supplied revision in the database update itself.
- Names must be nonblank and at most 300 characters. Priorities are P0, P1, P2, or Maintain. Ratings are null or numeric 0–5. IDs must be unique, and all completion/focus references must exist. Limits: 100 domains, 500 modules, 2,000 topics. UI file imports are limited to 2 MB.

### Verification

- `npm run build`: passed after implementation.
- `npm test`: four model regression tests passed, covering independent account templates, legacy progress migration, custom and empty checklists, invalid inputs, and domain percentages.
- `npm run test:api`: passed against the real built Next.js API using a local in-memory Supabase HTTP substitute. Exercises two accounts, authentication failures, custom content persistence, progress updates, reset, invalid references, stale revisions, and concurrent writes (one succeeds and one returns 409).
- The API test requires a current production build: run `npm run build` before `npm run test:api` after changing server code.
- `npm run lint` still requires the missing ESLint configuration identified in the original project review.
- Live Supabase authentication, PostgreSQL RLS enforcement, and browser interactions have not been tested against a configured project. The HTTP substitute checks request scoping; it does not prove deployed database policies.

### Manual test checklist

1. In account A, select a focus, change a priority and rating, rename a topic, add a domain/module/topic, and remove an unwanted topic. Save and reload; verify all changes persist.
2. Mark a custom topic complete. Search/filter the checklist and confirm percentages do not change solely because topics are hidden.
3. Sign out and sign into account B. Verify the original curriculum, unrated domains, no selected focus, and account B's own progress. Make different edits, reload, and switch back to A.
4. Export A's backup, edit the checklist, and import the backup. Verify content, settings, and completions restore.
5. Open the same account in two tabs. Save in one, then attempt a save in the other. Verify the stale tab reports a conflict and requires reload.
6. Cancel a draft and confirm nothing changes. Reset progress and confirm custom content and settings remain.
7. Remove all domains and save. Verify 0% without invalid totals, then add a new domain, module, and topic.
