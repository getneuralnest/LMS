CONTINUE AND COMPLETE THE WHOLE PROJECT. This supersedes every earlier prompt, including "stop after Phase 2".

AUTONOMY
- Do NOT stop at the end of a stage. Run stage after stage until everything, including the deployment docs, is done. Commit after each passing gate. Never push, never deploy.
- Stop only if (a) I must act (Docker access denied, a credential or account only I can create), or (b) a gate still fails after 3 root-cause fix attempts. Then say exactly what you need.
- After each stage give a 3-line status and keep going. Full report at the very end.
- Never print passwords, keys or tokens in output, logs or reports. (The last report printed a local password. Don't.)
- Never report "done/passes" without running the command in this session and pasting the real pass/fail counts. Never edit a test's expectation to make it pass; fix the code or schema.
- No new dependencies without asking. Stock shadcn UI only. students.csv and .env* stay out of git. Reuse existing code and refactor instead of rewriting.
- After ANY config.toml change run: npx supabase stop && npx supabase start (db reset does not reload Auth config). Add npm run env:check that fails if .env.local mixes a hosted Supabase URL with local keys, and run it before dev, tests and seeds.

CURRENT STATE (your last report): Phase 2 built with the OLD design (random temp passwords, /change-password page, credentials CSV download, abdullah as teacher, email domain abdullah.qds.com). 54/54 pgTAP, Vitest 12, Playwright 5 passed. Replace the old design as below and keep what still applies.

ROLES: admin (global, me), teacher, cr, student. Admin creates teachers and assigns them to the class; admin has no access to student marks/fines unless also a teacher.

STAGE 1: Accounts, popup, admin
1.1 Student rules (replaces random temp passwords; remove the credentials CSV download):
- username = full name lowercased, letters only (strip spaces, dots, hyphens, apostrophes, non-ASCII) + roll_no. Initial password = the same string. "Abdullah Bajwa" + 1122 -> abdullahbajwa1122; "M.Umair Ali" + 241124 -> mumairali241124. name, roll_no, uni_roll_no are text with leading zeros kept; roll_no and uni_roll_no are unique per class. A username clash fails that row with a clear message.
- Placeholder auth email: username@AUTH_EMAIL_DOMAIN, a single constant defaulting to "students.example.com". I own no domain. Remove abdullah.qds.com everywhere. Verify Supabase Auth accepts the default.
- Login: username + password. The server action looks up the profile, reads the user's CURRENT auth email via the admin API, and calls signInWithPassword with it. Generic error for any failure. Turnstile on the form (Cloudflare's published test keys locally), with the captcha token passed to Supabase. Success redirects by role: admin -> /admin, teacher -> /teacher, student/CR -> /.
1.2 Seeding:
- npm run seed:students reads gitignored ./data/students.csv (name,roll_no,uni_roll_no), using the SAME shared function as the create-students Edge Function and the teacher/admin CSV import UI. Idempotent; reports created/skipped/failed; a --confirm-production flag is required when the URL is not local.
- Committed seed.sql and fixtures use only 3 fake students.
- npm run seed:admin creates admin: full_name "Abdullah", username "abdullah", password from SEED_ADMIN_PASSWORD in .env.local. Remove the old seed:teacher. E2E creates its own throwaway admin and teacher.
1.3 First-login popup (student only, blocking, cannot be dismissed):
- While unclaimed, a modal "Set up your account" asks for email, new password and confirm password; the LMS is unreachable behind it. Enforce on the server too: middleware, plus RLS helpers that return false (except reading own profile and the claim action) while app_metadata.must_change_password = true.
- Server action: Zod (valid email, password >= 8, confirm matches, new password != the default and != the username). Call supabase.auth.updateUser({ email, password }). The password changes immediately and Supabase sends a confirmation mail to the new address. Set double_confirm_changes = false in config.toml, otherwise Supabase also waits on the undeliverable placeholder. Then clear must_change_password via the admin API (server-only), refreshSession, and store claimed_at on the profile.
- After the submit the student sees the whole LMS. Email confirmation is optional.
1.4 Confirmation reminder:
- At every login until the real email is confirmed, show a dismissible modal ("Confirm your email, we sent a link to x@y.com") with "Resend" (rate-limited) and "Change email". Dismissing lasts for that session; it comes back at the next login.
- /auth/confirm route handler verifies the token hash (verifyOtp) and redirects to the dashboard. Configure site_url and additional_redirect_urls for local and production.
- "Forgot password" on /login works only for accounts with a confirmed email, always returns the same generic message, and is rate-limited. The teacher action "Reset password" issues a NEW random temporary password (shown once), sets must_change_password = true so the popup shows again, signs out that student's sessions, and is audit-logged; teacher of that class only.
- Local mail goes to Mailpit (port 54324). Hosted SMTP is provider-agnostic: docs/DEPLOY.md lists two free options (Gmail app password, Brevo). Check each provider's current free limits in its docs. Hardcode no provider.
1.5 Teachers: admin creates them at /admin/teachers (full name, username, password typed or generated). No email, no popup, no forced password change. Admin can reset a teacher's password, deactivate a teacher, assign a teacher to the class.
1.6 Teacher roster: roll_no, uni_roll_no, claimed / email-confirmed status, Reset password, Set as CR, and the CSV import.
GATE 1: pgTAP (unclaimed user cannot read class data; a student cannot create or reset accounts; a teacher of another class cannot reset; admin cannot read student marks; unique rolls; self-signup rejected). Vitest (username generation with dots, hyphens, multi-word names, leading zeros; CSV validation). Playwright (default-password login -> popup -> set email+password -> LMS visible -> Mailpit confirmation mail -> clicking it confirms -> reminder stops; reminder returns at next login while unconfirmed; the default password no longer works; generic login errors; admin creates a teacher; teacher login has no popup).

