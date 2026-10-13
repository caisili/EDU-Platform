create extension if not exists pgcrypto;
create table if not exists public.events (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 date text default '', time text default '', location text default '', grades text default '6–8',
 interest text default '', description text default '', published boolean default true,
 created_at timestamptz default now()
);
create table if not exists public.event_participants (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete cascade,
 student_id text not null,
 student_name text default '',
 joined_at timestamptz default now(),
 unique(event_id,student_id)
);
alter table public.events enable row level security;
alter table public.event_participants enable row level security;
-- Pilot policies. Tighten these after authentication/roles are added.
drop policy if exists "pilot read events" on public.events;
create policy "pilot read events" on public.events for select using (published = true);
drop policy if exists "pilot create events" on public.events;
create policy "pilot create events" on public.events for insert with check (true);
drop policy if exists "pilot read participants" on public.event_participants;
create policy "pilot read participants" on public.event_participants for select using (true);
drop policy if exists "pilot join events" on public.event_participants;
create policy "pilot join events" on public.event_participants for insert with check (true);
