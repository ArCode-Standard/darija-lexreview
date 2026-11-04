-- =============================================================================
-- Migration: Automated Editorial Decision Inbox Notifications &
--            Enriched Public Contributors Directory Breakdown
-- =============================================================================
-- 1. Links member_messages directly to adjudicated review_submissions so the
--    recipient's inbox displays a 1-click button to inspect or revise their item.
-- 2. Automatically dispatches an inbox message whenever an editor accepts,
--    requests changes on, rejects, or merges a contributor's submission.
-- 3. Enriches get_public_contributors_directory() with documented word &
--    contextual example counts plus recent accepted headwords while preserving
--    strict privacy (public_listed = true, zero UUID/email exposure).
-- =============================================================================

alter table public.member_messages
  add column if not exists related_submission_id uuid
    references public.review_submissions(id) on delete set null,
  add column if not exists related_entry_id text
    check (related_entry_id is null or char_length(pg_catalog.btrim(related_entry_id)) <= 64),
  add column if not exists decision_status text
    check (
      decision_status is null
      or decision_status in ('accepted', 'needs_changes', 'rejected', 'merged')
    );

create index if not exists member_messages_related_submission_idx
  on public.member_messages(related_submission_id)
  where related_submission_id is not null;

-- Keep non-admin read/ack updates strictly locked on reference columns as well
create or replace function private.enforce_member_message_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_admin boolean := (select private.is_lexreview_admin());
begin
  if not v_is_admin then
    if old.recipient_id is distinct from (select auth.uid()) then
      raise exception 'Not authorized to update this message' using errcode = '42501';
    end if;
    new.id := old.id;
    new.recipient_id := old.recipient_id;
    new.is_broadcast := old.is_broadcast;
    new.sender_id := old.sender_id;
    new.sender_label := old.sender_label;
    new.category := old.category;
    new.title := old.title;
    new.body := old.body;
    new.requires_ack := old.requires_ack;
    new.pinned_until := old.pinned_until;
    new.related_submission_id := old.related_submission_id;
    new.related_entry_id := old.related_entry_id;
    new.decision_status := old.decision_status;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_member_message_update() from public, anon, authenticated;

-- Automatically notify the submitting contributor on editorial adjudication
create or replace function private.notify_contributor_on_submission_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_editor_name text;
  v_sender_label text;
  v_headword text;
  v_note text;
  v_category text;
  v_title text;
  v_body text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status not in ('accepted', 'needs_changes', 'rejected', 'merged') then
    return new;
  end if;

  if new.reviewer_id is null then
    return new;
  end if;

  -- Skip self-notification if an editor somehow triggered an update on their own row
  if new.status <> 'merged' and new.editor_id is not null and new.reviewer_id = new.editor_id then
    return new;
  end if;

  if new.editor_id is not null then
    select nullif(pg_catalog.btrim(coalesce(rp.display_name, '')), '')
      into v_editor_name
      from public.reviewer_profiles rp
     where rp.id = new.editor_id;
  end if;

  v_sender_label := case
    when v_editor_name is not null then 'هيئة التحرير (' || pg_catalog.left(v_editor_name, 72) || ')'
    else 'هيئة التحرير المعجمي'
  end;

  v_headword := coalesce(
    nullif(pg_catalog.btrim(coalesce(new.proposed_data ->> 'word_ar', '')), ''),
    nullif(pg_catalog.btrim(coalesce(new.proposed_data ->> 'arabizi', '')), ''),
    new.entry_id
  );
  v_headword := pg_catalog.left(v_headword, 48);

  v_note := nullif(pg_catalog.btrim(coalesce(new.editor_note, '')), '');

  if new.status = 'accepted' then
    v_category := 'appreciation';
    v_title := 'تم اعتماد مساهمتك المعجمية: «' || v_headword || '»';
    v_body := 'اعتمدت هيئة التحرير مقترحك الخاص بـ «' || v_headword || '» لإدراجه في التحديث الرسمي القادم للمعجم.'
      || case
           when v_note is not null then ' ملاحظة المحرر اللغوي: ' || pg_catalog.left(v_note, 1500)
           else ' نشكرك على مساهمتك الموثقة في إثراء معجم الدارجة المغربية.'
         end;
  elsif new.status = 'needs_changes' then
    v_category := 'editorial_note';
    v_title := 'مطلوب تعديل بسيط على مقترحك: «' || v_headword || '»';
    v_body := 'راجع المحرر اللغوي مقترحك الخاص بـ «' || v_headword || '» وطلب استكمال أو توضيح بعض التفاصيل قبل الاعتماد النهائي.'
      || case
           when v_note is not null then ' ملاحظة المحرر: ' || pg_catalog.left(v_note, 1500)
           else ''
         end
      || ' يمكنك فتح المقترح مباشرة وتعديله ثم إعادة إرساله بضغطة واحدة.';
  elsif new.status = 'rejected' then
    v_category := 'editorial_note';
    v_title := 'نتيجة تحكيم مقترحك: «' || v_headword || '»';
    v_body := 'تعذر اعتماد المقترح الخاص بـ «' || v_headword || '» بصيغته الحالية بعد المراجعة التحريرية.'
      || case
           when v_note is not null then ' سبب القرار وملاحظة المحرر: ' || pg_catalog.left(v_note, 1500)
           else ''
         end
      || ' يمكنك الاطلاع على تفاصيل المقترح وتقديم نسخة منقحة وموثقة بشاهد أوضح متى شئت.';
  else
    -- merged into an official corpus release
    v_category := 'appreciation';
    v_title := 'أُدرجت مساهمتك في الإصدار الرسمي ' || pg_catalog.left(coalesce(new.exported_in_version, ''), 24) || ': «' || v_headword || '»';
    v_body := 'تم دمج مساهمتك المعتمدة الخاصة بـ «' || v_headword || '» رسمياً ضمن حزمة الإصدار الموقعة للمتن المفتوح. شكراً لأثرك العلمي المستدام.';
  end if;

  insert into public.member_messages (
    recipient_id,
    is_broadcast,
    sender_id,
    sender_label,
    category,
    title,
    body,
    requires_ack,
    related_submission_id,
    related_entry_id,
    decision_status
  ) values (
    new.reviewer_id,
    false,
    new.editor_id,
    v_sender_label,
    v_category,
    pg_catalog.left(v_title, 160),
    pg_catalog.left(v_body, 4000),
    false,
    new.id,
    new.entry_id,
    new.status
  );

  return new;
