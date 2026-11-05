-- =============================================================================
-- ArCode Darija LexReview — Complete Synchronized Supabase Schema
-- Synchronized through migration 20261102150000_contributors_governance_and_messages.sql
-- Review workflow, audit ledger, community attestations (headwords + ctx-* examples),
-- RBAC role promotions, public contributors directory, member standing & messages,
-- and SHA-256 official release manifests.
-- The canonical lexical dataset remains versioned in GitHub.
-- Safe to apply idempotently on fresh or existing Supabase deployments.
-- =============================================================================

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- 1. Core Tables
-- -----------------------------------------------------------------------------
create table if not exists public.reviewer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 120),
  dialect_region text check (dialect_region is null or char_length(dialect_region) <= 80),
  specialty text check (specialty is null or char_length(specialty) <= 120),
  github_handle text check (github_handle is null or char_length(github_handle) <= 80),
  role text not null default 'reviewer'
    check (role in ('reviewer', 'editor', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.reviewer_profiles
  add column if not exists dialect_region text check (dialect_region is null or char_length(dialect_region) <= 80),
  add column if not exists specialty text check (specialty is null or char_length(specialty) <= 120),
  add column if not exists github_handle text check (github_handle is null or char_length(github_handle) <= 80);

create table if not exists public.review_submissions (
  id uuid primary key default gen_random_uuid(),
  entry_id text not null
    check (btrim(entry_id) <> '' and char_length(entry_id) <= 64),
  supersedes_id uuid references public.review_submissions(id) on delete set null,
  corpus_version text not null default '1.5.0',
  baseline_fingerprint text,
  exported_in_version text,
  exported_at timestamptz,
  proposed_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(proposed_data) = 'object' and octet_length(proposed_data::text) <= 32768),
  evidence jsonb not null default '[]'::jsonb
    check (jsonb_typeof(evidence) = 'array' and octet_length(evidence::text) <= 32768),
  reviewer_note text
    check (reviewer_note is null or char_length(reviewer_note) <= 4000),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'needs_changes', 'merged', 'withdrawn', 'superseded')),
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

