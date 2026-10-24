# Project analysis

Reviewed: 24 October 2026

This is the initial review before customization was implemented. Several findings below have since been addressed; see [CHANGELOG.md](CHANGELOG.md) for changes and current verification results.

## Overview

AI Engineering Tracker is a Next.js App Router and React application using Supabase authentication and PostgreSQL to save learning progress. The curriculum contains 11 domains, 73 modules, and 534 topics with unique IDs, matching the README.

The browser loads the curriculum from `lib/curriculum.json`, authenticates with Supabase, and sends bearer-authenticated requests to `/api/progress`. The API validates users and topic IDs. The database schema defines row-level security policies for each user's progress.

## Findings

### High: filtered views change domain completion percentages

Location: `app/page.js`, filtering and domain metrics.

Domain totals are calculated from groups remaining after filtering. Completing the first seven topics in domain 1 normally shows 7/49 (14%). Selecting Completed removes other groups and changes the displayed result to 7/7 (100%). This calculation was reproduced using the actual curriculum.

Suggested fix: calculate domain metrics from the original curriculum and filter only the displayed topic list.

### High: imports and resets can partially persist

Location: `app/api/progress/route.js`, PUT handler.

The handler writes 534 rows through three separate upsert requests. If a later request fails, earlier writes remain committed while the browser retains its previous state.

Suggested fix: perform the replacement in one database transaction, for example through a suitably secured PostgreSQL function.

### High: delayed mutations can affect state after an account change

Location: `app/page.js`, toggle and bulk operations.

The initial progress load checks an authentication epoch. Checkbox failure rollbacks and successful bulk updates do not check whether the initiating account is still active. A delayed response after sign-out or an account switch can therefore affect current browser state. This is a source-level client-state finding, not evidence of a database authorization bypass.

Suggested fix: guard asynchronous state changes by account epoch and reset operation state when the account changes.

### Medium: bulk operations can overlap with individual saves

Location: `app/page.js`, import/reset controls and mutation functions.

Import remains enabled during loading and pending checkbox saves. Reset checks loading but does not check pending checkbox saves. Concurrent PUT and PATCH requests can overwrite the same topic and leave displayed progress inconsistent with stored progress.

Suggested fix: serialize conflicting mutations, disable conflicting controls, and reconcile state after failures.

### Medium: lint configuration and automated tests are missing

`npm run lint` exits with code 2 because ESLint 9 cannot find an `eslint.config.js`, `.mjs`, or `.cjs` file. No project test files or test script were found.

Suggested fix: configure ESLint and add regression coverage for filtered totals, account changes, and conflicting saves.

### Medium: personalization is hardcoded

Location: `app/page.js`, baseline ratings and current focus.

Every user receives the same self-ratings and System Design focus. These values are neither stored per user nor derived from progress.

Suggested fix: make them editable per user or label them as roadmap defaults.

## Strengths

- Clear setup and deployment documentation.
- Consistent, unique curriculum topic IDs.
- Server-side authentication and input validation.
- Per-user database security policies in the SQL schema.
- Optimistic checkbox updates with failure rollback.
- JSON import/export for backups.

## Additional improvements

- Separate authentication, progress state, and curriculum views from the main page component.
- Add password recovery.
- Add visible keyboard focus for custom checkboxes and `aria-expanded` for domain controls.
- Report unknown imported IDs instead of silently discarding them.

## Verification

- `npm run build`: passed.
- `npm run lint`: failed because its configuration is missing.
- Curriculum: verified 11 domains, 73 modules, 534 topics, and 534 unique IDs.
- Reproduced the filtered-percentage calculation with actual curriculum data.
- No application source was changed during the analysis.

No `.env.local` was present. Live authentication, deployed database policies, cross-device sync, and authenticated browser interactions were not verified. Concurrency and partial-write findings are based on source inspection.

## Documentation preference

Document future project changes in Markdown or HTML files. Include what changed, why, and relevant verification results.
