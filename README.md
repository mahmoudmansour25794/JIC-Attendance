# JIC Attendance

Static Arabic attendance UI backed by Supabase. Open `index.html` through a static server or GitHub Pages. The existing XLSX and Supabase browser SDK dependencies are version-pinned in the HTML.

## Username sign-in

Approved users sign in with their username and their existing password. The `username-login` Edge Function resolves the username privately and asks Supabase Auth to validate the password. The browser receives a normal Supabase session and existing row-level policies still enforce access. Emails and passwords in Auth remain unchanged; the UI displays the username.

The two existing accounts have been assigned `hashem` and `mans`. User/email mappings and secret keys are not included in this repository. Additional usernames are assigned to existing approved `app_users` by an administrator, not by public sign-up.

The login function performs authentication itself, so `verify_jwt = false` is intentional. The service-role key is read only from Supabase's server environment. The function limits attempts per username (15/15 minutes) and gateway IP (60/15 minutes), uses generic credential errors, and does not log passwords or tokens. Removing a user's `app_users` membership also removes their data access even if a session still exists.

## Date filtering and Excel

- Initial range: today in `Africa/Cairo`.
- From/To are inclusive. Empty To means today; equal dates select one day.
- Press **عرض الفترة** to apply changed dates. Export stays disabled while dates differ from the applied period.
- Date buttons show only dates with records in the applied period, plus **الكل**.
- Selecting a date affects the table only. Excel detail and summary always use the entire applied period, sorted by date ascending.
- The existing summary constants (21 days and 140 hours) are unchanged.
- All pages of the API response are retrieved, including periods exceeding 1,000 records.
- Inserting a record outside the viewed period saves it but does not add it to that period's table/export.

## Backend setup

`database/username_login.sql` records the incremental schema applied to the existing attendance project. It assumes the existing employees, app_users, attendance_records tables and RLS policies. It is not a fresh-project bootstrap script and should not be re-run on the configured project.

`supabase/functions/username-login/` contains the deployed endpoint source. Deploy with the configuration in `supabase/config.toml`. Supabase provides `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` to the function. Never copy server keys into HTML.

## Validation

Run `npm test` using Node 20 or newer. Tests use the actual inline application script and the actual Edge Function handler, with mocked DOM/API boundaries. They cover date range boundaries, Cairo midnight, day navigation, whole-period export, API batching, updates/deletes, and username authentication failure/success paths.

The live project was also checked for username assignments, denied invalid credentials, RLS grants, and rate-limit behavior. A real successful sign-in with an existing user's password must be tested by that user; no existing password was requested or changed. A full browser visual test was unavailable in the build environment.

Existing project advisory: [Leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) is disabled. This existing Auth setting was not changed. The private login-limit table deliberately has no client RLS policy: clients have no access and only the server service role can use it.
