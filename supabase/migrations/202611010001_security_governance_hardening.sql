-- Security and governance hardening for Darija LexReview.
-- Apply after the initial schema. Safe to re-run.

create table if not exists public.review_decision_events (
  id bigint generated always as identity primary key,
  submission_id uuid not null references public.review_submissions(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('baseline', 'submitted', 'decision')),
  previous_status text,
  new_status text not null check (new_status in ('pending','accepted','rejected','needs_changes')),
  editor_note text,
  submission_snapshot jsonb not null,
  occurred_at timestamptz not null default now()
);

create index if not exists review_decision_events_submission_idx
  on public.review_decision_events(submission_id, occurred_at desc);

-- Capture the current state of pre-existing rows without inventing historical decisions.
insert into public.review_decision_events (
  submission_id, actor_id, event_type, previous_status,
  new_status, editor_note, submission_snapshot
)
select s.id, null, 'baseline', null, s.status, s.editor_note, to_jsonb(s)
from public.review_submissions s
where not exists (
  select 1 from public.review_decision_events e where e.submission_id = s.id
);

alter table public.review_decision_events enable row level security;
revoke all on public.review_decision_events from public, anon, authenticated;
grant select on public.review_decision_events to authenticated;

drop policy if exists "editors read review decision events" on public.review_decision_events;
create policy "editors read review decision events"
on public.review_decision_events for select to authenticated
using ((select private.is_lexreview_editor()));

-- No client role receives INSERT/UPDATE/DELETE on the audit table.
-- SECURITY DEFINER trigger functions are the only writers.

create or replace function public.record_review_submission_event()
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
    -- Submitted content and authorship are immutable after creation.
    if new.id is distinct from old.id
      or new.entry_id is distinct from old.entry_id
      or new.reviewer_id is distinct from old.reviewer_id
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

    if old.status not in ('pending', 'needs_changes')
      or new.status not in ('accepted', 'rejected', 'needs_changes')
      or new.status = old.status then
      raise exception 'Invalid review status transition: % -> %', old.status, new.status
        using errcode = '23514';
    end if;

    if new.status in ('rejected', 'needs_changes')
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

revoke all on function public.record_review_submission_event() from public, anon, authenticated;

drop trigger if exists review_submission_event_insert on public.review_submissions;
drop trigger if exists review_submission_event_update on public.review_submissions;
create trigger review_submission_event_insert
after insert on public.review_submissions
for each row execute function public.record_review_submission_event();

-- BEFORE trigger is required to reject unauthorized changes before persistence.
drop trigger if exists review_submissions_integrity_trg on public.review_submissions;
create trigger review_submissions_integrity_trg
before update on public.review_submissions
for each row execute function public.record_review_submission_event();

-- Replace broad editor update access with decision-only columns.
revoke update on public.review_submissions from authenticated;
revoke update (status, editor_id, editor_note, proposed_data, evidence, reviewer_note)
  on public.review_submissions from authenticated;
grant update (status, editor_note) on public.review_submissions to authenticated;

drop policy if exists "editors update submissions" on public.review_submissions;
create policy "editors update submissions"
on public.review_submissions for update to authenticated
using (
  (select private.is_lexreview_editor())
  and reviewer_id <> (select auth.uid())
  and status in ('pending', 'needs_changes')
)
with check (
  (select private.is_lexreview_editor())
  and reviewer_id <> (select auth.uid())
  and editor_id = (select auth.uid())
  and status in ('accepted', 'rejected', 'needs_changes')
);

-- Keep reviewer profile roles self-provisioned only; role changes remain operator-only.
drop policy if exists "reviewers create own profile" on public.reviewer_profiles;
create policy "reviewers create own profile"
on public.reviewer_profiles for insert to authenticated
with check (id = (select auth.uid()) and role = 'reviewer');
