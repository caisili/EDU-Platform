# EDU School Admin MVP v0.2

Adds:
- EDU AI Command Center demo
- School-data query demo flows
- Teacher / parent communication draft + review workflow
- Event creation and publish-to-Student-Discover concept
- Independent Next.js project

Run:
npm install
npm run dev

Important: v0.2 uses local demo data. It does not yet send real email or sync events into the separate Student app. Those actions require the future shared database/auth/integration layer.

## EDU shared Data Layer (v0.4)
1. Create one Supabase project.
2. Run `EDU_DATA_LAYER_SETUP.sql` from the bundle in Supabase SQL Editor.
3. Copy `.env.example` to `.env.local` and fill the same Supabase URL/keys used by Student and Teacher.
4. `npm install && npm run dev`
Admin Events now publishes to the shared database and shows participant counts.

## V1.9 School Accounts & Roles
Run `EDU_V1_9_ACCOUNTS_ROLES.sql` in Supabase after the V1.8 data-layer SQL. School Admin can create the first school account and issue teacher invite codes from **Accounts**. Teacher signup requires an invite code. V1.9 replaces the temporary open RLS policies on school-operations tables with authenticated school-scoped policies.
