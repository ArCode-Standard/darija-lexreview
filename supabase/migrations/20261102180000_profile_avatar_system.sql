-- Contributor avatar system: private ownership, public opt-in display.
alter table public.reviewer_profiles
  add column if not exists avatar_source text not null default 'arcode'
    check (avatar_source in ('upload', 'github', 'dicebear', 'arcode'));
alter table public.reviewer_profiles
  add column if not exists avatar_path text
    check (avatar_path is null or (char_length(avatar_path) <= 240 and left(avatar_path, 1) <> '/' and position('..' in avatar_path) = 0));
alter table public.reviewer_profiles
  add column if not exists avatar_seed text
    check (avatar_seed is null or char_length(avatar_seed) <= 80);

-- Public bucket: image bytes are readable, but only the owning authenticated
-- user can upload, replace, or delete objects in their own UUID folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public buckets serve known object URLs without granting bucket listing.
-- Do not add a public SELECT policy: it would expose every member's object path.

drop policy if exists "Members upload their own avatar images" on storage.objects;
create policy "Members upload their own avatar images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Members update their own avatar images" on storage.objects;
create policy "Members update their own avatar images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Members delete their own avatar images" on storage.objects;
create policy "Members delete their own avatar images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

grant update (avatar_source, avatar_path, avatar_seed)
  on table public.reviewer_profiles to authenticated;

-- Keep the public directory sanitized: avatar details are returned only for
-- profiles that explicitly opted into the public contributors directory.
drop function if exists public.get_public_contributors_directory();

create function public.get_public_contributors_directory()
returns table (
  public_slug text,
  display_name text,
  dialect_region text,
  specialty text,
  github_handle text,
  role text,
  accepted_count integer,
  attestations_count integer,
  joined_year integer,
  avatar_source text,
  avatar_path text,
  avatar_seed text
)
language sql
stable
security definer
set search_path = ''
as $$
  with sub_counts as (
    select
      s.reviewer_id,
      count(*) filter (where s.status in ('accepted', 'merged'))::integer as accepted_count
    from public.review_submissions s
    group by s.reviewer_id
  ),
  att_counts as (
    select
      ca.reviewer_id,
      count(*)::integer as attestations_count
    from public.community_attestations ca
    where coalesce(ca.response_ms, 1500) >= 800
    group by ca.reviewer_id
  )
  select
    pg_catalog.substr(pg_catalog.encode(extensions.digest(rp.id::text || ':lexreview-public', 'sha256'), 'hex'), 1, 12) as public_slug,
    coalesce(nullif(pg_catalog.btrim(rp.display_name), ''), 'مساهم معجمي') as display_name,
    rp.dialect_region,
    rp.specialty,
    rp.github_handle,
    rp.role,
    coalesce(sc.accepted_count, 0) as accepted_count,
    coalesce(ac.attestations_count, 0) as attestations_count,
    extract(year from rp.created_at)::integer as joined_year,
    coalesce(rp.avatar_source, 'arcode') as avatar_source,
    rp.avatar_path,
    rp.avatar_seed
  from public.reviewer_profiles rp
  left join sub_counts sc on sc.reviewer_id = rp.id
  left join att_counts ac on ac.reviewer_id = rp.id
  where rp.public_listed = true
    and rp.account_status in ('active', 'warned')
    and (
      rp.role in ('editor', 'admin')
      or coalesce(sc.accepted_count, 0) > 0
      or coalesce(ac.attestations_count, 0) > 0
      or nullif(pg_catalog.btrim(coalesce(rp.display_name, '')), '') is not null
    )
  order by
    case rp.role when 'admin' then 1 when 'editor' then 2 else 3 end,
    coalesce(sc.accepted_count, 0) desc,
    coalesce(ac.attestations_count, 0) desc,
    rp.created_at asc
  limit 200;
$$;
grant execute on function public.get_public_contributors_directory() to anon, authenticated;
