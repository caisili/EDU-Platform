# EDU Parent Portal v0.1 — multilingual UI + secured data integration scaffold

## What is implemented
- Responsive Home / My Child / Ask EDU / Messages UI in English, Simplified Chinese, Spanish.
- Demo preview clearly labeled with fictional data.
- Parent login using Supabase password auth; API independently verifies JWT and `profiles.role = parent`.
- Verified `parent_student_links` lookup and school scoped child profile lookup.
- Growth and interests are queried only for verified linked students. **RLS policies must be added to existing tables before real data access works**.
- AI answers grounded in the linked student's accessible `growth_events` and `student_interests`; no private chat history.
- Email composition opens a user-reviewed `mailto:` draft; **does not send email automatically**. Recipient is entered by parent, never invented.

## Setup
1. `npm install`
2. Create `.env.local` (do not commit or share) with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`), `OPENAI_API_KEY`, optional `EDU_AI_MODEL=gpt-4o-mini`.
3. `npm run dev` (port 3003).
4. Demo works without credentials. To connect live data, first review `supabase/EDU_PARENT_V0_1_REVIEW_FIRST.sql`, confirm live table/column names, and implement *scoped* RLS on existing tables.
5. Create verified parent profiles and parent-child links through an authorized school administration workflow (not via a public self-service endpoint).

## Important integration notes
- This is a **new standalone Parent project**; Student, Teacher and Principal files are unchanged.
- Existing `growth_events` and `student_interests` columns were inferred from the previous Student v2.0.2 upgrade and must be validated against live Supabase.
- Do not run the SQL without schema review. The provided SQL is a starting point, **not** a complete production migration.
- Student scores in this UI are mission evidence, not school report-card grades. Gradebook integration is not yet implemented.
- The app does not know teacher/school email addresses yet; add verified directory integration before auto-filling recipients.
- AI conversations are not stored; do not paste sensitive student information into the email draft unnecessarily.
- For production: parent onboarding/consent, data minimization, audited school authorization, role-scoped RLS, retention controls, localization QA, and CSRF/rate-limit controls should be completed.
