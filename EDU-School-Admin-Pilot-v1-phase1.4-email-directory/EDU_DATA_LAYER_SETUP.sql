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

-- EDU V1.8 Teacher -> School Admin operations
create table if not exists public.teaching_reports (
 id uuid primary key default gen_random_uuid(), school_name text not null default 'EDU Test School', teacher_name text not null,
 class_name text default '', report_type text default 'daily', report_date date not null,
 taught text default '', progress text default '', struggles text default '', next_steps text default '', note text default '',
 status text default 'submitted', submitted_at timestamptz default now()
);
create table if not exists public.student_attendance (
 id uuid primary key default gen_random_uuid(), school_name text not null default 'EDU Test School', teacher_name text not null,
 class_name text default '', attendance_date date not null, records jsonb not null default '[]'::jsonb,
 present_count int default 0, absent_count int default 0, late_count int default 0, excused_count int default 0, submitted_at timestamptz default now()
);
create table if not exists public.staff_attendance (
 id uuid primary key default gen_random_uuid(), school_name text not null default 'EDU Test School', teacher_name text not null,
 work_date date not null, clock_in timestamptz, clock_out timestamptz, status text default 'Clocked in', created_at timestamptz default now()
);
create table if not exists public.time_off_requests (
 id uuid primary key default gen_random_uuid(), school_name text not null default 'EDU Test School', teacher_name text not null,
 start_date date not null, end_date date not null, time_off_type text default 'Full day', reason text default '', note text default '',
 status text default 'Pending', submitted_at timestamptz default now(), reviewed_at timestamptz
);
create index if not exists teaching_reports_school_date_idx on public.teaching_reports(school_name,report_date desc);
create index if not exists student_attendance_school_date_idx on public.student_attendance(school_name,attendance_date desc);
create index if not exists staff_attendance_school_date_idx on public.staff_attendance(school_name,work_date desc);
create index if not exists time_off_requests_school_status_idx on public.time_off_requests(school_name,status);
