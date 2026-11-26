drop policy "Teachers can update upcoming class sessions" on public.class_sessions;
create policy "Teachers can update class sessions"
on public.class_sessions for update to authenticated
using (public.has_role(class_id, array['teacher']))
with check (public.has_role(class_id, array['teacher']));

drop policy "Teachers can delete upcoming class sessions" on public.class_sessions;
create policy "Teachers can delete class sessions"
on public.class_sessions for delete to authenticated
using (public.has_role(class_id, array['teacher']));

drop policy "Teachers can update attendance" on public.attendance;
create policy "Teachers can update attendance"
on public.attendance for update to authenticated
using (public.has_role(class_id, array['teacher']))
with check (public.has_role(class_id, array['teacher']));

create or replace function public.attendance_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ends_at timestamptz;
  v_old_ends_at timestamptz;
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
      and coalesce(auth.jwt() ->> 'role', '') not in ('authenticated', 'anon', 'service_role')
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

  if tg_op = 'UPDATE' then
    select s.ends_at
    into v_old_ends_at
    from public.class_sessions s
    where s.id = old.session_id
      and s.class_id = old.class_id;

    if v_old_ends_at is null then
      raise exception using errcode = '23503', message = 'Attendance session does not exist';
    end if;

    if now() >= v_old_ends_at then
      raise exception using errcode = '55000', message = 'The session has ended';
    end if;
  end if;

  return new;
end;
$$;
