begin;

select plan(50);

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

select ok(
  private.content_projection_has_text(
    private.content_scan_projection('community_attestations', '{"dialect_region":"الريف"}'::jsonb)
  ),
  'community dialect region is treated as scanned text'
);
select ok(
  private.content_projection_has_text(
    private.content_scan_projection('role_promotion_requests', '{"dialect_region":"الشمال"}'::jsonb)
  ),
  'promotion request dialect region is treated as scanned text'
);

insert into auth.users(id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000038', 'authenticated', 'authenticated', 'gateway-test-38@example.invalid', '{}'::jsonb, '{"name":"Shadow Signup"}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000000039', 'authenticated', 'authenticated', 'gateway-test-39@example.invalid', '{}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

select ok(to_regprocedure('public.record_content_scan_event(uuid,text,text,text,text,text,jsonb)') is not null, 'privacy-preserving scan audit RPC exists');
select is(has_function_privilege('anon', 'public.record_content_scan_event(uuid,text,text,text,text,text,jsonb)', 'EXECUTE'), false, 'anon cannot forge scan audit events');
select is(has_function_privilege('service_role', 'public.record_content_scan_event(uuid,text,text,text,text,text,jsonb)', 'EXECUTE'), true, 'service_role can persist scan audit metadata');
select set_config('request.jwt.claim.role', 'service_role', true);
select public.record_content_scan_event(
  '00000000-0000-4000-8000-000000000038',
  'review_submissions.create',
  'allow',
  repeat('a',64),
  '0.2.0',
  'test-policy-1',
  '[]'::jsonb
);
select ok(exists(select 1 from private.content_scan_events where decision='allow' and content_digest=repeat('a',64)), 'scan decisions are persisted without raw text');

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
select throws_ok(
  $$select private.consume_content_scan_token(
    current_setting('app.test_scan_token'),
    'community_attestations.upsert',
    '{"entry_id":"gateway-original","proposed_data":{"meaning":"original"},"evidence":[]}'::jsonb
  )$$,
  '42501',
  null,
  'a token cannot be reused for a different operation'
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
set created_at = now() - interval '2 minutes',
    expires_at = now() - interval '1 second'
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



select ok(to_regprocedure('public.submit_learning_feedback_candidate(uuid,text,text,text,text,text,text,text,boolean,text,jsonb,text,text)') is not null, 'service-only feedback intake RPC exists');
select is(
  has_function_privilege('anon', 'public.review_learning_feedback_candidate(uuid,text,text)', 'EXECUTE'),
  false,
  'anon cannot review learning feedback'
);
select is(
  has_function_privilege('authenticated', 'public.review_learning_feedback_candidate(uuid,text,text)', 'EXECUTE'),
  true,
  'authenticated users can call the guarded review RPC'
);

reset role;
insert into auth.users(id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-000000000040', 'authenticated', 'authenticated', 'gateway-test-40@example.invalid', '{}'::jsonb, '{"name":"Enforce Signup Should Not Copy"}'::jsonb, now(), now())
on conflict (id) do nothing;
select is((select display_name from public.reviewer_profiles where id='00000000-0000-4000-8000-000000000040'), null, 'enforce-mode signup does not copy unscanned user metadata');
update public.reviewer_profiles set role='editor'
where id in (
  '00000000-0000-4000-8000-000000000038',
  '00000000-0000-4000-8000-000000000039',
  '00000000-0000-4000-8000-000000000040'
);

select set_config('request.jwt.claim.role', 'service_role', true);
select throws_ok(
  $$select public.submit_learning_feedback_candidate(
    '00000000-0000-4000-8000-000000000038','linguistic','lexicon_suggestion','private_message',
    'private-message-group','private text','example','rationale',true,'CC-BY-4.0','{}'::jsonb,'pii-regex-1',null
  )$$,
  '22023', null,
  'private messages cannot enter the learning dataset'
);
select throws_ok(
  $$select public.submit_learning_feedback_candidate(
    '00000000-0000-4000-8000-000000000038','linguistic','lexicon_suggestion','lexicon',
    'no-consent-group','sample text','example','rationale',false,'CC-BY-4.0','{}'::jsonb,'pii-regex-1',null
  )$$,
  '22023', null,
  'feedback without explicit dataset consent is rejected'
);

select set_config(
  'app.test_candidate_id',
  public.submit_learning_feedback_candidate(
    '00000000-0000-4000-8000-000000000038','content_safety','editor_correction','lexicon',
    'content-safety-group-1','sample unsafe content for review','unsafe','editorial benchmark rationale',
    true,'CC-BY-4.0','{}'::jsonb,'pii-regex-1',null
  )::text,
  true
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000038', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select throws_ok(
  $$select public.review_learning_feedback_candidate(current_setting('app.test_candidate_id')::uuid,'approve','Self review attempt')$,
  '42501', null,
  'contributors cannot review their own training examples'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000039', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select is(
  public.review_learning_feedback_candidate(current_setting('app.test_candidate_id')::uuid,'approve','Independent first review'),
  'pending',
  'content-safety examples remain pending after one approval'
);

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000040', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select is(
  public.review_learning_feedback_candidate(current_setting('app.test_candidate_id')::uuid,'approve','Independent second review'),
  'approved',
  'content-safety examples require and accept two independent approvals'
);

reset role;
select is(
  (select count(*)::integer from private.feedback_reviews where candidate_id=current_setting('app.test_candidate_id')::uuid),
  2,
  'two distinct editorial review records are persisted'
);

select ok(to_regclass('private.learning_release_policies') is not null, 'versioned domain-specific release policies exist');
select ok(to_regprocedure('public.create_frozen_learning_dataset(text,text,uuid[],jsonb,uuid)') is not null, 'frozen dataset RPC exists');
select ok(to_regprocedure('public.record_learning_evaluation(uuid,text,text,text,text,jsonb)') is not null, 'evaluation RPC exists');
select ok(to_regprocedure('public.register_model_candidate(text,text,text,uuid,uuid,text,uuid)') is not null, 'model candidate registration RPC exists');
select ok(to_regprocedure('public.review_model_release(uuid,text,text)') is not null, 'independent model release review RPC exists');
select ok(to_regprocedure('public.activate_model_release(uuid)') is not null, 'model activation RPC exists');
select ok(to_regprocedure('public.rollback_model_release(text,uuid,text,uuid)') is not null, 'model rollback RPC exists');
select is(has_function_privilege('anon', 'public.create_frozen_learning_dataset(text,text,uuid[],jsonb,uuid)', 'EXECUTE'), false, 'anon cannot freeze datasets');
select is(has_function_privilege('service_role', 'public.create_frozen_learning_dataset(text,text,uuid[],jsonb,uuid)', 'EXECUTE'), true, 'only trusted service role can freeze datasets');
select is(has_function_privilege('authenticated', 'public.review_model_release(uuid,text,text)', 'EXECUTE'), true, 'authenticated reviewers can submit guarded model release reviews');

select * from finish();
rollback;
