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

-- Phase 2.1: teacher class-management helpers
create or replace function public.edu_teacher_classes()
returns table(class_id uuid,class_name text,grade text,subject text,class_code text,student_count bigint)
language sql security definer set search_path=public as $$
 select c.id,c.name,c.grade,c.subject,c.class_code,count(cm.id)
 from public.classes c
 left join public.class_memberships cm on cm.class_id=c.id
 where c.school_id=public.edu_current_school_id()
   and c.teacher_id=auth.uid()
   and c.active=true
 group by c.id,c.name,c.grade,c.subject,c.class_code,c.created_at
 order by c.created_at desc;
$$;
grant execute on function public.edu_teacher_classes() to authenticated;

-- Phase 2.2: real class roster + teacher-added students
create table if not exists public.class_roster_students (
 id uuid primary key default gen_random_uuid(),
 class_id uuid not null references public.classes(id) on delete cascade,
 student_id uuid references auth.users(id) on delete set null,
 full_name text not null,
 email text,
 status text not null default 'pending' check (status in ('pending','connected')),
 created_at timestamptz default now()
);
create unique index if not exists class_roster_students_class_email_key
 on public.class_roster_students(class_id, lower(email)) where email is not null;
alter table public.class_roster_students enable row level security;
drop policy if exists "edu roster school read" on public.class_roster_students;
create policy "edu roster school read" on public.class_roster_students for select to authenticated
 using(exists(select 1 from public.classes c where c.id=class_id and c.school_id=public.edu_current_school_id()));

create or replace function public.edu_add_roster_student(p_class_id uuid,p_full_name text,p_email text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare rid uuid; sid uuid;
begin
 if public.edu_current_role() not in ('teacher','principal','admin') then raise exception 'School staff access required'; end if;
 if not exists(select 1 from public.classes c where c.id=p_class_id and c.school_id=public.edu_current_school_id() and (public.edu_current_role()<>'teacher' or c.teacher_id=auth.uid())) then raise exception 'Class access denied'; end if;
 if nullif(trim(p_email),'') is not null then
   select u.id into sid from auth.users u join public.profiles p on p.id=u.id where lower(u.email)=lower(trim(p_email)) and p.school_id=public.edu_current_school_id() limit 1;
 end if;
 insert into public.class_roster_students(class_id,student_id,full_name,email,status)
 values(p_class_id,sid,trim(p_full_name),nullif(lower(trim(p_email)),''),case when sid is null then 'pending' else 'connected' end)
 on conflict (class_id, lower(email)) where email is not null do update set full_name=excluded.full_name,student_id=coalesce(excluded.student_id,class_roster_students.student_id),status=case when coalesce(excluded.student_id,class_roster_students.student_id) is null then 'pending' else 'connected' end
 returning id into rid;
 if sid is not null then insert into public.class_memberships(class_id,student_id) values(p_class_id,sid) on conflict do nothing; end if;
 return rid;
end $$;

create or replace function public.edu_teacher_roster(p_class_id uuid)
returns table(roster_key text,student_id uuid,full_name text,email text,status text)
language sql security definer set search_path=public as $$
 with joined as (
  select 'member:'||cm.student_id::text as roster_key,cm.student_id,coalesce(nullif(p.full_name,''),'Student') as full_name,u.email::text as email,'connected'::text as status
  from public.class_memberships cm join public.classes c on c.id=cm.class_id
  left join public.profiles p on p.id=cm.student_id left join auth.users u on u.id=cm.student_id
  where cm.class_id=p_class_id and c.school_id=public.edu_current_school_id() and (public.edu_current_role()<>'teacher' or c.teacher_id=auth.uid())
 ), manual as (
  select 'roster:'||r.id::text,r.student_id,r.full_name,r.email,r.status
  from public.class_roster_students r join public.classes c on c.id=r.class_id
  where r.class_id=p_class_id and c.school_id=public.edu_current_school_id() and (public.edu_current_role()<>'teacher' or c.teacher_id=auth.uid())
    and (r.student_id is null or not exists(select 1 from joined j where j.student_id=r.student_id))
 ) select * from joined union all select * from manual order by full_name;
$$;

grant execute on function public.edu_add_roster_student(uuid,text,text) to authenticated;
grant execute on function public.edu_teacher_roster(uuid) to authenticated;

-- Connect a pending teacher-added roster entry when that student later joins with the class code.
create or replace function public.edu_join_class_by_code(p_class_code text,p_full_name text)
returns uuid language plpgsql security definer set search_path=public as $$
declare c public.classes%rowtype; student_email text;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into c from public.classes where upper(class_code)=upper(trim(p_class_code)) and active=true limit 1;
 if c.id is null then raise exception 'Class code is invalid'; end if;
 select email into student_email from auth.users where id=auth.uid();
 insert into public.profiles(id,full_name,role,school_id) values(auth.uid(),trim(p_full_name),'student',c.school_id)
 on conflict(id) do update set full_name=excluded.full_name,role='student',school_id=excluded.school_id;
 insert into public.class_memberships(class_id,student_id) values(c.id,auth.uid()) on conflict do nothing;
 update public.class_roster_students set student_id=auth.uid(),full_name=trim(p_full_name),status='connected'
 where class_id=c.id and student_email is not null and lower(email)=lower(student_email);
 return c.id;
end $$;

-- Count the real roster: joined accounts plus teacher-added students not already represented by a joined account.
create or replace function public.edu_teacher_classes()
returns table(class_id uuid,class_name text,grade text,subject text,class_code text,student_count bigint)
language sql security definer set search_path=public as $$
 select c.id,c.name,c.grade,c.subject,c.class_code,
   (select count(*) from (
      select cm.student_id::text as k from public.class_memberships cm where cm.class_id=c.id
      union
      select coalesce(r.student_id::text,'roster:'||r.id::text) from public.class_roster_students r where r.class_id=c.id
   ) roster) as student_count
 from public.classes c
 where c.school_id=public.edu_current_school_id() and c.teacher_id=auth.uid() and c.active=true
 order by c.created_at desc;
$$;
grant execute on function public.edu_teacher_classes() to authenticated;
