# JIC Attendance

Static Arabic attendance UI backed by Supabase. Open `index.html` through a static server or GitHub Pages. The existing XLSX and Supabase browser SDK dependencies are version-pinned in the HTML.

## Username sign-in

Approved users sign in with their username and their existing password. The `username-login` Edge Function resolves the username privately and asks Supabase Auth to validate the password. The browser receives a normal Supabase session and existing row-level policies still enforce access. Emails and passwords in Auth remain unchanged; the UI displays the username.

The two existing accounts have been assigned `hashem` and `mans`. User/email mappings and secret keys are not included in this repository. Additional usernames are assigned to existing approved `app_users` by an administrator, not by public sign-up.

The login function performs authentication itself, so `verify_jwt = false` is intentional. The service-role key is read only from Supabase's server environment. The function limits attempts per username (15/15 minutes) and gateway IP (60/15 minutes), uses generic credential errors, and does not log passwords or tokens. Removing a user's `app_users` membership also removes their data access even if a session still exists.

## Date filtering and Excel

- The homepage opens on today in `Africa/Cairo`, displaying one day at a time. The left arrow selects the nearest previous saved date and the right arrow the nearest next saved date. Empty dates are skipped without downloading historical attendance rows.
- From/To are inclusive. Empty To means today; equal dates select one day.
- Press **عرض الفترة** to apply changed dates. Export stays disabled while dates differ from the applied period.
- Applying a range displays its first populated day. Arrows stay within the applied period and skip empty dates; there is no whole-period table view. Navigation disables at either end.
- Without an applied range, Excel detail and summary export the currently displayed home day only. With a range applied, they export the entire period in ascending date order, regardless of the day displayed.
- The **اليوم** button returns to today and home browsing. Refresh preserves the current browsing mode and displayed day.
- If today is empty, it remains the initial displayed date with an empty-state message; arrows can still reach saved dates. Empty filtered periods disable both arrows.
- Leaving an unsaved record edit via the arrows requires confirmation.
- The summary's 21-day field remains unchanged. Actual Working Hours is now an Excel formula instead of a fixed 140 hours.
- Every exported detail row calculates duration from Check In and Check Out only. Comments do not add, deduct or zero hours. Missing times produce zero, and departures after midnight wrap into the next day.
- Both row durations and employee totals are numeric Excel times formatted as `[h]:mm`, so totals can exceed 24 hours. Changing exported attendance times updates the formulas in Excel; it does not update Supabase.
- Summary formulas group by a hidden Employee ID column, keeping employees with the same name separate. The formulas reference only the exported rows and preserve the current single-day/whole-period export behavior.
- All pages of the API response are retrieved, including periods exceeding 1,000 records.
- Inserting a record outside the viewed period saves it but does not add it to that period's table/export.

## Annual and casual leave

Selecting Annual Leave or Casual Leave disables attendance-time inputs. New records and edits save both times as null and hours as 00:00, even if disabled inputs retain draft values. Their exported times are blank and the Excel duration formula yields zero. Switching to another note type re-enables time inputs. Existing records are normalized when edited; this change does not bulk-modify historical data.

## Duplicate attendance

An employee can have exactly one attendance record per calendar date. The page shows **الشخص مسجل من قبل في هذا اليوم** on a repeated addition, including conflicts from another browser or a day outside the current filter. Different dates and different employees remain independent. Editing or deleting an existing attendance record is supported; after deletion, the same employee/day can be added again.

`database/attendance_daily_uniqueness.sql` adds the database constraint that enforces this rule even for simultaneous requests. Existing data was checked for duplicates before applying it. Retrying an addition whose success response was lost uses the same request UUID and recovers the saved record instead of inserting a second one.

## Backend setup

`database/username_login.sql` records the incremental schema applied to the existing attendance project. It assumes the existing employees, app_users, attendance_records tables and RLS policies. It is not a fresh-project bootstrap script and should not be re-run on the configured project.

`supabase/functions/username-login/` contains the deployed endpoint source. Deploy with the configuration in `supabase/config.toml`. Supabase provides `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` to the function. Never copy server keys into HTML.

## Validation

Run `npm test` using Node 20 or newer. Tests use the actual inline application script and the actual Edge Function handler, with mocked DOM/API boundaries. They cover date range boundaries, Cairo midnight, home and range arrow navigation, empty days and navigation boundaries, home-day versus whole-period export, API batching, updates/deletes, failed fetches, unsaved edits, and username authentication failure/success paths.

The live project was also checked for username assignments, denied invalid credentials, RLS grants, and rate-limit behavior. A real successful sign-in with an existing user's password must be tested by that user; no existing password was requested or changed. A full browser visual test was unavailable in the build environment.

Existing project advisory: [Leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) is disabled. This existing Auth setting was not changed. The private login-limit table deliberately has no client RLS policy: clients have no access and only the server service role can use it.
