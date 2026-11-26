create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  username text not null unique,
  roll_no text
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.class_members (
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('teacher', 'cr', 'student')),
  created_at timestamptz not null default now(),
  primary key (class_id, user_id)
);

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  subject text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  late_fine numeric not null default 0 check (late_fine >= 0),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (class_id, id)
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null,
  session_id uuid not null,
  student_id uuid not null references auth.users (id) on delete cascade,
  status text check (status in ('present', 'absent', 'late')),
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (class_id, session_id)
    references public.class_sessions (class_id, id) on delete cascade,
  unique (session_id, student_id),
  unique (class_id, id)
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  type text not null check (type in ('collection', 'expense', 'fine')),
  amount numeric not null check (amount > 0),
  note text not null,
  student_id uuid references auth.users (id) on delete restrict,
  attendance_id uuid unique,
  recorded_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  foreign key (class_id, attendance_id)
    references public.attendance (class_id, id) on delete restrict,
  check (type = 'fine' or attendance_id is null),
  check (type <> 'fine' or student_id is not null),
  unique (class_id, id)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  kind text not null check (kind in ('assignment', 'quiz', 'presentation')),
  title text not null,
  description text not null default '',
  due_at timestamptz not null,
  max_marks numeric not null check (max_marks > 0),
  submission_mode text not null check (submission_mode in ('hard', 'soft')),
  created_at timestamptz not null default now(),
  unique (class_id, id)
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null,
  assignment_id uuid not null,
  question text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array'),
  correct_index integer not null check (correct_index >= 0),
  marks numeric not null check (marks > 0),
  foreign key (class_id, assignment_id)
    references public.assignments (class_id, id) on delete cascade,
  check (correct_index < jsonb_array_length(options)),
  unique (class_id, id)
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null,
  assignment_id uuid not null,
  student_id uuid not null references auth.users (id) on delete cascade,
  file_path text,
  link text,
  status text not null default 'submitted'
    check (status in ('submitted', 'done')),
  submitted_at timestamptz not null default now(),
  foreign key (class_id, assignment_id)
    references public.assignments (class_id, id) on delete cascade,
  check (file_path is not null or link is not null or status = 'done'),
  unique (assignment_id, student_id),
  unique (class_id, id)
);

create table public.grades (
  submission_id uuid primary key,
  class_id uuid not null,
  marks numeric not null check (marks >= 0),
  feedback text not null default '',
  graded_by uuid not null references auth.users (id),
  graded_at timestamptz not null default now(),
  foreign key (class_id, submission_id)
    references public.submissions (class_id, id) on delete cascade
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  table_name text not null,
  row_id uuid not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old jsonb,
  new jsonb,
  actor uuid references auth.users (id) on delete set null,
  at timestamptz not null default now()
);

create or replace function public.is_member(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'must_change_password', 'false') <> 'true'
    and exists (
      select 1
      from public.class_members cm
      where cm.class_id = p_class_id
        and cm.user_id = auth.uid()
    );
$$;

create or replace function public.has_role(p_class_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'must_change_password', 'false') <> 'true'
    and exists (
      select 1
      from public.class_members cm
      where cm.class_id = p_class_id
        and cm.user_id = auth.uid()
        and cm.role = any (p_roles)
    );
$$;

create or replace function public.attendance_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ends_at timestamptz;
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'Attendance cannot be deleted';
  end if;

  if tg_op = 'UPDATE' and old.locked then
    raise exception using errcode = '55000', message = 'Attendance is locked';
  end if;

  select s.ends_at
  into v_ends_at
  from public.class_sessions s
  where s.id = new.session_id
    and s.class_id = new.class_id;

  if v_ends_at is null then
    raise exception using errcode = '23503', message = 'Attendance session does not exist';
  end if;

  if now() >= v_ends_at then
    if tg_op = 'UPDATE'
      and current_user = 'postgres'
      and old.status is null
      and new.status = 'absent'
      and new.locked
      and new.id = old.id
      and new.class_id = old.class_id
      and new.session_id = old.session_id
      and new.student_id = old.student_id
      and (to_jsonb(new) - 'status' - 'locked')
        = (to_jsonb(old) - 'status' - 'locked')
    then
      return new;
    end if;
    raise exception using errcode = '55000', message = 'The session has ended';
  end if;

  return new;
