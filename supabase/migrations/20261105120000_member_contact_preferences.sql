-- Consent-based member contact details.
-- The login email in auth.users is intentionally never copied or exposed.

create table if not exists public.member_contact_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  contact_email text null
    check (
      contact_email is null
      or (
        char_length(contact_email) <= 254
        and contact_email = lower(btrim(contact_email))
        and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
      )
    ),
  share_with_admins boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint member_contact_consent_requires_email
    check (not share_with_admins or contact_email is not null)
);

create index if not exists member_contact_preferences_shared_idx
  on public.member_contact_preferences (user_id)
  where share_with_admins = true and contact_email is not null;

alter table public.member_contact_preferences enable row level security;

revoke all on table public.member_contact_preferences from anon, authenticated;
grant select, insert, update on table public.member_contact_preferences to authenticated;

drop policy if exists "members read own contact preferences" on public.member_contact_preferences;
create policy "members read own contact preferences"
on public.member_contact_preferences for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "admins read consented member contact preferences" on public.member_contact_preferences;
create policy "admins read consented member contact preferences"
on public.member_contact_preferences for select to authenticated
using (
  (select private.is_lexreview_admin())
  and share_with_admins = true
  and contact_email is not null
);

drop policy if exists "members create own contact preferences" on public.member_contact_preferences;
create policy "members create own contact preferences"
on public.member_contact_preferences for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "members update own contact preferences" on public.member_contact_preferences;
create policy "members update own contact preferences"
on public.member_contact_preferences for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
