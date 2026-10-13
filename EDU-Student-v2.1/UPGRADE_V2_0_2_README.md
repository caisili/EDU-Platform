# EDU Student v2.0.2 — AI Discovery, Missions & Growth

Incremental upgrade from v2.0.1. Keeps existing pages, school events, interest news and student authentication.

## Setup
1. Copy your existing `.env.local` into this extracted project; never upload secrets.
2. Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` exist.
3. In Supabase SQL Editor review/apply `EDU_STUDENT_V2_0_1_INTERESTS.sql` first (if not already applied), then `EDU_STUDENT_V2_0_2_MISSIONS.sql`. Do not delete existing tables.
4. To enable the AI Companion, add `OPENAI_API_KEY` **server-side only** in `.env.local`; do not use a NEXT_PUBLIC prefix. Optional `EDU_AI_MODEL=gpt-4o-mini`. If no API key, AI chat shows a clear configuration error; Missions and Growth remain available.
5. `npm install && npm run build && npm run dev`. Restart after changing env.

## Test
- Log in as a real student attached to a school.
- Discover: select an interest, refresh, verify persistence (v2.0.1 SQL required).
- Missions: choose Basketball, answer 80, confirm success and evidence in My Growth; retry wrong answer to confirm it is recorded honestly.
- AI Companion: ask a question, confirm a contextual response (requires OPENAI_API_KEY).
- Sign out and in, verify attempts persist. Test a second student account and a different school for data isolation.

## Scope / known limitations
- The three missions are deterministic one-step math challenges; AI chat is optional and not saved to the database.
- Existing news feed is reused; do not assume each result is verified without inspecting its source.
- No teacher/principal access to student attempts is enabled yet.
- Mission scoring uses a server-side SQL RPC, and direct client inserts are revoked.
- No automated moderation service or student consent/retention workflow is included; not ready for a school pilot with minors without these controls.
