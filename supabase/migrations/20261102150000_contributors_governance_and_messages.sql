-- =============================================================================
-- Migration: Public Contributors Directory, Member Governance (Suspend/Ban),
--            Editor Escalation Reports, and Member Messages & Announcements
-- =============================================================================
-- Preserves strict RLS privacy guarantees on public.reviewer_profiles:
--   1. Raw profile rows remain visible only to owner + admins.
--   2. Public contributors showcase uses a sanitized SECURITY DEFINER RPC
--      that respects `public_listed = true` and hides suspended/banned accounts.
--   3. Suspended or banned accounts are blocked at the RLS policy level from
--      creating/updating submissions, attestations, or promotion requests.
-- =============================================================================

-- 1. Additive columns on public.reviewer_profiles
alter table public.reviewer_profiles
  add column if not exists public_listed boolean not null default true,
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'warned', 'suspended', 'banned')),
  add column if not exists status_reason text
    check (status_reason is null or char_length(status_reason) <= 1000),
  add column if not exists suspended_until timestamptz,
  add column if not exists status_updated_at timestamptz,
  add column if not exists status_updated_by uuid references auth.users(id) on delete set null;

create index if not exists reviewer_profiles_public_directory_idx
  on public.reviewer_profiles(public_listed, account_status, role);

-- 2. Member Moderation Audit Ledger & Editor Escalation Reports
create table if not exists public.member_moderation_events (
  id bigint generated always as identity primary key,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action_type text not null
    check (action_type in ('promote', 'demote', 'warn', 'suspend', 'ban', 'restore')),
  previous_role text,
  new_role text,
  previous_status text,
  new_status text,
  reason text check (reason is null or char_length(reason) <= 1000),
  occurred_at timestamptz not null default now()
);

create index if not exists member_moderation_events_target_idx
  on public.member_moderation_events(target_user_id, occurred_at desc);

create table if not exists public.member_moderation_reports (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  target_display_name text check (target_display_name is null or char_length(target_display_name) <= 120),
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recommended_action text not null default 'warn'
    check (recommended_action in ('warn', 'suspend', 'ban')),
  reason text not null
    check (char_length(btrim(reason)) between 10 and 1500),
  status text not null default 'open'
    check (status in ('open', 'resolved', 'dismissed')),
  reviewed_by uuid references auth.users(id) on delete set null,
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists member_moderation_reports_status_idx
  on public.member_moderation_reports(status, created_at desc);

-- 3. Member Messages & Global Announcements
create table if not exists public.member_messages (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references auth.users(id) on delete cascade,
  is_broadcast boolean not null default false,
  sender_id uuid references auth.users(id) on delete set null,
  sender_label text not null default 'إدارة المعجم'
    check (char_length(btrim(sender_label)) between 2 and 120),
  category text not null
    check (category in (
      'welcome',
      'appreciation',
      'editorial_note',
      'role_update',
      'warning',
      'suspension_notice',
      'announcement'
    )),
  title text not null
    check (char_length(btrim(title)) between 2 and 160),
  body text not null
    check (char_length(btrim(body)) between 4 and 4000),
  requires_ack boolean not null default false,
  read_at timestamptz,
  acknowledged_at timestamptz,
  pinned_until timestamptz,
  created_at timestamptz not null default now(),
  constraint member_messages_target_check
    check (
      (is_broadcast = true and recipient_id is null and requires_ack = false)
      or (is_broadcast = false and recipient_id is not null)
    )
);

create index if not exists member_messages_recipient_created_idx
  on public.member_messages(recipient_id, created_at desc)
  where recipient_id is not null;

create index if not exists member_messages_broadcast_idx
  on public.member_messages(created_at desc)
  where is_broadcast = true;

-- 4. Updated Security Helper Functions
create or replace function private.is_active_contributor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select
        rp.account_status not in ('suspended', 'banned')
        or (rp.account_status = 'suspended' and rp.suspended_until is not null and rp.suspended_until <= pg_catalog.now())
      from public.reviewer_profiles rp
      where rp.id = (select auth.uid())
    ),
    true
  );
$$;
revoke all on function private.is_active_contributor() from public, anon;
grant execute on function private.is_active_contributor() to authenticated;

create or replace function private.is_lexreview_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.reviewer_profiles rp
    where rp.id = (select auth.uid())
      and rp.role in ('editor', 'admin')
      and rp.account_status not in ('suspended', 'banned')
  );
$$;
revoke all on function private.is_lexreview_editor() from public, anon;
grant execute on function private.is_lexreview_editor() to authenticated;