create table if not exists public.review_decision_events (
  id bigint generated always as identity primary key,
  submission_id uuid not null references public.review_submissions(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null
    check (event_type in ('baseline', 'submitted', 'decision', 'withdrawn', 'superseded')),
  previous_status text
    check (
      previous_status is null
      or previous_status in ('pending', 'accepted', 'rejected', 'needs_changes', 'merged', 'withdrawn', 'superseded')
    ),
  new_status text not null
    check (new_status in ('pending', 'accepted', 'rejected', 'needs_changes', 'merged', 'withdrawn', 'superseded')),
  editor_note text,
  submission_snapshot jsonb not null,
  occurred_at timestamptz not null default now()
);

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

create table if not exists public.community_attestations (
  id uuid primary key default gen_random_uuid(),
  entry_id text not null check (char_length(pg_catalog.btrim(entry_id)) between 1 and 64),
  example_id text not null default '' check (char_length(example_id) <= 64),
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  verdict text not null check (verdict in ('accurate', 'needs_correction', 'regional_variant')),
  dialect_region text check (dialect_region is null or char_length(dialect_region) <= 80),
  note text check (note is null or char_length(note) <= 500),
  corpus_version text not null default '1.5.0',
  baseline_fingerprint text,
  response_ms integer check (response_ms is null or (response_ms >= 0 and response_ms <= 600000)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_attestations_target_reviewer_key unique (entry_id, example_id, reviewer_id)
);

create table if not exists public.release_manifests (
  id uuid primary key default gen_random_uuid(),
  version text not null unique
    check (char_length(pg_catalog.btrim(version)) between 2 and 64),
  lexicon_sha256 text not null
    check (lexicon_sha256 ~ '^[0-9a-f]{64}$'),
  examples_sha256 text not null
    check (examples_sha256 ~ '^[0-9a-f]{64}$'),
  total_entries integer not null check (total_entries >= 0),
  total_examples integer not null check (total_examples >= 0),
  modified_entries_count integer not null default 0 check (modified_entries_count >= 0),
  added_entries_count integer not null default 0 check (added_entries_count >= 0),
  added_examples_count integer not null default 0 check (added_examples_count >= 0),
  submission_ids uuid[] not null default '{}'::uuid[],
  github_pr_url text
    check (github_pr_url is null or (char_length(github_pr_url) <= 500 and github_pr_url ~ '^https://')),
  notes text
    check (notes is null or char_length(notes) <= 2000),
  exported_by uuid references auth.users(id) on delete set null,
  exported_by_name text
    check (exported_by_name is null or char_length(exported_by_name) <= 120),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. Indexes
-- -----------------------------------------------------------------------------
create index if not exists review_submissions_status_created_idx
  on public.review_submissions(status, created_at desc);
create index if not exists review_submissions_reviewer_idx
  on public.review_submissions(reviewer_id, created_at desc);
create index if not exists review_submissions_entry_idx
  on public.review_submissions(entry_id);
create index if not exists review_submissions_editor_idx
  on public.review_submissions(editor_id) where editor_id is not null;
create index if not exists review_submissions_supersedes_idx
  on public.review_submissions(supersedes_id) where supersedes_id is not null;
create index if not exists review_submissions_exported_version_idx
  on public.review_submissions(exported_in_version) where exported_in_version is not null;

create index if not exists review_decision_events_submission_idx
  on public.review_decision_events(submission_id, occurred_at desc);
create index if not exists review_decision_events_actor_idx
  on public.review_decision_events(actor_id) where actor_id is not null;

create unique index if not exists role_promotion_one_pending_per_user_idx
  on public.role_promotion_requests(requester_id) where status = 'pending';
create index if not exists role_promotion_status_created_idx
  on public.role_promotion_requests(status, created_at desc);

create index if not exists community_attestations_entry_idx
  on public.community_attestations(entry_id);
create index if not exists community_attestations_example_idx
  on public.community_attestations(example_id) where example_id <> '';
create index if not exists community_attestations_reviewer_idx
  on public.community_attestations(reviewer_id, created_at desc);

create index if not exists release_manifests_created_idx
  on public.release_manifests(created_at desc);

-- -----------------------------------------------------------------------------
-- 3. Security Helper Functions & Triggers
-- -----------------------------------------------------------------------------
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

create or replace function public.handle_new_lexreview_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.reviewer_profiles (
    id, display_name, dialect_region, specialty, github_handle, role
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

create or replace function private.enforce_submission_rate_and_bounds()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := coalesce((select auth.uid()), new.reviewer_id);
  v_recent_count integer;
  v_parent_reviewer uuid;
begin
  if pg_catalog.jsonb_typeof(new.evidence) <> 'array'
     or pg_catalog.jsonb_array_length(new.evidence) > 10 then
    raise exception 'Evidence array cannot exceed 10 items per submission'
      using errcode = '23514';
  end if;

  if new.supersedes_id is not null then
    select s.reviewer_id into v_parent_reviewer
    from public.review_submissions s
    where s.id = new.supersedes_id;

    if v_parent_reviewer is null then
      raise exception 'Superseded submission does not exist'
        using errcode = '23503';
    end if;

    if v_actor is not null and v_parent_reviewer <> v_actor then
      raise exception 'You can only submit a revision superseding your own submission'
        using errcode = '42501';
    end if;
  end if;

  if v_actor is not null then
    select count(*)::integer into v_recent_count
    from public.review_submissions s
    where s.reviewer_id = v_actor
      and s.created_at >= (pg_catalog.now() - interval '1 hour');

    if v_recent_count >= 25 then
      raise exception 'Rate limit exceeded: maximum 25 submissions per hour'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;
revoke all on function private.enforce_submission_rate_and_bounds() from public, anon, authenticated;

create or replace function private.record_review_submission_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    actor := coalesce(actor, new.reviewer_id);
    insert into public.review_decision_events (
      submission_id, actor_id, event_type, previous_status,
      new_status, editor_note, submission_snapshot
    ) values (
      new.id, actor, 'submitted', null, new.status, null, to_jsonb(new)
    );

    if new.supersedes_id is not null then
      update public.review_submissions
         set status = 'superseded',
             updated_at = pg_catalog.now()
       where id = new.supersedes_id
         and reviewer_id = new.reviewer_id
         and status in ('pending', 'needs_changes', 'rejected');
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if actor is null then
      raise exception 'Authenticated actor required for review lifecycle updates'
        using errcode = '42501';
    end if;

    if new.id is distinct from old.id
      or new.entry_id is distinct from old.entry_id
      or new.reviewer_id is distinct from old.reviewer_id
      or new.supersedes_id is distinct from old.supersedes_id
      or new.corpus_version is distinct from old.corpus_version
      or new.baseline_fingerprint is distinct from old.baseline_fingerprint
      or new.proposed_data is distinct from old.proposed_data
      or new.evidence is distinct from old.evidence
      or new.reviewer_note is distinct from old.reviewer_note
      or new.created_at is distinct from old.created_at then
      raise exception 'Submission content and authorship are immutable'
        using errcode = '42501';
    end if;

    if new.status = 'withdrawn' then
      if old.reviewer_id <> actor then
        raise exception 'Only the submitting contributor can withdraw their submission'
          using errcode = '42501';
      end if;
      if old.status <> 'pending' then
        raise exception 'Only pending submissions can be withdrawn'
          using errcode = '23514';
      end if;

      new.editor_id := old.editor_id;
      new.editor_note := old.editor_note;
      new.updated_at := pg_catalog.now();

      insert into public.review_decision_events (
        submission_id, actor_id, event_type, previous_status,
        new_status, editor_note, submission_snapshot
      ) values (
        new.id, actor, 'withdrawn', old.status, 'withdrawn',
        'سحب المساهم مقترحه قبل صدور قرار تحكيمي.', to_jsonb(new)
      );
      return new;
    end if;

    if new.status = 'superseded' then
      if old.reviewer_id <> actor and not (select private.is_lexreview_editor()) then
        raise exception 'Not authorized to mark submission as superseded'
          using errcode = '42501';
      end if;
      if old.status not in ('pending', 'needs_changes', 'rejected') then
        raise exception 'Only pending, needs_changes, or rejected submissions can be superseded'
          using errcode = '23514';
      end if;

      new.editor_id := old.editor_id;
      new.editor_note := old.editor_note;
      new.updated_at := pg_catalog.now();

      insert into public.review_decision_events (
        submission_id, actor_id, event_type, previous_status,
        new_status, editor_note, submission_snapshot
      ) values (
        new.id, actor, 'superseded', old.status, 'superseded',
        'حُلّ محل هذا المقترح بنسخة منقحة أحدث في السلسلة التحريرية.', to_jsonb(new)
      );
      return new;
    end if;

    if not (select private.is_lexreview_editor()) then
      raise exception 'Editor role required'
        using errcode = '42501';
    end if;

    if new.status <> 'merged' and old.reviewer_id = actor then
      raise exception 'Self-review is not permitted'
        using errcode = '42501';
    end if;

    if old.status not in ('pending', 'needs_changes', 'accepted')
      or new.status not in ('accepted', 'rejected', 'needs_changes', 'merged')
      or new.status = old.status then
      raise exception 'Invalid review status transition: % -> %', old.status, new.status
        using errcode = '23514';
    end if;

    if old.status = 'accepted' then
      if new.status = 'merged' then
        if new.exported_in_version is null or char_length(pg_catalog.btrim(new.exported_in_version)) < 2 then
          raise exception 'exported_in_version is required when marking a submission as merged'
            using errcode = '23514';
        end if;
        new.exported_at := coalesce(new.exported_at, pg_catalog.now());
      elsif new.status in ('needs_changes', 'rejected') then
        if new.editor_note is null or char_length(pg_catalog.btrim(new.editor_note)) < 10 then
          raise exception 'Revoking an accepted submission requires an audit justification of at least 10 characters'
            using errcode = '23514';
        end if;
      else
        raise exception 'Accepted submissions can only transition to merged, needs_changes, or rejected'
          using errcode = '23514';
      end if;
    elsif new.status = 'merged' then
      raise exception 'Only accepted submissions can be marked as merged into an exported release'
        using errcode = '23514';
    elsif new.status in ('rejected', 'needs_changes')
      and (new.editor_note is null or pg_catalog.btrim(new.editor_note) = '') then
      raise exception 'An editor note is required for rejection or requested changes'
        using errcode = '23514';
    end if;

    new.editor_id := actor;
    new.updated_at := pg_catalog.now();

    insert into public.review_decision_events (
      submission_id, actor_id, event_type, previous_status,
      new_status, editor_note, submission_snapshot
    ) values (
      new.id,
      actor,
      'decision',
      old.status,
      new.status,
      case
        when new.status = 'merged' then
          coalesce(nullif(pg_catalog.btrim(new.editor_note), ''), 'تم دمج المقترح في الإصدار الرسمي ' || new.exported_in_version)
        else new.editor_note
      end,
      to_jsonb(new)
    );
    return new;
  end if;

  return new;
end;
$$;
revoke all on function private.record_review_submission_event() from public, anon, authenticated;

create or replace function private.enforce_attestation_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := coalesce((select auth.uid()), new.reviewer_id);
  v_recent_count integer;
begin
  if v_actor is null then
    raise exception 'Authenticated contributor required for community attestation'
      using errcode = '42501';
  end if;

  new.reviewer_id := v_actor;
  new.updated_at := pg_catalog.now();

  if tg_op = 'INSERT' then
    select count(*)::integer into v_recent_count
    from public.community_attestations a
    where a.reviewer_id = v_actor
      and a.created_at >= (pg_catalog.now() - interval '1 hour');

    if v_recent_count >= 120 then
      raise exception 'Rate limit exceeded: maximum 120 rapid validations per hour'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;
revoke all on function private.enforce_attestation_rate_limit() from public, anon, authenticated;

drop trigger if exists reviewer_profiles_integrity_trg on public.reviewer_profiles;
create trigger reviewer_profiles_integrity_trg
before update on public.reviewer_profiles
for each row execute function public.enforce_reviewer_profile_integrity();

drop trigger if exists on_auth_user_created_lexreview on auth.users;
create trigger on_auth_user_created_lexreview
after insert on auth.users
for each row execute function public.handle_new_lexreview_user();

drop trigger if exists review_submissions_rate_bounds_trg on public.review_submissions;
create trigger review_submissions_rate_bounds_trg
before insert on public.review_submissions
for each row execute function private.enforce_submission_rate_and_bounds();

drop trigger if exists review_submission_event_insert on public.review_submissions;
create trigger review_submission_event_insert
after insert on public.review_submissions
for each row execute function private.record_review_submission_event();

drop trigger if exists review_submissions_updated_at on public.review_submissions;
drop trigger if exists review_submissions_integrity_trg on public.review_submissions;
create trigger review_submissions_integrity_trg
before update on public.review_submissions
for each row execute function private.record_review_submission_event();

drop trigger if exists community_attestations_rate_trg on public.community_attestations;
create trigger community_attestations_rate_trg
before insert or update on public.community_attestations
for each row execute function private.enforce_attestation_rate_limit();

-- -----------------------------------------------------------------------------
-- 4. RPC Functions
-- -----------------------------------------------------------------------------
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
  where (select private.is_lexreview_editor())
    and rp.role in ('editor', 'admin');
$$;
revoke all on function public.list_staff_display_names() from public, anon;
grant execute on function public.list_staff_display_names() to authenticated;

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

create or replace function public.withdraw_own_submission(
  p_submission_id uuid
)
returns public.review_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_row public.review_submissions;
begin
  if v_actor is null then
    raise exception 'Authentication required to withdraw a submission'
      using errcode = '42501';
  end if;

  update public.review_submissions
     set status = 'withdrawn',
         updated_at = pg_catalog.now()
   where id = p_submission_id
     and reviewer_id = v_actor
     and status = 'pending'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Pending submission not found or cannot be withdrawn'
      using errcode = '23514';
  end if;

  return v_row;
end;
$$;
revoke all on function public.withdraw_own_submission(uuid) from public, anon;
grant execute on function public.withdraw_own_submission(uuid) to authenticated;

create or replace function public.mark_submissions_exported(
  p_submission_ids uuid[],
  p_release_version text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_clean_version text := pg_catalog.btrim(coalesce(p_release_version, ''));
  v_updated_count integer := 0;
begin
  if v_actor is null or not (select private.is_lexreview_editor()) then
    raise exception 'Editor role required to archive exported submissions'
      using errcode = '42501';
  end if;

  if char_length(v_clean_version) < 2 then
    raise exception 'A valid release version tag is required'
      using errcode = '23514';
  end if;

  update public.review_submissions
     set status = 'merged',
         exported_in_version = v_clean_version,
         exported_at = pg_catalog.now(),
         editor_id = v_actor,
         editor_note = coalesce(
           nullif(pg_catalog.btrim(editor_note), ''),
           'تم التصدير والدمج ضمن حزمة الإصدار ' || v_clean_version
         )
   where id = any(p_submission_ids)
     and status = 'accepted';

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$;
revoke all on function public.mark_submissions_exported(uuid[], text) from public, anon;
grant execute on function public.mark_submissions_exported(uuid[], text) to authenticated;

create or replace function public.record_release_manifest(
  p_version text,
  p_lexicon_sha256 text,
  p_examples_sha256 text,
  p_total_entries integer,
  p_total_examples integer,
  p_modified_entries_count integer,
  p_added_entries_count integer,
  p_added_examples_count integer,
  p_submission_ids uuid[],
  p_github_pr_url text default null,
  p_notes text default null
)
returns public.release_manifests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_clean_version text := pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_version, '')), '^[vV]', '');
  v_actor_name text;
  v_manifest public.release_manifests;
begin
  if v_actor is null or not (select private.is_lexreview_editor()) then
    raise exception 'Editor role required to record official release manifests'
      using errcode = '42501';
  end if;

  if char_length(v_clean_version) < 2 then
    raise exception 'A valid release version tag is required'
      using errcode = '23514';
  end if;

  select rp.display_name into v_actor_name
  from public.reviewer_profiles rp
  where rp.id = v_actor;

  if coalesce(array_length(p_submission_ids, 1), 0) > 0 then
    update public.review_submissions
       set status = 'merged',
           exported_in_version = v_clean_version,
           exported_at = pg_catalog.now(),
           editor_id = v_actor,
           editor_note = coalesce(
             nullif(pg_catalog.btrim(editor_note), ''),
             'تم التصدير والدمج ضمن حزمة الإصدار ' || v_clean_version
           )
     where id = any(p_submission_ids)
       and status = 'accepted';
  end if;

  insert into public.release_manifests (
    version, lexicon_sha256, examples_sha256,
    total_entries, total_examples,
    modified_entries_count, added_entries_count, added_examples_count,
    submission_ids, github_pr_url, notes, exported_by, exported_by_name
  ) values (
    v_clean_version,
    pg_catalog.lower(pg_catalog.btrim(p_lexicon_sha256)),
    pg_catalog.lower(pg_catalog.btrim(p_examples_sha256)),
    p_total_entries, p_total_examples,
    p_modified_entries_count, p_added_entries_count, p_added_examples_count,
    coalesce(p_submission_ids, '{}'::uuid[]),
    nullif(pg_catalog.btrim(coalesce(p_github_pr_url, '')), ''),
    nullif(pg_catalog.btrim(coalesce(p_notes, '')), ''),
    v_actor, v_actor_name
  )
  on conflict (version) do update set
    lexicon_sha256 = excluded.lexicon_sha256,
    examples_sha256 = excluded.examples_sha256,
    total_entries = excluded.total_entries,
    total_examples = excluded.total_examples,
    modified_entries_count = excluded.modified_entries_count,
    added_entries_count = excluded.added_entries_count,
    added_examples_count = excluded.added_examples_count,
    submission_ids = excluded.submission_ids,
    github_pr_url = coalesce(excluded.github_pr_url, public.release_manifests.github_pr_url),
    notes = coalesce(excluded.notes, public.release_manifests.notes),
    exported_by = v_actor,
    exported_by_name = coalesce(v_actor_name, public.release_manifests.exported_by_name)
  returning * into v_manifest;

  return v_manifest;
end;
$$;
revoke all on function public.record_release_manifest(text, text, text, integer, integer, integer, integer, integer, uuid[], text, text) from public, anon;
grant execute on function public.record_release_manifest(text, text, text, integer, integer, integer, integer, integer, uuid[], text, text) to authenticated;

create or replace function public.get_entry_attestation_summaries(
  p_corpus_version text default null
)
returns table (
  entry_id text,
  accurate_count integer,
  flagged_count integer,
  regional_count integer,
  weighted_accurate_score numeric,
  regions text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ca.entry_id,
    count(*) filter (where ca.verdict = 'accurate' and coalesce(ca.response_ms, 1500) >= 800)::integer as accurate_count,
    count(*) filter (where ca.verdict = 'needs_correction' and coalesce(ca.response_ms, 1500) >= 800)::integer as flagged_count,
    count(*) filter (where ca.verdict = 'regional_variant' and coalesce(ca.response_ms, 1500) >= 800)::integer as regional_count,
    round(
      coalesce(
        sum(
          case
            when ca.verdict = 'accurate' and coalesce(ca.response_ms, 1500) >= 800 then
              case when rp.role in ('editor', 'admin') then 2.5 else 1.0 end
            else 0
          end
        ),
        0
      ),
      1
    ) as weighted_accurate_score,
    coalesce(
      array_agg(distinct ca.dialect_region)
        filter (where ca.dialect_region is not null and pg_catalog.btrim(ca.dialect_region) <> ''),
      array[]::text[]
    ) as regions
  from public.community_attestations ca
  left join public.reviewer_profiles rp on rp.id = ca.reviewer_id
  where ca.example_id = ''
    and (p_corpus_version is null or ca.corpus_version = p_corpus_version)
  group by ca.entry_id;
$$;
grant execute on function public.get_entry_attestation_summaries(text) to anon, authenticated;

create or replace function public.get_example_attestation_summaries(
  p_corpus_version text default null
)
returns table (
  example_id text,
  entry_id text,
  accurate_count integer,
  flagged_count integer,
  regional_count integer,
  weighted_accurate_score numeric,
  regions text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ca.example_id,
    max(ca.entry_id) as entry_id,
    count(*) filter (where ca.verdict = 'accurate' and coalesce(ca.response_ms, 1500) >= 800)::integer as accurate_count,
    count(*) filter (where ca.verdict = 'needs_correction' and coalesce(ca.response_ms, 1500) >= 800)::integer as flagged_count,
    count(*) filter (where ca.verdict = 'regional_variant' and coalesce(ca.response_ms, 1500) >= 800)::integer as regional_count,
    round(
      coalesce(
        sum(
          case
            when ca.verdict = 'accurate' and coalesce(ca.response_ms, 1500) >= 800 then
              case when rp.role in ('editor', 'admin') then 2.5 else 1.0 end
            else 0
          end
        ),
        0
      ),
      1
    ) as weighted_accurate_score,
    coalesce(
      array_agg(distinct ca.dialect_region)
        filter (where ca.dialect_region is not null and pg_catalog.btrim(ca.dialect_region) <> ''),
      array[]::text[]
    ) as regions
  from public.community_attestations ca
  left join public.reviewer_profiles rp on rp.id = ca.reviewer_id
  where ca.example_id <> ''
    and (p_corpus_version is null or ca.corpus_version = p_corpus_version)
  group by ca.example_id;
$$;
grant execute on function public.get_example_attestation_summaries(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Row Level Security & Column-Level Grants
-- -----------------------------------------------------------------------------
alter table public.reviewer_profiles enable row level security;
alter table public.review_submissions enable row level security;
alter table public.review_decision_events enable row level security;
alter table public.role_promotion_requests enable row level security;
alter table public.community_attestations enable row level security;
alter table public.release_manifests enable row level security;

drop policy if exists "reviewers read own profile" on public.reviewer_profiles;
create policy "reviewers read own profile"
on public.reviewer_profiles for select to authenticated
using (id = (select auth.uid()) or (select private.is_lexreview_admin()));

drop policy if exists "reviewers create own profile" on public.reviewer_profiles;
create policy "reviewers create own profile"
on public.reviewer_profiles for insert to authenticated
with check (id = (select auth.uid()) and role = 'reviewer');

drop policy if exists "users update own metadata or admins manage roles" on public.reviewer_profiles;
create policy "users update own metadata or admins manage roles"
on public.reviewer_profiles for update to authenticated
using (id = (select auth.uid()) or (select private.is_lexreview_admin()))
with check ((id = (select auth.uid()) and role = role) or (select private.is_lexreview_admin()));

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
using (reviewer_id = (select auth.uid()) or (select private.is_lexreview_editor()));

drop policy if exists "editors update submissions" on public.review_submissions;
create policy "editors update submissions"
on public.review_submissions for update to authenticated
using (
  (select private.is_lexreview_editor())
  and status in ('pending', 'needs_changes', 'accepted')
)
with check (
  (select private.is_lexreview_editor())
  and editor_id = (select auth.uid())
  and status in ('accepted', 'rejected', 'needs_changes', 'merged')
  and (status = 'merged' or reviewer_id <> (select auth.uid()))
);

drop policy if exists "editors read review decision events" on public.review_decision_events;
drop policy if exists "editors or owners read review decision events" on public.review_decision_events;
create policy "editors or owners read review decision events"
on public.review_decision_events for select to authenticated
using (
  (select private.is_lexreview_editor())
  or exists (
    select 1 from public.review_submissions s
    where s.id = submission_id and s.reviewer_id = (select auth.uid())
  )
);

drop policy if exists "users read own promotion requests or admins read all" on public.role_promotion_requests;
create policy "users read own promotion requests or admins read all"
on public.role_promotion_requests for select to authenticated
using (requester_id = (select auth.uid()) or (select private.is_lexreview_admin()));

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

drop policy if exists "reviewers or editors read attestations" on public.community_attestations;
create policy "reviewers or editors read attestations"
on public.community_attestations for select to authenticated
using (reviewer_id = (select auth.uid()) or (select private.is_lexreview_editor()));

drop policy if exists "reviewers insert own attestations" on public.community_attestations;
create policy "reviewers insert own attestations"
on public.community_attestations for insert to authenticated
with check (reviewer_id = (select auth.uid()));

drop policy if exists "reviewers update own attestations" on public.community_attestations;
create policy "reviewers update own attestations"
on public.community_attestations for update to authenticated
using (reviewer_id = (select auth.uid()))
with check (reviewer_id = (select auth.uid()));

drop policy if exists "reviewers delete own attestations" on public.community_attestations;
create policy "reviewers delete own attestations"
on public.community_attestations for delete to authenticated
using (reviewer_id = (select auth.uid()));

drop policy if exists "anyone reads release manifests" on public.release_manifests;
create policy "anyone reads release manifests"
on public.release_manifests for select to anon, authenticated
using (true);

revoke all on table public.reviewer_profiles from public, anon, authenticated;
revoke all on table public.review_submissions from public, anon, authenticated;
revoke all on table public.review_decision_events from public, anon, authenticated;
revoke all on table public.role_promotion_requests from public, anon, authenticated;
revoke all on table public.community_attestations from public, anon, authenticated;
revoke all on table public.release_manifests from public, anon, authenticated;

grant select, insert on table public.reviewer_profiles to authenticated;
grant update (display_name, dialect_region, specialty, github_handle, role)
  on table public.reviewer_profiles to authenticated;

grant select, insert on table public.review_submissions to authenticated;
grant update (status, editor_note, exported_in_version, exported_at)
  on table public.review_submissions to authenticated;

grant select on table public.review_decision_events to authenticated;

grant select, insert on table public.role_promotion_requests to authenticated;
grant update (status, reviewed_by, admin_note, updated_at)
  on table public.role_promotion_requests to authenticated;

grant select, insert, update, delete on table public.community_attestations to authenticated;
grant select on table public.release_manifests to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. Public Contributors Directory, Member Standing & Messages (20261102150000)
-- -----------------------------------------------------------------------------
alter table public.reviewer_profiles
  add column if not exists public_listed boolean not null default true,
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'warned', 'suspended', 'banned')),
  add column if not exists status_reason text
    check (status_reason is null or char_length(status_reason) <= 1000),
  add column if not exists suspended_until timestamptz,
  add column if not exists status_updated_at timestamptz,
  add column if not exists status_updated_by uuid references auth.users(id) on delete set null;

create table if not exists public.member_moderation_events (
  id bigint generated always as identity primary key,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action_type text not null
    check (action_type in ('promote', 'demote', 'warn', 'suspend', 'ban', 'restore')),
  previous_role text,
  new_role text,
  previous_status text,
  new_status text,
  reason text check (reason is null or char_length(reason) <= 1000),
  occurred_at timestamptz not null default now()
);

create table if not exists public.member_moderation_reports (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  target_display_name text check (target_display_name is null or char_length(target_display_name) <= 120),
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recommended_action text not null default 'warn'
    check (recommended_action in ('warn', 'suspend', 'ban')),
  reason text not null
    check (char_length(btrim(reason)) between 10 and 1500),
  status text not null default 'open'
    check (status in ('open', 'resolved', 'dismissed')),
  reviewed_by uuid references auth.users(id) on delete set null,
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_messages (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references auth.users(id) on delete cascade,
  is_broadcast boolean not null default false,
  sender_id uuid references auth.users(id) on delete set null,
  sender_label text not null default 'إدارة المعجم'
    check (char_length(btrim(sender_label)) between 2 and 120),
  category text not null
    check (category in (
      'welcome',
      'appreciation',
      'editorial_note',
      'role_update',
      'warning',
      'suspension_notice',
      'announcement'
    )),
  title text not null
    check (char_length(btrim(title)) between 2 and 160),
  body text not null
    check (char_length(btrim(body)) between 4 and 4000),
  requires_ack boolean not null default false,
  read_at timestamptz,
  acknowledged_at timestamptz,
  pinned_until timestamptz,
  related_submission_id uuid references public.review_submissions(id) on delete set null,
  related_entry_id text check (related_entry_id is null or char_length(pg_catalog.btrim(related_entry_id)) <= 64),
  decision_status text check (decision_status is null or decision_status in ('accepted', 'needs_changes', 'rejected', 'merged')),
  created_at timestamptz not null default now(),
  constraint member_messages_target_check
    check (
      (is_broadcast = true and recipient_id is null and requires_ack = false)
      or (is_broadcast = false and recipient_id is not null)
    )
);

create index if not exists member_messages_related_submission_idx
  on public.member_messages(related_submission_id)
  where related_submission_id is not null;

create or replace function private.notify_contributor_on_submission_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_editor_name text;
  v_sender_label text;
  v_headword text;
  v_note text;
  v_category text;
  v_title text;
  v_body text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status not in ('accepted', 'needs_changes', 'rejected', 'merged') then
    return new;
  end if;

  if new.reviewer_id is null then
    return new;
  end if;

  if new.status <> 'merged' and new.editor_id is not null and new.reviewer_id = new.editor_id then
    return new;
  end if;

  if new.editor_id is not null then
    select nullif(pg_catalog.btrim(coalesce(rp.display_name, '')), '')
      into v_editor_name
      from public.reviewer_profiles rp
     where rp.id = new.editor_id;
  end if;

  v_sender_label := case
    when v_editor_name is not null then 'هيئة التحرير (' || pg_catalog.left(v_editor_name, 72) || ')'
    else 'هيئة التحرير المعجمي'
  end;

  v_headword := pg_catalog.left(
    coalesce(
      nullif(pg_catalog.btrim(coalesce(new.proposed_data ->> 'word_ar', '')), ''),
      nullif(pg_catalog.btrim(coalesce(new.proposed_data ->> 'arabizi', '')), ''),
      new.entry_id
    ),
    48
  );

  v_note := nullif(pg_catalog.btrim(coalesce(new.editor_note, '')), '');

  if new.status = 'accepted' then
    v_category := 'appreciation';
    v_title := 'تم اعتماد مساهمتك المعجمية: «' || v_headword || '»';
    v_body := 'اعتمدت هيئة التحرير مقترحك الخاص بـ «' || v_headword || '» لإدراجه في التحديث الرسمي القادم للمعجم.'
      || case
           when v_note is not null then ' ملاحظة المحرر اللغوي: ' || pg_catalog.left(v_note, 1500)
           else ' نشكرك على مساهمتك الموثقة في إثراء معجم الدارجة المغربية.'
         end;
  elsif new.status = 'needs_changes' then
    v_category := 'editorial_note';
    v_title := 'مطلوب تعديل بسيط على مقترحك: «' || v_headword || '»';
    v_body := 'راجع المحرر اللغوي مقترحك الخاص بـ «' || v_headword || '» وطلب استكمال أو توضيح بعض التفاصيل قبل الاعتماد النهائي.'
      || case
           when v_note is not null then ' ملاحظة المحرر: ' || pg_catalog.left(v_note, 1500)
           else ''
         end
      || ' يمكنك فتح المقترح مباشرة وتعديله ثم إعادة إرساله بضغطة واحدة.';
  elsif new.status = 'rejected' then
    v_category := 'editorial_note';
    v_title := 'نتيجة تحكيم مقترحك: «' || v_headword || '»';
    v_body := 'تعذر اعتماد المقترح الخاص بـ «' || v_headword || '» بصيغته الحالية بعد المراجعة التحريرية.'
      || case
           when v_note is not null then ' سبب القرار وملاحظة المحرر: ' || pg_catalog.left(v_note, 1500)
           else ''
         end
      || ' يمكنك الاطلاع على تفاصيل المقترح وتقديم نسخة منقحة وموثقة بشاهد أوضح متى شئت.';
  else
    v_category := 'appreciation';
    v_title := 'أُدرجت مساهمتك في الإصدار الرسمي ' || pg_catalog.left(coalesce(new.exported_in_version, ''), 24) || ': «' || v_headword || '»';
    v_body := 'تم دمج مساهمتك المعتمدة الخاصة بـ «' || v_headword || '» رسمياً ضمن حزمة الإصدار الموقعة للمتن المفتوح. شكراً لأثرك العلمي المستدام.';
  end if;

  insert into public.member_messages (
    recipient_id, is_broadcast, sender_id, sender_label,
    category, title, body, requires_ack,
    related_submission_id, related_entry_id, decision_status
  ) values (
    new.reviewer_id, false, new.editor_id, v_sender_label,
    v_category, pg_catalog.left(v_title, 160), pg_catalog.left(v_body, 4000), false,
    new.id, new.entry_id, new.status
  );

  return new;
end;
$$;
revoke all on function private.notify_contributor_on_submission_decision() from public, anon, authenticated;

drop trigger if exists trg_submission_decision_inbox_notify on public.review_submissions;
create trigger trg_submission_decision_inbox_notify
after update on public.review_submissions
for each row execute function private.notify_contributor_on_submission_decision();

alter table public.member_moderation_events enable row level security;
alter table public.member_moderation_reports enable row level security;
alter table public.member_messages enable row level security;

grant select on table public.member_moderation_events to authenticated;
grant select, insert on table public.member_moderation_reports to authenticated;
grant update (status, reviewed_by, admin_note, updated_at)
  on table public.member_moderation_reports to authenticated;
grant select on table public.member_messages to anon, authenticated;
grant insert on table public.member_messages to authenticated;
grant update (read_at, acknowledged_at, pinned_until)
  on table public.member_messages to authenticated;
grant update (
  display_name, dialect_region, specialty, github_handle, public_listed,
  role, account_status, status_reason, suspended_until
) on table public.reviewer_profiles to authenticated;

-- -----------------------------------------------------------------------------
-- 7. Member Saved Bookmarks & Realtime Inbox Publication (20261103180000)
-- -----------------------------------------------------------------------------
create table if not exists public.member_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_id text not null check (char_length(pg_catalog.btrim(entry_id)) between 1 and 64),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (user_id, entry_id)
);

create index if not exists member_bookmarks_user_created_idx
  on public.member_bookmarks(user_id, created_at desc);

alter table public.member_bookmarks enable row level security;

revoke all on table public.member_bookmarks from public, anon, authenticated;
grant select, insert, update (note), delete on table public.member_bookmarks to authenticated;

drop policy if exists "members read own bookmarks" on public.member_bookmarks;
create policy "members read own bookmarks"
on public.member_bookmarks for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "members insert own bookmarks" on public.member_bookmarks;
create policy "members insert own bookmarks"
on public.member_bookmarks for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "members update own bookmarks" on public.member_bookmarks;
create policy "members update own bookmarks"
on public.member_bookmarks for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "members delete own bookmarks" on public.member_bookmarks;
create policy "members delete own bookmarks"
on public.member_bookmarks for delete to authenticated
using (user_id = (select auth.uid()));

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'member_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.member_messages';
  end if;
end;
$$;

-- Bootstrap initial admin once via SQL Editor:
-- update public.reviewer_profiles set role = 'admin' where id = '<INITIAL_ADMIN_UUID>';


-- -----------------------------------------------------------------------------
-- 8. Guided Documentation Sprints & Word Revision History RPC (20261103210000)
-- -----------------------------------------------------------------------------
create table if not exists public.documentation_sprints (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (char_length(pg_catalog.btrim(slug)) between 3 and 96),
  title text not null check (char_length(pg_catalog.btrim(title)) between 4 and 180),
  description text not null check (char_length(pg_catalog.btrim(description)) between 8 and 1000),
  target_type text not null
    check (target_type in ('region', 'category', 'entry_type', 'etymology', 'missing_examples')),
  target_value text check (target_value is null or char_length(pg_catalog.btrim(target_value)) <= 120),
  goal_count integer not null default 50 check (goal_count between 5 and 10000),
  baseline_count integer not null default 0 check (baseline_count >= 0),
  badge_label text not null check (char_length(pg_catalog.btrim(badge_label)) between 4 and 120),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  status text not null default 'active'
    check (status in ('active', 'completed', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documentation_sprints_status_created_idx
  on public.documentation_sprints(status, created_at desc);

create table if not exists public.sprint_participations (
  sprint_id uuid not null references public.documentation_sprints(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contributions_count integer not null default 1 check (contributions_count >= 1),
  last_contributed_at timestamptz not null default now(),
  primary key (sprint_id, user_id)
);

create index if not exists sprint_participations_user_idx
  on public.sprint_participations(user_id, last_contributed_at desc);

alter table public.documentation_sprints enable row level security;
alter table public.sprint_participations enable row level security;

revoke all on table public.documentation_sprints from public, anon, authenticated;
grant select on table public.documentation_sprints to anon, authenticated;
grant insert, update on table public.documentation_sprints to authenticated;

drop policy if exists "anyone reads documentation sprints" on public.documentation_sprints;
create policy "anyone reads documentation sprints"
on public.documentation_sprints for select to anon, authenticated
using (true);

drop policy if exists "staff manages documentation sprints" on public.documentation_sprints;
create policy "staff manages documentation sprints"
on public.documentation_sprints for all to authenticated
using (private.is_lexreview_editor())
with check (private.is_lexreview_editor());

revoke all on table public.sprint_participations from public, anon, authenticated;
grant select on table public.sprint_participations to anon, authenticated;
grant insert, update (contributions_count, last_contributed_at) on table public.sprint_participations to authenticated;

drop policy if exists "anyone reads sprint participations" on public.sprint_participations;
create policy "anyone reads sprint participations"
on public.sprint_participations for select to anon, authenticated
using (true);

drop policy if exists "members upsert own sprint participation" on public.sprint_participations;
create policy "members upsert own sprint participation"
on public.sprint_participations for insert to authenticated
with check (user_id = (select auth.uid()) or private.is_lexreview_editor());

drop policy if exists "members update own sprint participation" on public.sprint_participations;
create policy "members update own sprint participation"
on public.sprint_participations for update to authenticated
using (user_id = (select auth.uid()) or private.is_lexreview_editor())
with check (user_id = (select auth.uid()) or private.is_lexreview_editor());

create or replace function public.get_entry_public_history(p_entry_id text)
returns table (
  revision_id uuid,
  status text,
  submission_kind text,
  has_new_example boolean,
  has_etymology boolean,
  has_meaning_update boolean,
  exported_in_version text,
  contributor_name text,
  contributor_slug text,
  editor_name text,
  created_at timestamptz,
  decided_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    rs.id as revision_id,
    rs.status,
    coalesce(rs.proposed_data ->> 'submission_kind', 'edit_entry') as submission_kind,
    (coalesce(pg_catalog.btrim(rs.proposed_data ->> 'example_darija'), '') <> '') as has_new_example,
    (coalesce(pg_catalog.btrim(rs.proposed_data ->> 'etymology'), '') <> '') as has_etymology,
    (
      coalesce(pg_catalog.btrim(rs.proposed_data ->> 'msa_translation'), '') <> ''
      or coalesce(pg_catalog.btrim(rs.proposed_data ->> 'meaning'), '') <> ''
      or coalesce(pg_catalog.btrim(rs.proposed_data ->> 'french_translation'), '') <> ''
    ) as has_meaning_update,
    rs.exported_in_version,
    case
      when rp.public_listed = true and coalesce(pg_catalog.btrim(rp.display_name), '') <> ''
        then rp.display_name
      else 'مساهم موثق في المجتمع'
    end as contributor_name,
    case
      when rp.public_listed = true then 'self-' || pg_catalog.left(rp.id::text, 8)
      else null
    end as contributor_slug,
    case
      when ep.public_listed = true and coalesce(pg_catalog.btrim(ep.display_name), '') <> ''
        then ep.display_name
      when rs.editor_id is not null
        then 'محرر معتمد في الهيئة العلمية'
      else null
    end as editor_name,
    rs.created_at,
    rs.updated_at as decided_at
  from public.review_submissions rs
  left join public.reviewer_profiles rp on rp.id = rs.reviewer_id
  left join public.reviewer_profiles ep on ep.id = rs.editor_id
  where rs.entry_id = pg_catalog.btrim(p_entry_id)
    and rs.status in ('accepted', 'merged')
  order by rs.updated_at asc;
$$;

revoke all on function public.get_entry_public_history(text) from public;
grant execute on function public.get_entry_public_history(text) to anon, authenticated;

-- Consent-based member contact details (kept separate from public contributor profiles).
create table if not exists public.member_contact_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  contact_email text null
    check (
      contact_email is null
      or (
        char_length(contact_email) <= 254
        and contact_email = lower(btrim(contact_email))
        and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
      )
    ),
  share_with_admins boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint member_contact_consent_requires_email
    check (not share_with_admins or contact_email is not null)
);

create index if not exists member_contact_preferences_shared_idx
  on public.member_contact_preferences (user_id)
  where share_with_admins = true and contact_email is not null;

alter table public.member_contact_preferences enable row level security;

revoke all on table public.member_contact_preferences from anon, authenticated;
grant select, insert, update on table public.member_contact_preferences to authenticated;

drop policy if exists "members read own contact preferences" on public.member_contact_preferences;
create policy "members read own contact preferences"
on public.member_contact_preferences for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "admins read consented member contact preferences" on public.member_contact_preferences;
create policy "admins read consented member contact preferences"
on public.member_contact_preferences for select to authenticated
using (
  (select private.is_lexreview_admin())
  and share_with_admins = true
  and contact_email is not null
);

drop policy if exists "members create own contact preferences" on public.member_contact_preferences;
create policy "members create own contact preferences"
on public.member_contact_preferences for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "members update own contact preferences" on public.member_contact_preferences;
create policy "members update own contact preferences"
on public.member_contact_preferences for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
