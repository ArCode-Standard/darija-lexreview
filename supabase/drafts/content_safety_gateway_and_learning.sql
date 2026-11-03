-- DRAFT ONLY: server-enforced content safety and governed learning persistence.
-- This file is intentionally outside supabase/migrations until generated with
-- `supabase migration new`, reviewed, and validated against an isolated database.
-- Do not apply this draft to production.

create schema if not exists private;

create table if not exists private.content_safety_settings (
  singleton boolean primary key default true check (singleton),
  enforcement_mode text not null default 'shadow'
    check (enforcement_mode in ('shadow', 'enforce')),
  active_policy_version text,
  updated_at timestamptz not null default now()
);

insert into private.content_safety_settings(singleton, enforcement_mode)
values (true, 'shadow')
on conflict (singleton) do nothing;

create table if not exists private.content_scan_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash bytea not null unique,
  actor_id uuid not null references auth.users(id) on delete cascade,
  operation text not null,
  payload_hash bytea not null,
  engine_version text not null,
  policy_version text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint content_scan_token_expiry_check check (expires_at > created_at),
  constraint content_scan_token_operation_check check (operation in (
    'review_submissions.create', 'review_submissions.decision',
    'community_attestations.upsert', 'reviewer_profiles.update',
    'reviewer_profiles.admin_update', 'member_messages.create',
    'member_moderation_reports.create', 'member_moderation_reports.resolve',
    'role_promotion_requests.create', 'role_promotion_requests.decision'
  ))
);
create index if not exists content_scan_tokens_expiry_idx
  on private.content_scan_tokens(expires_at) where consumed_at is null;

create table if not exists private.content_scan_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  table_name text not null,
  operation text not null,
  decision text not null,
  content_digest text,
  engine_version text,
  policy_version text,
  token_id uuid,
  occurred_at timestamptz not null default now()
);
create index if not exists content_scan_events_occurred_idx
  on private.content_scan_events(occurred_at desc);

revoke all on private.content_safety_settings, private.content_scan_tokens, private.content_scan_events
  from public, anon, authenticated;
grant select, insert, update, delete on private.content_safety_settings,
  private.content_scan_tokens, private.content_scan_events to service_role;

create or replace function public.issue_content_scan_token(
  p_actor_id uuid,
  p_operation text,
  p_payload jsonb,
  p_engine_version text,
  p_policy_version text
) returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text := coalesce(
    nullif(pg_catalog.current_setting('request.jwt.claim.role', true), ''),
    nullif(pg_catalog.current_setting('role', true), '')
  );
  v_token text := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
begin
  if v_role <> 'service_role' then
    raise exception 'Service role required to issue scan tokens' using errcode = '42501';
  end if;
  if p_actor_id is null or p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_engine_version is null or p_engine_version = ''
     or p_policy_version is null or p_policy_version = '' then
    raise exception 'Invalid scan token request' using errcode = '22023';
  end if;
  if p_operation not in (
    'review_submissions.create', 'review_submissions.decision',
    'community_attestations.upsert', 'reviewer_profiles.update',
    'reviewer_profiles.admin_update', 'member_messages.create',
    'member_moderation_reports.create', 'member_moderation_reports.resolve',
    'role_promotion_requests.create', 'role_promotion_requests.decision'
  ) then
    raise exception 'Unsupported content operation' using errcode = '22023';
  end if;

  insert into private.content_scan_tokens(
    token_hash, actor_id, operation, payload_hash, engine_version, policy_version, expires_at
  ) values (
    extensions.digest(pg_catalog.convert_to(v_token, 'UTF8'), 'sha256'),
    p_actor_id,
    p_operation,
    extensions.digest(pg_catalog.convert_to(p_payload::text, 'UTF8'), 'sha256'),
    p_engine_version,
    p_policy_version,
    pg_catalog.clock_timestamp() + interval '90 seconds'
  );
  return v_token;
end;
$function$;

