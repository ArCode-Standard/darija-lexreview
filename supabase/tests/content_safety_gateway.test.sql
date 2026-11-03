begin;

select plan(23);

select ok(to_regclass('private.content_scan_tokens') is not null, 'private one-time token table exists');
select ok(to_regclass('private.feedback_candidates') is not null, 'private governed feedback table exists');
select ok(to_regprocedure('public.issue_content_scan_token(uuid,text,jsonb,text,text)') is not null, 'service-only token issuer exists');
select ok(to_regprocedure('public.submit_review_submission(jsonb,text)') is not null, 'review submission SECURITY INVOKER RPC exists');
select is(
  (select prosecdef from pg_proc where oid = 'public.submit_review_submission(jsonb,text)'::regprocedure),
  false,
  'write RPC is SECURITY INVOKER'
);
select is(
  has_function_privilege('anon', 'public.issue_content_scan_token(uuid,text,jsonb,text,text)', 'EXECUTE'),
  false,
  'anon cannot issue scan tokens'
);
select is(
  has_function_privilege('service_role', 'public.issue_content_scan_token(uuid,text,jsonb,text,text)', 'EXECUTE'),
  true,
  'service_role can issue scan tokens'
);
select is(
  has_function_privilege('authenticated', 'public.submit_review_submission(jsonb,text)', 'EXECUTE'),
  true,
  'authenticated can call the narrow write RPC'
);

select ok(exists(select 1 from pg_trigger where tgrelid='public.review_submissions'::regclass and tgname='content_safety_guard' and not tgisinternal), 'review submissions have content guard');
select ok(exists(select 1 from pg_trigger where tgrelid='public.community_attestations'::regclass and tgname='content_safety_guard' and not tgisinternal), 'community attestations have content guard');
select ok(exists(select 1 from pg_trigger where tgrelid='public.reviewer_profiles'::regclass and tgname='content_safety_guard' and not tgisinternal), 'reviewer profiles have content guard');
select ok(exists(select 1 from pg_trigger where tgrelid='public.member_messages'::regclass and tgname='content_safety_guard' and not tgisinternal), 'member messages have content guard');
select ok(exists(select 1 from pg_trigger where tgrelid='public.member_moderation_reports'::regclass and tgname='content_safety_guard' and not tgisinternal), 'moderation reports have content guard');
select ok(exists(select 1 from pg_trigger where tgrelid='public.role_promotion_requests'::regclass and tgname='content_safety_guard' and not tgisinternal), 'promotion requests have content guard');

select is((select enforcement_mode from private.content_safety_settings where singleton), 'shadow', 'gateway starts in shadow mode');

insert into auth.users(id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000038', 'authenticated', 'authenticated', 'gateway-test-38@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000000039', 'authenticated', 'authenticated', 'gateway-test-39@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000038', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
update private.content_safety_settings set enforcement_mode='enforce' where singleton;

select throws_ok(
  $$insert into public.review_submissions(entry_id, proposed_data, evidence, reviewer_id)
    values ('gateway-direct-bypass', '{"meaning":"unscanned"}'::jsonb, '[]'::jsonb, '00000000-0000-4000-8000-000000000038')$$,
  '42501',
  null,
  'direct table INSERT without a scan token is rejected'
);

select set_config('request.jwt.claim.role', 'service_role', true);
select set_config(
  'app.test_scan_token',
  public.issue_content_scan_token(
    '00000000-0000-4000-8000-000000000038',
    'review_submissions.create',
    '{"entry_id":"gateway-valid-write","proposed_data":{"meaning":"approved scan token test"},"evidence":[]}'::jsonb,
    '0.2.0',
    'test-policy-1'
  ),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.submit_review_submission(
  '{"entry_id":"gateway-valid-write","proposed_data":{"meaning":"approved scan token test"},"evidence":[]}'::jsonb,
  current_setting('app.test_scan_token')
);
select is(
  (select count(*)::integer from public.review_submissions
   where entry_id='gateway-valid-write' and reviewer_id='00000000-0000-4000-8000-000000000038'),
  1,
  'matching actor and payload are accepted through the SECURITY INVOKER RPC'
);

select throws_ok(
  $$select public.submit_review_submission(
    '{"entry_id":"gateway-valid-write","proposed_data":{"meaning":"approved scan token test"},"evidence":[]}'::jsonb,
    current_setting('app.test_scan_token')
  )$$,
  '42501',
  null,
  'a scan token cannot be replayed'
);

reset role;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config(
  'app.test_scan_token',
  public.issue_content_scan_token(
    '00000000-0000-4000-8000-000000000038',
    'review_submissions.create',
    '{"entry_id":"gateway-original","proposed_data":{"meaning":"original"},"evidence":[]}'::jsonb,
    '0.2.0',
    'test-policy-1'
  ),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select throws_ok(
  $$select public.submit_review_submission(
    '{"entry_id":"gateway-mutated","proposed_data":{"meaning":"tampered"},"evidence":[]}'::jsonb,
    current_setting('app.test_scan_token')
  )$$,
  '42501',
  null,
  'payload mutation invalidates the token'
);

reset role;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config(
  'app.test_scan_token',
  public.issue_content_scan_token(
    '00000000-0000-4000-8000-000000000038',
    'review_submissions.create',
    '{"entry_id":"gateway-actor-mismatch","proposed_data":{"meaning":"actor"},"evidence":[]}'::jsonb,
    '0.2.0',
    'test-policy-1'
  ),
  true
);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000039', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select throws_ok(
  $$select public.submit_review_submission(
    '{"entry_id":"gateway-actor-mismatch","proposed_data":{"meaning":"actor"},"evidence":[]}'::jsonb,
    current_setting('app.test_scan_token')
  )$$,
  '42501',
  null,
  'a token issued for another actor is rejected'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000038', true);
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config(
  'app.test_scan_token',
  public.issue_content_scan_token(
    '00000000-0000-4000-8000-000000000038',
    'review_submissions.create',
    '{"entry_id":"gateway-expired","proposed_data":{"meaning":"expired"},"evidence":[]}'::jsonb,
    '0.2.0',
    'test-policy-1'
  ),
  true
);
update private.content_scan_tokens
set expires_at = now() - interval '1 second'
where token_hash = extensions.digest(convert_to(current_setting('app.test_scan_token'), 'UTF8'), 'sha256');
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select throws_ok(
  $$select public.submit_review_submission(
    '{"entry_id":"gateway-expired","proposed_data":{"meaning":"expired"},"evidence":[]}'::jsonb,
    current_setting('app.test_scan_token')
  )$$,
  '42501',
  null,
  'expired scan tokens are rejected'
);

select lives_ok(
  $$update public.member_messages set read_at=now()
    where recipient_id='00000000-0000-4000-8000-000000000038' and category='welcome'$$,
  'metadata-only message updates remain available without rescanning text'
);
reset role;
select ok(
  exists(select 1 from private.content_scan_events where decision='authorized' and table_name='review_submissions'),
  'successful writes produce metadata-only scan audit events'
);

select * from finish();
rollback;
