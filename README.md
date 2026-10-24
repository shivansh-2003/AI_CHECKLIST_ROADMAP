# AI Engineering 2027 — Full-stack Progress Tracker

A responsive **Next.js + Supabase (Auth + PostgreSQL)** application with account-specific learning plans. Each account starts with an 11-domain AI engineering curriculum: **73 sections, 534 checkable topics**. Deployable on **Vercel**.

## Features

- Personal checklist per account, starting with the original curriculum (11 domains / 73 sections / 534 topics)
- Add, rename, or remove domains, modules, and topics with **Customize checklist**
- Choose your current focus, domain priorities, and self-ratings independently per account
- Email/password signup and login via Supabase Auth
- Progress synced to PostgreSQL **per authenticated user**
- Next.js API route (`GET`, `PATCH`, `PUT /api/progress`) with authenticated JWT validation and Supabase RLS
- Instant optimistic checkboxes, progress dashboard, domain-wise completion
- Search, priority filters, completed/incomplete filters, expandable domain sections
- JSON import/export, including imports from the original standalone HTML checklist
- Mobile-friendly and deployable on Vercel

## 1. Create Supabase backend

1. Create a project at https://supabase.com/dashboard.
2. Open **SQL Editor** and execute `supabase/schema.sql`.
3. Open **Project Settings → API Keys** (or Connect) and copy your **Project URL** and **publishable/anon key**.
4. Under **Authentication → Providers → Email**, enable email/password login. With email confirmation enabled, users must verify their email before signing in.
5. Under **Authentication → URL Configuration**, set **Site URL** to your Vercel URL (for example `https://your-app.vercel.app`) and add your localhost and deployment URLs to redirect allow-list as appropriate.

**Security:** The publishable/anon key is designed for client use. Never place a Supabase secret/service-role key in `NEXT_PUBLIC_` variables. The SQL enables Row Level Security (RLS) so one signed-in user cannot read or edit another user's progress.

## 2. Run locally

Node.js 20+ recommended.

```bash
npm install
cp .env.example .env.local
# Fill in the Supabase project URL and publishable/anon key
npm run dev
```

Open http://localhost:3000. Create an account, sign in, and toggle a topic. Open **Customize checklist** to personalize your plan. Check `account_checklists` in Supabase Table Editor after saving. If upgrading an existing installation, rerun the updated SQL schema first; existing completions carry over automatically.

## 3. Deploy to Vercel

1. Upload this folder as a GitHub repository.
2. In Vercel, select **Add New → Project**, import the repository and use the default Next.js framework.
3. Configure environment variables for Production (and Preview/Development if desired):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy, then update your Supabase authentication Site URL/redirect URLs to include the deployed domain.
5. Sign up/sign in and verify syncing across browser sessions.

No separate API server or Vercel database provisioning is required: Next.js route handlers deploy as Vercel functions, and Supabase hosts Postgres/Auth.

## API

All endpoints require `Authorization: Bearer <Supabase access token>`.

- `GET /api/progress` → `{plan, revision}`
- `PATCH /api/progress` with `{revision, topicId:"1.1.1", completed:true}` → saves one topic
- `PATCH /api/progress` with `{revision, plan}` → saves personal content, settings, and progress
- `PUT /api/progress` with `{revision, completedIds:["1.1.1",...]}` → replaces progress while retaining personal content and settings

Writes return `{ok:true, plan, revision}`. Stale revisions return HTTP 409; reload before retrying. Full version-2 exports contain the entire plan. See [CHANGELOG.md](CHANGELOG.md) for migration details and manual test steps.

## Notes

- This app is ready **for connecting to your own Supabase project**; no actual database has been provisioned or deployed on your behalf.
- The starting curriculum is in `lib/curriculum.json`. Saved personal checklists live in `account_checklists` and are edited through the dashboard.
- The original HTML's exported progress (`{checked:[...]}`) can be imported under **Backup → Import JSON**.
- The API validates Supabase access tokens server-side (`getUser(token)`), and database queries remain under the caller's JWT/RLS rules.

## Verification

Run `npm test` for checklist model tests. Run `npm run build && npm run test:api` for production compilation and API integration tests against a local Supabase HTTP substitute. Live Supabase RLS and browser checks are described in [CHANGELOG.md](CHANGELOG.md).

## Missing account checklist table

If the app reports that `public.account_checklists` is missing from the schema cache, open your configured Supabase project → **SQL Editor** and run the entire [account checklist migration](supabase/migrations/202610240001_account_checklists.sql). It creates the table and account-isolation policies, retains existing progress, and refreshes the API schema cache. Reload the app after the SQL succeeds. Running the complete `supabase/schema.sql` is also supported.
