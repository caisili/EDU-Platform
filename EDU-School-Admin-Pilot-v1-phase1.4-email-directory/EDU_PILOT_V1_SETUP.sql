-- EDU Pilot v1.0 — controlled school pilots, classes, student enrollment
-- Run AFTER EDU_V1_9_ACCOUNTS_ROLES.sql in the shared Supabase project.
create extension if not exists pgcrypto;

alter table public.schools add column if not exists pilot_status text default 'active';
alter table public.schools add column if not exists pilot_start date;
alter table public.schools add column if not exists pilot_end date;

create table if not exists public.classes (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 teacher_id uuid references auth.users(id) on delete set null,
 name text not null,
 grade text default '', subject text default 'Math',
 class_code text not null unique,
 active boolean default true,
 created_at timestamptz default now()
);
create table if not exists public.class_memberships (
 id uuid primary key default gen_random_uuid(),
 class_id uuid not null references public.classes(id) on delete cascade,
 student_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz default now(),
 unique(class_id,student_id)
);

alter table public.classes enable row level security;
alter table public.class_memberships enable row level security;

drop policy if exists "edu classes school read" on public.classes;
create policy "edu classes school read" on public.classes for select to authenticated
 using(school_id=public.edu_current_school_id());
drop policy if exists "edu classes staff insert" on public.classes;
create policy "edu classes staff insert" on public.classes for insert to authenticated
 with check(school_id=public.edu_current_school_id() and public.edu_current_role() in ('principal','admin','teacher'));
drop policy if exists "edu memberships school read" on public.class_memberships;
create policy "edu memberships school read" on public.class_memberships for select to authenticated
 using(exists(select 1 from public.classes c where c.id=class_id and c.school_id=public.edu_current_school_id()));

create or replace function public.edu_create_class(p_name text,p_grade text default '7',p_subject text default 'Math')
returns table(class_id uuid,class_code text) language plpgsql security definer set search_path=public as $$
declare sid uuid; cid uuid; code text;
begin
 sid:=public.edu_current_school_id();
 if sid is null or public.edu_current_role() not in ('principal','admin','teacher') then raise exception 'School staff access required'; end if;
 code:='CLASS-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
 insert into public.classes(school_id,teacher_id,name,grade,subject,class_code)
 values(sid,case when public.edu_current_role()='teacher' then auth.uid() else null end,trim(p_name),p_grade,p_subject,code) returning id into cid;
 return query select cid,code;
end $$;

create or replace function public.edu_join_class_by_code(p_class_code text,p_full_name text)
returns uuid language plpgsql security definer set search_path=public as $$
declare c public.classes%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into c from public.classes where upper(class_code)=upper(trim(p_class_code)) and active=true limit 1;
 if c.id is null then raise exception 'Class code is invalid'; end if;
 insert into public.profiles(id,full_name,role,school_id) values(auth.uid(),trim(p_full_name),'student',c.school_id)
 on conflict(id) do update set full_name=excluded.full_name,role='student',school_id=excluded.school_id;
 insert into public.class_memberships(class_id,student_id) values(c.id,auth.uid()) on conflict do nothing;
 return c.id;
end $$;

grant execute on function public.edu_create_class(text,text,text) to authenticated;
grant execute on function public.edu_join_class_by_code(text,text) to authenticated;
