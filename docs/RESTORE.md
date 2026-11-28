# Backup and restore

## Backup schedule and contents

- The GitHub Actions database workflow runs daily. It encrypts the SQL dump
  with GPG AES-256 and retains the artifact for 14 days.
- The Storage workflow runs weekly. It downloads the private `submissions`
  bucket, encrypts the archive, and retains it for 60 days.
- Both workflows require `BACKUP_ENCRYPTION_KEY`; database backup also needs
  `SUPABASE_DB_URL`, while Storage backup needs `SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY`.
- Backups are not tested until a restore drill is completed. Perform a restore
  drill at least quarterly in a separate project.

## Database restore

1. Download the encrypted database artifact from GitHub Actions. Keep it
   private.
2. Restore into a new or intentionally emptied Supabase project. Do not run
   this against a live database without a reviewed recovery plan.
3. Decrypt the archive without placing the passphrase in shell history:

   ```sh
   read -rsp 'Backup passphrase: ' BACKUP_ENCRYPTION_KEY
   export BACKUP_ENCRYPTION_KEY
   gpg --batch --decrypt --output class-portal.sql class-portal.sql.gpg
   unset BACKUP_ENCRYPTION_KEY
   ```

4. Link the CLI to the target project and apply the repository migrations:

   ```sh
   npx supabase link --project-ref <restore-project-ref>
   npx supabase db push
   ```

5. Restore the dump to the target's direct database URL with `psql`, using a
   secure prompt or a temporary environment variable for the connection
   string:

   ```sh
   psql "$RESTORE_DATABASE_URL" --set ON_ERROR_STOP=1 --file=class-portal.sql
   ```

6. Verify profiles, class membership, assignments, ledger totals, attendance
   locks, cron scheduling, and Auth account access. Rotate credentials if the
   source project may have been compromised.

Supabase-managed Auth and Storage metadata may have provider-specific restore
requirements. Confirm the current Supabase backup/restore guidance before a
production recovery and test it against a disposable project first.

## Submission file restore

1. Download the encrypted weekly Storage artifact and decrypt it with the same
   passphrase.
2. Extract into a private, access-controlled directory.
3. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
   `STORAGE_RESTORE_DIR` (the extracted directory), then run:

   ```sh
   npm run restore:storage -- --confirm-production
   ```

   The production confirmation flag is required for hosted URLs. The script
   upserts each object into the private `submissions` bucket and preserves the
   exact `{class_id}/{assignment_id}/{student_id}/{file}` keys.
4. Verify a teacher can generate a signed URL and that an unrelated student
   cannot read the object.
5. Securely remove local plaintext archives after the restore is verified.

Never attach decrypted SQL or student submissions to public issues, workflow
logs, or unencrypted artifacts.
