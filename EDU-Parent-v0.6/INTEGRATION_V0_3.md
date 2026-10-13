# EDU Family connection — integration release

This ZIP contains the Student `Family Invite` UI and Parent Portal. It does not alter live Supabase or Teacher/Principal source.

1. Back up existing projects and copy existing `.env.local` locally (never upload secrets).
2. Review `supabase/EDU_PARENT_V0_2_INVITES_REVIEW.sql` against live profiles/schools schema before executing. Parent v0.1 and v0.2 SQL are not automatically safe to execute together.
3. Student Family Invite calls `edu_create_parent_invite` with the authenticated student JWT.
4. Parent redeems `PARENT-...` after creating a Supabase Auth account; status is **pending**. A school administrator must verify identity out of band and approve the link. No automatic approval.
5. Parent overview and AI only see verified links, subject to scoped RLS. Actual student data requires production schema validation.
6. Email stays draft-only until a real sending provider and explicit parent confirmation are integrated.
7. Test login, student invite, parent signup, redeem, pending status, verification, and cross-school denial.

Visual design: Student purple/indigo exploration, Parent warm teal. Teacher and Principal are untouched in this release.