revoke all on function public.issue_content_scan_token(uuid, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.issue_content_scan_token(uuid, text, jsonb, text, text) to service_role;

create or replace function private.consume_content_scan_token(
  p_token text,
  p_operation text,
  p_payload jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_id uuid;
begin
  if v_actor is null then
    raise exception 'Authenticated user required' using errcode = '42501';
  end if;
  if p_token is null or p_token = '' or p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid scan authorization' using errcode = '22023';
  end if;

  update private.content_scan_tokens t
     set consumed_at = pg_catalog.clock_timestamp()
   where t.token_hash = extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256')
     and t.actor_id = v_actor
     and t.operation = p_operation
     and t.payload_hash = extensions.digest(pg_catalog.convert_to(p_payload::text, 'UTF8'), 'sha256')
     and t.consumed_at is null
     and t.expires_at > pg_catalog.clock_timestamp()
  returning t.id into v_id;

  if v_id is null then
    raise exception 'Scan token is invalid, expired, mismatched, or already used'
      using errcode = '42501';
  end if;

  perform pg_catalog.set_config('app.content_scan_token_id', v_id::text, true);
  perform pg_catalog.set_config('app.content_scan_operation', p_operation, true);
  perform pg_catalog.set_config('app.content_scan_actor_id', v_actor::text, true);
  return v_id;
end;
$function$;

revoke all on function private.consume_content_scan_token(text, text, jsonb) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.consume_content_scan_token(text, text, jsonb) to authenticated;

create or replace function private.content_scan_projection(p_table text, p_row jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $function$
  select case p_table
    when 'review_submissions' then pg_catalog.jsonb_build_object(
      'proposed_data', p_row->'proposed_data', 'evidence', p_row->'evidence',
      'reviewer_note', p_row->'reviewer_note', 'editor_note', p_row->'editor_note'
    )
    when 'community_attestations' then pg_catalog.jsonb_build_object('note', p_row->'note')
    when 'reviewer_profiles' then pg_catalog.jsonb_build_object(
      'display_name', p_row->'display_name', 'specialty', p_row->'specialty',
      'dialect_region', p_row->'dialect_region', 'github_handle', p_row->'github_handle',
      'status_reason', p_row->'status_reason'
    )
    when 'member_messages' then pg_catalog.jsonb_build_object(
      'sender_label', p_row->'sender_label', 'title', p_row->'title', 'body', p_row->'body'
    )
    when 'member_moderation_reports' then pg_catalog.jsonb_build_object(
      'target_display_name', p_row->'target_display_name', 'reason', p_row->'reason',
      'admin_note', p_row->'admin_note'
    )
    when 'role_promotion_requests' then pg_catalog.jsonb_build_object(
      'requester_name', p_row->'requester_name', 'experience_summary', p_row->'experience_summary',
      'sample_links', p_row->'sample_links', 'admin_note', p_row->'admin_note'
    )
    else '{}'::jsonb
  end;
$function$;

create or replace function private.content_projection_has_text(p_projection jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select exists (
    select 1 from pg_catalog.jsonb_each(p_projection) e
    where e.value <> 'null'::jsonb
      and pg_catalog.btrim(coalesce(e.value #>> '{}', '')) <> ''
  ) or exists (
    select 1 from pg_catalog.jsonb_each(p_projection) e
    where pg_catalog.jsonb_typeof(e.value) in ('object', 'array')
      and e.value not in ('{}'::jsonb, '[]'::jsonb)
  );
$function$;

create or replace function private.enforce_content_scan_token()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_mode text;
  v_old jsonb;
  v_new jsonb;
  v_token_id uuid;
  v_actor uuid := (select auth.uid());
  v_token private.content_scan_tokens;
  v_operation text := nullif(pg_catalog.current_setting('app.content_scan_operation', true), '');
begin
  v_new := private.content_scan_projection(TG_TABLE_NAME, pg_catalog.to_jsonb(NEW));
  if TG_OP = 'UPDATE' then
    v_old := private.content_scan_projection(TG_TABLE_NAME, pg_catalog.to_jsonb(OLD));
    if v_old is not distinct from v_new then
      return NEW;
    end if;
  end if;

  -- The auth signup trigger creates a fixed system welcome message with no sender.
  if TG_TABLE_NAME = 'member_messages' and TG_OP = 'INSERT' and NEW.sender_id is null then
    return NEW;
  end if;

  if not private.content_projection_has_text(v_new) then
    return NEW;
  end if;

  select s.enforcement_mode into v_mode
  from private.content_safety_settings s where s.singleton = true;
  v_mode := coalesce(v_mode, 'shadow');

  v_token_id := nullif(pg_catalog.current_setting('app.content_scan_token_id', true), '')::uuid;
  if v_token_id is null then
    insert into private.content_scan_events(actor_id, table_name, operation, decision)
    values (v_actor, TG_TABLE_NAME, TG_OP, 'shadow_unscanned_write');
    if v_mode = 'enforce' then
      raise exception 'Content safety scan authorization required for %.%', TG_TABLE_NAME, TG_OP
        using errcode = '42501';
    end if;
    return NEW;
  end if;

  select t.* into v_token
  from private.content_scan_tokens t
  where t.id = v_token_id
    and t.actor_id = v_actor
    and t.operation = v_operation
    and t.consumed_at is not null
    and t.expires_at > pg_catalog.clock_timestamp();

  if not found or v_token.operation not like TG_TABLE_NAME || '.%' then
    raise exception 'Content scan authorization does not match this write'
      using errcode = '42501';
  end if;

  if (TG_OP = 'INSERT' and v_token.operation not in (
      TG_TABLE_NAME || '.create', 'community_attestations.upsert'
    ))
    or (TG_OP = 'UPDATE' and v_token.operation not in (
      TG_TABLE_NAME || '.decision', TG_TABLE_NAME || '.resolve',
      TG_TABLE_NAME || '.update', 'community_attestations.upsert',
      'reviewer_profiles.admin_update'
    )) then
    raise exception 'Content scan operation does not match database event'
      using errcode = '42501';
  end if;

  insert into private.content_scan_events(
    actor_id, table_name, operation, decision, content_digest,
    engine_version, policy_version, token_id
  ) values (
    v_actor, TG_TABLE_NAME, TG_OP, 'authorized',
    pg_catalog.encode(v_token.payload_hash, 'hex'),
    v_token.engine_version, v_token.policy_version, v_token.id
  );
  return NEW;
end;
$function$;

revoke all on function private.enforce_content_scan_token() from public, anon, authenticated;

drop trigger if exists content_safety_guard on public.review_submissions;
create trigger content_safety_guard before insert or update on public.review_submissions
for each row execute function private.enforce_content_scan_token();

drop trigger if exists content_safety_guard on public.community_attestations;
create trigger content_safety_guard before insert or update on public.community_attestations
for each row execute function private.enforce_content_scan_token();

drop trigger if exists content_safety_guard on public.reviewer_profiles;
create trigger content_safety_guard before insert or update on public.reviewer_profiles
for each row execute function private.enforce_content_scan_token();

drop trigger if exists content_safety_guard on public.member_messages;
create trigger content_safety_guard before insert or update on public.member_messages
for each row execute function private.enforce_content_scan_token();

drop trigger if exists content_safety_guard on public.member_moderation_reports;
create trigger content_safety_guard before insert or update on public.member_moderation_reports
for each row execute function private.enforce_content_scan_token();

drop trigger if exists content_safety_guard on public.role_promotion_requests;
create trigger content_safety_guard before insert or update on public.role_promotion_requests
for each row execute function private.enforce_content_scan_token();

-- Public RPCs are SECURITY INVOKER: the actual DML remains under the caller's RLS context.
create or replace function public.submit_review_submission(p_payload jsonb, p_scan_token text)
returns uuid language plpgsql security invoker set search_path = ''
as $function$
declare v_id uuid;
begin
  if p_payload - array['entry_id','proposed_data','evidence','reviewer_note','supersedes_id','corpus_version','baseline_fingerprint'] <> '{}'::jsonb then
    raise exception 'Unsupported review submission field' using errcode = '22023';
  end if;
  perform private.consume_content_scan_token(p_scan_token, 'review_submissions.create', p_payload);
  insert into public.review_submissions(entry_id, proposed_data, evidence, reviewer_note, reviewer_id, supersedes_id, corpus_version, baseline_fingerprint)
  values (
    p_payload->>'entry_id', coalesce(p_payload->'proposed_data','{}'::jsonb),
    coalesce(p_payload->'evidence','[]'::jsonb), p_payload->>'reviewer_note',
    (select auth.uid()), nullif(p_payload->>'supersedes_id','')::uuid,
    coalesce(p_payload->>'corpus_version','1.5.0'), p_payload->>'baseline_fingerprint'
  ) returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.submit_community_attestation(p_payload jsonb, p_scan_token text)
returns uuid language plpgsql security invoker set search_path = ''
as $function$
declare v_id uuid; v_actor uuid := (select auth.uid());
begin
  if p_payload - array['entry_id','verdict','dialect_region','note','corpus_version','baseline_fingerprint','response_ms','example_id'] <> '{}'::jsonb then
    raise exception 'Unsupported attestation field' using errcode = '22023';
  end if;
  perform private.consume_content_scan_token(p_scan_token, 'community_attestations.upsert', p_payload);
  insert into public.community_attestations(entry_id, reviewer_id, verdict, dialect_region, note, corpus_version, baseline_fingerprint, response_ms, example_id)
  values (p_payload->>'entry_id', v_actor, p_payload->>'verdict', p_payload->>'dialect_region',
    p_payload->>'note', coalesce(p_payload->>'corpus_version','1.5.0'), p_payload->>'baseline_fingerprint',
    nullif(p_payload->>'response_ms','')::integer, coalesce(p_payload->>'example_id',''))
  on conflict (entry_id, example_id, reviewer_id) do update set
    verdict = excluded.verdict, dialect_region = excluded.dialect_region, note = excluded.note,
    response_ms = excluded.response_ms, updated_at = pg_catalog.now()
  returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.update_reviewer_profile_content(p_payload jsonb, p_scan_token text)
returns void language plpgsql security invoker set search_path = ''
as $function$
begin
  if p_payload - array['display_name','dialect_region','specialty','github_handle'] <> '{}'::jsonb then
    raise exception 'Unsupported profile field' using errcode = '22023';
  end if;
  perform private.consume_content_scan_token(p_scan_token, 'reviewer_profiles.update', p_payload);
  update public.reviewer_profiles set
    display_name = case when p_payload ? 'display_name' then p_payload->>'display_name' else display_name end,
    dialect_region = case when p_payload ? 'dialect_region' then p_payload->>'dialect_region' else dialect_region end,
    specialty = case when p_payload ? 'specialty' then p_payload->>'specialty' else specialty end,
    github_handle = case when p_payload ? 'github_handle' then p_payload->>'github_handle' else github_handle end
  where id = (select auth.uid());
  if not found then raise exception 'Profile not found' using errcode = 'P0002'; end if;
end;
$function$;

create or replace function public.update_reviewer_profile_admin_note(p_payload jsonb, p_scan_token text)
returns void language plpgsql security invoker set search_path = ''
as $function$
begin
  if p_payload - array['status_reason'] <> '{}'::jsonb then
    raise exception 'Unsupported admin profile field' using errcode = '22023';
  end if;
  perform private.consume_content_scan_token(p_scan_token, 'reviewer_profiles.admin_update', p_payload);
  update public.reviewer_profiles set status_reason = p_payload->>'status_reason'
  where id = nullif(p_payload->>'id','')::uuid
    and (select private.is_lexreview_admin());
  if not found then raise exception 'Profile not found or admin permission required' using errcode = '42501'; end if;
end;
$function$;

create or replace function public.send_member_message(p_payload jsonb, p_scan_token text)
returns uuid language plpgsql security invoker set search_path = ''
as $function$
declare v_id uuid; v_label text;
begin
  if p_payload - array['recipient_id','is_broadcast','category','title','body','requires_ack','pinned_until'] <> '{}'::jsonb then
    raise exception 'Unsupported message field' using errcode = '22023';
  end if;
  perform private.consume_content_scan_token(p_scan_token, 'member_messages.create', p_payload);
  select coalesce(nullif(pg_catalog.btrim(display_name),''),'فريق Darija LexReview') into v_label
  from public.reviewer_profiles where id = (select auth.uid());
  insert into public.member_messages(sender_id, sender_label, recipient_id, is_broadcast, category, title, body, requires_ack, pinned_until)
  values ((select auth.uid()), coalesce(v_label,'فريق Darija LexReview'),
    nullif(p_payload->>'recipient_id','')::uuid, coalesce((p_payload->>'is_broadcast')::boolean,false),
    p_payload->>'category', p_payload->>'title', p_payload->>'body',
    coalesce((p_payload->>'requires_ack')::boolean,false), nullif(p_payload->>'pinned_until','')::timestamptz)
  returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.submit_moderation_report(p_payload jsonb, p_scan_token text)
returns uuid language plpgsql security invoker set search_path = ''
as $function$
declare v_id uuid;
begin
  if p_payload - array['target_user_id','target_display_name','recommended_action','reason'] <> '{}'::jsonb then
    raise exception 'Unsupported moderation report field' using errcode = '22023';
  end if;
  perform private.consume_content_scan_token(p_scan_token, 'member_moderation_reports.create', p_payload);
  insert into public.member_moderation_reports(target_user_id,target_display_name,reporter_id,recommended_action,reason)
  values (nullif(p_payload->>'target_user_id','')::uuid,p_payload->>'target_display_name',
    (select auth.uid()),coalesce(p_payload->>'recommended_action','warn'),p_payload->>'reason')
  returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.resolve_moderation_report(p_payload jsonb, p_scan_token text)
returns void language plpgsql security invoker set search_path = ''
as $function$
begin
  if p_payload - array['id','status','admin_note'] <> '{}'::jsonb then
    raise exception 'Unsupported report resolution field' using errcode = '22023';
  end if;
  perform private.consume_content_scan_token(p_scan_token, 'member_moderation_reports.resolve', p_payload);
  update public.member_moderation_reports set status = p_payload->>'status',
    admin_note = p_payload->>'admin_note', reviewed_by = (select auth.uid()), updated_at = pg_catalog.now()
  where id = nullif(p_payload->>'id','')::uuid;
  if not found then raise exception 'Report not found or admin permission required' using errcode = '42501'; end if;
end;
$function$;

create or replace function public.submit_role_promotion_request(p_payload jsonb, p_scan_token text)
returns uuid language plpgsql security invoker set search_path = ''
as $function$
declare v_id uuid;
begin
  if p_payload - array['requester_name','dialect_region','experience_summary','sample_links'] <> '{}'::jsonb then
    raise exception 'Unsupported promotion request field' using errcode = '22023';
  end if;
  perform private.consume_content_scan_token(p_scan_token, 'role_promotion_requests.create', p_payload);
  insert into public.role_promotion_requests(requester_id,requester_name,dialect_region,experience_summary,sample_links)
  values ((select auth.uid()),p_payload->>'requester_name',p_payload->>'dialect_region',
    p_payload->>'experience_summary',p_payload->>'sample_links')
  returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.decide_role_promotion_request(p_payload jsonb, p_scan_token text)
returns void language plpgsql security invoker set search_path = ''
as $function$
begin
  if p_payload - array['id','decision','admin_note'] <> '{}'::jsonb then
    raise exception 'Unsupported promotion decision field' using errcode = '22023';
  end if;
  perform private.consume_content_scan_token(p_scan_token, 'role_promotion_requests.decision', p_payload);
  perform public.review_role_promotion_request(
    nullif(p_payload->>'id','')::uuid, p_payload->>'decision', p_payload->>'admin_note'
  );
end;
$function$;

create or replace function public.decide_review_submission(p_payload jsonb, p_scan_token text)
returns void language plpgsql security invoker set search_path = ''
as $function$
begin
  if p_payload - array['id','status','editor_note'] <> '{}'::jsonb then
    raise exception 'Unsupported review decision field' using errcode = '22023';
  end if;
  perform private.consume_content_scan_token(p_scan_token, 'review_submissions.decision', p_payload);
  update public.review_submissions set status = p_payload->>'status',
    editor_note = p_payload->>'editor_note', editor_id = (select auth.uid()), updated_at = pg_catalog.now()
  where id = nullif(p_payload->>'id','')::uuid;
  if not found then raise exception 'Submission not found or editor permission required' using errcode = '42501'; end if;
end;
$function$;

revoke all on function public.submit_review_submission(jsonb,text) from public, anon;
revoke all on function public.submit_community_attestation(jsonb,text) from public, anon;
revoke all on function public.update_reviewer_profile_content(jsonb,text) from public, anon;
revoke all on function public.update_reviewer_profile_admin_note(jsonb,text) from public, anon;
revoke all on function public.send_member_message(jsonb,text) from public, anon;
revoke all on function public.submit_moderation_report(jsonb,text) from public, anon;
revoke all on function public.resolve_moderation_report(jsonb,text) from public, anon;
revoke all on function public.submit_role_promotion_request(jsonb,text) from public, anon;
revoke all on function public.decide_role_promotion_request(jsonb,text) from public, anon;
revoke all on function public.decide_review_submission(jsonb,text) from public, anon;
grant execute on function public.submit_review_submission(jsonb,text) to authenticated;
grant execute on function public.submit_community_attestation(jsonb,text) to authenticated;
grant execute on function public.update_reviewer_profile_content(jsonb,text) to authenticated;
grant execute on function public.update_reviewer_profile_admin_note(jsonb,text) to authenticated;
grant execute on function public.send_member_message(jsonb,text) to authenticated;
grant execute on function public.submit_moderation_report(jsonb,text) to authenticated;
grant execute on function public.resolve_moderation_report(jsonb,text) to authenticated;
grant execute on function public.submit_role_promotion_request(jsonb,text) to authenticated;
grant execute on function public.decide_role_promotion_request(jsonb,text) to authenticated;
grant execute on function public.decide_review_submission(jsonb,text) to authenticated;

-- Signup must not copy unscanned, user-editable metadata into the canonical public profile.
create or replace function public.handle_new_lexreview_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.reviewer_profiles(id, role)
  values (new.id, 'reviewer')
  on conflict (id) do nothing;

  insert into public.member_messages(
    recipient_id,is_broadcast,sender_id,sender_label,category,title,body,requires_ack
  ) values (
    new.id,false,null,'فريق Darija LexReview','welcome',
    'مرحباً بك في مجتمع توثيق الدارجة المغربية',
    'يسعدنا انضمامك إلى Darija LexReview. يمكنك إكمال ملفك الشخصي بعد تسجيل الدخول.',
    false
  );
  return new;
end;
$function$;

-- Durable, private learning governance records. Raw private messages are not eligible sources.
create table if not exists private.feedback_candidates (
  id uuid primary key default gen_random_uuid(),
  domain text not null check (domain in ('linguistic','content_safety')),
  source text not null check (source in ('lexicon_suggestion','editor_correction','moderation_appeal','moderation_decision','benchmark_annotation')),
  source_surface text not null check (source_surface in ('profile','lexicon','contribution','review','comment','discussion','report','benchmark')),
  group_id text not null,
  text_value text not null check (char_length(text_value) between 1 and 5000),
  label text not null check (char_length(label) between 1 and 120),
  rationale text not null check (char_length(rationale) between 1 and 2000),
  contributor_id uuid not null references auth.users(id),
  consent_to_dataset_use boolean not null check (consent_to_dataset_use),
  license text not null check (char_length(license) between 1 and 250),
  provenance jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  pii_screened boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists private.feedback_reviews (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references private.feedback_candidates(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id),
  reviewer_role text not null check (reviewer_role in ('editor','admin')),
  decision text not null check (decision in ('approve','reject')),
  reason text not null check (char_length(reason) between 1 and 2000),
  reviewed_at timestamptz not null default now(),
  unique(candidate_id, reviewer_id)
);
create table if not exists private.dataset_registry (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  fingerprint text not null check (fingerprint ~ '^sha256:[a-f0-9]{64}$'),
  source_candidate_ids uuid[] not null,
  split_manifest jsonb not null,
  frozen boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists private.evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references private.dataset_registry(id),
  model_name text not null,
  model_version text not null,
  code_commit text not null,
  artifact_digest text,
  metrics jsonb not null,
  passed_release_gate boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists private.model_registry (
  id uuid primary key default gen_random_uuid(),
  model_name text not null,
  version text not null,
  artifact_digest text not null check (artifact_digest ~ '^sha256:[a-f0-9]{64}$'),
  dataset_id uuid not null references private.dataset_registry(id),
  evaluation_id uuid not null references private.evaluation_runs(id),
  code_commit text not null,
  status text not null default 'candidate' check (status in ('candidate','approved','active','rolled_back')),
  created_at timestamptz not null default now(),
  unique(model_name,version)
);
create table if not exists private.model_release_approvals (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references private.model_registry(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id),
  decision text not null check (decision in ('approve','reject')),
  reason text not null check (char_length(reason) between 1 and 2000),
  created_at timestamptz not null default now(),
  unique(model_id, reviewer_id)
);
create table if not exists private.model_rollbacks (
  id uuid primary key default gen_random_uuid(),
  model_name text not null,
  from_model_id uuid references private.model_registry(id),
  to_model_id uuid references private.model_registry(id),
  reason text not null,
  initiated_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

revoke all on private.feedback_candidates, private.feedback_reviews, private.dataset_registry,
  private.evaluation_runs, private.model_registry, private.model_release_approvals,
  private.model_rollbacks from public, anon, authenticated;
grant select, insert, update, delete on private.feedback_candidates, private.feedback_reviews,
  private.dataset_registry, private.evaluation_runs, private.model_registry,
  private.model_release_approvals, private.model_rollbacks to service_role;