STAGE 2: Attendance
- Teacher creates a session per date with its own start and end time (subject, starts_at, ends_at, late_fine). No fixed timetable; off days have no session. Rows are created for every student with status null.
- Teacher UI: TanStack Table, one row per student (roll_no, name), Present/Absent/Late select, optimistic update, keyboard navigation, clear locked state after the end. Unmarked rows display as Absent after ends_at.
- pg_cron every minute finalizes (null -> absent, locked = true) after ends_at as the postgres role; idempotent. Test that it runs and the guard accepts it.
- Late creates exactly one ledger fine entry (amount = late_fine) via trigger. Changing Late to another status before the end adds a compensating ledger entry, never an edit or delete.
- Students see only their own attendance: percentage = (present + late) / finished sessions, plus history.
- Confirm that tests exist for the class_sessions protections: once old.ends_at <= now(), starts_at, ends_at, late_fine and class_id cannot change; ended sessions and sessions with attendance cannot be deleted. Add them if missing.
- The one-time Excel history import is NOT part of this task.
GATE 2: pgTAP and Playwright for attendance pass.

STAGE 3: Ledger and fines
- Append-only ledger (collection, expense, fine, fine_payment); no UPDATE/DELETE for any role, enforced by triggers and policies. Corrections are new entries.
- Teacher and CR record collection, expense and fine_payment (against a student). Fines are trigger-only.
- Pending fine = sum(fine) - sum(fine_payment) per student. Class totals (collected, spent, balance) come from a view or function, never stored. CSV export for teacher and CR.
GATE 3: pgTAP (a student cannot insert; no role updates or deletes; pending-fine math) and Playwright.

STAGE 4: Student dashboard and LMS
- Student dashboard: pending fine, attendance percentage, assignments due (sorted, status pending / submitted / graded / overdue), recent marks.
- Teacher creates/edits assignments (title, description, due_at, max_marks, kind assignment|presentation). Per assignment: accepted types file, link or either; mode hard (locked at due_at, enforced in RLS and storage policy) or soft (late accepted and flagged late). The teacher sees all submissions, opens files, adds marks and feedback.
- Students submit a file or paste a link as allowed, and can replace it until the deadline (hard) or at any time (soft). Links: http/https only, max length, rendered with rel="noopener noreferrer", never as javascript: URLs.
- Private bucket "submissions" at {class_id}/{assignment_id}/{student_id}/{file}; storage RLS mirrors table RLS; max 10 MB; pdf, docx, pptx, png, jpg; signed URLs only.
- Quizzes (MCQ, auto-graded by a security-definer function, correct_index never sent to students, one attempt unless the teacher resets) come last. If time is short, skip and tell me.
- Students see only their own submissions and marks.
GATE 4: pgTAP (cross-student read denied, hard upload after due denied, wrong class denied, link scheme validation, correct_index unreadable) and Playwright (file submission, link submission, grading, a student sees only own marks).

STAGE 5: Hardening
- Security headers + strict CSP, secure httpOnly cookies, every server action validated with Zod and checking role and class server-side.
- GET /api/health runs a trivial DB query and returns 200, no secrets.
- Audit triggers on attendance, ledger_entries, grades, class_sessions and account actions (resets, role changes).
- GitHub Actions: lint, typecheck, vitest, db reset + test db, Playwright on every push; daily supabase db dump (encrypted artifact, 14-day retention); weekly storage backup; health ping every 3 days.
- docs/RESTORE.md, docs/LIMITS.md, README. npm audit with high/critical fixed. Secrets scan of git history.
GATE 5: full local CI-equivalent run is green (lint, typecheck, vitest, db reset, test db, Playwright, production build).

STAGE 6: Deployment preparation (do not deploy)
- docs/DEPLOY.md, exact ordered steps: hosted Supabase project (free), npx supabase link and db push, enable pg_cron, deploy the Edge Function with JWT verification ON, auth settings (signups off, min password 8, Turnstile, strict rate limits, custom SMTP, site_url and redirect URLs), production admin with a strong password, seed:students against production with the guard, Vercel env vars (service role key server-only, never NEXT_PUBLIC_), Firewall rate-limit rule for /login and /api/*, GitHub secrets for backups, uptime monitor, and a post-deploy smoke checklist with test data deleted afterwards.
- npm run smoke:prod: read-only health and login-page check against a URL.
- Final report: a table of every requirement (attendance table, auto-absent, immutability, late fines, CR collection/spending, fine payments, assignments/presentations/quizzes, hard/soft, file/link submission, teacher marks, name+roll accounts, first-login popup, optional email confirmation, admin-created teachers, rate limiting, RLS, backups, heartbeat) as implemented / tested by (test name) / manual check needed. Include every command run with real pass/fail counts and anything that could not run.