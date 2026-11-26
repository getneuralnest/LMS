PROJECT: Class Portal — attendance + CR ledger + LMS for one class (one teacher now, multi-class ready).

HARD CONSTRAINTS
- Stack only: Next.js (App Router, TypeScript), Supabase (Auth, Postgres, Storage, pg_cron, Edge Functions), shadcn/ui, TanStack Table, react-hook-form, Zod, @supabase/ssr. Deploy on Vercel.
- Testing: Vitest (unit), Playwright (e2e), pgTAP via `supabase test db` (RLS).
- Do NOT add any other dependency without asking me first. No custom design system.
- UI: stock shadcn components, plain and clean. No gradients, emojis, hero sections or marketing copy.
- Keep it simple: small files, no abstractions without a second use, no speculative features.
- Everything in migrations (supabase/migrations). Local dev via Supabase CLI.

ROLES (table class_members: class_id, user_id, role = teacher | cr | student)
Every table has class_id. RLS checks membership + role through security-definer helper functions (is_member, has_role). Enable RLS on ALL tables, deny by default.

DATA MODEL
- profiles(id -> auth.users, full_name, username unique, roll_no)
- classes, class_members
- class_sessions(id, class_id, subject, starts_at, ends_at, late_fine numeric default 0)
- attendance(id, session_id, student_id, status: present|absent|late|null, locked bool) unique(session_id, student_id)
- ledger_entries(id, class_id, type: collection|expense|fine, amount > 0, note, student_id nullable, attendance_id nullable unique, recorded_by, created_at)
- assignments(id, class_id, kind: assignment|quiz|presentation, title, description, due_at, max_marks, submission_mode: hard|soft)
- quiz_questions(assignment_id, question, options jsonb, correct_index, marks)
- submissions(id, assignment_id, student_id, file_path, link, status, submitted_at) unique(assignment_id, student_id)
- grades(submission_id, marks, feedback, graded_by)
- audit_log(id, table_name, row_id, action, old, new, actor, at) filled by triggers on attendance, ledger_entries, grades

FEATURES AND RULES
1. Accounts
   - Teacher uploads a CSV (name, roll_no). Edge Function `create-students` (teacher-only, service role key stays there) creates auth users with username = name+roll_no, internal email username@class.local, and a random temporary password. It returns a CSV of credentials once, never stored.
   - Login screen takes username + password and maps to the internal email.
   - Set app_metadata.must_change_password = true on creation. Middleware redirects to /change-password, and RLS helper returns false while the claim is true. After the change, a server action clears the flag via the admin API (users cannot edit app_metadata).
2. Attendance
   - Teacher creates a session; rows are created for all students with status null.
   - Teacher UI: TanStack Table, one row per student, Present/Absent/Late select, optimistic update, Excel-like keyboard navigation.
   - Trigger rejects any insert/update on attendance once now() > session.ends_at.
   - pg_cron every minute: for sessions past ends_at, set null -> absent and locked = true.
   - Setting status late inserts one ledger fine entry (amount = session.late_fine) via trigger, idempotent through attendance_id. Strictly immutable after class end, no override.
   - Students see only their own attendance.
3. CR ledger
   - Append-only: no UPDATE/DELETE policies, plus a trigger that raises on update/delete. Corrections are new entries.
   - Teacher and CR can insert collection/expense. Fines are trigger-only.
   - Students see their own fines/dues. All members see class totals (computed via a view/function, never stored).
4. LMS
   - Teacher creates/edits assignments, quizzes (MCQ), presentations, and grades submissions.
   - hard: file upload, blocked after due_at (enforced in RLS/storage policy). soft: student marks done or adds a link.
   - Quizzes auto-graded server-side by a security-definer function. correct_index is never sent to students.
   - Students see only their own submissions and marks.
5. Storage
   - Private bucket `submissions`, path {class_id}/{assignment_id}/{student_id}/{file}. Storage RLS mirrors table RLS. Max 10 MB; pdf/docx/pptx/png/jpg only. Signed URLs only.

SECURITY
- Never trust client input: Zod validation on every server action and route handler.
- Service role key only in Edge Functions / server-only code. Validate env vars with Zod at startup.
- Supabase Auth rate limits on, minimum password length 8, Turnstile CAPTCHA on login.
- Vercel Firewall rate-limit rules on /login and /api/*.
- Security headers + strict CSP in next.config, secure httpOnly cookies, HTTPS only.
- Audit triggers as above.
- GET /api/health runs `select 1` against the DB and returns 200 (used by an uptime monitor).
- One singleton Supabase client per context; no per-request client creation in loops.

TESTS (required, not optional)
- pgTAP: student cannot read another student's attendance/submissions/grades; cannot write attendance after ends_at; ledger update/delete fails; student cannot create ledger entries; must_change_password blocks data access; cross-class access denied.
- Vitest: Zod schemas, username generation, fine calculation, quiz grading.
- Playwright: first login -> forced password change; teacher marks attendance; lock after end time; CR adds collection; student submits hard and soft assignment; student cannot access teacher pages.
- GitHub Actions: lint, typecheck, unit, pgTAP, e2e on every push.

BUILD ORDER (stop and show me after each phase)
1. Repo setup, Supabase local, schema + RLS + pgTAP tests, CI.
2. Auth, create-students function, forced password change.
3. Attendance + cron + fines.
4. CR ledger.
5. LMS (assignments, submissions, storage, quizzes, grading).
6. Health route, headers, rate limiting, Vercel deploy, README with setup steps.

DEFINITION OF DONE per phase: migrations apply cleanly, all tests green, no TypeScript errors, no unused code.