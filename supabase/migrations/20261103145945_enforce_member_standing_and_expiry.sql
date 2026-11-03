-- Enforce member standing in database policies and restore expired suspensions.
-- The UI is advisory only; authorization is decided by PostgreSQL.

create or replace function private.is_active_contributor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select
      rp.account_status in ('active', 'warned')
      or (
        rp.account_status = 'suspended'
        and rp.suspended_until is not null
        and rp.suspended_until <= pg_catalog.now()
      )
    from public.reviewer_profiles rp
    where rp.id = (select auth.uid())
  ), false);
$$;
revoke all on function private.is_active_contributor() from public, anon;
grant execute on function private.is_active_contributor() to authenticated;

create or replace function private.is_lexreview_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.reviewer_profiles rp
    where rp.id = (select auth.uid())
      and rp.role in ('editor', 'admin')
      and (
        rp.account_status in ('active', 'warned')
        or (
          rp.account_status = 'suspended'
          and rp.suspended_until is not null
          and rp.suspended_until <= pg_catalog.now()
        )
      )
  );
$$;
revoke all on function private.is_lexreview_editor() from public, anon;
grant execute on function private.is_lexreview_editor() to authenticated;

create or replace function private.is_lexreview_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.reviewer_profiles rp
    where rp.id = (select auth.uid())
      and rp.role = 'admin'
      and (
        rp.account_status in ('active', 'warned')
        or (
          rp.account_status = 'suspended'
          and rp.suspended_until is not null
          and rp.suspended_until <= pg_catalog.now()
        )
      )
  );
$$;
revoke all on function private.is_lexreview_admin() from public, anon;
grant execute on function private.is_lexreview_admin() to authenticated;

-- Allow the trusted database scheduler to expire suspensions. Ordinary API
-- callers still require an active admin identity to change account standing.
create or replace function public.enforce_reviewer_profile_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_is_admin boolean := (select private.is_lexreview_admin());
  v_is_trusted_system boolean :=
    session_user in ('postgres', 'supabase_admin')
    or coalesce(pg_catalog.current_setting('request.jwt.claim.role', true), '') = 'service_role';
begin
  new.id := old.id;
  new.created_at := old.created_at;

  if new.role is distinct from old.role
     or new.account_status is distinct from old.account_status
     or new.status_reason is distinct from old.status_reason
     or new.suspended_until is distinct from old.suspended_until then
    if not v_is_admin and not v_is_trusted_system then
      raise exception 'Only admins can modify member roles or account standing'
        using errcode = '42501';
    end if;
    new.status_updated_at := pg_catalog.now();
    new.status_updated_by := v_actor;
  else
    new.status_updated_at := old.status_updated_at;
    new.status_updated_by := old.status_updated_by;
  end if;

  return new;
end;
$$;
revoke all on function public.enforce_reviewer_profile_integrity() from public, anon, authenticated;

-- Persist the expiry in the profile itself. The existing AFTER UPDATE
-- governance trigger writes the restore audit event and member notification.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.unschedule(jobid)
from cron.job
where jobname = 'reactivate-expired-member-suspensions';

select cron.schedule(
  'reactivate-expired-member-suspensions',
  '* * * * *',
  $job$
    update public.reviewer_profiles
       set account_status = 'active',
           suspended_until = null,
           status_reason = null
     where account_status = 'suspended'
       and suspended_until is not null
       and suspended_until <= pg_catalog.now();
  $job$
);
