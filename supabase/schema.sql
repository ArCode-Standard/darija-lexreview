-- ArCode Darija LexReview — Supabase schema
-- Review workflow only. The official lexical dataset remains in GitHub.
-- Apply to a fresh Supabase project with the SQL editor or migration tooling.

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.reviewer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'reviewer'
    check (role in ('reviewer','editor','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.review_submissions (
  id uuid primary key default gen_random_uuid(),
  entry_id text not null,
  proposed_data jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  reviewer_note text,
  status text not null default 'pending'
    check (status in ('pending','accepted','rejected','needs_changes')),
  reviewer_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  editor_id uuid references auth.users(id) on delete set null,
  editor_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists review_submissions_status_created_idx
  on public.review_submissions(status, created_at desc);
create index if not exists review_submissions_reviewer_idx
  on public.review_submissions(reviewer_id, created_at desc);
create index if not exists review_submissions_entry_idx
  on public.review_submissions(entry_id);
create index if not exists review_submissions_editor_idx
  on public.review_submissions(editor_id) where editor_id is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;
revoke all on function public.set_updated_at() from public, anon, authenticated;

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
create trigger review_submissions_updated_at
before update on public.review_submissions
for each row execute function public.set_updated_at();

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
with check ((select private.is_lexreview_editor()));

revoke all on table public.reviewer_profiles from anon, authenticated;
revoke all on table public.review_submissions from anon, authenticated;
grant select, insert on table public.reviewer_profiles to authenticated;
grant select, insert on table public.review_submissions to authenticated;
grant update (status, editor_id, editor_note, proposed_data, evidence, reviewer_note)
on table public.review_submissions to authenticated;

-- Users are provisioned by an administrator in Supabase Auth.
-- New users receive reviewer role automatically. Promote trusted editors
-- manually after verifying identity:
-- update public.reviewer_profiles set role = 'editor' where id = '<AUTH_USER_UUID>';
-- Never expose service_role or secret keys in browser code.
