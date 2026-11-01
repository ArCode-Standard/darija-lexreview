-- =============================================================================
-- Darija LexReview — Governance Hardening Phase 2
-- 1. Corpus Version Pinning & Baseline Fingerprints on Submissions & Attestations
-- 2. Post-Export Release Lifecycle ('merged', exported_in_version, exported_at)
-- 3. Anti-Rush Dwell Timing (response_ms) & Trust-Weighted Crowd Consensus RPC
-- Safe to run idempotently after 20261101140000_community_attestations.sql.
-- =============================================================================

begin;

-- 1. Extend review_submissions with version pinning & export lifecycle metadata
alter table public.review_submissions
  add column if not exists corpus_version text not null default '1.5.0',
  add column if not exists baseline_fingerprint text,
  add column if not exists exported_in_version text,
  add column if not exists exported_at timestamptz;

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
  loop
    execute format('alter table public.review_submissions drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.review_submissions
  add constraint review_submissions_status_check
  check (status in ('pending', 'accepted', 'rejected', 'needs_changes', 'merged'));

create index if not exists review_submissions_exported_version_idx
  on public.review_submissions (exported_in_version)
  where exported_in_version is not null;

-- 2. Extend review_decision_events constraints to permit 'merged'
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
      and (
        pg_get_constraintdef(con.oid) ilike '%new_status%'
        or pg_get_constraintdef(con.oid) ilike '%previous_status%'
      )
  loop
    execute format('alter table public.review_decision_events drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.review_decision_events
  add constraint review_decision_events_new_status_check
  check (new_status in ('pending', 'accepted', 'rejected', 'needs_changes', 'merged'));

alter table public.review_decision_events
  add constraint review_decision_events_prev_status_check
  check (previous_status is null or previous_status in ('pending', 'accepted', 'rejected', 'needs_changes', 'merged'));

-- 3. Update immutability & audit trigger to allow controlled 'accepted' -> 'merged'
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
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if actor is null then
      raise exception 'Authenticated actor required for review decisions'
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

    if not (select private.is_lexreview_editor()) then
      raise exception 'Editor role required'
        using errcode = '42501';
    end if;

    -- Self-review remains blocked for editorial decisions (archiving an already-accepted item into a release is allowed by any certified editor).
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

-- 4. RPC for atomic batch archival after official dataset export
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

-- 5. Extend community_attestations with version pinning & anti-rush dwell timing
alter table public.community_attestations
  add column if not exists corpus_version text not null default '1.5.0',
  add column if not exists baseline_fingerprint text,
  add column if not exists response_ms integer check (response_ms is null or (response_ms >= 0 and response_ms <= 600000));

-- 6. Trust-weighted, rush-filtered crowd consensus summary RPC (backwards compatible default arg)
drop function if exists public.get_entry_attestation_summaries();
drop function if exists public.get_entry_attestation_summaries(text);

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
  where p_corpus_version is null or ca.corpus_version = p_corpus_version
  group by ca.entry_id;
$$;

grant execute on function public.get_entry_attestation_summaries(text) to anon, authenticated;

commit;
