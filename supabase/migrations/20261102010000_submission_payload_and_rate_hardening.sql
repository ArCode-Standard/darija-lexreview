-- Tighten server-side submission payload limits and make per-user rate limiting concurrency-safe.
-- Existing data must pass validation before this migration is deployed to production.

begin;

alter table public.review_submissions
  add constraint review_submissions_entry_id_length_check
    check (char_length(btrim(entry_id)) between 1 and 40) not valid,
  add constraint review_submissions_proposed_data_size_check
    check (pg_column_size(proposed_data) < 20000) not valid,
  add constraint review_submissions_evidence_count_check
    check (jsonb_typeof(evidence) = 'array' and jsonb_array_length(evidence) <= 5) not valid;

alter table public.review_submissions
  validate constraint review_submissions_entry_id_length_check;
alter table public.review_submissions
  validate constraint review_submissions_proposed_data_size_check;
alter table public.review_submissions
  validate constraint review_submissions_evidence_count_check;

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
  if v_actor is null then
    raise exception 'Authenticated contributor required'
      using errcode = '42501';
  end if;

  -- Serialize concurrent inserts for the same contributor so parallel requests
  -- cannot race past the rolling-hour limit.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_actor::text));

  new.reviewer_id := v_actor;

  if char_length(pg_catalog.btrim(new.entry_id)) not between 1 and 40
     or pg_catalog.pg_column_size(new.proposed_data) >= 20000
     or pg_catalog.jsonb_typeof(new.evidence) <> 'array'
     or pg_catalog.jsonb_array_length(new.evidence) > 5 then
    raise exception 'Submission payload exceeds the permitted bounds'
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

    if v_parent_reviewer <> v_actor then
      raise exception 'You can only revise your own submission'
        using errcode = '42501';
    end if;
  end if;

  select count(*)::integer into v_recent_count
  from public.review_submissions s
  where s.reviewer_id = v_actor
    and s.created_at >= (pg_catalog.now() - interval '1 hour');

  if v_recent_count >= 20 then
    raise exception 'Rate limit exceeded: maximum 20 submissions per hour'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_submission_rate_and_bounds()
  from public, anon, authenticated, service_role;

commit;
