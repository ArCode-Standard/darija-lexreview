-- ArCode Darija LexReview — Hardened Supabase Schema (RBAC + Promotion Governance)
-- Review workflow only. The official lexical dataset remains in GitHub.
-- Apply idempotently to a Supabase project with the SQL editor or migration tooling.

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.reviewer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 120),
  dialect_region text check (dialect_region is null or char_length(dialect_region) <= 80),
  specialty text check (specialty is null or char_length(specialty) <= 120),
  github_handle text check (github_handle is null or char_length(github_handle) <= 80),
  role text not null default 'reviewer'
    check (role in ('reviewer','editor','admin')),
  created_at timestamptz not null default now()
);

-- Ensure idempotent upgrades on existing deployments
alter table public.reviewer_profiles
  add column if not exists dialect_region text check (dialect_region is null or char_length(dialect_region) <= 80);
alter table public.reviewer_profiles
  add column if not exists specialty text check (specialty is null or char_length(specialty) <= 120);
alter table public.reviewer_profiles
  add column if not exists github_handle text check (github_handle is null or char_length(github_handle) <= 80);

create table if not exists public.review_submissions (
  id uuid primary key default gen_random_uuid(),
  entry_id text not null
    check (btrim(entry_id) <> '' and char_length(entry_id) <= 64),
  proposed_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(proposed_data) = 'object' and octet_length(proposed_data::text) <= 32768),
  evidence jsonb not null default '[]'::jsonb
    check (jsonb_typeof(evidence) = 'array' and octet_length(evidence::text) <= 32768),
  reviewer_note text
    check (reviewer_note is null or char_length(reviewer_note) <= 4000),
  status text not null default 'pending'
    check (status in ('pending','accepted','rejected','needs_changes')),
  reviewer_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  editor_id uuid references auth.users(id) on delete set null,
  editor_note text
    check (editor_note is null or char_length(editor_note) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_rejection_requires_editor_note
    check (
      status not in ('rejected', 'needs_changes')
      or (editor_note is not null and btrim(editor_note) <> '')
    )
);

-- Editor promotion applications submitted by active reviewers for admin adjudication
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

create index if not exists review_submissions_status_created_idx
  on public.review_submissions(status, created_at desc);
create index if not exists review_submissions_reviewer_idx
  on public.review_submissions(reviewer_id, created_at desc);
create index if not exists review_submissions_entry_idx
  on public.review_submissions(entry_id);
create index if not exists review_submissions_editor_idx
  on public.review_submissions(editor_id) where editor_id is not null;

create unique index if not exists role_promotion_one_pending_per_user_idx
  on public.role_promotion_requests(requester_id)
  where status = 'pending';
create index if not exists role_promotion_status_created_idx
  on public.role_promotion_requests(status, created_at desc);

create or replace function private.is_lexreview_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.reviewer_profiles rp
    where rp.id = (select auth.uid())
      and rp.role in ('editor', 'admin')
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
    select 1 from public.reviewer_profiles rp
    where rp.id = (select auth.uid())
      and rp.role = 'admin'
  );
$$;
revoke all on function private.is_lexreview_admin() from public, anon;
grant execute on function private.is_lexreview_admin() to authenticated;

-- Prevents self-escalation on reviewer_profiles while allowing contributors to update own metadata
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
      raise exception 'Only admins can modify editorial roles';
    end if;
  end if;

  return new;
end;
$$;
revoke all on function public.enforce_reviewer_profile_integrity() from public, anon, authenticated;

-- Enforces immutable audit fields and stamps editor_id server-side on moderation updates
create or replace function public.enforce_review_submission_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.id := old.id;
  new.entry_id := old.entry_id;
  new.reviewer_id := old.reviewer_id;
  new.created_at := old.created_at;
  new.updated_at := pg_catalog.now();

  if (select auth.uid()) is not null then
    new.editor_id := (select auth.uid());
  end if;

  if new.status in ('rejected', 'needs_changes')
     and (new.editor_note is null or pg_catalog.btrim(new.editor_note) = '') then
    raise exception 'editor_note is required when rejecting or requesting changes';
  end if;

  return new;
end;
$$;
revoke all on function public.enforce_review_submission_integrity() from public, anon, authenticated;

