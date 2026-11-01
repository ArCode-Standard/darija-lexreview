-- =============================================================================
-- Darija LexReview — Immutable Official Release Ledger
-- Prevents rewriting an existing release version and blocks UPDATE/DELETE
-- against the release history, including privileged application roles.
-- =============================================================================

begin;

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

  -- Friendly early rejection. The UNIQUE constraint remains the concurrency-safe
  -- final guard if two release attempts race after this check.
  if exists (
    select 1
    from public.release_manifests rm
    where rm.version = v_clean_version
  ) then
    raise exception 'Release version % already exists; release manifests are immutable. Publish a new version instead.',
      v_clean_version
      using errcode = '23505';
  end if;

  select rp.display_name into v_actor_name
  from public.reviewer_profiles rp
  where rp.id = v_actor;

  -- Atomically archive included accepted submissions into 'merged'.
  -- If the manifest insert fails, this update is rolled back with the transaction.
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
  returning * into v_manifest;

  return v_manifest;
end;
$$;

revoke all on function public.record_release_manifest(text, text, text, integer, integer, integer, integer, integer, uuid[], text, text) from public, anon;
grant execute on function public.record_release_manifest(text, text, text, integer, integer, integer, integer, integer, uuid[], text, text) to authenticated;

-- RLS and grants do not protect against service_role or accidental privileged
-- writes. Enforce append-only semantics at the table boundary as well.
create or replace function private.reject_release_manifest_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Official release manifests are immutable; create a new version instead.'
    using errcode = '55000';
end;
$$;

revoke all on function private.reject_release_manifest_mutation() from public, anon, authenticated;

drop trigger if exists release_manifests_append_only on public.release_manifests;
create trigger release_manifests_append_only
before update or delete on public.release_manifests
for each row
execute function private.reject_release_manifest_mutation();

commit;
