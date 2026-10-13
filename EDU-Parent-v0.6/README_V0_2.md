# EDU Parent Portal v0.2 — Family Invite + AI Draft

## New capabilities
- Three-language (English / Chinese / Spanish) parent signup and family invite redemption.
- A student's *separate family invite code* can be generated from their Student account with the included Student integration route.
- Invite redemption creates a **pending** parent–student link. School staff must verify the guardian before child data becomes accessible.
- AI reads only verified linked child's available interest and mission-growth records, not private chats or official grades.
- AI can create a translated, editable teacher/school email draft. The parent must supply/confirm the recipient and send through their email app. **No automatic sending**.

## Required integration
1. Review SQL in `supabase/EDU_PARENT_V0_2_INVITES_REVIEW.sql` against the actual live schema and existing policies. Do not blindly run both v0.1 and v0.2 migrations.
2. Copy `student-integration/parent-invite-route.ts` into Student's `src/app/api/student/parent-invite/route.ts`. Add a `Parent Invite` button to the Student invite screen that calls it with the signed-in student's Bearer token, and displays the returned single-use code. This UI insertion is **not** automatic in this package.
3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or publishable key), `OPENAI_API_KEY` in `.env.local` (never commit secrets).
4. Configure Supabase Auth signup and email confirmation as desired. After confirmation, parents sign in and redeem the family code.
5. Implement a school-staff-only verification workflow for pending parent_student_links; do not automatically verify guardians based solely on possession of a code.
6. Review and implement scoped parent RLS for `profiles`, `student_interests`, and `growth_events` against actual production schema. Until then the Parent UI may show missing data.
7. Run `npm install && npm run build && npm run dev` (port 3003).

## Safety
- Existing Teacher and Principal code and database records are unchanged.
- No service-role key in the browser. API calls use the signed-in user's access token.
- Email sending is **draft-only**. A provider integration and explicit parent confirmation are required for direct send.
- The parent account currently supports one school profile. Multi-school children require a separate membership model.
- This is an integration candidate, not production-certified. Run build, RLS tests, and a real-school approval test before pilot use.
