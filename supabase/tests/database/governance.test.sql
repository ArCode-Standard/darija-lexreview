begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

-- All fixtures are synthetic and live only in this disposable CI database.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('10000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','contributor@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{"name":"CI Contributor"}',now(),now()),
  ('10000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','editor@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{"name":"CI Editor"}',now(),now()),
  ('10000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{"name":"CI Admin"}',now(),now());

update public.reviewer_profiles set role = 'editor'
where id = '10000000-0000-4000-8000-000000000002';
update public.reviewer_profiles set role = 'admin'
where id = '10000000-0000-4000-8000-000000000003';

select ok(
  (select relrowsecurity from pg_class where oid = 'public.review_submissions'::regclass),
  'RLS is enabled on review_submissions'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.reviewer_profiles'::regclass),
  'RLS is enabled on reviewer_profiles'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.review_decision_events'::regclass),
  'RLS is enabled on review_decision_events'
);
select ok(
  not has_table_privilege('authenticated','public.review_decision_events','INSERT'),
  'authenticated cannot insert audit events directly'
);
select ok(
  not has_table_privilege('authenticated','public.review_decision_events','UPDATE'),
  'authenticated cannot update audit events directly'
);

-- Contributor creates a submission; Auth trigger provisions the reviewer profile.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
insert into public.review_submissions(entry_id, proposed_data, evidence, reviewer_note)
values ('ci-entry-1','{"lemma":"سلام"}','[{"source":"synthetic-ci"}]','synthetic fixture');
reset role;

select is(
  (select count(*)::integer from public.review_submissions
   where reviewer_id = '10000000-0000-4000-8000-000000000001'),
  1,
  'contributor submission is persisted'
);

-- A different authenticated user cannot read another contributor's private profile.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
select is(
  (select count(*)::integer from public.reviewer_profiles
   where id = '10000000-0000-4000-8000-000000000001'),
  0,
  'editor cannot read contributor private profile row'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claim.role','authenticated',true);
select is(
  (select count(*)::integer from public.reviewer_profiles
   where id = '10000000-0000-4000-8000-000000000001'),
  1,
  'admin can read contributor profile for governance'
);
reset role;

-- Editor can make a decision on another user's submission; audit event is created.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
update public.review_submissions
set status = 'accepted'
where entry_id = 'ci-entry-1';
reset role;

select is(
  (select count(*)::integer from public.review_decision_events
   where submission_id = (select id from public.review_submissions where entry_id='ci-entry-1')
     and event_type = 'decision' and new_status = 'accepted'),
  1,
  'editor decision appends exactly one audit event'
);

-- The author cannot review their own submission, even if that author has editor role.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
insert into public.review_submissions(entry_id, proposed_data, evidence, reviewer_note)
values ('ci-entry-self','{"lemma":"دار"}','[]','self-review fixture');
update public.review_submissions set status='accepted' where entry_id='ci-entry-self';
select is(
  (select status from public.review_submissions where entry_id='ci-entry-self'),
  'pending',
  'self-review update is blocked by RLS and leaves submission pending'
);
reset role;

select * from finish();
rollback;
