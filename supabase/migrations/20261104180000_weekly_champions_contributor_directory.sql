-- Migration: Add real weekly activity and sprint participation to the public contributors directory.
-- Keep the public RPC privacy-preserving and derive statistics from their source tables.
--
-- PostgreSQL cannot change a function's RETURNS TABLE row type with CREATE OR REPLACE.
-- Drop the zero-argument RPC before recreating it with the additional result columns.
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
    role text,
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
set search_path = ''
as $$
    with submission_stats as (
        select
            rs.reviewer_id,
            count(*) filter (where rs.status in ('accepted', 'merged'))::integer as accepted_count,
            count(distinct rs.entry_id) filter (where rs.status in ('accepted', 'merged'))::integer as accepted_entries_count,
            count(*) filter (
                where rs.status in ('accepted', 'merged')
                  and nullif(pg_catalog.btrim(coalesce(rs.proposed_data ->> 'example_darija', '')), '') is not null
            )::integer as accepted_examples_count,
            (
                array_agg(
                    nullif(pg_catalog.btrim(coalesce(rs.proposed_data ->> 'word_ar', '')), '')
                    order by rs.updated_at desc
                ) filter (
                    where rs.status in ('accepted', 'merged')
                      and nullif(pg_catalog.btrim(coalesce(rs.proposed_data ->> 'word_ar', '')), '') is not null
                )
            )[1:5] as recent_words
        from public.review_submissions rs
        group by rs.reviewer_id
    ),
    attestation_stats as (
        select
            ca.reviewer_id,
            count(*) filter (where coalesce(ca.response_ms, 1500) >= 800)::integer as attestations_count,
            count(distinct ca.entry_id) filter (
                where ca.example_id = '' and coalesce(ca.response_ms, 1500) >= 800
            )::integer as attested_words_count,
            count(*) filter (
                where ca.example_id <> '' and coalesce(ca.response_ms, 1500) >= 800
            )::integer as attested_examples_count
        from public.community_attestations ca
        group by ca.reviewer_id
    ),
    sprint_stats as (
        select
            sp.user_id as reviewer_id,
            count(*)::integer as sprint_participations_count
        from public.sprint_participations sp
        group by sp.user_id
    ),
    weekly_activity as (
        select rs.reviewer_id, count(*)::integer as contribution_count
        from public.review_submissions rs
        where rs.created_at >= (pg_catalog.now() - interval '7 days')
        group by rs.reviewer_id

        union all

        select ca.reviewer_id, count(*)::integer as contribution_count
        from public.community_attestations ca
        where ca.created_at >= (pg_catalog.now() - interval '7 days')
          and coalesce(ca.response_ms, 1500) >= 800
        group by ca.reviewer_id
    ),
    weekly_stats as (
        select wa.reviewer_id, sum(wa.contribution_count)::integer as weekly_contributions_count
        from weekly_activity wa
        group by wa.reviewer_id
    )
    select
        pg_catalog.substr(
            pg_catalog.encode(extensions.digest(rp.id::text || ':lexreview-public', 'sha256'), 'hex'),
            1,
            12
        ) as public_slug,
        coalesce(nullif(pg_catalog.btrim(rp.display_name), ''), 'مساهم معجمي') as display_name,
        rp.dialect_region,
        rp.specialty,
        rp.github_handle,
        coalesce(rp.avatar_source, 'arcode') as avatar_source,
        rp.avatar_path,
        coalesce(rp.avatar_seed, rp.id::text) as avatar_seed,
        rp.role,
        coalesce(ss.accepted_count, 0) as accepted_count,
        coalesce(ats.attestations_count, 0) as attestations_count,
        coalesce(sps.sprint_participations_count, 0) as sprint_participations_count,
        (
            coalesce(ss.accepted_entries_count, 0)
            + coalesce(ats.attested_words_count, 0)
        )::integer as documented_words_count,
        (
            coalesce(ss.accepted_examples_count, 0)
            + coalesce(ats.attested_examples_count, 0)
        )::integer as documented_examples_count,
        coalesce(ws.weekly_contributions_count, 0) as weekly_contributions_count,
        coalesce(ss.recent_words, array[]::text[]) as recent_words,
        coalesce(extract(year from rp.created_at)::integer, 2024) as joined_year
    from public.reviewer_profiles rp
    left join submission_stats ss on ss.reviewer_id = rp.id
    left join attestation_stats ats on ats.reviewer_id = rp.id
    left join sprint_stats sps on sps.reviewer_id = rp.id
    left join weekly_stats ws on ws.reviewer_id = rp.id
    where rp.public_listed = true
      and (
          rp.account_status in ('active', 'warned')
          or (
              rp.account_status = 'suspended'
              and rp.suspended_until is not null
              and rp.suspended_until <= pg_catalog.now()
          )
      )
      and (
          rp.role in ('editor', 'admin')
          or coalesce(ss.accepted_count, 0) > 0
          or coalesce(ats.attestations_count, 0) > 0
          or nullif(pg_catalog.btrim(coalesce(rp.display_name, '')), '') is not null
      )
    order by
        case rp.role when 'admin' then 1 when 'editor' then 2 else 3 end,
        coalesce(ss.accepted_count, 0) desc,
        coalesce(ats.attestations_count, 0) desc,
        rp.created_at asc
    limit 200;
$$;

grant execute on function public.get_public_contributors_directory() to anon, authenticated;
