-- Editors may moderate submissions but must not inspect other contributors' private profiles.
-- Only the profile owner and admins can read a reviewer profile.
drop policy if exists "reviewers read own profile" on public.reviewer_profiles;
drop policy if exists "admins read contributor profiles" on public.reviewer_profiles;

create policy "reviewers read own profile"
on public.reviewer_profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (select private.is_lexreview_admin())
);
