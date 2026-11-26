begin;

select plan(39);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'teacher@class.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'student-a@class.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'student-b@class.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'other-teacher@class.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'other-student@class.local', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'class-rep@class.local', '', now(), '{}', '{}', now(), now());

insert into public.profiles (id, full_name, username, roll_no)
values
  ('00000000-0000-0000-0000-000000000001', 'Teacher', 'teacher1', null),
  ('00000000-0000-0000-0000-000000000002', 'Student A', 'studenta2', '2'),
  ('00000000-0000-0000-0000-000000000003', 'Student B', 'studentb3', '3'),
  ('00000000-0000-0000-0000-000000000004', 'Other Teacher', 'teacher4', null),
  ('00000000-0000-0000-0000-000000000005', 'Other Student', 'student5', '5'),
  ('00000000-0000-0000-0000-000000000006', 'Class Representative', 'cr6', '6');

insert into public.classes (id, name, created_by)
values
  ('10000000-0000-0000-0000-000000000001', 'Class One', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', 'Class Two', '00000000-0000-0000-0000-000000000004');

insert into public.class_members (class_id, user_id, role)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'student'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'student'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', 'student'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006', 'cr');

insert into public.class_sessions (id, class_id, subject, starts_at, ends_at)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Math', now() - interval '1 hour', now() + interval '1 hour'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Science', now() - interval '1 hour', now() + interval '1 hour'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'History', now() - interval '2 hours', now() + interval '1 hour');

insert into public.attendance (id, class_id, session_id, student_id, status)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'present'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'absent'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', null),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', 'present');

update public.class_sessions
set ends_at = now() - interval '1 hour'
where id = '20000000-0000-0000-0000-000000000003';

insert into public.assignments (id, class_id, kind, title, due_at, max_marks, submission_mode)
values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'assignment', 'Task One', now() + interval '1 day', 10, 'soft');

insert into public.submissions (id, class_id, assignment_id, student_id, link)
values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'https://example.test/a'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'https://example.test/b');

insert into public.grades (submission_id, class_id, marks, graded_by)
values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 8, '00000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 6, '00000000-0000-0000-0000-000000000001');

insert into public.ledger_entries (id, class_id, type, amount, note, student_id, recorded_by)
values
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'collection', 25, 'Class supplies', null, '00000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'fine', 5, 'Late fine B', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'collection', 15, 'Other class collection', null, '00000000-0000-0000-0000-000000000004');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{}}';

select is(
  (select count(*)::integer from public.attendance where student_id = '00000000-0000-0000-0000-000000000002' and session_id = '20000000-0000-0000-0000-000000000001'),
  1,
  'student can read own attendance'
);
select is(
  (select count(*)::integer from public.attendance where student_id = '00000000-0000-0000-0000-000000000003'),
  0,
  'student cannot read another student attendance'
);
select is(
  (select count(*)::integer from public.attendance where class_id = '10000000-0000-0000-0000-000000000002'),
  0,
  'student cannot read attendance from another class'
);
select is(
  (select count(*)::integer from public.ledger_entries where id = '60000000-0000-0000-0000-000000000002'),
  0,
  'student cannot read another student ledger row'
);
select is(
  (select count(*)::integer from public.ledger_entries where class_id = '10000000-0000-0000-0000-000000000002'),
  0,
  'student cannot read ledger rows from another class'
);
select is(
  (select count(*)::integer from public.submissions),
  1,
  'student can read own submission'
);
select is(
  (select count(*)::integer from public.submissions where student_id = '00000000-0000-0000-0000-000000000003'),
  0,
  'student cannot read another student submission'
);
select is(
  (select count(*)::integer from public.grades),
  1,
  'student can read own grade'
);
select is(
  (select count(*)::integer from public.grades where submission_id = '50000000-0000-0000-0000-000000000002'),
  0,
  'student cannot read another student grade'
);
select is(
  (select count(*)::integer from public.classes where id = '10000000-0000-0000-0000-000000000002'),
  0,
  'student cannot access a different class'
);
select is(
  (select count(*)::integer from public.profiles where id = '00000000-0000-0000-0000-000000000002'),
  1,
  'student can read own profile'
);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{}}';
select results_eq(
  $$update public.class_sessions set ends_at = now() + interval '1 hour'
    where id = '20000000-0000-0000-0000-000000000003' returning id$$,
  array[]::uuid[],
  'teacher cannot extend a session after it ends'
);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{}}';
select throws_ok(
  $$insert into public.classes (name, created_by)
    values ('Unauthorized Class', auth.uid())$$,
  '42501',
  null,
  'students cannot create classes'
);
select throws_ok(
  $$insert into public.ledger_entries (class_id, type, amount, note, recorded_by)
    values ('10000000-0000-0000-0000-000000000001', 'collection', 10, 'forbidden', auth.uid())$$,
  '42501',
  null,
  'student cannot create ledger entries'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{}}';