-- Automatically provisions a safe 'reviewer' profile upon Email or GitHub OAuth sign-up
create or replace function public.handle_new_lexreview_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.reviewer_profiles (
    id,
    display_name,
    dialect_region,
    specialty,
    github_handle,
    role
  )
  values (
    new.id,
    nullif(
      pg_catalog.btrim(
        coalesce(
          new.raw_user_meta_data ->> 'name',
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'user_name',
          ''
        )
      ),
      ''
    ),
    nullif(pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'dialect_region', '')), ''),
    nullif(pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'specialty', '')), ''),
    nullif(pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'user_name', '')), ''),
    'reviewer'
  )
  on conflict (id) do update set
    display_name = coalesce(public.reviewer_profiles.display_name, excluded.display_name),
    github_handle = coalesce(public.reviewer_profiles.github_handle, excluded.github_handle);
  return new;
end;
$$;
revoke all on function public.handle_new_lexreview_user() from public, anon, authenticated;

-- Atomic admin RPC to approve/reject a promotion request and upgrade role to 'editor'
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
    raise exception 'Only admins can review role promotion requests';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  if p_decision = 'rejected' and (p_admin_note is null or pg_catalog.btrim(p_admin_note) = '') then
    raise exception 'An admin justification note is required when rejecting a request';
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

drop trigger if exists reviewer_profiles_integrity_trg on public.reviewer_profiles;
create trigger reviewer_profiles_integrity_trg
before update on public.reviewer_profiles
for each row execute function public.enforce_reviewer_profile_integrity();

drop trigger if exists review_submissions_updated_at on public.review_submissions;
drop trigger if exists review_submissions_integrity_trg on public.review_submissions;
create trigger review_submissions_integrity_trg
before update on public.review_submissions
for each row execute function public.enforce_review_submission_integrity();

drop trigger if exists on_auth_user_created_lexreview on auth.users;
create trigger on_auth_user_created_lexreview
after insert on auth.users
for each row execute function public.handle_new_lexreview_user();

alter table public.reviewer_profiles enable row level security;
alter table public.review_submissions enable row level security;
alter table public.role_promotion_requests enable row level security;

drop policy if exists "reviewers read own profile" on public.reviewer_profiles;
drop policy if exists "admins read contributor profiles" on public.reviewer_profiles;
create policy "reviewers read own profile"
on public.reviewer_profiles for select to authenticated
using (
  id = (select auth.uid())
  or (select private.is_lexreview_admin())
);

drop policy if exists "reviewers create own profile" on public.reviewer_profiles;
create policy "reviewers create own profile"
on public.reviewer_profiles for insert to authenticated
with check (id = (select auth.uid()) and role = 'reviewer');

drop policy if exists "users update own metadata or admins manage roles" on public.reviewer_profiles;
create policy "users update own metadata or admins manage roles"
on public.reviewer_profiles for update to authenticated
using (id = (select auth.uid()) or (select private.is_lexreview_admin()))
with check (
  (id = (select auth.uid()) and role = role)
  or (select private.is_lexreview_admin())
);

drop policy if exists "reviewers create submissions" on public.review_submissions;
create policy "reviewers create submissions"
on public.review_submissions for insert to authenticated
with check (
  reviewer_id = (select auth.uid())
  and status = 'pending'
  and editor_id is null
  and editor_note is null
);

drop policy if exists "reviewers read own submissions" on public.review_submissions;
create policy "reviewers read own submissions"
on public.review_submissions for select to authenticated
using (
  reviewer_id = (select auth.uid())
  or (select private.is_lexreview_editor())
);

drop policy if exists "editors update submissions" on public.review_submissions;
create policy "editors update submissions"
on public.review_submissions for update to authenticated
using ((select private.is_lexreview_editor()))
with check (
  (select private.is_lexreview_editor())
  and (editor_id is null or editor_id = (select auth.uid()))
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

revoke all on table public.reviewer_profiles from anon, authenticated;
revoke all on table public.review_submissions from anon, authenticated;
revoke all on table public.role_promotion_requests from anon, authenticated;

grant select, insert on table public.reviewer_profiles to authenticated;
grant update (display_name, dialect_region, specialty, github_handle, role)
  on table public.reviewer_profiles to authenticated;

grant select, insert on table public.review_submissions to authenticated;
grant update (status, editor_id, editor_note, proposed_data, evidence, reviewer_note)
  on table public.review_submissions to authenticated;

grant select, insert on table public.role_promotion_requests to authenticated;
grant update (status, reviewed_by, admin_note, updated_at)
  on table public.role_promotion_requests to authenticated;

-- Bootstrap initial admin once via SQL Editor:
-- update public.reviewer_profiles set role = 'admin' where id = '<INITIAL_ADMIN_UUID>';
-- Subsequent promotions from reviewer -> editor can be reviewed & approved directly from the UI!
