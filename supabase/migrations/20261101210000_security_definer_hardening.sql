-- Security hardening for SECURITY DEFINER functions.
-- All application-owned definer functions use an empty search_path and narrowly
-- scoped EXECUTE grants. Trigger-only functions are not callable by API roles.

begin;

-- Trigger functions are invoked by their owning triggers. API roles do not need
-- direct EXECUTE privileges on them.
revoke all on function private.enforce_submission_rate_and_bounds()
  from public, anon, authenticated, service_role;
revoke all on function private.record_review_submission_event()
  from public, anon, authenticated, service_role;
revoke all on function public.enforce_reviewer_profile_integrity()
  from public, anon, authenticated, service_role;
revoke all on function public.handle_new_lexreview_user()
  from public, anon, authenticated, service_role;

-- Role predicates are intentionally callable only by authenticated users and
-- always derive the subject from auth.uid(), never from caller-supplied IDs.
alter function private.is_lexreview_admin()
  security definer set search_path = '';
revoke all on function private.is_lexreview_admin() from public, anon;
grant execute on function private.is_lexreview_admin() to authenticated;

alter function private.is_lexreview_editor()
  security definer set search_path = '';
revoke all on function private.is_lexreview_editor() from public, anon;
grant execute on function private.is_lexreview_editor() to authenticated;

-- Staff names are a deliberately narrow RPC. Keep SECURITY DEFINER because
-- reviewer_profiles is private to its owner/admin under RLS; authorize the
-- caller explicitly before returning the minimal staff directory.
create or replace function public.list_staff_display_names()
returns table (
  id uuid,
  display_name text,
  role text
)
language sql
stable
security definer
set search_path = ''
as $$
  select rp.id, rp.display_name, rp.role
  from public.reviewer_profiles rp
  where (select auth.uid()) is not null
    and (select private.is_lexreview_editor())
    and rp.role in ('editor', 'admin');
$$;

revoke all on function public.list_staff_display_names() from public, anon;
grant execute on function public.list_staff_display_names() to authenticated;

-- Promotion review is a privileged state transition. Lock the request, require
-- it to still be pending, and perform the request decision + role update in one
-- transaction. This prevents replaying an already adjudicated request.
create or replace function public.review_role_promotion_request(
  p_request_id uuid,
  p_decision text,
  p_admin_note text default null
)
returns public.role_promotion_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_row public.role_promotion_requests;
  v_updated_count integer := 0;
begin
  if v_actor is null or not (select private.is_lexreview_admin()) then
    raise exception 'Only authenticated admins can review role promotion requests'
      using errcode = '42501';
  end if;

  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected'
      using errcode = '23514';
  end if;

  if p_decision = 'rejected'
     and (p_admin_note is null or pg_catalog.btrim(p_admin_note) = '') then
    raise exception 'An admin justification note is required when rejecting a request'
      using errcode = '23514';
  end if;

  select r.*
    into v_row
  from public.role_promotion_requests r
  where r.id = p_request_id
  for update;

  if v_row.id is null then
    raise exception 'Promotion request not found'
      using errcode = 'P0002';
  end if;

  if v_row.status <> 'pending' then
    raise exception 'Only pending promotion requests can be reviewed'
      using errcode = '55000';
  end if;

  update public.role_promotion_requests
     set status = p_decision,
         reviewed_by = v_actor,
         admin_note = nullif(pg_catalog.btrim(coalesce(p_admin_note, '')), ''),
         updated_at = pg_catalog.now()
   where id = p_request_id
     and status = 'pending'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Promotion request is no longer pending'
      using errcode = '55000';
  end if;

  if p_decision = 'approved' then
    update public.reviewer_profiles
       set role = 'editor'
     where id = v_row.requester_id
       and role = 'reviewer';

    get diagnostics v_updated_count = row_count;
    if v_updated_count <> 1 then
      raise exception 'Promotion requester is no longer eligible for editor role'
        using errcode = '55000';
    end if;
  end if;

  return v_row;
end;
$$;

revoke all on function public.review_role_promotion_request(uuid, text, text)
  from public, anon;
grant execute on function public.review_role_promotion_request(uuid, text, text)
  to authenticated;

-- Fail the migration if any application-owned SECURITY DEFINER function has a
-- mutable/default search_path. Extension-owned functions are outside this audit.
do $$
declare
  v_unsafe text;
begin
  select pg_catalog.string_agg(
    pg_catalog.format('%I.%I(%s)', n.nspname, p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid)),
    ', '
  )
  into v_unsafe
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
    and p.prosecdef
    and not coalesce(
      'search_path=""' = any(p.proconfig),
      false
    );

  if v_unsafe is not null then
    raise exception 'SECURITY DEFINER functions require an empty search_path: %', v_unsafe;
  end if;
end;
$$;

commit;
