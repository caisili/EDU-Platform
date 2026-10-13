# EDU Student v2.0.1 — Student interest persistence

## What changed
- Added authenticated `/api/student-interests` GET and PUT endpoints.
- Added an additive Supabase migration `EDU_STUDENT_V2_0_1_INTERESTS.sql`.
- Student interest selection now saves per signed-in student, not shared browser localStorage.
- Added Space as a starter interest. Existing Profile, Discover, News, Events, and other screens are retained.
- No changes to Teacher or Principal projects.

## Install / upgrade
1. Back up your current Student folder and Supabase schema/data.
2. Inspect the SQL file; run it **once** in Supabase SQL Editor for your shared project. It does not delete existing tables. It creates a new table and a function. If names already exist, review for conflicts first.
3. Replace your Student project with this ZIP's project folder (or merge the changed files). Keep your existing `.env.local` separately; it is intentionally excluded.
4. In the Student folder run `npm ci && npm run build && npm run dev`.
5. Sign in as a real student linked to a school; select Coding, Basketball, or Space; reload and confirm interests remain.
6. Sign out, sign in as a different student, and confirm interests are isolated. Verify invalid/missing token requests return 401 and cross-account access is impossible.

## Compatibility / limits
- Existing `edu_student_interests` browser localStorage values are **not** silently migrated because the key is not user-scoped and could belong to a different student. Users select interests once again.
- The SQL migration has not been executed against your live Supabase project.
- This phase does not yet add AI Companion, Missions, Growth evidence, or Principal aggregates.
- Existing news/events endpoints are untouched and need a separate security audit before school-wide production rollout.
- For minors, complete school consent/privacy and content safety review before real student deployment.
