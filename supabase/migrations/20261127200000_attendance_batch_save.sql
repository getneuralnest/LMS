create or replace function public.save_attendance_batch(
  p_class_id uuid,
  p_session_id uuid,
  p_updates jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requested integer;
  v_matching integer;
  v_updated integer;
begin
  if auth.uid() is null
    or not public.has_role(p_class_id, array['teacher'])
  then
    raise exception using errcode = '42501', message = 'Teacher access required';
  end if;

  if p_updates is null or jsonb_typeof(p_updates) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Attendance updates must be an array';
  end if;

  v_requested := jsonb_array_length(p_updates);
  if v_requested = 0 then
    raise exception using errcode = '22023', message = 'At least one attendance update is required';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_updates) as updates(item)
    where jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item -> 'attendance_id') is distinct from 'string'
      or not (item ? 'status')
      or not (
        item -> 'status' = 'null'::jsonb
        or (
          jsonb_typeof(item -> 'status') = 'string'
          and item ->> 'status' in ('present', 'absent', 'late')
        )
      )
  ) then
    raise exception using errcode = '22023', message = 'Invalid attendance update';
  end if;

  if exists (
    select item ->> 'attendance_id'
    from jsonb_array_elements(p_updates) as updates(item)
    group by item ->> 'attendance_id'
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'Attendance rows cannot be repeated';
  end if;

  if not exists (
    select 1
    from public.class_sessions s
    where s.id = p_session_id
      and s.class_id = p_class_id
      and s.ends_at > now()
  ) then
    raise exception using errcode = '55000', message = 'The session has ended or does not exist';
  end if;

  select count(*)::integer
  into v_matching
  from jsonb_array_elements(p_updates) as updates(item)
  join public.attendance a
    on a.id::text = updates.item ->> 'attendance_id'
   and a.class_id = p_class_id
   and a.session_id = p_session_id
   and not a.locked;

  if v_matching <> v_requested then
    raise exception using errcode = '55000', message = 'Attendance is locked or does not belong to this session';
  end if;

  update public.attendance a
  set status = case
    when updates.item -> 'status' = 'null'::jsonb then null
    else updates.item ->> 'status'
  end
  from jsonb_array_elements(p_updates) as updates(item)
  where a.id::text = updates.item ->> 'attendance_id'
    and a.class_id = p_class_id
    and a.session_id = p_session_id
    and not a.locked
    and a.status is distinct from case
      when updates.item -> 'status' = 'null'::jsonb then null
      else updates.item ->> 'status'
    end;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.save_attendance_batch(uuid, uuid, jsonb)
  from public, anon, service_role;
grant execute on function public.save_attendance_batch(uuid, uuid, jsonb)
  to authenticated;
