create extension if not exists pg_cron;

drop policy "Teachers and students can read attendance" on public.attendance;
create policy "Teachers, students, and CRs can read attendance"
on public.attendance for select to authenticated
using (
  public.has_role(class_id, array['teacher'])
  or (
    student_id = (select auth.uid())
    and public.has_role(class_id, array['student', 'cr'])
  )
);

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
      and new.locked
      and (
        (old.status is null and new.status = 'absent')
        or new.status is not distinct from old.status
      )
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

create or replace function public.create_session_attendance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.attendance (class_id, session_id, student_id)
  select new.class_id, new.id, cm.user_id
  from public.class_members cm
  join public.profiles p on p.id = cm.user_id
  where cm.class_id = new.class_id
    and cm.role in ('student', 'cr')
    and p.is_active
  on conflict (session_id, student_id) do nothing;

  return new;
end;
$$;

revoke all on function public.create_session_attendance()
  from public, anon, authenticated, service_role;

create trigger class_sessions_create_attendance
after insert on public.class_sessions
for each row execute function public.create_session_attendance();

create or replace function public.add_attendance_late_fine()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_late_fine numeric;
  v_subject text;
  v_actor uuid;
begin
  if new.status is distinct from 'late'
    or (tg_op = 'UPDATE' and old.status = 'late')
  then
    return new;
  end if;

  select s.late_fine, s.subject
  into v_late_fine, v_subject
  from public.class_sessions s
  where s.id = new.session_id
    and s.class_id = new.class_id;

  if v_late_fine is null or v_late_fine <= 0 then
    return new;
  end if;

  v_actor := auth.uid();
  if v_actor is null then
    raise exception using errcode = '42501', message = 'A signed-in teacher must record attendance';
  end if;

  insert into public.ledger_entries (
    class_id, type, amount, note, student_id, attendance_id, recorded_by
  )
  values (
    new.class_id,
    'fine',
    v_late_fine,
    'Late attendance fine: ' || v_subject,
    new.student_id,
    new.id,
    v_actor
  )
  on conflict (attendance_id) do nothing;

  return new;
end;
$$;

revoke all on function public.add_attendance_late_fine()
  from public, anon, authenticated, service_role;

create trigger attendance_add_late_fine
after insert or update on public.attendance
for each row execute function public.add_attendance_late_fine();

create or replace function public.finalize_expired_attendance()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_finalized integer;
begin
  update public.attendance a
  set status = coalesce(a.status, 'absent'),
      locked = true
  from public.class_sessions s
  where s.id = a.session_id
    and s.class_id = a.class_id
    and s.ends_at <= now()
    and not a.locked;

  get diagnostics v_finalized = row_count;
  return v_finalized;
end;
$$;

revoke all on function public.finalize_expired_attendance()
  from public, anon, authenticated, service_role;

select cron.schedule(
  'finalize-expired-attendance',
  '* * * * *',
  'select public.finalize_expired_attendance();'
);
