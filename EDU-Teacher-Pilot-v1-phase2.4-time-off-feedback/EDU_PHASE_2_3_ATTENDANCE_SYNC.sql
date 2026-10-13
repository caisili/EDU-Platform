-- EDU Phase 2.3 — durable Teacher -> School Admin attendance sync
-- Run once in the SAME Supabase project used by Teacher and School Admin.
-- Safe to re-run.

alter table public.student_attendance add column if not exists class_id uuid references public.classes(id) on delete cascade;
alter table public.student_attendance add column if not exists class_name text default '';
alter table public.student_attendance add column if not exists attendance_date date;
alter table public.student_attendance add column if not exists records jsonb default '[]'::jsonb;
alter table public.student_attendance add column if not exists present_count integer default 0;
alter table public.student_attendance add column if not exists absent_count integer default 0;
alter table public.student_attendance add column if not exists late_count integer default 0;
alter table public.student_attendance add column if not exists excused_count integer default 0;
alter table public.student_attendance add column if not exists submitted_at timestamptz default now();

create index if not exists student_attendance_school_date_idx on public.student_attendance(school_id,attendance_date desc);
create index if not exists student_attendance_class_date_idx on public.student_attendance(class_id,attendance_date desc);

grant select,insert on public.student_attendance to authenticated;

-- Existing school-scoped RLS from EDU_V1_9_ACCOUNTS_ROLES.sql remains authoritative:
-- teachers insert their own school records; principal/admin can read all records for their school.
