-- Remove the retired DiceBear avatar provider and normalize existing profiles.
update public.reviewer_profiles
set avatar_source = 'arcode'
where avatar_source = 'dicebear';

alter table public.reviewer_profiles
  alter column avatar_source set default 'arcode';

alter table public.reviewer_profiles
  drop constraint if exists reviewer_profiles_avatar_source_check;

alter table public.reviewer_profiles
  add constraint reviewer_profiles_avatar_source_check
  check (avatar_source in ('upload', 'github', 'arcode'));
