begin;

select plan(94);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'rls-teacher@students.example.com', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'rls-student-a@students.example.com', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'rls-student-b@students.example.com', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'rls-other-teacher@students.example.com', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'rls-other-student@students.example.com', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'rls-class-rep@students.example.com', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'rls-admin@students.example.com', '', now(), '{}', '{}', now(), now());

insert into public.profiles (id, full_name, username, roll_no)
values
  ('00000000-0000-0000-0000-000000000001', 'Teacher', 'teacher1', null),
  ('00000000-0000-0000-0000-000000000002', 'Student A', 'studenta2', '2'),
  ('00000000-0000-0000-0000-000000000003', 'Student B', 'studentb3', '3'),
  ('00000000-0000-0000-0000-000000000004', 'Other Teacher', 'teacher4', null),
  ('00000000-0000-0000-0000-000000000005', 'Other Student', 'student5', '5'),
  ('00000000-0000-0000-0000-000000000006', 'Class Representative', 'cr6', '6'),
  ('00000000-0000-0000-0000-000000000007', 'Global Admin', 'globaladmin', null);

update public.profiles
set is_admin = true
where id = '00000000-0000-0000-0000-000000000007';

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

update public.class_members
set roll_no = 'R-1', uni_roll_no = 'U-1'
where class_id = '10000000-0000-0000-0000-000000000001'
  and user_id = '00000000-0000-0000-0000-000000000002';
update public.class_members
set roll_no = 'R-2', uni_roll_no = 'U-2'
where class_id = '10000000-0000-0000-0000-000000000001'
  and user_id = '00000000-0000-0000-0000-000000000003';
update public.class_members
set roll_no = 'R-1', uni_roll_no = 'U-1'
where class_id = '10000000-0000-0000-0000-000000000002'
  and user_id = '00000000-0000-0000-0000-000000000005';

insert into public.class_sessions (id, class_id, subject, starts_at, ends_at, late_fine)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Math', now() - interval '1 hour', now() + interval '1 hour', 5),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Science', now() - interval '1 hour', now() + interval '1 hour', 0),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'History', now() - interval '2 hours', now() + interval '1 hour', 0),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Biology', now() - interval '2 hours', now() + interval '1 hour', 0),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'Physics', now() - interval '1 hour', now() + interval '1 hour', 0),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'Chemistry', now() - interval '1 hour', now() + interval '1 hour', 0);

insert into public.attendance (id, class_id, session_id, student_id, status)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'present'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'absent'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', null),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', 'present'),
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', null),
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', null)
on conflict (session_id, student_id) do update
set id = excluded.id, status = excluded.status;

update public.class_sessions
set ends_at = now() - interval '1 hour'
where id = '20000000-0000-0000-0000-000000000003';
update public.class_sessions
set ends_at = now() - interval '1 hour'
where id = '20000000-0000-0000-0000-000000000004';

select is(
  (select count(*)::integer from public.attendance where session_id = '20000000-0000-0000-0000-000000000001'),
  3,
  'creating a session creates attendance for every student and CR'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{}}';
update public.attendance
set status = 'late'
where id = '30000000-0000-0000-0000-000000000001';
select is(
  (select amount from public.ledger_entries where attendance_id = '30000000-0000-0000-0000-000000000001'),
  5::numeric,
  'late attendance creates a fine for the configured amount'
);
select is(
  (select recorded_by from public.ledger_entries where attendance_id = '30000000-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-000000000001'::uuid,
  'late fine records the authenticated teacher'
);
update public.attendance
set status = 'late'
where id = '30000000-0000-0000-0000-000000000001';
select is(
  (select count(*)::integer from public.ledger_entries where attendance_id = '30000000-0000-0000-0000-000000000001'),
  1,
  'repeated late status does not duplicate its fine'
);
update public.attendance
set status = 'present'
where id = '30000000-0000-0000-0000-000000000001';
select is(
  (select count(*)::integer
    from public.ledger_entries
    where type = 'fine_payment'
      and student_id = '00000000-0000-0000-0000-000000000002'
      and note = 'Late attendance fine reversed: Math'),
  1,
  'changing late attendance creates one compensating fine payment'
);
select is(
  (select amount
    from public.ledger_entries
    where type = 'fine_payment'
      and student_id = '00000000-0000-0000-0000-000000000002'
      and note = 'Late attendance fine reversed: Math'),
  5::numeric,
  'late fine correction preserves the configured amount'
);
select is(
  public.save_attendance_batch(
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000005',
    '[
      {"attendance_id":"30000000-0000-0000-0000-000000000005","status":"present"},
      {"attendance_id":"30000000-0000-0000-0000-000000000006","status":"absent"}
    ]'::jsonb
  ),
  2,
  'teacher can save multiple attendance changes in one batch'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{}}',
  true
);
select throws_ok(
  $$select public.save_attendance_batch(
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000005',
    '[{"attendance_id":"30000000-0000-0000-0000-000000000005","status":"absent"}]'::jsonb
  )$$,
  '42501',
  'Teacher access required',
  'student cannot save attendance batches'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{}}',
  true
);
select throws_ok(
  $$select public.save_attendance_batch(
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    '[{"attendance_id":"30000000-0000-0000-0000-000000000004","status":"absent"}]'::jsonb
  )$$,
  '42501',
  'Teacher access required',
  'teacher cannot batch update attendance in another class'
);
reset role;

