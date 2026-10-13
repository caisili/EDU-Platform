# EDU Student v2.1 — Rewards & Personalization

1. Copy `.env.local` from your working Student project into this project root. Never share API keys.
2. In Supabase SQL Editor run `EDU_STUDENT_V2_1_REWARDS.sql` after v2.0.1 interests and v2.0.2 missions migrations. This migration replaces the existing mission RPC while preserving the original interface.
3. `npm install && npm run build && npm run dev -- -p 3000` (stop the old server first).
4. Sign in as a student, visit Rewards. Solve each of the three Missions correctly once to earn 20/30/50 points; retries do not duplicate points. All rewards and preferences persist in Supabase.
5. Pets unlock based on lifetime earned points at 1000/1500/2500; themes cost 800 available points each. Classic is free.

**Important:** Current v2.0.2 has only three unique graded missions, so the maximum earnable points through this release is **100**. The pets/themes are implemented but require additional graded question banks or teacher homework integrations before they can realistically be earned. No artificial points or client-awarded credits have been added. Interest choices already persist via `student_interests`.

**Pilot caution:** Rewarding students for interest exploration is not enabled: the existing interest cards are preferences, not verifiable completed activities. Do not award points for clicking an interest. Further question banks should use server-validated answers and unique question IDs. Test the SQL in staging before production.