create or replace function private.is_lexreview_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.reviewer_profiles rp
    where rp.id = (select auth.uid())
      and rp.role = 'admin'
      and rp.account_status not in ('suspended', 'banned')
  );
$$;
revoke all on function private.is_lexreview_admin() from public, anon;
grant execute on function private.is_lexreview_admin() to authenticated;

-- 5. Profile Integrity & Automated Governance Audit + Lifecycle Messages
create or replace function public.enforce_reviewer_profile_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_is_admin boolean := (select private.is_lexreview_admin());
begin
  new.id := old.id;
  new.created_at := old.created_at;

  if new.role is distinct from old.role
     or new.account_status is distinct from old.account_status
     or new.status_reason is distinct from old.status_reason
     or new.suspended_until is distinct from old.suspended_until then
    if not v_is_admin then
      raise exception 'Only admins can modify member roles or account standing'
        using errcode = '42501';
    end if;
    new.status_updated_at := pg_catalog.now();
    new.status_updated_by := v_actor;
  else
    new.status_updated_at := old.status_updated_at;
    new.status_updated_by := old.status_updated_by;
  end if;

  return new;
end;
$$;
revoke all on function public.enforce_reviewer_profile_integrity() from public, anon, authenticated;

create or replace function private.record_member_governance_side_effects()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_action text;
  v_msg_cat text;
  v_msg_title text;
  v_msg_body text;
  v_req_ack boolean := false;
begin
  if new.role is distinct from old.role then
    v_action := case
      when new.role in ('editor', 'admin') and old.role = 'reviewer' then 'promote'
      when new.role = 'admin' and old.role = 'editor' then 'promote'
      else 'demote'
    end;

    insert into public.member_moderation_events (
      target_user_id, actor_id, action_type, previous_role, new_role,
      previous_status, new_status, reason
    ) values (
      new.id, v_actor, v_action, old.role, new.role,
      old.account_status, new.account_status, new.status_reason
    );

    v_msg_cat := 'role_update';
    v_msg_title := case
      when v_action = 'promote' then 'تمت ترقية صلاحيتك في منصة Darija LexReview'
      else 'تحديث صلاحيات حسابك في المنصة'
    end;
    v_msg_body := case
      when new.role = 'admin' then 'تم منح حسابك صلاحية «مشرف عام» لإدارة الأعضاء وحوكمة المتن المعجمي.'
      when new.role = 'editor' then 'تهانينا! تم اعتمادك بصلاحية «محرر معتمد» للمشاركة في تحكيم المقترحات وتدقيق الشواهد.'
      else 'تم تحديث دور حسابك إلى «مراجع مساهم».'
    end;

    insert into public.member_messages (
      recipient_id, is_broadcast, sender_id, sender_label,
      category, title, body, requires_ack
    ) values (
      new.id, false, v_actor, 'إدارة الحوكمة',
      v_msg_cat, v_msg_title, v_msg_body, false
    );
  end if;

  if new.account_status is distinct from old.account_status then
    v_action := case
      when new.account_status = 'warned' then 'warn'
      when new.account_status = 'suspended' then 'suspend'
      when new.account_status = 'banned' then 'ban'
      else 'restore'
    end;

    insert into public.member_moderation_events (
      target_user_id, actor_id, action_type, previous_role, new_role,
      previous_status, new_status, reason
    ) values (
      new.id, v_actor, v_action, old.role, new.role,
      old.account_status, new.account_status, new.status_reason
    );

    if new.account_status = 'warned' then
      v_msg_cat := 'warning';
      v_msg_title := 'إنذار رسمي بخصوص ضوابط المساهمة المعجمية';
      v_msg_body := coalesce(nullif(pg_catalog.btrim(coalesce(new.status_reason, '')), ''), 'يرجى الالتزام بالمعايير العلمية وتجنب إرسال بيانات غير موثقة.');
      v_req_ack := true;
    elsif new.account_status in ('suspended', 'banned') then
      v_msg_cat := 'suspension_notice';
      v_msg_title := case
        when new.account_status = 'banned' then 'إشعار بحظر الحساب وإيقاف صلاحية النشر'
        else 'إشعار بتجميد الحساب مؤقتاً'
      end;
      v_msg_body := coalesce(nullif(pg_catalog.btrim(coalesce(new.status_reason, '')), ''), 'تم تقييد صلاحية إرسال المساهمات بقرار إداري حفاظاً على نزاهة المتن.');
    else
      v_msg_cat := 'editorial_note';
      v_msg_title := 'تمت إعادة تفعيل حسابك بالكامل';
      v_msg_body := 'يمكنك الآن استئناف إرسال المساهمات والتصديقات في المعجم.';
    end if;

    insert into public.member_messages (
      recipient_id, is_broadcast, sender_id, sender_label,
      category, title, body, requires_ack
    ) values (
      new.id, false, v_actor, 'إدارة المعجم',
      v_msg_cat, v_msg_title, v_msg_body, v_req_ack
    );
  end if;

  return new;