insert into public.assignments (id, class_id, kind, title, due_at, max_marks, submission_mode)
values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'assignment', 'Task One', now() + interval '1 day', 10, 'soft');
insert into public.assignments (
  id, class_id, kind, title, due_at, max_marks, submission_mode, submission_type
)
values
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'assignment', 'Hard deadline', now() - interval '1 hour', 10, 'hard', 'either'),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'assignment', 'Soft deadline', now() - interval '1 hour', 10, 'soft', 'link'),
  ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'quiz', 'Private quiz', now() + interval '1 day', 10, 'hard', 'link'),
  ('40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'assignment', 'Other class', now() + interval '1 day', 10, 'soft', 'link');
insert into public.quiz_questions (class_id, assignment_id, question, options, correct_index, marks)
values (
  '10000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000004',
  'Private answer key',
  '["A", "B"]'::jsonb,
  1,
  1
);

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
  ('60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'collection', 15, 'Other class collection', null, '00000000-0000-0000-0000-000000000004'),
  ('60000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'collection', 2, 'Student B payment', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{}}';
insert into public.ledger_entries (
  class_id, type, amount, note, student_id, recorded_by
)
values (
  '10000000-0000-0000-0000-000000000001',
  'fine_payment',
  4,
  'Fine payment',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001'
);
select is(
  (select fine_payment_total
    from public.get_class_ledger_totals('10000000-0000-0000-0000-000000000001')),
  9::numeric,
  'class totals include compensating and paid fines'
);
select throws_ok(
  $$insert into public.ledger_entries (
      class_id, type, amount, note, student_id, recorded_by
    ) values (
      '10000000-0000-0000-0000-000000000001',
      'fine_payment',
      2,
      'Overpayment',
      '00000000-0000-0000-0000-000000000003',
      '00000000-0000-0000-0000-000000000001'
    )$$,
  '23514',
  'Payment exceeds the outstanding fine',
  'fine payments cannot exceed outstanding fines'
);
reset role;

select throws_ok(
  $$insert into public.class_members (class_id, user_id, role, roll_no, uni_roll_no)
    values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'student', 'R-1', 'U-3')$$,
  '23505',
  null,
  'roll numbers are unique within a class'
);
select throws_ok(
  $$insert into public.class_members (class_id, user_id, role, roll_no, uni_roll_no)
    values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'student', 'R-3', 'U-1')$$,
  '23505',
  null,
  'university roll numbers are unique within a class'
);
select is(
  (select count(*)::integer from public.class_members where roll_no = 'R-1'),
  2,
  'same roll number is allowed in different classes'
);
select is(
  (select count(*)::integer from public.class_members where uni_roll_no = 'U-1'),
  2,
  'same university roll number is allowed in different classes'
);

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
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","role":"authenticated","app_metadata":{}}';
select is(
  (select count(*)::integer from public.attendance
    where student_id = '00000000-0000-0000-0000-000000000006'
      and session_id = '20000000-0000-0000-0000-000000000001'),
  1,
  'CR can read only their own attendance'
);
select is(
  (select collection_total from public.get_class_ledger_totals('10000000-0000-0000-0000-000000000001')),
  27::numeric,
  'CR can read class totals'
);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{}}';
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
  (select count(*)::integer from public.ledger_entries
    where id = '60000000-0000-0000-0000-000000000001'),
  0,
  'student cannot read class-level ledger entries'
);
select is(
  (select collection_total from public.get_class_ledger_totals('10000000-0000-0000-0000-000000000001')),
  27::numeric,
  'student can read the class collection total without reading entries'
);
select is(
  (select fine_total from public.get_class_ledger_totals('10000000-0000-0000-0000-000000000001')),
  10::numeric,
  'class fine totals include all students without exposing fine entries'
);
select throws_ok(
  $$select * from public.get_class_ledger_totals('10000000-0000-0000-0000-000000000002')$$,
  '42501',
  'Class membership required',
  'student cannot read totals from another class'
);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{}}';
select is(
  (select count(*)::integer from public.ledger_entries where id = '60000000-0000-0000-0000-000000000004'),
  1,
  'student can read their own collection entry'
);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{}}';
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
  (select count(*)::integer from public.quiz_questions),
  0,
  'students cannot read quiz answer keys'
);
select throws_ok(
  $$insert into public.submissions (
      class_id, assignment_id, student_id, link
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000002',
      'https://example.test/late'
    )$$,
  '55000',
  'The submission deadline has passed',
  'hard assignment rejects submissions after the deadline'
);
insert into public.submissions (
  id, class_id, assignment_id, student_id, link
)
values (
  '50000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  'https://example.test/late-soft'
);
select is(
  (select submitted_late
    from public.submissions
    where id = '50000000-0000-0000-0000-000000000003'),
  true,
  'soft assignment accepts and flags a late submission'
);
select throws_ok(
  $$insert into public.submissions (
      class_id, assignment_id, student_id, link
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
      'javascript:alert(1)'
    )$$,
  '23514',
  null,
  'submission links reject unsafe URL schemes'
);
select throws_ok(
  $$insert into public.submissions (
      class_id, assignment_id, student_id, link
    ) values (
      '10000000-0000-0000-0000-000000000002',
      '40000000-0000-0000-0000-000000000005',
      '00000000-0000-0000-0000-000000000002',
      'https://example.test/wrong-class'
    )$$,
  '23503',
  'Assignment does not exist',
  'student cannot submit work across classes'
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
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000007","role":"authenticated","app_metadata":{}}';
select is(public.is_admin(), true, 'global administrator is recognized');
select is(
  (select count(*)::integer
    from public.classes
    where id in (
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002'
    )),
  2,
  'global administrator can list classes'
);
select is(
  (select count(*)::integer from public.attendance),
  0,
  'global administrator cannot read attendance without a class role'
);
select is(
  (select count(*)::integer from public.ledger_entries),
  0,
  'global administrator cannot read fines without a class role'
);
select is(
  (select count(*)::integer from public.grades),
  0,
  'global administrator cannot read grades without a class role'
);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{}}';
reset role;
update public.profiles
set sessions_revoked_at = now()
where id = '00000000-0000-0000-0000-000000000002';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{}}';
select is(
  public.is_session_current(),
  false,
  'revoked authentication sessions fail the database session guard'
);
reset role;
update public.profiles
set sessions_revoked_at = null
where id = '00000000-0000-0000-0000-000000000002';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{}}';
select is(
  public.has_role('10000000-0000-0000-0000-000000000001', array['teacher']),
  false,
  'non-teacher is not authorized to create students'
);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated","app_metadata":{}}';
select is(
  public.has_role('10000000-0000-0000-0000-000000000001', array['teacher']),
  false,
  'teacher of another class is not authorized for this class'
);
select is(
  (select count(*)::integer from public.profiles where id = '00000000-0000-0000-0000-000000000002'),
  0,
  'teacher cannot read another class student profiles'
);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{}}';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{}}';
select lives_ok(
  $$update public.class_sessions set ends_at = ends_at + interval '1 hour'
    where id = '20000000-0000-0000-0000-000000000001' returning id$$,
  'teacher can adjust an upcoming session end'
);
select is(
  (select count(*)::integer
    from public.audit_log
    where table_name = 'class_sessions'
      and row_id = '20000000-0000-0000-0000-000000000001'
      and action = 'UPDATE'
      and actor = auth.uid()
      and (old ->> 'ends_at')::timestamptz < (new ->> 'ends_at')::timestamptz),
  1,
  'session end adjustments are audit logged'
);
select throws_ok(
  $$update public.class_sessions set ends_at = now() + interval '1 hour'
    where id = '20000000-0000-0000-0000-000000000003' returning id$$,
  '55000',
  'The session has ended',
  'teacher cannot extend a session after it ends'
);
select throws_ok(
  $$update public.class_sessions set starts_at = starts_at - interval '1 day'
    where id = '20000000-0000-0000-0000-000000000004' returning id$$,
  '55000',
  'The session has ended',
  'teacher cannot change the start of an ended session'
);
select throws_ok(
  $$update public.class_sessions set late_fine = 5
    where id = '20000000-0000-0000-0000-000000000004' returning id$$,
  '55000',
  'The session has ended',
  'teacher cannot change the late fine of an ended session'
);
select throws_ok(
  $$update public.class_sessions set class_id = '10000000-0000-0000-0000-000000000002'
    where id = '20000000-0000-0000-0000-000000000004' returning id$$,
  '55000',
  'The session has ended',
  'teacher cannot move an ended session to another class'
);
select throws_ok(
  $$delete from public.class_sessions where id = '20000000-0000-0000-0000-000000000004' returning id$$,
  '55000',
  'The session has ended',
  'ended sessions without attendance cannot be deleted'
);
select throws_ok(
  $$delete from public.class_sessions where id = '20000000-0000-0000-0000-000000000005' returning id$$,
  '55000',
  'Class session has attendance',
  'sessions with attendance cannot be deleted'
);
select throws_ok(
  $$delete from public.class_sessions where id = '20000000-0000-0000-0000-000000000006' returning id$$,
  '55000',
  'Class session has attendance',
  'upcoming sessions with generated attendance cannot be deleted'
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
select throws_ok(
  $$insert into public.ledger_entries (class_id, type, amount, note, student_id, recorded_by)
    values ('10000000-0000-0000-0000-000000000001', 'collection', 10, 'wrong class', '00000000-0000-0000-0000-000000000005', auth.uid())$$,
  '23503',
  'Ledger student must belong to the same class',
  'teacher cannot create an entry for another class student'
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
  $$insert into public.ledger_entries (class_id, type, amount, note, student_id, recorded_by)
    values ('10000000-0000-0000-0000-000000000001', 'fine', 5, 'direct fine', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001')$$,
  '55000',
  'Fines can only be created by the attendance trigger',
  'service role cannot create a fine directly'
);
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
select throws_ok(
  $$update public.attendance set status = 'present'
    where id = '30000000-0000-0000-0000-000000000003' returning id$$,
  '55000',
  'The session has ended',
  'teacher cannot update attendance after the session ends'
);
select throws_ok(
  $$update public.attendance set status = 'absent', locked = true
    where id = '30000000-0000-0000-0000-000000000003' returning id$$,
  '55000',
  'The session has ended',
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
select is(
  has_function_privilege('authenticated', 'public.finalize_expired_attendance()', 'EXECUTE'),
  false,
  'authenticated users cannot invoke attendance finalization'
);
select is(
  (select count(*)::integer from cron.job where jobname = 'finalize-expired-attendance'),
  1,
  'expired attendance finalization is scheduled with pg_cron'
);
select is(
  public.finalize_expired_attendance(),
  5,
  'cron finalizes every remaining null attendance row for ended sessions'
);
select is(
  (select count(*)::integer
    from public.attendance
    where session_id in (
      '20000000-0000-0000-0000-000000000003',
      '20000000-0000-0000-0000-000000000004'
    )
    and status = 'absent'
    and locked),
  6,
  'finalized attendance is absent and locked'
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
  1,
  'must_change_password permits only the own profile'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000007","role":"authenticated","app_metadata":{}}';
update public.class_members
set role = 'teacher'
where class_id = '10000000-0000-0000-0000-000000000001'
  and user_id = '00000000-0000-0000-0000-000000000003';

set local role postgres;
select ok(
  exists (
    select 1 from public.audit_log
    where table_name = 'attendance'
      and row_id = '30000000-0000-0000-0000-000000000001'
      and action = 'UPDATE'
  ),
  'attendance changes are audited'
);
select ok(
  exists (
    select 1 from public.audit_log
    where table_name = 'ledger_entries'
      and row_id = '60000000-0000-0000-0000-000000000001'
      and action = 'INSERT'
  ),
  'ledger inserts are audited'
);
select ok(
  exists (
    select 1 from public.audit_log
    where table_name = 'grades'
      and row_id = '50000000-0000-0000-0000-000000000001'
      and action = 'INSERT'
  ),
  'grade inserts are audited'
);
select ok(
  exists (
    select 1 from public.audit_log
    where table_name = 'class_sessions'
      and row_id = '20000000-0000-0000-0000-000000000001'
      and action = 'INSERT'
  ),
  'class session inserts are audited'
);
select ok(
  exists (
    select 1 from public.account_audit_log
    where class_id = '10000000-0000-0000-0000-000000000001'
      and target_user_id = '00000000-0000-0000-0000-000000000003'
      and actor = '00000000-0000-0000-0000-000000000007'
      and action = 'class_membership_updated'
  ),
  'class role changes are audited'
);

select * from finish();
rollback;
