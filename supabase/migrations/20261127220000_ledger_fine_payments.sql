alter table public.ledger_entries
  drop constraint ledger_entries_type_check,
  add constraint ledger_entries_type_check
    check (type in ('collection', 'expense', 'fine', 'fine_payment')),
  add constraint ledger_entries_fine_payment_requires_student
    check (type <> 'fine_payment' or student_id is not null);

drop policy "Class members can read their permitted ledger entries"
  on public.ledger_entries;
create policy "Class members can read their permitted ledger entries"
on public.ledger_entries for select to authenticated
using (
  public.has_role(class_id, array['teacher', 'cr'])
  or (
    student_id = (select auth.uid())
    and type in ('fine', 'fine_payment', 'collection')
    and public.has_role(class_id, array['student', 'cr'])
  )
);

drop policy "Teachers and CRs can add collections and expenses"
  on public.ledger_entries;
create policy "Teachers and CRs can add permitted ledger entries"
on public.ledger_entries for insert to authenticated
with check (
  type in ('collection', 'expense', 'fine_payment')
  and public.has_role(class_id, array['teacher', 'cr'])
  and recorded_by = (select auth.uid())
);

create or replace function public.ledger_entry_student_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_outstanding numeric;
begin
  if new.type in ('fine_payment', 'fine') and new.student_id is null then
    raise exception using errcode = '23514', message = 'Student is required for fines and payments';
  end if;

  if new.student_id is not null then
    perform 1
    from public.class_members cm
    where cm.class_id = new.class_id
      and cm.user_id = new.student_id
      and cm.role in ('student', 'cr')
    for update;
    if not found then
      raise exception using errcode = '23503', message = 'Ledger student must belong to the same class';
    end if;
  end if;

  if new.type = 'fine_payment' then
    select coalesce(sum(le.amount) filter (where le.type = 'fine'), 0)
      - coalesce(sum(le.amount) filter (where le.type = 'fine_payment'), 0)
    into v_outstanding
    from public.ledger_entries le
    where le.class_id = new.class_id
      and le.student_id = new.student_id;
    if new.amount > v_outstanding then
      raise exception using errcode = '23514', message = 'Payment exceeds the outstanding fine';
    end if;
  end if;

  return new;
end;
$$;

drop function public.get_class_ledger_totals(uuid);
create function public.get_class_ledger_totals(p_class_id uuid)
returns table (
  collection_total numeric,
  expense_total numeric,
  fine_total numeric,
  fine_payment_total numeric,
  balance_total numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_member(p_class_id) then
    raise exception using errcode = '42501', message = 'Class membership required';
  end if;

  return query
  select
    coalesce(sum(le.amount) filter (where le.type = 'collection'), 0),
    coalesce(sum(le.amount) filter (where le.type = 'expense'), 0),
    coalesce(sum(le.amount) filter (where le.type = 'fine'), 0),
    coalesce(sum(le.amount) filter (where le.type = 'fine_payment'), 0),
    coalesce(sum(le.amount) filter (where le.type = 'collection'), 0)
      - coalesce(sum(le.amount) filter (where le.type = 'expense'), 0)
  from public.ledger_entries le
  where le.class_id = p_class_id;
end;
$$;

revoke all on function public.get_class_ledger_totals(uuid)
  from public, anon, service_role;
grant execute on function public.get_class_ledger_totals(uuid) to authenticated;

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
  v_initial_fine_exists boolean;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;
  if new.status is distinct from 'late'
    and (tg_op <> 'UPDATE' or old.status is distinct from 'late')
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

  if new.status = 'late' then
    if tg_op = 'UPDATE' and old.status = 'late' then
      return new;
    end if;

    select exists (
      select 1
      from public.ledger_entries le
      where le.attendance_id = new.id
    )
    into v_initial_fine_exists;

    insert into public.ledger_entries (
      class_id, type, amount, note, student_id, attendance_id, recorded_by
    )
    values (
      new.class_id,
      'fine',
      v_late_fine,
      'Late attendance fine: ' || v_subject,
      new.student_id,
      case when v_initial_fine_exists then null else new.id end,
      v_actor
    )
    on conflict (attendance_id) do nothing;
  elsif tg_op = 'UPDATE' and old.status = 'late' then
    insert into public.ledger_entries (
      class_id, type, amount, note, student_id, recorded_by
    )
    values (
      new.class_id,
      'fine_payment',
      v_late_fine,
      'Late attendance fine reversed: ' || v_subject,
      new.student_id,
      v_actor
    );
  end if;

  return new;
end;
$$;
