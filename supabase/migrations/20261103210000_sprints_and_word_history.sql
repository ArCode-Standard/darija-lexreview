-- =============================================================================
-- Migration: 20261103210000_sprints_and_word_history
-- Guided Documentation Sprints (collective goals + sprint badges) &
-- Transparent Encyclopedic Word Revision History public RPC.
-- =============================================================================

create table if not exists public.documentation_sprints (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (char_length(pg_catalog.btrim(slug)) between 3 and 96),
  title text not null check (char_length(pg_catalog.btrim(title)) between 4 and 180),
  description text not null check (char_length(pg_catalog.btrim(description)) between 8 and 1000),
  target_type text not null
    check (target_type in ('region', 'category', 'entry_type', 'etymology', 'missing_examples')),
  target_value text check (target_value is null or char_length(pg_catalog.btrim(target_value)) <= 120),
  goal_count integer not null default 50 check (goal_count between 5 and 10000),
  baseline_count integer not null default 0 check (baseline_count >= 0),
  badge_label text not null check (char_length(pg_catalog.btrim(badge_label)) between 4 and 120),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  status text not null default 'active'
    check (status in ('active', 'completed', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documentation_sprints_status_created_idx
  on public.documentation_sprints(status, created_at desc);

create table if not exists public.sprint_participations (
  sprint_id uuid not null references public.documentation_sprints(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contributions_count integer not null default 1 check (contributions_count >= 1),
  last_contributed_at timestamptz not null default now(),
  primary key (sprint_id, user_id)
);

create index if not exists sprint_participations_user_idx
  on public.sprint_participations(user_id, last_contributed_at desc);

alter table public.documentation_sprints enable row level security;
alter table public.sprint_participations enable row level security;

revoke all on table public.documentation_sprints from public, anon, authenticated;
grant select on table public.documentation_sprints to anon, authenticated;
grant insert, update on table public.documentation_sprints to authenticated;

drop policy if exists "anyone reads documentation sprints" on public.documentation_sprints;
create policy "anyone reads documentation sprints"
on public.documentation_sprints for select to anon, authenticated
using (true);

drop policy if exists "staff manages documentation sprints" on public.documentation_sprints;
create policy "staff manages documentation sprints"
on public.documentation_sprints for all to authenticated
using (private.is_lexreview_editor())
with check (private.is_lexreview_editor());

revoke all on table public.sprint_participations from public, anon, authenticated;
grant select on table public.sprint_participations to anon, authenticated;
grant insert, update (contributions_count, last_contributed_at) on table public.sprint_participations to authenticated;

drop policy if exists "anyone reads sprint participations" on public.sprint_participations;
create policy "anyone reads sprint participations"
on public.sprint_participations for select to anon, authenticated
using (true);

drop policy if exists "members upsert own sprint participation" on public.sprint_participations;
create policy "members upsert own sprint participation"
on public.sprint_participations for insert to authenticated
with check (user_id = (select auth.uid()) or private.is_lexreview_editor());

drop policy if exists "members update own sprint participation" on public.sprint_participations;
create policy "members update own sprint participation"
on public.sprint_participations for update to authenticated
using (user_id = (select auth.uid()) or private.is_lexreview_editor())
with check (user_id = (select auth.uid()) or private.is_lexreview_editor());

-- Sanitized Public Encyclopedic Word Revision History RPC
-- Exposes only accepted/merged revisions and opted-in public contributor names (never private emails).
create or replace function public.get_entry_public_history(p_entry_id text)
returns table (
  revision_id uuid,
  status text,
  submission_kind text,
  has_new_example boolean,
  has_etymology boolean,
  has_meaning_update boolean,
  exported_in_version text,
  contributor_name text,
  contributor_slug text,
  editor_name text,
  created_at timestamptz,
  decided_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    rs.id as revision_id,
    rs.status,
    coalesce(rs.proposed_data ->> 'submission_kind', 'edit_entry') as submission_kind,
    (coalesce(pg_catalog.btrim(rs.proposed_data ->> 'example_darija'), '') <> '') as has_new_example,
    (coalesce(pg_catalog.btrim(rs.proposed_data ->> 'etymology'), '') <> '') as has_etymology,
    (
      coalesce(pg_catalog.btrim(rs.proposed_data ->> 'msa_translation'), '') <> ''
      or coalesce(pg_catalog.btrim(rs.proposed_data ->> 'meaning'), '') <> ''
      or coalesce(pg_catalog.btrim(rs.proposed_data ->> 'french_translation'), '') <> ''
    ) as has_meaning_update,
    rs.exported_in_version,
    case
      when rp.public_listed = true and coalesce(pg_catalog.btrim(rp.display_name), '') <> ''
        then rp.display_name
      else 'مساهم موثق في المجتمع'
    end as contributor_name,
    case
      when rp.public_listed = true then 'self-' || pg_catalog.left(rp.id::text, 8)
      else null
    end as contributor_slug,
    case
      when ep.public_listed = true and coalesce(pg_catalog.btrim(ep.display_name), '') <> ''
        then ep.display_name
      when rs.editor_id is not null
        then 'محرر معتمد في الهيئة العلمية'
      else null
    end as editor_name,
    rs.created_at,
    rs.updated_at as decided_at
  from public.review_submissions rs
  left join public.reviewer_profiles rp on rp.id = rs.reviewer_id
  left join public.reviewer_profiles ep on ep.id = rs.editor_id
  where rs.entry_id = pg_catalog.btrim(p_entry_id)
    and rs.status in ('accepted', 'merged')
  order by rs.updated_at asc;
$$;

revoke all on function public.get_entry_public_history(text) from public;
grant execute on function public.get_entry_public_history(text) to anon, authenticated;
