-- =============================================================================
-- Migration: Member Saved Bookmarks & Realtime Inbox Publication
-- Date: 2026-11-03
-- =============================================================================

create table if not exists public.member_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_id text not null check (char_length(pg_catalog.btrim(entry_id)) between 1 and 64),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (user_id, entry_id)
);

create index if not exists member_bookmarks_user_created_idx
  on public.member_bookmarks(user_id, created_at desc);

alter table public.member_bookmarks enable row level security;

revoke all on table public.member_bookmarks from public, anon, authenticated;
grant select, insert, update (note), delete on table public.member_bookmarks to authenticated;

drop policy if exists "members read own bookmarks" on public.member_bookmarks;
create policy "members read own bookmarks"
on public.member_bookmarks for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "members insert own bookmarks" on public.member_bookmarks;
create policy "members insert own bookmarks"
on public.member_bookmarks for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "members update own bookmarks" on public.member_bookmarks;
create policy "members update own bookmarks"
on public.member_bookmarks for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "members delete own bookmarks" on public.member_bookmarks;
create policy "members delete own bookmarks"
on public.member_bookmarks for delete to authenticated
using (user_id = (select auth.uid()));

-- Ensure member_messages is published to supabase_realtime for instant inbox badge updates
do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'member_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.member_messages';
  end if;
end;
$$;