end;
$$;
revoke all on function private.record_member_governance_side_effects() from public, anon, authenticated;

drop trigger if exists trg_member_governance_side_effects on public.reviewer_profiles;
create trigger trg_member_governance_side_effects
after update on public.reviewer_profiles
for each row execute function private.record_member_governance_side_effects();

-- Automated Welcome Message on User Signup
create or replace function public.handle_new_lexreview_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.reviewer_profiles (
    id, display_name, dialect_region, specialty, github_handle, role
  )
  values (
    new.id,
    nullif(
      pg_catalog.btrim(
        coalesce(
          new.raw_user_meta_data ->> 'name',
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'user_name',
          ''
        )
      ),
      ''
    ),
    nullif(pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'dialect_region', '')), ''),
    nullif(pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'specialty', '')), ''),
    nullif(pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'user_name', '')), ''),
    'reviewer'
  )
  on conflict (id) do update set
    display_name = coalesce(public.reviewer_profiles.display_name, excluded.display_name),
    github_handle = coalesce(public.reviewer_profiles.github_handle, excluded.github_handle);

  insert into public.member_messages (
    recipient_id, is_broadcast, sender_id, sender_label,
    category, title, body, requires_ack
  )
  values (
    new.id,
    false,
    null,
    'فريق Darija LexReview',
    'welcome',
    'مرحباً بك في مجتمع توثيق الدارجة المغربية',
    'يسعدنا انضمامك إلى Darija LexReview. يمكنك البدء فوراً بالمراجعة السريعة للبطاقات، أو اقتراح مفردات وشواهد جديدة، أو إكمال ملفك الشخصي وربط حسابَي GitHub وGoogle لتوثيق اسمك في لوحة شرف المساهمين.',
    false
  );

  return new;
end;
$$;
revoke all on function public.handle_new_lexreview_user() from public, anon, authenticated;

-- Enforce recipient-only read/ack updates on member_messages
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
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_member_message_update() from public, anon, authenticated;

drop trigger if exists trg_enforce_member_message_update on public.member_messages;
create trigger trg_enforce_member_message_update
before update on public.member_messages
for each row execute function private.enforce_member_message_update();

