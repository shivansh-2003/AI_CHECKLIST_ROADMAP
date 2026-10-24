# AI Engineering 2027 — Full-stack Progress Tracker

A responsive **Next.js + Supabase (Auth + PostgreSQL)** application for the complete 11-domain AI engineering learning curriculum: **73 sections, 534 checkable topics**. Deployable on **Vercel**.

## Features

- Full original curriculum (11 domains / 73 sections / 534 topics), stable numbered topic IDs
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

Open http://localhost:3000. Create an account, sign in, and toggle a topic. Check `topic_progress` in Supabase Table Editor.

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

- `GET /api/progress` → `{progress:[{topic_id, completed, updated_at}]}`
- `PATCH /api/progress` with `{topicId:"1.1.1",completed:true}` → `{ok:true,...}`
- `PUT /api/progress` with `{completedIds:["1.1.1",...]}` → overwrites completion flags for all curriculum items (bulk import/reset)

## Notes

- This app is ready **for connecting to your own Supabase project**; no actual database has been provisioned or deployed on your behalf.
- The topic curriculum is in `lib/curriculum.json` and can be edited directly.
- The original HTML's exported progress (`{checked:[...]}`) can be imported under **Backup → Import JSON**.
- The API validates Supabase access tokens server-side (`getUser(token)`), and database queries remain under the caller's JWT/RLS rules.
