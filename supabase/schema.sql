-- ArCode Darija LexReview — Hardened Supabase Schema
-- Review workflow only. The official lexical dataset remains in GitHub.
-- Apply idempotently to a Supabase project with the SQL editor or migration tooling.

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.reviewer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 120),
  role text not null default 'reviewer'
    check (role in ('reviewer','editor','admin')),
  created_at timestamptz not null default now()
);

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

create index if not exists review_submissions_status_created_idx
  on public.review_submissions(status, created_at desc);
create index if not exists review_submissions_reviewer_idx
  on public.review_submissions(reviewer_id, created_at desc);
create index if not exists review_submissions_entry_idx
  on public.review_submissions(entry_id);
create index if not exists review_submissions_editor_idx
  on public.review_submissions(editor_id) where editor_id is not null;

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

-- Enforces immutable audit fields and stamps editor_id server-side on moderation updates
create or replace function public.enforce_review_submission_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Immutable columns cannot be altered after creation
  new.id := old.id;
  new.entry_id := old.entry_id;
  new.reviewer_id := old.reviewer_id;
  new.created_at := old.created_at;
  new.updated_at := pg_catalog.now();

  -- Stamp the acting authenticated editor automatically
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

create or replace function public.handle_new_lexreview_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.reviewer_profiles (id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''), 'reviewer')
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_lexreview_user() from public, anon, authenticated;

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

drop policy if exists "reviewers read own profile" on public.reviewer_profiles;
create policy "reviewers read own profile"
on public.reviewer_profiles for select to authenticated
using (id = (select auth.uid()) or (select private.is_lexreview_editor()));

drop policy if exists "reviewers create own profile" on public.reviewer_profiles;
create policy "reviewers create own profile"
on public.reviewer_profiles for insert to authenticated
with check (id = (select auth.uid()) and role = 'reviewer');

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

revoke all on table public.reviewer_profiles from anon, authenticated;
revoke all on table public.review_submissions from anon, authenticated;
grant select, insert on table public.reviewer_profiles to authenticated;
grant select, insert on table public.review_submissions to authenticated;
grant update (status, editor_id, editor_note, proposed_data, evidence, reviewer_note)
on table public.review_submissions to authenticated;

-- Users are provisioned in Supabase Auth.
-- New users receive reviewer role automatically. Promote trusted editors manually:
-- update public.reviewer_profiles set role = 'editor' where id = '<AUTH_USER_UUID>';
-- Never expose service_role or secret keys in browser code.
