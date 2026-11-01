begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

-- All fixtures are synthetic and live only in this disposable CI database.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('10000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','contributor@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{"name":"CI Contributor"}',now(),now()),
  ('10000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','editor@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{"name":"CI Editor"}',now(),now()),
  ('10000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{"name":"CI Admin"}',now(),now());

-- Bootstrap the first CI admin using the same one-time privileged provisioning
-- boundary documented for production. The auth trigger initially creates a reviewer
-- profile; replace only this synthetic fixture row with its pre-provisioned admin role.
delete from public.reviewer_profiles
where id = '10000000-0000-4000-8000-000000000003';
insert into public.reviewer_profiles (id, display_name, role)
values ('10000000-0000-4000-8000-000000000003', 'CI Admin', 'admin');

-- Promote the editor fixture through the real reviewer -> admin approval workflow.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
insert into public.role_promotion_requests (
  id, requester_id, requester_name, experience_summary
) values (
  '20000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002',
  'CI Editor',
  'Synthetic integration-test fixture requesting editorial permissions.'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claim.role','authenticated',true);
select public.review_role_promotion_request(
  '20000000-0000-4000-8000-000000000002',
  'approved',
  null
);
reset role;

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
-- The database trigger rejects the attempt with SQLSTATE 42501 and preserves the row.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
insert into public.review_submissions(entry_id, proposed_data, evidence, reviewer_note)
values ('ci-entry-self','{"lemma":"دار"}','[]','self-review fixture');
select throws_ok(
  $$ update public.review_submissions set status='accepted' where entry_id='ci-entry-self' $$,
  '42501',
  'Self-review is not permitted',
  'self-review attempt is explicitly rejected'
);
select is(
  (select status from public.review_submissions where entry_id='ci-entry-self'),
  'pending',
  'self-review rejection leaves submission pending'
);
reset role;


-- Official release manifests are an append-only audit ledger.
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.release_manifests'::regclass
      and tgname = 'release_manifests_append_only'
      and not tgisinternal
  ),
  'release manifest table has an append-only mutation trigger'
);
select ok(
  not has_table_privilege('authenticated','public.release_manifests','UPDATE'),
  'authenticated cannot update release manifests directly'
);
select ok(
  not has_table_privilege('authenticated','public.release_manifests','DELETE'),
  'authenticated cannot delete release manifests directly'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claim.role','authenticated',true);
select public.record_release_manifest(
  'ci-2026.11.1',
  repeat('a',64),
  repeat('b',64),
  1, 0, 0, 0, 0,
  '{}'::uuid[]
);
select throws_ok(
  $ select public.record_release_manifest(
    'ci-2026.11.1',
    repeat('c',64),
    repeat('d',64),
    2, 0, 0, 0, 0,
    '{}'::uuid[]
  ) $,
  '23505',
  'Release version ci-2026.11.1 already exists; release manifests are immutable. Publish a new version instead.',
  're-registering an existing release version is rejected'
);
reset role;

select throws_ok(
  $ update public.release_manifests set notes = 'tampered' where version = 'ci-2026.11.1' $,
  '55000',
  'Official release manifests are immutable; create a new version instead.',
  'release manifest updates are rejected by the database trigger'
);
select throws_ok(
  $ delete from public.release_manifests where version = 'ci-2026.11.1' $,
  '55000',
  'Official release manifests are immutable; create a new version instead.',
  'release manifest deletion is rejected by the database trigger'
);
select is(
  (select count(*)::integer from public.release_manifests where version = 'ci-2026.11.1'),
  1,
  'the original release manifest remains unchanged after rejected mutations'
);

select * from finish();
rollback;