end;
$$;
revoke all on function private.notify_contributor_on_submission_decision() from public, anon, authenticated;

drop trigger if exists trg_submission_decision_inbox_notify on public.review_submissions;
create trigger trg_submission_decision_inbox_notify
after update on public.review_submissions
for each row execute function private.notify_contributor_on_submission_decision();

-- Upgrade public contributors directory RPC with documented words & examples breakdown
drop function if exists public.get_public_contributors_directory();

create function public.get_public_contributors_directory()
returns table (
  public_slug text,
  display_name text,
  dialect_region text,
  specialty text,
  github_handle text,
  role text,
  accepted_count integer,
  attestations_count integer,
  joined_year integer,
  avatar_source text,
  avatar_path text,
  avatar_seed text,
  documented_words_count integer,
  documented_examples_count integer,
  recent_words text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with sub_stats as (
    select
      s.reviewer_id,
      count(*) filter (where s.status in ('accepted', 'merged'))::integer as accepted_count,
      count(distinct s.entry_id) filter (where s.status in ('accepted', 'merged'))::integer as accepted_entries_count,
      count(*) filter (
        where s.status in ('accepted', 'merged')
          and nullif(pg_catalog.btrim(coalesce(s.proposed_data ->> 'example_darija', '')), '') is not null
      )::integer as accepted_examples_count,
      (
        array_agg(
          nullif(pg_catalog.btrim(coalesce(s.proposed_data ->> 'word_ar', '')), '')
          order by s.updated_at desc
        ) filter (
          where s.status in ('accepted', 'merged')
            and nullif(pg_catalog.btrim(coalesce(s.proposed_data ->> 'word_ar', '')), '') is not null
        )
      )[1:5] as recent_words
    from public.review_submissions s
    group by s.reviewer_id
  ),
  att_stats as (
    select
      ca.reviewer_id,
      count(*)::integer as attestations_count,
      count(distinct ca.entry_id) filter (where ca.example_id = '')::integer as attested_words_count,
      count(*) filter (where ca.example_id <> '')::integer as attested_examples_count
    from public.community_attestations ca
    where coalesce(ca.response_ms, 1500) >= 800
    group by ca.reviewer_id
  )
  select
    pg_catalog.substr(pg_catalog.encode(extensions.digest(rp.id::text || ':lexreview-public', 'sha256'), 'hex'), 1, 12) as public_slug,
    coalesce(nullif(pg_catalog.btrim(rp.display_name), ''), 'مساهم معجمي') as display_name,
    rp.dialect_region,
    rp.specialty,
    rp.github_handle,
    rp.role,
    coalesce(ss.accepted_count, 0) as accepted_count,
    coalesce(ats.attestations_count, 0) as attestations_count,
    extract(year from rp.created_at)::integer as joined_year,
    coalesce(rp.avatar_source, 'arcode') as avatar_source,
    rp.avatar_path,
    rp.avatar_seed,
    (coalesce(ss.accepted_entries_count, 0) + coalesce(ats.attested_words_count, 0))::integer as documented_words_count,
    (coalesce(ss.accepted_examples_count, 0) + coalesce(ats.attested_examples_count, 0))::integer as documented_examples_count,
    coalesce(ss.recent_words, array[]::text[]) as recent_words
  from public.reviewer_profiles rp
  left join sub_stats ss on ss.reviewer_id = rp.id
  left join att_stats ats on ats.reviewer_id = rp.id
  where rp.public_listed = true
    and (
      rp.account_status in ('active', 'warned')
      or (
        rp.account_status = 'suspended'
        and rp.suspended_until is not null
        and rp.suspended_until <= pg_catalog.now()
      )
    )
    and (
      rp.role in ('editor', 'admin')
      or coalesce(ss.accepted_count, 0) > 0
      or coalesce(ats.attestations_count, 0) > 0
      or nullif(pg_catalog.btrim(coalesce(rp.display_name, '')), '') is not null
    )
  order by
    case rp.role when 'admin' then 1 when 'editor' then 2 else 3 end,
    coalesce(ss.accepted_count, 0) desc,
    coalesce(ats.attestations_count, 0) desc,
    rp.created_at asc
  limit 200;
$$;
grant execute on function public.get_public_contributors_directory() to anon, authenticated;
