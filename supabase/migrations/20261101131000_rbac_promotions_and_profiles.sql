-- RBAC role promotion applications & contributor linguistic profile metadata.
-- Apply after 20261101130441_security_governance_hardening.sql and 20261101130559_audit_actor_index.sql.
-- Safe to re-run idempotently.

alter table public.reviewer_profiles
  add column if not exists dialect_region text check (dialect_region is null or char_length(dialect_region) <= 80);
alter table public.reviewer_profiles
  add column if not exists specialty text check (specialty is null or char_length(specialty) <= 120);
alter table public.reviewer_profiles
  add column if not exists github_handle text check (github_handle is null or char_length(github_handle) <= 80);

create table if not exists public.role_promotion_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  requester_name text not null
    check (btrim(requester_name) <> '' and char_length(requester_name) <= 120),
  dialect_region text
    check (dialect_region is null or char_length(dialect_region) <= 80),
  experience_summary text not null
    check (char_length(btrim(experience_summary)) >= 20 and char_length(experience_summary) <= 3000),
  sample_links text
    check (sample_links is null or char_length(sample_links) <= 1000),
  requested_role text not null default 'editor'
    check (requested_role = 'editor'),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  admin_note text
    check (admin_note is null or char_length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotion_rejection_requires_admin_note
    check (
      status <> 'rejected'
      or (admin_note is not null and btrim(admin_note) <> '')
    )
);

create unique index if not exists role_promotion_one_pending_per_user_idx
  on public.role_promotion_requests(requester_id)
  where status = 'pending';
create index if not exists role_promotion_status_created_idx
  on public.role_promotion_requests(status, created_at desc);

create or replace function private.is_lexreview_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.reviewer_profiles rp
    where rp.id = (select auth.uid())
      and rp.role = 'admin'
  );
$$;
revoke all on function private.is_lexreview_admin() from public, anon;
grant execute on function private.is_lexreview_admin() to authenticated;

create or replace function public.enforce_reviewer_profile_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.id := old.id;
  new.created_at := old.created_at;

  if new.role is distinct from old.role then
    if not (select private.is_lexreview_admin()) then
      raise exception 'Only admins can modify editorial roles'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;
revoke all on function public.enforce_reviewer_profile_integrity() from public, anon, authenticated;

drop trigger if exists reviewer_profiles_integrity_trg on public.reviewer_profiles;
create trigger reviewer_profiles_integrity_trg
before update on public.reviewer_profiles
for each row execute function public.enforce_reviewer_profile_integrity();

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
  v_row public.role_promotion_requests;
begin
  if not (select private.is_lexreview_admin()) then
    raise exception 'Only admins can review role promotion requests'
      using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected'
      using errcode = '23514';
  end if;

  if p_decision = 'rejected' and (p_admin_note is null or pg_catalog.btrim(p_admin_note) = '') then
    raise exception 'An admin justification note is required when rejecting a request'
      using errcode = '23514';
  end if;

  update public.role_promotion_requests
  set
    status = p_decision,
    reviewed_by = (select auth.uid()),
    admin_note = nullif(pg_catalog.btrim(coalesce(p_admin_note, '')), ''),
    updated_at = pg_catalog.now()
  where id = p_request_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Promotion request not found';
  end if;

  if p_decision = 'approved' then
    update public.reviewer_profiles
    set role = 'editor'
    where id = v_row.requester_id
      and role = 'reviewer';
  end if;

  return v_row;
end;
$$;
revoke all on function public.review_role_promotion_request(uuid, text, text) from public, anon;
grant execute on function public.review_role_promotion_request(uuid, text, text) to authenticated;

alter table public.role_promotion_requests enable row level security;
revoke all on table public.role_promotion_requests from anon, authenticated;
grant select, insert on table public.role_promotion_requests to authenticated;
grant update (status, reviewed_by, admin_note, updated_at)
  on table public.role_promotion_requests to authenticated;

grant update (display_name, dialect_region, specialty, github_handle, role)
  on table public.reviewer_profiles to authenticated;

drop policy if exists "users update own metadata or admins manage roles" on public.reviewer_profiles;
create policy "users update own metadata or admins manage roles"
on public.reviewer_profiles for update to authenticated
using (id = (select auth.uid()) or (select private.is_lexreview_admin()))
with check (
  id = (select auth.uid())
  or (select private.is_lexreview_admin())
);

drop policy if exists "users read own promotion requests or admins read all" on public.role_promotion_requests;
create policy "users read own promotion requests or admins read all"
on public.role_promotion_requests for select to authenticated
using (
  requester_id = (select auth.uid())
  or (select private.is_lexreview_admin())
);

drop policy if exists "reviewers submit own promotion request" on public.role_promotion_requests;
create policy "reviewers submit own promotion request"
on public.role_promotion_requests for insert to authenticated
with check (
  requester_id = (select auth.uid())
  and status = 'pending'
  and requested_role = 'editor'
  and reviewed_by is null
  and admin_note is null
  and not (select private.is_lexreview_editor())
);

drop policy if exists "admins adjudicate promotion requests" on public.role_promotion_requests;
create policy "admins adjudicate promotion requests"
on public.role_promotion_requests for update to authenticated
using ((select private.is_lexreview_admin()))
with check ((select private.is_lexreview_admin()));
