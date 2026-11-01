-- Tighten server-side submission payload limits and make per-user rate limiting concurrency-safe.
-- The existing BEFORE INSERT trigger from the governance migration invokes this function.
-- Existing production data is validated before the constraints are accepted.

begin;

alter table public.review_submissions
  add constraint review_submissions_entry_id_length_check
    check (char_length(btrim(entry_id)) between 1 and 40) not valid,
  add constraint review_submissions_proposed_data_size_check
    check (pg_column_size(proposed_data) < 20000) not valid,
  add constraint review_submissions_evidence_count_check
    check (
      case
        when jsonb_typeof(evidence) = 'array'
          then jsonb_array_length(evidence) <= 5
        else false
      end
    ) not valid,
  add constraint review_submissions_evidence_size_check
    check (pg_column_size(evidence) < 20000) not valid;

alter table public.review_submissions
  validate constraint review_submissions_entry_id_length_check;
alter table public.review_submissions
  validate constraint review_submissions_proposed_data_size_check;
alter table public.review_submissions
  validate constraint review_submissions_evidence_count_check;
alter table public.review_submissions
  validate constraint review_submissions_evidence_size_check;

create or replace function private.enforce_submission_rate_and_bounds()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_recent_count integer;
  v_parent_reviewer uuid;
begin
  -- Never infer the caller from client-supplied row data. PostgREST requests
  -- must carry an authenticated Supabase identity.
  if v_actor is null or new.reviewer_id is distinct from v_actor then
    raise exception 'Authenticated contributor required'
      using errcode = '42501';
  end if;

  -- Serialize concurrent inserts for the same contributor so parallel requests
  -- cannot race past the rolling-hour limit.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text, 0)
  );

  if char_length(pg_catalog.btrim(new.entry_id)) not between 1 and 40
     or pg_catalog.pg_column_size(new.proposed_data) >= 20000
     or pg_catalog.pg_column_size(new.evidence) >= 20000
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

-- The rate/bounds guard must run on every authenticated submission insert.
drop trigger if exists review_submissions_rate_and_bounds_trg
  on public.review_submissions;
create trigger review_submissions_rate_and_bounds_trg
before insert on public.review_submissions
for each row execute function private.enforce_submission_rate_and_bounds();

commit;
