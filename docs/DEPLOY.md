# Production deployment preparation

These are preparation steps only; this project has not been deployed.

## 1. Create Supabase

1. Create a hosted Supabase project and choose a region close to the class.
2. Save the project URL, publishable key, service-role key, and direct database
   connection string in a password manager. Never commit them.
3. Check current plan quotas and pricing at
   [Supabase pricing](https://supabase.com/pricing/). The free plan and its
   availability can change.

## 2. Apply database migrations

Link the repository to the project and apply reviewed migrations:

```sh
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Confirm `pg_cron` is available for the project, then check that the
`finalize-expired-attendance` job exists and runs every minute. The attendance
migration enables the extension and schedules the job. Verify it from the
database with:

```sql
select jobname, schedule, command
from cron.job
where jobname = 'finalize-expired-attendance';
```

## 3. Deploy the student-import Edge Function

Set the function's required secrets with the Supabase CLI. Do not put the
service-role key in Vercel or a browser bundle:

```sh
npx supabase secrets set SUPABASE_URL=<project-url>
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
npx supabase secrets set AUTH_EMAIL_DOMAIN=students.example.com
npx supabase functions deploy create-students
```

`AUTH_EMAIL_DOMAIN` controls the placeholder email suffix used for student
Auth accounts. The function reads it from this secret at runtime; it is never
hard-coded and never sent to the browser. Set it to any domain you own or leave
it as `students.example.com` — Supabase Auth accepts it and no mail is sent to
the placeholder address until a student completes the first-login popup.

Keep JWT verification enabled; do not pass `--no-verify-jwt` in production.
The function independently requires an active teacher and validates the class
and CSV. A student JWT returns HTTP 403.

## 4. Configure Supabase Auth and email

In Supabase Authentication settings:

- Disable public signups.
- Set the minimum password length to 8 or greater.
- Configure Turnstile with the production secret; local published test keys
  must not be used in production.
- Set strict sign-in, token, and email-send rate limits appropriate for the
  class.
- Set the production site URL and exact HTTPS redirect URLs, including
  `/auth/confirm`.
- Keep double-confirm email changes disabled so first-login setup works with
  the placeholder Auth email.
- Configure custom SMTP. The application does not depend on a specific
  provider. See the verified free-plan notes in [LIMITS](./LIMITS.md).

## 5. Create the production administrator

Create a confirmed Auth user in the Supabase dashboard, then create its profile
and class using the SQL in the README's production bootstrap section. Do not
give the global administrator a class membership unless they should have
teacher access to class data. Create and assign class teachers from
`/admin/teachers`.

## 6. Configure Vercel

Set these project environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL` (the canonical HTTPS deployment origin)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` as a server-only variable, never prefixed with
  `NEXT_PUBLIC_`

Use the production Turnstile public key, not the local test key. Keep HTTPS
enabled. The application emits a nonce-based Content Security Policy,
clickjacking/content-type protections, secure production cookies, and HSTS.

## 7. Configure rate limits and backups

In Vercel Firewall, enable rate limits for `/login` and `/api/*`; tune the
thresholds to expected class traffic and CAPTCHA behavior.

Configure these GitHub repository secrets for scheduled backups:

- `SUPABASE_DB_URL`: direct database connection URI with backup access.
- `SUPABASE_URL`: hosted project URL for Storage API access.
- `SUPABASE_SERVICE_ROLE_KEY`: server-side key for listing and downloading the
  private submissions bucket.
- `BACKUP_ENCRYPTION_KEY`: a long, unique passphrase stored separately from
  downloaded backups.

Configure the GitHub repository variable `PRODUCTION_BASE_URL` to the canonical
HTTPS site URL. GitHub Actions creates daily encrypted database artifacts
(14-day retention), weekly encrypted submissions artifacts (60-day retention),
and a scheduled health ping. Make sure the database allows the runner to
connect; if its network policy forbids hosted runners, use an approved
self-hosted runner rather than weakening the database firewall.

## 8. Production seed and smoke checks

Create a gitignored `.env.production.local` with the hosted project credentials:

```sh
# .env.production.local  — gitignored, never committed
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SEED_ADMIN_PASSWORD=<strong-admin-password>
```

Create the production administrator (idempotent; requires the class to exist
from step 5):

```sh
node scripts/seed-admin.mjs \
  --env-file=.env.production.local \
  --confirm-production
```

Seed the student roster only when intended:

```sh
node scripts/seed-students.mjs \
  --env-file=.env.production.local \
  --confirm-production \
  --class-id=<class-uuid>
```

Never use `npm run seed:admin` or `npm run seed:students` for production — those
scripts read `.env.local`. The `--env-file=` flag explicitly targets the hosted
project; both commands refuse production URLs without `--confirm-production`.
Credentials are read from the named file; nothing is printed or logged.

After Vercel and Supabase are configured, run:

```sh
npm run smoke:prod -- --url=https://<your-site>
```

The smoke check is read-only: it verifies `/api/health` and that `/login`
returns HTTP 200. Also verify the login CAPTCHA, one disposable student
first-login flow, email confirmation in the configured mailbox, teacher
attendance, and a private signed submission link. Do not create attendance or
ledger test records in the real class. Remove any disposable account and test
class after verification, subject to the append-only and ended-session guards.

No hosted project, Vercel site, Firewall rule, SMTP provider, or production
account is created by these instructions.