end;
$$;

create or replace function public.ledger_entries_immutable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'Ledger entries are append-only';
end;
$$;

create or replace function public.class_session_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if now() >= old.ends_at then
    raise exception using errcode = '55000', message = 'The session has ended';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.add_class_creator_as_teacher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.class_members (class_id, user_id, role)
  values (new.id, new.created_by, 'teacher');
  return new;
end;
$$;

create trigger classes_add_creator
after insert on public.classes
for each row execute function public.add_class_creator_as_teacher();

create trigger attendance_guard_before_write
before insert or update or delete on public.attendance
for each row execute function public.attendance_guard();

create trigger ledger_entries_are_immutable
before update or delete on public.ledger_entries
for each row execute function public.ledger_entries_immutable();

create trigger class_sessions_closed_after_end
before update or delete on public.class_sessions
for each row execute function public.class_session_guard();

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.class_sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.assignments enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.submissions enable row level security;
alter table public.grades enable row level security;
alter table public.audit_log enable row level security;

create policy "Profiles are visible to their owner"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  and coalesce(auth.jwt() -> 'app_metadata' ->> 'must_change_password', 'false') <> 'true'
);

create policy "Members can read their classes"
on public.classes for select to authenticated
using (public.is_member(id));

create policy "Authenticated users can create classes"
on public.classes for insert to authenticated
with check (
  created_by = (select auth.uid())
  and coalesce(auth.jwt() -> 'app_metadata' ->> 'must_change_password', 'false') <> 'true'
  and exists (
    select 1
    from public.class_members cm
    where cm.user_id = (select auth.uid())
      and cm.role = 'teacher'
  )
);

create policy "Teachers can update classes"
on public.classes for update to authenticated
using (public.has_role(id, array['teacher']))
with check (public.has_role(id, array['teacher']));

create policy "Members can read class membership"
on public.class_members for select to authenticated
using (public.is_member(class_id));

create policy "Teachers can add class members"
on public.class_members for insert to authenticated
with check (public.has_role(class_id, array['teacher']));

create policy "Teachers can update class members"
on public.class_members for update to authenticated
using (public.has_role(class_id, array['teacher']))
with check (public.has_role(class_id, array['teacher']));

create policy "Teachers can remove class members"
on public.class_members for delete to authenticated
using (public.has_role(class_id, array['teacher']));

create policy "Members can read class sessions"
on public.class_sessions for select to authenticated
using (public.is_member(class_id));

create policy "Teachers can create class sessions"
on public.class_sessions for insert to authenticated
with check (public.has_role(class_id, array['teacher']));

create policy "Teachers can update upcoming class sessions"
on public.class_sessions for update to authenticated
using (
  public.has_role(class_id, array['teacher'])
  and ends_at > now()
)
with check (
  public.has_role(class_id, array['teacher'])
  and ends_at > now()
);

create policy "Teachers can delete upcoming class sessions"
on public.class_sessions for delete to authenticated
using (
  public.has_role(class_id, array['teacher'])
  and ends_at > now()
);

create policy "Teachers and students can read attendance"
on public.attendance for select to authenticated
using (
  public.has_role(class_id, array['teacher'])
  or (
    student_id = (select auth.uid())
    and public.has_role(class_id, array['student'])
  )
);

create policy "Teachers can insert attendance"
on public.attendance for insert to authenticated
with check (
  public.has_role(class_id, array['teacher'])
  and exists (
    select 1
    from public.class_sessions s
    where s.id = session_id
      and s.class_id = attendance.class_id
      and s.ends_at > now()
  )
);