-- 6. Sanitized Public Contributors Honor Roll RPC (Zero Email / UUID Exposure)
create or replace function public.get_public_contributors_directory()
returns table (
  public_slug text,
  display_name text,
  dialect_region text,
  specialty text,
  github_handle text,
  role text,
  accepted_count integer,
  attestations_count integer,
  joined_year integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with sub_counts as (
    select
      s.reviewer_id,
      count(*) filter (where s.status in ('accepted', 'merged'))::integer as accepted_count
    from public.review_submissions s
    group by s.reviewer_id
  ),
  att_counts as (
    select
      ca.reviewer_id,
      count(*)::integer as attestations_count
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
    coalesce(sc.accepted_count, 0) as accepted_count,
    coalesce(ac.attestations_count, 0) as attestations_count,
    extract(year from rp.created_at)::integer as joined_year
  from public.reviewer_profiles rp
  left join sub_counts sc on sc.reviewer_id = rp.id
  left join att_counts ac on ac.reviewer_id = rp.id
  where rp.public_listed = true
    and rp.account_status in ('active', 'warned')
    and (
      rp.role in ('editor', 'admin')
      or coalesce(sc.accepted_count, 0) > 0
      or coalesce(ac.attestations_count, 0) > 0
      or nullif(pg_catalog.btrim(coalesce(rp.display_name, '')), '') is not null
    )
  order by
    case rp.role when 'admin' then 1 when 'editor' then 2 else 3 end,
    coalesce(sc.accepted_count, 0) desc,
    coalesce(ac.attestations_count, 0) desc,
    rp.created_at asc
  limit 200;
$$;
grant execute on function public.get_public_contributors_directory() to anon, authenticated;

-- 7. Enforce Active Account Standing on Contributions & Attestations RLS
drop policy if exists "reviewers create submissions" on public.review_submissions;
create policy "reviewers create submissions"
on public.review_submissions for insert to authenticated
with check (
  reviewer_id = (select auth.uid())
  and (select private.is_active_contributor())
  and status = 'pending'
  and editor_id is null
  and editor_note is null
);

drop policy if exists "reviewers insert own attestations" on public.community_attestations;
create policy "reviewers insert own attestations"
on public.community_attestations for insert to authenticated
with check (
  reviewer_id = (select auth.uid())
  and (select private.is_active_contributor())
);

drop policy if exists "reviewers update own attestations" on public.community_attestations;
create policy "reviewers update own attestations"
on public.community_attestations for update to authenticated
using (
  reviewer_id = (select auth.uid())
  and (select private.is_active_contributor())
)
with check (
  reviewer_id = (select auth.uid())
  and (select private.is_active_contributor())
);

drop policy if exists "reviewers submit own promotion request" on public.role_promotion_requests;
create policy "reviewers submit own promotion request"
on public.role_promotion_requests for insert to authenticated
with check (
  requester_id = (select auth.uid())
  and (select private.is_active_contributor())
  and status = 'pending'
  and requested_role = 'editor'
  and reviewed_by is null
  and admin_note is null
  and not (select private.is_lexreview_editor())
);

-- 8. RLS Policies & Column Grants for New Tables
alter table public.member_moderation_events enable row level security;
alter table public.member_moderation_reports enable row level security;
alter table public.member_messages enable row level security;

drop policy if exists "admins read moderation events" on public.member_moderation_events;
create policy "admins read moderation events"
on public.member_moderation_events for select to authenticated
using ((select private.is_lexreview_admin()));

drop policy if exists "staff read or create moderation reports" on public.member_moderation_reports;
create policy "staff read or create moderation reports"
on public.member_moderation_reports for select to authenticated
using (
  reporter_id = (select auth.uid())
  or (select private.is_lexreview_admin())
);

drop policy if exists "editors submit moderation reports" on public.member_moderation_reports;
create policy "editors submit moderation reports"
on public.member_moderation_reports for insert to authenticated
with check (
  reporter_id = (select auth.uid())
  and (select private.is_lexreview_editor())
  and status = 'open'
);

drop policy if exists "admins resolve moderation reports" on public.member_moderation_reports;
create policy "admins resolve moderation reports"
on public.member_moderation_reports for update to authenticated
using ((select private.is_lexreview_admin()))
with check ((select private.is_lexreview_admin()));

drop policy if exists "anon reads active broadcast announcements" on public.member_messages;
create policy "anon reads active broadcast announcements"
on public.member_messages for select to anon
using (
  is_broadcast = true
  and (pinned_until is null or pinned_until > pg_catalog.now())
);

drop policy if exists "members read own messages or broadcasts" on public.member_messages;
create policy "members read own messages or broadcasts"
on public.member_messages for select to authenticated
using (
  recipient_id = (select auth.uid())
  or is_broadcast = true
  or (select private.is_lexreview_admin())
);

drop policy if exists "staff send member messages" on public.member_messages;
create policy "staff send member messages"
on public.member_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and (
    (select private.is_lexreview_admin())
    or (
      (select private.is_lexreview_editor())
      and is_broadcast = false
      and category in ('appreciation', 'editorial_note', 'warning')
    )
  )
);

drop policy if exists "recipients ack own messages or admins manage" on public.member_messages;
create policy "recipients ack own messages or admins manage"
on public.member_messages for update to authenticated
using (
  recipient_id = (select auth.uid())
  or (select private.is_lexreview_admin())
)
with check (
  recipient_id = (select auth.uid())
  or (select private.is_lexreview_admin())
);

revoke all on table public.member_moderation_events from public, anon, authenticated;
revoke all on table public.member_moderation_reports from public, anon, authenticated;
revoke all on table public.member_messages from public, anon, authenticated;

grant select on table public.member_moderation_events to authenticated;
grant select, insert on table public.member_moderation_reports to authenticated;
grant update (status, reviewed_by, admin_note, updated_at)
  on table public.member_moderation_reports to authenticated;

grant select on table public.member_messages to anon, authenticated;
grant insert on table public.member_messages to authenticated;
grant update (read_at, acknowledged_at, pinned_until)
  on table public.member_messages to authenticated;

grant update (
  display_name,
  dialect_region,
  specialty,
  github_handle,
  public_listed,
  role,
  account_status,
  status_reason,
  suspended_until
) on table public.reviewer_profiles to authenticated;
