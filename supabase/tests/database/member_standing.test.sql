begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

-- Synthetic fixtures only; all writes are rolled back at the end.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('10000000-0000-4000-8000-000000000011','00000000-0000-0000-0000-000000000000','authenticated','authenticated','standing-reviewer@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{"name":"Standing Reviewer"}',now(),now()),
  ('10000000-0000-4000-8000-000000000012','00000000-0000-0000-0000-000000000000','authenticated','authenticated','standing-editor@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{"name":"Standing Editor"}',now(),now()),
  ('10000000-0000-4000-8000-000000000013','00000000-0000-0000-0000-000000000000','authenticated','authenticated','standing-admin@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{"name":"Standing Admin"}',now(),now());

update public.reviewer_profiles set role = 'editor'
where id = '10000000-0000-4000-8000-000000000012';
update public.reviewer_profiles set role = 'admin'
where id = '10000000-0000-4000-8000-000000000013';

select ok(
  exists (
    select 1 from cron.job
    where jobname = 'reactivate-expired-member-suspensions'
      and schedule = '* * * * *'
      and active
  ),
  'expired suspensions have an active minute-level database job'
);

-- A normal active contributor remains authorized.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000011',true);
select set_config('request.jwt.claim.role','authenticated',true);
select is((select private.is_active_contributor()), true, 'active member passes the database standing check');
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','',true);

-- Missing profiles fail closed rather than inheriting contributor access.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000099',true);
select set_config('request.jwt.claim.role','authenticated',true);
select is((select private.is_active_contributor()), false, 'a user without a reviewer profile is not an active contributor');
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','',true);

-- Permanent bans and non-expired suspensions are rejected by the database.
update public.reviewer_profiles
set account_status = 'banned', status_reason = 'Synthetic test ban'
where id = '10000000-0000-4000-8000-000000000011';

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000011',true);
select set_config('request.jwt.claim.role','authenticated',true);
select is((select private.is_active_contributor()), false, 'a banned member fails the database standing check');
select throws_ok(
  $$ insert into public.review_submissions(entry_id, proposed_data, evidence, reviewer_note)
     values ('ci-banned-entry', '{"lemma":"محظور"}', '[]', 'banned fixture') $$,
  '42501',
  'new row violates row-level security policy for table "review_submissions"',
  'a banned member cannot insert a submission through the Data API'
);
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','',true);

update public.reviewer_profiles
set account_status = 'suspended',
    suspended_until = now() + interval '1 hour',
    status_reason = 'Synthetic timed suspension'
where id = '10000000-0000-4000-8000-000000000011';

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000011',true);
select set_config('request.jwt.claim.role','authenticated',true);
select is((select private.is_active_contributor()), false, 'a suspension before its deadline blocks contribution');
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','',true);

-- Once the deadline passes, authorization is restored immediately, even before
-- the scheduled job materializes account_status='active'.
update public.reviewer_profiles
set suspended_until = now() - interval '1 second'
where id = '10000000-0000-4000-8000-000000000011';

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000011',true);
select set_config('request.jwt.claim.role','authenticated',true);
select is((select private.is_active_contributor()), true, 'an expired suspension immediately restores contribution access');
select lives_ok(
  $$ insert into public.review_submissions(entry_id, proposed_data, evidence, reviewer_note)
     values ('ci-expired-suspension-entry', '{"lemma":"مستعاد"}', '[]', 'expired suspension fixture') $$,
  'an expired suspension can submit without waiting for the scheduler'
);
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','',true);

-- Simulate the exact SQL executed by pg_cron and verify persistent restoration,
-- audit logging, and the existing member notification side effect.
update public.reviewer_profiles
set account_status = 'suspended',
    suspended_until = now() - interval '1 second',
    status_reason = 'Synthetic expired suspension'
where id = '10000000-0000-4000-8000-000000000011';

update public.reviewer_profiles
set account_status = 'active',
    suspended_until = null,
    status_reason = null
where account_status = 'suspended'
  and suspended_until is not null
  and suspended_until <= now();

select is(
  (select account_status from public.reviewer_profiles where id = '10000000-0000-4000-8000-000000000011'),
  'active',
  'the scheduled reactivation statement persists active account status'
);
select ok(
  exists (
    select 1 from public.member_moderation_events
    where target_user_id = '10000000-0000-4000-8000-000000000011'
      and action_type = 'restore'
      and new_status = 'active'
  ),
  'automatic reactivation writes a moderation audit event'
);
select ok(
  exists (
    select 1 from public.member_messages
    where recipient_id = '10000000-0000-4000-8000-000000000011'
      and category = 'editorial_note'
      and title = 'تمت إعادة تفعيل حسابك بالكامل'
  ),
  'automatic reactivation sends the existing account-restored notification'
);


-- Staff roles are restored by the same expiry rule, not left locked out.
update public.reviewer_profiles
set account_status = 'suspended', suspended_until = now() - interval '1 second'
where id = '10000000-0000-4000-8000-000000000012';
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000012',true);
select set_config('request.jwt.claim.role','authenticated',true);
select is((select private.is_lexreview_editor()), true, 'an expired suspension restores editor authorization');
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','',true);

update public.reviewer_profiles
set account_status = 'suspended', suspended_until = now() - interval '1 second'
where id = '10000000-0000-4000-8000-000000000013';
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000013',true);
select set_config('request.jwt.claim.role','authenticated',true);
select is((select private.is_lexreview_admin()), true, 'an expired suspension restores admin authorization');
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','',true);

select * from finish();
rollback;
