begin;

create extension if not exists pgtap with schema extensions;
select plan(35);

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

-- SECURITY DEFINER RPCs must have a pinned empty search_path and no anon EXECUTE.
select ok(
  (select prosecdef and 'search_path=""' = any(proconfig)
   from pg_proc where oid = 'public.list_staff_display_names()'::regprocedure),
  'staff directory definer pins an empty search_path'
);
select ok(
  (select prosecdef and 'search_path=""' = any(proconfig)
   from pg_proc where oid = 'public.review_role_promotion_request(uuid,text,text)'::regprocedure),
  'promotion review definer pins an empty search_path'
);
select ok(
  not has_function_privilege('anon','public.list_staff_display_names()','EXECUTE'),
  'anonymous users cannot execute staff directory RPC'
);
select ok(
  not has_function_privilege('anon','public.review_role_promotion_request(uuid,text,text)','EXECUTE'),
  'anonymous users cannot execute promotion review RPC'
);

-- A regular contributor may create a promotion request but cannot adjudicate it.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
insert into public.role_promotion_requests (
  id, requester_id, requester_name, experience_summary
) values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'CI Contributor',
  'Synthetic contributor request used to verify administrative authorization.'
);
select throws_ok(
  $$ select public.review_role_promotion_request(
    '20000000-0000-4000-8000-000000000001', 'approved', null
  ) $$,
  '42501',
  'Only authenticated admins can review role promotion requests',
  'ordinary contributor cannot adjudicate a promotion request'
);
reset role;

-- An already approved request cannot be replayed or changed by a second call.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claim.role','authenticated',true);
select throws_ok(
  $$ select public.review_role_promotion_request(
    '20000000-0000-4000-8000-000000000002', 'rejected', 'replay attempt'
  ) $$,
  '55000',
  'Only pending promotion requests can be reviewed',
  'an already adjudicated promotion request cannot be replayed'
);
reset role;

-- Non-editor authenticated users receive no staff directory rows.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select is(
  (select count(*)::integer from public.list_staff_display_names()),
  0,
  'non-editor receives no staff directory records'
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

-- Submission inserts are guarded by the server-side rate/bounds trigger.
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.review_submissions'::regclass
      and tgname = 'review_submissions_rate_and_bounds_trg'
      and not tgisinternal
  ),
  'review_submissions has a BEFORE INSERT rate/bounds trigger'
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

-- Client-supplied reviewer IDs cannot spoof another contributor.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select throws_ok(
  $ insert into public.review_submissions(entry_id, proposed_data, evidence, reviewer_id)
     values ('ci-entry-spoof','{"lemma":"مزور"}','[]','10000000-0000-4000-8000-000000000002') $,
  '42501',
  'Authenticated contributor required',
  'submission reviewer_id cannot be spoofed'
);
reset role;

-- Twenty inserts are accepted in the rolling hour; the twenty-first is rejected.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
insert into public.review_submissions(entry_id, proposed_data, evidence)
select 'ci-rate-' || g, '{"lemma":"اختبار"}'::jsonb, '[]'::jsonb
from generate_series(1,20) as g;
select throws_ok(
  $ insert into public.review_submissions(entry_id, proposed_data, evidence)
     values ('ci-rate-21','{"lemma":"اختبار"}','[]') $,
  '42501',
  'Rate limit exceeded: maximum 20 submissions per hour',
  'twenty-first submission in one hour is rejected'
);
reset role;

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



-- Export RPC is authenticated-editor only and archives accepted submissions atomically.
select ok(
  not has_function_privilege('anon','public.mark_submissions_exported(uuid[],text)','EXECUTE'),
  'anonymous users cannot execute the export RPC'
);

-- Contributors may not archive submissions, even when the function is directly invoked.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select throws_ok(
  $test$ select public.mark_submissions_exported('{}'::uuid[], 'ci-export-1') $test$,
  '42501',
  'Editor role required to archive exported submissions',
  'contributor cannot invoke the export RPC'
);
reset role;

-- Create a fresh contributor submission, accept it as editor, then export it.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
insert into public.review_submissions(entry_id, proposed_data, evidence, reviewer_note)
values ('ci-entry-export','{"lemma":"كتاب"}','[]','export lifecycle fixture');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
update public.review_submissions
set status = 'accepted'
where entry_id = 'ci-entry-export';

select is(
  public.mark_submissions_exported(
    array(select id from public.review_submissions where entry_id = 'ci-entry-export'),
    'ci-export-1'
  ),
  1,
  'editor export RPC reports one archived submission'
);
reset role;

select is(
  (select status from public.review_submissions where entry_id = 'ci-entry-export'),
  'merged',
  'exported accepted submission transitions to merged'
);
select is(
  (select count(*)::integer
   from public.review_decision_events e
   join public.review_submissions s on s.id = e.submission_id
   where s.entry_id = 'ci-entry-export'
     and e.event_type = 'decision'
     and e.previous_status = 'accepted'
     and e.new_status = 'merged'),
  1,
  'export transition appends exactly one accepted-to-merged audit event'
);

-- A merged submission is terminal and cannot be reopened through the editor update path.
-- Keep the editor JWT identity, but execute as the migration-test owner so
-- RLS visibility cannot turn the UPDATE into a silent zero-row no-op. The
-- lifecycle trigger still evaluates auth.uid() and the editor profile.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
reset role;
select throws_ok(
  $test$ update public.review_submissions
     set status = 'accepted'
     where entry_id = 'ci-entry-export' $test$,
  '23514',
  'Invalid review status transition: merged -> accepted',
  'merged submissions cannot be reopened'
);

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
  $$ select public.record_release_manifest(
    'ci-2026.11.1',
    repeat('c',64),
    repeat('d',64),
    2, 0, 0, 0, 0,
    '{}'::uuid[]
  ) $$,
  '23505',
  'Release version ci-2026.11.1 already exists; release manifests are immutable. Publish a new version instead.',
  're-registering an existing release version is rejected'
);
reset role;

select throws_ok(
  $$ update public.release_manifests set notes = 'tampered' where version = 'ci-2026.11.1' $$,
  '55000',
  'Official release manifests are immutable; create a new version instead.',
  'release manifest updates are rejected by the database trigger'
);
select throws_ok(
  $$ delete from public.release_manifests where version = 'ci-2026.11.1' $$,
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