create policy "Teachers can update attendance"
on public.attendance for update to authenticated
using (
  public.has_role(class_id, array['teacher'])
  and exists (
    select 1
    from public.class_sessions s
    where s.id = session_id
      and s.class_id = attendance.class_id
      and s.ends_at > now()
  )
)
with check (
  public.has_role(class_id, array['teacher'])
  and exists (
    select 1
    from public.class_sessions s
    where s.id = session_id
      and s.class_id = attendance.class_id
      and s.ends_at > now()
  )
);

create policy "Teachers and CRs can read the class ledger"
on public.ledger_entries for select to authenticated
using (
  public.has_role(class_id, array['teacher', 'cr'])
  or (
    type = 'fine'
    and student_id = (select auth.uid())
    and public.has_role(class_id, array['student'])
  )
);

create policy "Teachers and CRs can add collections and expenses"
on public.ledger_entries for insert to authenticated
with check (
  type in ('collection', 'expense')
  and public.has_role(class_id, array['teacher', 'cr'])
  and recorded_by = (select auth.uid())
);

create policy "Members can read assignments"
on public.assignments for select to authenticated
using (public.is_member(class_id));

create policy "Teachers can manage assignments"
on public.assignments for all to authenticated
using (public.has_role(class_id, array['teacher']))
with check (public.has_role(class_id, array['teacher']));

create policy "Teachers can read quiz questions"
on public.quiz_questions for select to authenticated
using (public.has_role(class_id, array['teacher']));

create policy "Teachers can manage quiz questions"
on public.quiz_questions for all to authenticated
using (public.has_role(class_id, array['teacher']))
with check (public.has_role(class_id, array['teacher']));

create policy "Students and teachers can read submissions"
on public.submissions for select to authenticated
using (
  public.has_role(class_id, array['teacher'])
  or (
    student_id = (select auth.uid())
    and public.has_role(class_id, array['student'])
  )
);

create policy "Students can submit their own work before the deadline"
on public.submissions for insert to authenticated
with check (
  student_id = (select auth.uid())
  and public.has_role(class_id, array['student'])
  and exists (
    select 1
    from public.assignments a
    where a.id = assignment_id
      and a.class_id = submissions.class_id
      and a.due_at >= now()
  )
);

create policy "Students can update their own work before the deadline"
on public.submissions for update to authenticated
using (
  student_id = (select auth.uid())
  and public.has_role(class_id, array['student'])
)
with check (
  student_id = (select auth.uid())
  and public.has_role(class_id, array['student'])
  and exists (
    select 1
    from public.assignments a
    where a.id = assignment_id
      and a.class_id = submissions.class_id
      and a.due_at >= now()
  )
);

create policy "Students and teachers can read grades"
on public.grades for select to authenticated
using (
  public.has_role(class_id, array['teacher'])
  or (
    public.has_role(class_id, array['student'])
    and exists (
      select 1
      from public.submissions s
      where s.id = submission_id
        and s.class_id = grades.class_id
        and s.student_id = (select auth.uid())
    )
  )
);

create policy "Teachers can manage grades"
on public.grades for all to authenticated
using (public.has_role(class_id, array['teacher']))
with check (public.has_role(class_id, array['teacher']));

create policy "Teachers can read audit history"
on public.audit_log for select to authenticated
using (public.has_role(class_id, array['teacher']));

revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

revoke all on function public.is_member(uuid) from public, anon;
revoke all on function public.has_role(uuid, text[]) from public, anon;
revoke all on function public.attendance_guard() from public, anon, authenticated;
revoke all on function public.ledger_entries_immutable() from public, anon, authenticated;
revoke all on function public.class_session_guard() from public, anon, authenticated;
revoke all on function public.add_class_creator_as_teacher() from public, anon, authenticated;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.has_role(uuid, text[]) to authenticated;
