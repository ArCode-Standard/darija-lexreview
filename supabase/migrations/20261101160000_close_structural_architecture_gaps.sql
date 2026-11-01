-- =============================================================================
-- Darija LexReview — Structural Architecture Completion (Phase 3)
-- 1. Submission Lifecycle Completion ('withdrawn', 'superseded', auto-supersession, withdraw_own_submission RPC)
-- 2. Context-Example Attestations (example_id on community_attestations + get_example_attestation_summaries RPC)
-- 3. Official Export Release Ledger (release_manifests + cryptographic SHA-256 checksums + record_release_manifest RPC)
-- Safe to run idempotently after 20261101150000_version_pinning_export_lifecycle_and_trust.sql.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Expand review_submissions & review_decision_events lifecycle constraints
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'review_submissions'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
      and con.conname <> 'review_rejection_requires_editor_note'
  loop
    execute format('alter table public.review_submissions drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.review_submissions
  add constraint review_submissions_status_check
  check (status in ('pending', 'accepted', 'rejected', 'needs_changes', 'merged', 'withdrawn', 'superseded'));

do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'review_decision_events'
      and con.contype = 'c'
  loop
    execute format('alter table public.review_decision_events drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.review_decision_events
  add constraint review_decision_events_event_type_check
  check (event_type in ('baseline', 'submitted', 'decision', 'withdrawn', 'superseded'));

alter table public.review_decision_events
  add constraint review_decision_events_new_status_check
  check (new_status in ('pending', 'accepted', 'rejected', 'needs_changes', 'merged', 'withdrawn', 'superseded'));

alter table public.review_decision_events
  add constraint review_decision_events_prev_status_check
  check (
    previous_status is null
    or previous_status in ('pending', 'accepted', 'rejected', 'needs_changes', 'merged', 'withdrawn', 'superseded')
  );

-- -----------------------------------------------------------------------------
-- 2. Lifecycle Audit & Immutability Trigger (Auto-Supersede + Contributor Withdraw)
-- -----------------------------------------------------------------------------
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

    -- Automatically mark superseded parent submission so stale drafts leave active queues
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

    -- Submitted content, authorship, version pin, and revision lineage are immutable after creation.
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

    -- Branch A: Contributor withdraws their own pending submission
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

    -- Branch B: Automatic or editorial supersession by a newer linked revision
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

    -- Branch C: Certified Editor / Admin adjudication & release archival
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

-- Contributor RPC to safely withdraw own pending submission without direct client UPDATE privilege escalation
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

-- -----------------------------------------------------------------------------
-- 3. Context-Example Attestations (ctx-*) on community_attestations
-- -----------------------------------------------------------------------------
alter table public.community_attestations
  add column if not exists example_id text not null default ''
    check (char_length(example_id) <= 64);

do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'community_attestations'
      and con.contype = 'u'
  loop
    execute format('alter table public.community_attestations drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.community_attestations
  add constraint community_attestations_target_reviewer_key
  unique (entry_id, example_id, reviewer_id);

create index if not exists community_attestations_example_idx
  on public.community_attestations(example_id)
  where example_id <> '';

-- Keep headword consensus summaries isolated from contextual-example votes
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
    count(*) filter (
      where ca.verdict = 'accurate'
        and coalesce(ca.response_ms, 1500) >= 800
    )::integer as accurate_count,
    count(*) filter (
      where ca.verdict = 'needs_correction'
        and coalesce(ca.response_ms, 1500) >= 800
    )::integer as flagged_count,
    count(*) filter (
      where ca.verdict = 'regional_variant'
        and coalesce(ca.response_ms, 1500) >= 800
    )::integer as regional_count,
    round(
      coalesce(
        sum(
          case
            when ca.verdict = 'accurate' and coalesce(ca.response_ms, 1500) >= 800 then
              case
                when rp.role in ('editor', 'admin') then 2.5
                else 1.0
              end
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

-- Dedicated aggregation RPC for contextual examples (ctx-000001, etc.)
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
    count(*) filter (
      where ca.verdict = 'accurate'
        and coalesce(ca.response_ms, 1500) >= 800
    )::integer as accurate_count,
    count(*) filter (
      where ca.verdict = 'needs_correction'
        and coalesce(ca.response_ms, 1500) >= 800
    )::integer as flagged_count,
    count(*) filter (
      where ca.verdict = 'regional_variant'
        and coalesce(ca.response_ms, 1500) >= 800
    )::integer as regional_count,
    round(
      coalesce(
        sum(
          case
            when ca.verdict = 'accurate' and coalesce(ca.response_ms, 1500) >= 800 then
              case
                when rp.role in ('editor', 'admin') then 2.5
                else 1.0
              end
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
-- 4. Official Export Release Ledger (release_manifests)
-- -----------------------------------------------------------------------------
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

create index if not exists release_manifests_created_idx
  on public.release_manifests(created_at desc);

alter table public.release_manifests enable row level security;
revoke all on table public.release_manifests from public, anon, authenticated;
grant select on table public.release_manifests to anon, authenticated;

drop policy if exists "anyone reads release manifests" on public.release_manifests;
create policy "anyone reads release manifests"
on public.release_manifests for select to anon, authenticated
using (true);

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

  -- Atomically archive included accepted submissions into 'merged'
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
    version,
    lexicon_sha256,
    examples_sha256,
    total_entries,
    total_examples,
    modified_entries_count,
    added_entries_count,
    added_examples_count,
    submission_ids,
    github_pr_url,
    notes,
    exported_by,
    exported_by_name
  ) values (
    v_clean_version,
    pg_catalog.lower(pg_catalog.btrim(p_lexicon_sha256)),
    pg_catalog.lower(pg_catalog.btrim(p_examples_sha256)),
    p_total_entries,
    p_total_examples,
    p_modified_entries_count,
    p_added_entries_count,
    p_added_examples_count,
    coalesce(p_submission_ids, '{}'::uuid[]),
    nullif(pg_catalog.btrim(coalesce(p_github_pr_url, '')), ''),
    nullif(pg_catalog.btrim(coalesce(p_notes, '')), ''),
    v_actor,
    v_actor_name
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

commit;