select results_eq(
  $$update public.ledger_entries set note = 'changed' where id = '60000000-0000-0000-0000-000000000001' returning id$$,
  array[]::uuid[],
  'ledger entries cannot be updated'
);
select results_eq(
  $$delete from public.ledger_entries where id = '60000000-0000-0000-0000-000000000001' returning id$$,
  array[]::uuid[],
  'ledger entries cannot be deleted'
);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","role":"authenticated","app_metadata":{}}';
select results_eq(
  $$update public.ledger_entries set note = 'CR change'
    where id = '60000000-0000-0000-0000-000000000001' returning id$$,
  array[]::uuid[],
  'CRs cannot update ledger entries'
);
select results_eq(
  $$delete from public.ledger_entries
    where id = '60000000-0000-0000-0000-000000000001' returning id$$,
  array[]::uuid[],
  'CRs cannot delete ledger entries'
);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{}}';
select results_eq(
  $$update public.ledger_entries set note = 'student change'
    where id = '60000000-0000-0000-0000-000000000001' returning id$$,
  array[]::uuid[],
  'students cannot update ledger entries'
);
select results_eq(
  $$delete from public.ledger_entries
    where id = '60000000-0000-0000-0000-000000000001' returning id$$,
  array[]::uuid[],
  'students cannot delete ledger entries'
);
set local role service_role;
select throws_ok(
  $$update public.ledger_entries set note = 'service change'
    where id = '60000000-0000-0000-0000-000000000001' returning id$$,
  '55000',
  'Ledger entries are append-only',
  'service role cannot update ledger entries'
);
select throws_ok(
  $$delete from public.ledger_entries
    where id = '60000000-0000-0000-0000-000000000001' returning id$$,
  '55000',
  'Ledger entries are append-only',
  'service role cannot delete ledger entries'
);
reset role;

select throws_ok(
  $$insert into public.attendance (class_id, session_id, student_id, status)
    values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'present')$$,
  '55000',
  'The session has ended',
  'teacher cannot insert attendance after the session ends'
);
select results_eq(
  $$update public.attendance set status = 'present'
    where id = '30000000-0000-0000-0000-000000000003' returning id$$,
  array[]::uuid[],
  'teacher cannot update attendance after the session ends'
);
select results_eq(
  $$update public.attendance set status = 'absent', locked = true
    where id = '30000000-0000-0000-0000-000000000003' returning id$$,
  array[]::uuid[],
  'authenticated teacher cannot perform cron finalization'
);

reset role;
set local role service_role;
select throws_ok(
  $$update public.attendance set status = 'present'
    where id = '30000000-0000-0000-0000-000000000003' returning id$$,
  '55000',
  'The session has ended',
  'service role cannot override the attendance end time'
);
select throws_ok(
  $$update public.attendance set status = 'absent', locked = true
    where id = '30000000-0000-0000-0000-000000000003' returning id$$,
  '55000',
  'The session has ended',
  'service role cannot perform cron finalization'
);
select throws_ok(
  $$update public.class_sessions set ends_at = now() + interval '1 hour'
    where id = '20000000-0000-0000-0000-000000000003' returning id$$,
  '55000',
  'The session has ended',
  'service role cannot extend an ended session'
);
reset role;
select throws_ok(
  $$update public.ledger_entries set note = 'changed'
    where id = '60000000-0000-0000-0000-000000000001' returning id$$,
  '55000',
  'Ledger entries are append-only',
  'ledger trigger rejects updates'
);
select throws_ok(
  $$delete from public.ledger_entries
    where id = '60000000-0000-0000-0000-000000000001' returning id$$,
  '55000',
  'Ledger entries are append-only',
  'ledger trigger rejects deletes'
);
select set_config('request.jwt.claims', '{}', true);
set local role anon;
select throws_ok(
  $$update public.ledger_entries set note = 'anonymous change'
    where id = '60000000-0000-0000-0000-000000000001' returning id$$,
  '42501',
  null,
  'anonymous role cannot update ledger entries'
);
select throws_ok(
  $$delete from public.ledger_entries
    where id = '60000000-0000-0000-0000-000000000001' returning id$$,
  '42501',
  null,
  'anonymous role cannot delete ledger entries'
);
reset role;
select throws_ok(
  $$update public.attendance set status = 'present'
    where id = '30000000-0000-0000-0000-000000000003' returning id$$,
  '55000',
  'The session has ended',
  'attendance trigger rejects changes after the session ends'
);
select throws_ok(
  $$update public.attendance set status = 'absent', locked = true,
      student_id = '00000000-0000-0000-0000-000000000003'
    where id = '30000000-0000-0000-0000-000000000003' returning id$$,
  '55000',
  'The session has ended',
  'finalization cannot modify other attendance fields'
);
select lives_ok(
  $$update public.attendance set status = 'absent', locked = true
    where id = '30000000-0000-0000-0000-000000000003' returning id$$,
  'postgres can perform the exact finalization transition'
);
select throws_ok(
  $$update public.attendance set status = 'present', locked = false
    where id = '30000000-0000-0000-0000-000000000003' returning id$$,
  '55000',
  'Attendance is locked',
  'finalized attendance is immutable'
);
select throws_ok(
  $$delete from public.attendance where id = '30000000-0000-0000-0000-000000000003' returning id$$,
  '55000',
  'Attendance cannot be deleted',
  'attendance cannot be deleted'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"must_change_password":true}}';
select is(
  (select count(*)::integer from public.classes),
  0,
  'must_change_password blocks access'
);
select is(
  (select count(*)::integer from public.profiles),
  0,
  'must_change_password blocks profile access'
);

select * from finish();
rollback;
