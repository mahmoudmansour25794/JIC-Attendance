-- Exactly one attendance record per employee and calendar date.
-- Check/resolve existing duplicates before applying; never delete them silently.
alter table public.attendance_records
  add constraint attendance_records_employee_date_key
  unique (employee_id, attendance_date);
