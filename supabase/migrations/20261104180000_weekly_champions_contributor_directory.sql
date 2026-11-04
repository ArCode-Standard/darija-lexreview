-- Migration: Add weekly contributions count calculation to public contributors directory
-- Allows calculating the past 7 days activity dynamically without fake data.
--
-- PostgreSQL does not allow CREATE OR REPLACE FUNCTION to change a
-- RETURNS TABLE row type. The new weekly_contributions_count column changes
-- that row type, so remove the old zero-argument RPC before recreating it.
drop function if exists public.get_public_contributors_directory();

create function public.get_public_contributors_directory()
returns table (
    public_slug text,
    display_name text,
    dialect_region text,
    specialty text,
    github_handle text,
    avatar_source text,
    avatar_path text,
    avatar_seed text,
    role public.reviewer_role,
    accepted_count integer,
    attestations_count integer,
    sprint_participations_count integer,
    documented_words_count integer,
    documented_examples_count integer,
    weekly_contributions_count integer,
    recent_words text[],
    joined_year integer
)
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
    select
        rp.id::text as public_slug,
        coalesce(nullif(trim(rp.display_name), ''), 'مساهم موثق') as display_name,
        rp.dialect_region,
        rp.specialty,
        rp.github_handle,
        rp.avatar_source,
        rp.avatar_path,
        coalesce(rp.avatar_seed, rp.id::text) as avatar_seed,
        rp.role,
        coalesce(rp.accepted_count, 0) as accepted_count,
        coalesce(rp.attestations_count, 0) as attestations_count,
        coalesce(rp.sprint_participations_count, 0) as sprint_participations_count,
        coalesce(rp.documented_words_count, 0) as documented_words_count,
        coalesce(rp.documented_examples_count, 0) as documented_examples_count,
        (
            -- Real activity in the past 7 days: review submissions + community attestations
            coalesce((
                select count(*)::integer
                from public.review_submissions rs
                where (rs.contributor_id = rp.id or rs.submitter_email = rp.email)
                  and rs.created_at >= (pg_catalog.now() - interval '7 days')
            ), 0)
            +
            coalesce((
                select count(*)::integer
                from public.community_attestations ca
                where ca.contributor_id = rp.id
                  and ca.created_at >= (pg_catalog.now() - interval '7 days')
            ), 0)
        ) as weekly_contributions_count,
        array(
            select rs.word
            from public.review_submissions rs
            where (rs.contributor_id = rp.id or rs.submitter_email = rp.email)
              and rs.status = 'approved'
            order by rs.created_at desc
            limit 3
        ) as recent_words,
        coalesce(extract(year from rp.created_at)::integer, 2024) as joined_year
    from public.reviewer_profiles rp
    where coalesce(rp.public_listed, true) = true
      and coalesce(rp.account_status, 'active') not in ('suspended', 'banned')
    order by
        coalesce(rp.accepted_count, 0) + coalesce(rp.attestations_count, 0) desc,
        rp.created_at asc;
$$;

grant execute on function public.get_public_contributors_directory() to anon, authenticated;
