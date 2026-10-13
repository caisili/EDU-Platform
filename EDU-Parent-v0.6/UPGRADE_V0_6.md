# EDU Parent v0.6

- Home: overview of verified children and recent learning evidence.
- Academics: separate saved growth_events skill/score timeline; no fabricated grades.
- Interests: separate student_interests view with friendly cards.
- Family Settings: verified children and invite redemption, moved away from Home.
- Existing parent authentication, link redemption, and verified-link authorization unchanged.

## Run
Copy your existing `.env.local` into this project locally. Run `npm install`, then `npm run dev` (port configured in package.json).

## Data
Student interest selection already persists via `edu_set_student_interests` RPC. Parent overview reads student_interests and growth_events through verified parent_student_links. No migration required for these existing tables. A `growth_events` row is evidence, not necessarily a formal exam grade.

## Privacy
Do not place `.env.local` or secrets in shared ZIPs. Only verified parent-child links are read.
