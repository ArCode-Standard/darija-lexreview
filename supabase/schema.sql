-- ArCode Darija LexReview — initial Supabase schema
-- Run in Supabase SQL Editor. This schema stores review workflow only.
create extension if not exists pgcrypto;

create table if not exists public.reviewer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'reviewer' check (role in ('reviewer','editor','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.review_submissions (
  id uuid primary key default gen_random_uuid(),
  entry_id text not null,
  proposed_data jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  reviewer_note text,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','needs_changes')),
  reviewer_id uuid not null references auth.users(id) on delete cascade,
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

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists review_submissions_updated_at on public.review_submissions;
create trigger review_submissions_updated_at before update on public.review_submissions
for each row execute function public.set_updated_at();

create or replace function public.is_lexreview_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.reviewer_profiles
    where id = auth.uid() and role in ('editor','admin')
  );
$$;

alter table public.reviewer_profiles enable row level security;
alter table public.review_submissions enable row level security;

drop policy if exists "reviewers read own profile" on public.reviewer_profiles;
create policy "reviewers read own profile" on public.reviewer_profiles
for select to authenticated using (id = auth.uid() or public.is_lexreview_editor());

drop policy if exists "reviewers create own profile" on public.reviewer_profiles;
create policy "reviewers create own profile" on public.reviewer_profiles
for insert to authenticated with check (id = auth.uid() and role = 'reviewer');

drop policy if exists "reviewers update own submission" on public.review_submissions;
drop policy if exists "reviewers create submissions" on public.review_submissions;
create policy "reviewers create submissions" on public.review_submissions
for insert to authenticated with check (reviewer_id = auth.uid() and status = 'pending' and editor_id is null);

drop policy if exists "reviewers read own submissions" on public.review_submissions;
create policy "reviewers read own submissions" on public.review_submissions
for select to authenticated using (reviewer_id = auth.uid() or public.is_lexreview_editor());

drop policy if exists "editors update submissions" on public.review_submissions;
create policy "editors update submissions" on public.review_submissions
for update to authenticated using (public.is_lexreview_editor())
with check (public.is_lexreview_editor());

-- Profiles are created on first authenticated session; role is always reviewer.
create or replace function public.handle_new_lexreview_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.reviewer_profiles (id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), 'reviewer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_lexreview on auth.users;
create trigger on_auth_user_created_lexreview
after insert on auth.users for each row execute procedure public.handle_new_lexreview_user();

-- Promote trusted editors manually, after verifying their identity:
-- update public.reviewer_profiles set role = 'editor' where id = '<AUTH_USER_UUID>';
-- Never expose the Supabase service-role key in the browser.
