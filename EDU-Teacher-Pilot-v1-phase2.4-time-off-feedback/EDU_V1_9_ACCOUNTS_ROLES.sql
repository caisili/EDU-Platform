-- EDU V1.9 — School Accounts & Roles
-- Run once in the SAME Supabase project used by Teacher and School Admin.
create extension if not exists pgcrypto;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text default '',
  role text not null default 'teacher' check (role in ('principal','admin','teacher','student')),
  school_id uuid references public.schools(id) on delete set null,
  created_at timestamptz default now()
);
create table if not exists public.school_invites (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  code text not null unique,
  role text not null default 'teacher' check (role in ('admin','teacher')),
  created_by uuid references auth.users(id),
  used_by uuid references auth.users(id),
  used_at timestamptz,
  expires_at timestamptz default (now()+interval '14 days'),
  created_at timestamptz default now()
);

-- Existing V1.8 operation tables gain stable school/user ownership.
alter table public.teaching_reports add column if not exists school_id uuid references public.schools(id) on delete cascade;
alter table public.teaching_reports add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.student_attendance add column if not exists school_id uuid references public.schools(id) on delete cascade;
alter table public.student_attendance add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.staff_attendance add column if not exists school_id uuid references public.schools(id) on delete cascade;
alter table public.staff_attendance add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.time_off_requests add column if not exists school_id uuid references public.schools(id) on delete cascade;
alter table public.time_off_requests add column if not exists user_id uuid references auth.users(id) on delete set null;

create or replace function public.edu_current_school_id() returns uuid
language sql stable security definer set search_path=public as $$
  select school_id from public.profiles where id=auth.uid() limit 1
$$;
create or replace function public.edu_current_role() returns text
language sql stable security definer set search_path=public as $$
  select role from public.profiles where id=auth.uid() limit 1
$$;

create or replace function public.edu_bootstrap_school(p_school_name text,p_full_name text)
returns uuid language plpgsql security definer set search_path=public as $$
declare sid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if exists(select 1 from public.profiles where id=auth.uid() and school_id is not null) then
    select school_id into sid from public.profiles where id=auth.uid(); return sid;
  end if;
  insert into public.schools(name) values(trim(p_school_name)) returning id into sid;
  insert into public.profiles(id,full_name,role,school_id) values(auth.uid(),trim(p_full_name),'principal',sid)
  on conflict(id) do update set full_name=excluded.full_name,role='principal',school_id=sid;
  return sid;
end $$;

create or replace function public.edu_create_school_invite(p_role text default 'teacher')
returns text language plpgsql security definer set search_path=public as $$
declare sid uuid; r text; c text;
begin
  sid:=public.edu_current_school_id(); r:=public.edu_current_role();
  if sid is null or r not in ('principal','admin') then raise exception 'School admin access required'; end if;
  if p_role not in ('teacher','admin') then raise exception 'Invalid invite role'; end if;
  c:='EDU-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.school_invites(school_id,code,role,created_by) values(sid,c,p_role,auth.uid());
  return c;
end $$;

create or replace function public.edu_join_school_by_invite(p_invite_code text,p_full_name text)
returns uuid language plpgsql security definer set search_path=public as $$
declare inv public.school_invites%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into inv from public.school_invites where upper(code)=upper(trim(p_invite_code)) and used_at is null and expires_at>now() limit 1;
  if inv.id is null then raise exception 'Invite code is invalid or expired'; end if;
  insert into public.profiles(id,full_name,role,school_id) values(auth.uid(),trim(p_full_name),inv.role,inv.school_id)
  on conflict(id) do update set full_name=excluded.full_name,role=excluded.role,school_id=excluded.school_id;
  update public.school_invites set used_by=auth.uid(),used_at=now() where id=inv.id;
  return inv.school_id;
end $$;

grant execute on function public.edu_bootstrap_school(text,text) to authenticated;
grant execute on function public.edu_create_school_invite(text) to authenticated;
grant execute on function public.edu_join_school_by_invite(text,text) to authenticated;

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.school_invites enable row level security;
alter table public.teaching_reports enable row level security;
alter table public.student_attendance enable row level security;
alter table public.staff_attendance enable row level security;
alter table public.time_off_requests enable row level security;

-- Replace the temporary V1.8 open MVP policies.
drop policy if exists "edu_mvp_teaching_reports" on public.teaching_reports;
drop policy if exists "edu_mvp_student_attendance" on public.student_attendance;
drop policy if exists "edu_mvp_staff_attendance" on public.staff_attendance;
drop policy if exists "edu_mvp_time_off_requests" on public.time_off_requests;

-- School/account visibility.
drop policy if exists "edu school read" on public.schools;
create policy "edu school read" on public.schools for select to authenticated using(id=public.edu_current_school_id());
drop policy if exists "edu profiles school read" on public.profiles;
create policy "edu profiles school read" on public.profiles for select to authenticated using(school_id=public.edu_current_school_id() or id=auth.uid());
drop policy if exists "edu invites admin read" on public.school_invites;
create policy "edu invites admin read" on public.school_invites for select to authenticated using(school_id=public.edu_current_school_id() and public.edu_current_role() in ('principal','admin'));

-- Teacher writes own records; school leadership reads all records in its school.
do $$ declare t text; begin
 foreach t in array array['teaching_reports','student_attendance','staff_attendance','time_off_requests'] loop
   execute format('drop policy if exists "edu ops read" on public.%I',t);
   execute format('create policy "edu ops read" on public.%I for select to authenticated using (school_id=public.edu_current_school_id() and (user_id=auth.uid() or public.edu_current_role() in (''principal'',''admin'')))',t);
   execute format('drop policy if exists "edu ops insert" on public.%I',t);
   execute format('create policy "edu ops insert" on public.%I for insert to authenticated with check (school_id=public.edu_current_school_id() and user_id=auth.uid())',t);
 end loop;
end $$;

drop policy if exists "edu timeoff admin update" on public.time_off_requests;
create policy "edu timeoff admin update" on public.time_off_requests for update to authenticated
using(school_id=public.edu_current_school_id() and public.edu_current_role() in ('principal','admin'))
with check(school_id=public.edu_current_school_id());
