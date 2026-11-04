begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('20000000-0000-4000-8000-000000000021','00000000-0000-0000-0000-000000000000','authenticated','authenticated','inbox-contrib@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{"name":"سلمى الموثقة","dialect_region":"فاس - مكناس","specialty":"اللسانيات الحاسوبية"}',now(),now()),
  ('20000000-0000-4000-8000-000000000022','00000000-0000-0000-0000-000000000000','authenticated','authenticated','inbox-editor@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{"name":"يوسف المحرر"}',now(),now());

update public.reviewer_profiles
set role = 'editor'
where id = '20000000-0000-4000-8000-000000000022';

-- Contributor submits two lexical proposals
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000021',true);
select set_config('request.jwt.claim.role','authenticated',true);

insert into public.review_submissions (
  id, entry_id, proposed_data, evidence, reviewer_note
) values
  (
    '30000000-0000-4000-8000-000000000001',
    'NEW:dghya',
    '{"submission_kind":"new_entry","word_ar":"دغيا","arabizi":"dghya","category":"ظرف","msa_translation":"بسرعة","french_translation":"vite","example_darija":"جا دغيا من الخدمة."}'::jsonb,
    '[]'::jsonb,
    'شائعة في الحديث اليومي'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '108',
    '{"submission_kind":"edit_entry","word_ar":"بزاف","msa_translation":"كثيراً جداً"}'::jsonb,
    '[]'::jsonb,
    'تحسين الدقة'
  );

insert into public.community_attestations (
  entry_id, example_id, reviewer_id, verdict, dialect_region, response_ms
) values
  ('108', '', '20000000-0000-4000-8000-000000000021', 'accurate', 'فاس - مكناس', 1600),
  ('108', 'ctx-108-1', '20000000-0000-4000-8000-000000000021', 'accurate', 'فاس - مكناس', 1800);

reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','',true);

-- Editor accepts submission 1 and requests changes on submission 2
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000022',true);
select set_config('request.jwt.claim.role','authenticated',true);

update public.review_submissions
set status = 'accepted',
    editor_note = 'توثيق ممتاز وشاهد سياقي سليم.'
where id = '30000000-0000-4000-8000-000000000001';

update public.review_submissions
set status = 'needs_changes',
    editor_note = 'يرجى إضافة شاهد سياقي يوضح الاستعمال الجهوي.'
where id = '30000000-0000-4000-8000-000000000002';

reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','',true);

select ok(
  exists (
    select 1 from public.member_messages
    where recipient_id = '20000000-0000-4000-8000-000000000021'
      and related_submission_id = '30000000-0000-4000-8000-000000000001'
      and decision_status = 'accepted'
      and category = 'appreciation'
      and body like '%توثيق ممتاز%'
  ),
  'accepting a submission automatically sends an appreciation message linked to the submission'
);

select ok(
  exists (
    select 1 from public.member_messages
    where recipient_id = '20000000-0000-4000-8000-000000000021'
      and related_submission_id = '30000000-0000-4000-8000-000000000002'
      and decision_status = 'needs_changes'
      and category = 'editorial_note'
      and body like '%شاهد سياقي%'
  ),
  'requesting changes automatically sends an editorial_note message with editor feedback and submission link'
);

-- Rejecting also notifies with reason
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000022',true);
select set_config('request.jwt.claim.role','authenticated',true);

update public.review_submissions
set status = 'rejected',
    editor_note = 'المقترح مكرر حرفياً في المتن المعتمد.'
where id = '30000000-0000-4000-8000-000000000002';

reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','',true);

select ok(
  exists (
    select 1 from public.member_messages
    where recipient_id = '20000000-0000-4000-8000-000000000021'
      and related_submission_id = '30000000-0000-4000-8000-000000000002'
      and decision_status = 'rejected'
  ),
  'rejecting a submission sends an editorial notification linked to the submission'
);

-- Verify recipient cannot tamper with related_submission_id when marking message read
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000021',true);
select set_config('request.jwt.claim.role','authenticated',true);

update public.member_messages
set read_at = now()
where recipient_id = '20000000-0000-4000-8000-000000000021'
  and decision_status = 'accepted';

select ok(
  exists (
    select 1 from public.member_messages
    where recipient_id = '20000000-0000-4000-8000-000000000021'
      and decision_status = 'accepted'
      and read_at is not null
      and related_submission_id = '30000000-0000-4000-8000-000000000001'
  ),
  'recipient can mark decision notification read while related_submission_id remains intact'
);

reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','',true);

-- Verify enriched public contributors directory breakdown
select is(
  (select accepted_count from public.get_public_contributors_directory() where display_name = 'سلمى الموثقة'),
  1,
  'public contributors directory reports accepted_count accurately'
);

select is(
  (select documented_words_count from public.get_public_contributors_directory() where display_name = 'سلمى الموثقة'),
  2,
  'public contributors directory reports documented_words_count (1 accepted word + 1 attested word)'
);

select is(
  (select documented_examples_count from public.get_public_contributors_directory() where display_name = 'سلمى الموثقة'),
  2,
  'public contributors directory reports documented_examples_count (1 accepted example + 1 attested example)'
);

select ok(
  (select 'دغيا' = any(recent_words) from public.get_public_contributors_directory() where display_name = 'سلمى الموثقة'),
  'public contributors directory includes recent accepted headwords'
);

select * from finish();
rollback;
