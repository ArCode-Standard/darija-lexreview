-- Close remaining governance, rate-limiting, revision-lineage, revocation, and profile-privacy gaps.
-- Apply after 20261101130441_security_governance_hardening.sql, 20261101130559_audit_actor_index.sql,
-- and 20261101131000_rbac_promotions_and_profiles.sql. Safe to re-run idempotently.

-- 1. Revision Lineage: link revised submissions to the prior submission they supersede.
alter table public.review_submissions
  add column if not exists supersedes_id uuid
    references public.review_submissions(id) on delete set null;

create index if not exists review_submissions_supersedes_idx
  on public.review_submissions(supersedes_id)
  where supersedes_id is not null;

-- 2. Submission Rate Limiting & Evidence Array Bounds (max 10 evidence items, max 25 submissions/hour).
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

drop trigger if exists review_submissions_rate_bounds_trg on public.review_submissions;
create trigger review_submissions_rate_bounds_trg
before insert on public.review_submissions
for each row execute function private.enforce_submission_rate_and_bounds();

-- 3. Controlled Revocation of Accepted Submissions + Immutable Supersedes Lineage + Audit Events.
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

    -- Submitted content, authorship, and revision lineage are immutable after creation.
    if new.id is distinct from old.id
      or new.entry_id is distinct from old.entry_id
      or new.reviewer_id is distinct from old.reviewer_id
      or new.supersedes_id is distinct from old.supersedes_id
      or new.proposed_data is distinct from old.proposed_data
      or new.evidence is distinct from old.evidence
      or new.reviewer_note is distinct from old.reviewer_note
      or new.created_at is distinct from old.created_at then
      raise exception 'Submission content and authorship are immutable'
        using errcode = '42501';
    end if;

    if old.reviewer_id = actor then
      raise exception 'Self-review is not permitted'
        using errcode = '42501';
    end if;

    if not (select private.is_lexreview_editor()) then
      raise exception 'Editor role required'
        using errcode = '42501';
    end if;

    -- Standard transitions from pending/needs_changes, plus controlled revocation from accepted -> needs_changes/rejected.
    if old.status not in ('pending', 'needs_changes', 'accepted')
      or new.status not in ('accepted', 'rejected', 'needs_changes')
      or new.status = old.status then
      raise exception 'Invalid review status transition: % -> %', old.status, new.status
        using errcode = '23514';
    end if;

    if old.status = 'accepted' then
      if new.status not in ('needs_changes', 'rejected') then
        raise exception 'Accepted submissions can only be revoked to needs_changes or rejected'
          using errcode = '23514';
      end if;
      if new.editor_note is null or char_length(pg_catalog.btrim(new.editor_note)) < 10 then
        raise exception 'Revoking an accepted submission requires an audit justification of at least 10 characters'
          using errcode = '23514';
      end if;
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
      new.id, actor, 'decision', old.status, new.status,
      new.editor_note, to_jsonb(new)
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
  and reviewer_id <> (select auth.uid())
  and status in ('pending', 'needs_changes', 'accepted')
)
with check (
  (select private.is_lexreview_editor())
  and reviewer_id <> (select auth.uid())
  and editor_id = (select auth.uid())
  and status in ('accepted', 'rejected', 'needs_changes')
);

-- Allow editors to read all audit events, and allow contributors to inspect audit events on their own submissions.
drop policy if exists "editors read review decision events" on public.review_decision_events;
drop policy if exists "editors or owners read review decision events" on public.review_decision_events;
create policy "editors or owners read review decision events"
on public.review_decision_events for select to authenticated
using (
  (select private.is_lexreview_editor())
  or exists (
    select 1
    from public.review_submissions s
    where s.id = submission_id
      and s.reviewer_id = (select auth.uid())
  )
);

-- 4. Minimize Contributor Profile Exposure:
-- Restrict full reviewer_profiles SELECT to the profile owner or admins; expose staff display names via minimal RPC.
drop policy if exists "reviewers read own profile" on public.reviewer_profiles;
create policy "reviewers read own profile"
on public.reviewer_profiles for select to authenticated
using (
  id = (select auth.uid())
  or (select private.is_lexreview_admin())
);

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
