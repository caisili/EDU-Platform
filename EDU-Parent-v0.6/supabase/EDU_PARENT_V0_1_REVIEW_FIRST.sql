-- REVIEW FIRST. Apply only after confirming existing schema and policies.
-- This creates an explicit, school-verified parent/student link.
-- DO NOT automatically link accounts by matching email, surname or school_id.
create table if not exists public.parent_student_links (
 id uuid primary key default gen_random_uuid(),
 parent_id uuid not null references public.profiles(id),
 student_id uuid not null references public.profiles(id),
 school_id uuid not null references public.schools(id),
 status text not null default 'pending' check(status in ('pending','verified','revoked')),
 verified_at timestamptz,
 created_at timestamptz not null default now(),
 unique(parent_id,student_id,school_id)
);
alter table public.parent_student_links enable row level security;
-- Parent may only see their own verified links. Verification must be performed by authorized school staff.
drop policy if exists parent_read_verified_links on public.parent_student_links;
create policy parent_read_verified_links on public.parent_student_links for select to authenticated using(parent_id=auth.uid() and status='verified');
-- IMPORTANT: before enabling real parent data reads, add matching SELECT RLS policies
-- to profiles, student_interests, growth_events for linked verified parents.
-- DO NOT grant blanket school-wide access. Do not expose private AI conversations.
-- Exact policies depend on your live schema and must be reviewed before production.
