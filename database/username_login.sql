-- Applied to the existing JIC_Attendance schema; no password or email changes.
alter table public.app_users add column username text;
alter table public.app_users add constraint app_users_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,32}$');
alter table public.app_users add constraint app_users_username_key unique(username);
grant select on public.app_users to service_role;
create index attendance_records_date_order_idx
  on public.attendance_records(attendance_date, created_at, id);

-- Only the server may consume login limits. The mapping is still protected by
-- app_users' existing own-membership RLS; users cannot assign their usernames.
create schema if not exists private;
create table private.username_login_limits (
  bucket_key text primary key,
  window_start timestamptz not null,
  attempts integer not null
);
alter table private.username_login_limits enable row level security;
revoke all on private.username_login_limits from public, anon, authenticated;
grant usage on schema private to service_role;
grant select,insert,update,delete on private.username_login_limits to service_role;
create function public.consume_username_login_attempt(p_key text, p_limit integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare attempt_count integer;
begin
  if p_limit < 1 or p_limit > 100 or length(p_key) <> 64 then
    raise exception 'Invalid limit parameters';
  end if;
  delete from private.username_login_limits where window_start < now() - interval '1 day';
  insert into private.username_login_limits as limits(bucket_key,window_start,attempts)
  values(p_key,now(),1)
  on conflict(bucket_key) do update set
    attempts=case when limits.window_start <= now()-interval '15 minutes' then 1 else least(limits.attempts+1,10000) end,
    window_start=case when limits.window_start <= now()-interval '15 minutes' then now() else limits.window_start end
  returning attempts into attempt_count;
  return attempt_count <= p_limit;
end;
$$;
revoke all on function public.consume_username_login_attempt(text,integer) from public,anon,authenticated;
grant execute on function public.consume_username_login_attempt(text,integer) to service_role;
