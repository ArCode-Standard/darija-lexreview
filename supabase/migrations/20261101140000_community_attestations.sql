-- Lightweight Human Validation & Regional Attestations (Yes / Needs Correction / Regional Usage).
-- Separates rapid crowd confirmations ("نعم، صحيحة") from formal editorial proposals (review_submissions)
-- so editors get clean consensus signals without empty submission queue noise.

create table if not exists public.community_attestations (
  id uuid primary key default gen_random_uuid(),
  entry_id text not null check (char_length(pg_catalog.btrim(entry_id)) between 1 and 64),
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  verdict text not null check (verdict in ('accurate', 'needs_correction', 'regional_variant')),
  dialect_region text check (dialect_region is null or char_length(dialect_region) <= 80),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entry_id, reviewer_id)
);

create index if not exists community_attestations_entry_idx
  on public.community_attestations(entry_id);

create index if not exists community_attestations_reviewer_idx
  on public.community_attestations(reviewer_id, created_at desc);

alter table public.community_attestations enable row level security;

-- Rate limiting & authorship enforcement trigger (max 120 rapid attestations per rolling hour per contributor)
create or replace function private.enforce_attestation_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := coalesce((select auth.uid()), new.reviewer_id);
  v_recent_count integer;
begin
  if v_actor is null then
    raise exception 'Authenticated contributor required for community attestation'
      using errcode = '42501';
  end if;

  new.reviewer_id := v_actor;
  new.updated_at := pg_catalog.now();

  if tg_op = 'INSERT' then
    select count(*)::integer into v_recent_count
    from public.community_attestations a
    where a.reviewer_id = v_actor
      and a.created_at >= (pg_catalog.now() - interval '1 hour');

    if v_recent_count >= 120 then
      raise exception 'Rate limit exceeded: maximum 120 rapid validations per hour'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_attestation_rate_limit() from public, anon, authenticated;

drop trigger if exists community_attestations_rate_trg on public.community_attestations;
create trigger community_attestations_rate_trg
before insert or update on public.community_attestations
for each row execute function private.enforce_attestation_rate_limit();

-- RLS Policies: Contributors manage only their own attestations; editors can inspect rows.
drop policy if exists "reviewers or editors read attestations" on public.community_attestations;
create policy "reviewers or editors read attestations"
on public.community_attestations for select to authenticated
using (
  reviewer_id = (select auth.uid())
  or (select private.is_lexreview_editor())
);

drop policy if exists "reviewers insert own attestations" on public.community_attestations;
create policy "reviewers insert own attestations"
on public.community_attestations for insert to authenticated
with check (
  reviewer_id = (select auth.uid())
);

drop policy if exists "reviewers update own attestations" on public.community_attestations;
create policy "reviewers update own attestations"
on public.community_attestations for update to authenticated
using (
  reviewer_id = (select auth.uid())
)
with check (
  reviewer_id = (select auth.uid())
);

drop policy if exists "reviewers delete own attestations" on public.community_attestations;
create policy "reviewers delete own attestations"
on public.community_attestations for delete to authenticated
using (
  reviewer_id = (select auth.uid())
);

-- Privacy-preserving public aggregation RPC: exposes per-entry verification counts & regions
-- without leaking individual contributor UUIDs.
create or replace function public.get_entry_attestation_summaries()
returns table (
  entry_id text,
  accurate_count integer,
  flagged_count integer,
  regional_count integer,
  regions text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ca.entry_id,
    count(*) filter (where ca.verdict = 'accurate')::integer as accurate_count,
    count(*) filter (where ca.verdict = 'needs_correction')::integer as flagged_count,
    count(*) filter (where ca.verdict = 'regional_variant')::integer as regional_count,
    coalesce(
      array_agg(distinct ca.dialect_region)
        filter (where ca.dialect_region is not null and pg_catalog.btrim(ca.dialect_region) <> ''),
      array[]::text[]
    ) as regions
  from public.community_attestations ca
  group by ca.entry_id;
$$;

grant execute on function public.get_entry_attestation_summaries() to anon, authenticated;
