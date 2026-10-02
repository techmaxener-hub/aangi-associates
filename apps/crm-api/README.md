# apps/crm-api

Plain PHP 8 + MySQL backend for the Aangi Associates CRM, replacing the
Supabase project that was deleted on 2026-09-10. No Composer dependencies
— runs on any Hostinger PHP hosting plan with a MySQL database.

## One-time setup on Hostinger

1. **Create a MySQL database** in hPanel → Databases → MySQL Databases.
   Note the host, database name, username, and password it gives you.
2. **Deploy this folder** to `/api/` on the `aa.tmarinternational.com`
   FTP account (already automated by `.github/workflows/ci.yml`'s deploy
   job on every push to `main` — or upload manually once via FTP/file
   manager for a first test before wiring CI).
3. **Create `env.php`** directly on the server (it's gitignored, CI never
   uploads it) — copy `env.example.php`'s contents and fill in the real
   DB host/name/user/password, plus a random `SETUP_TOKEN`.
4. **Run the schema**: in hPanel's phpMyAdmin, import `schema.sql` then
   `seed.sql`, in that order, against the database from step 1.
5. **Create the first admin user** — upload `setup_admin.php` (excluded
   from automated deploys on purpose) and run:
   ```
   curl -X POST https://aa.tmarinternational.com/api/setup_admin.php \
     -d "token=YOUR_SETUP_TOKEN&email=info@aangiassociates.com&password=CHOOSE_A_REAL_PASSWORD&full_name=Jainik Shah"
   ```
   Then **delete `setup_admin.php` from the server**. It refuses to run
   again once any admin exists, but delete it anyway.
6. **Schedule the renewal-reminder cron job** — hPanel → Advanced → Cron
   Jobs → add `0 3 * * * php /home/<hostinger-user>/public_html/api/cron/renewal_reminders.php`
   (adjust the path to wherever `/api/` actually resolves on disk — check
   hPanel's File Manager for the real path). Without this, 60/30/14-day
   renewal reminders are never generated or sent. Inert without
   `WHATSAPP_SYSTEM_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` configured (step 7).
6b. **Schedule the daily intimation digest cron job** — same hPanel
   screen, add a second job: `0 7 * * * php /home/<hostinger-user>/public_html/api/cron/daily_intimation.php`.
   This is the Admin/Staff-only digest (today's due birthday wishes +
   renewal reminders, emailed with a PDF attachment — see
   `lib/intimation.php`'s header). Unlike step 6, it needs no WhatsApp
   credentials at all: every button it sends is a dispatch-token link an
   admin/staff member clicks themselves (`intimation_redirect.php`), never
   an automatic send to a client. It does need `MAIL_FROM_ADDRESS` set
   (step 7) and at least one admin/staff user with a real `email` on file,
   or it has nowhere to send the digest and logs that instead.
7. **WhatsApp / SMS credentials** (optional, can be added later): set
   `WHATSAPP_SYSTEM_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` in `env.php` for
   renewal reminders to actually send, and `SMS_PROVIDER`/`SMS_API_KEY`
   for client-portal OTP login to actually deliver codes. Until then,
   both degrade honestly (reminders log `skipped_no_credentials`, OTP
   codes are generated and logged server-side but not sent).

## Local development

No local PHP/MySQL was available in the environment this was built in —
everything here was written and reviewed, not executed. Before trusting
it in production: `php -S localhost:8080 -t apps/crm-api` (if PHP is
available to you locally) and `curl` through the endpoints in
`apps/crm/src/lib/api.ts`'s call sites, per the plan's Verification
section.
