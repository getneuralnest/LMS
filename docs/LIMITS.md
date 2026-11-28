# Operational limits

## Application limits

| Area | Limit |
| --- | --- |
| Student CSV upload | 1 MB maximum |
| Submission object | 10 MiB maximum |
| Allowed submission file types | PDF, DOCX, PPTX, PNG, JPG/JPEG |
| Submission link | HTTP/HTTPS only, maximum 2,048 characters |
| Private signed file link | Expires after 5 minutes |
| Assignment title | 160 characters |
| Assignment description | 5,000 characters |
| Grade feedback | 5,000 characters |
| Password | At least 8 characters; configured Auth policy may be stricter |

Database policies and triggers enforce deadlines, append-only ledger rules,
class membership, and attendance locking independently of these UI limits.
There is no supported bulk historical attendance import.

## Email provider references

Provider quotas and free-plan terms can change. These figures were checked
against the linked provider documentation on November 28, 2026; re-check the
provider pages before choosing a service.

- **Brevo Free:** 300 email sends per day. Its documentation says transactional
  messages can queue up to 1,000 additional messages after the daily limit;
  that does not make them immediate delivery. See
  [Brevo Free plan limits](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan).
- **Personal Gmail:** sending is limited to 500 emails per day, with sending
  disabled for up to 24 hours after reaching the limit. App passwords require
  2-Step Verification; Google says they are not recommended when a more secure
  sign-in method is available. See [Gmail sending limits](https://support.google.com/mail/answer/22839)
  and [Google app passwords](https://support.google.com/accounts/answer/185833).
- **Google Workspace:** standard accounts have a higher documented limit, but
  trial accounts are lower and exact SMTP relay limits differ. This is not a
  free personal SMTP option; consult
  [Workspace sending limits](https://support.google.com/a/answer/166852).

For low-volume class account confirmations, use the provider's own SMTP
credentials and rate controls. Do not hardcode a provider or rely on a free
quota as a delivery guarantee.

## Hosting and storage quotas

Supabase, Vercel, and email-provider quotas/pricing can change and depend on
region, usage, and plan. Check their current official pages before production:
[Supabase pricing](https://supabase.com/pricing) and
[Vercel pricing](https://vercel.com/pricing). A provider quota is not a
substitute for monitoring database size, file storage, bandwidth, and email
delivery failures.
