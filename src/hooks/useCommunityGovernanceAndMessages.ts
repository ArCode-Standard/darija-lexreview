import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  AccountStatus,
  MemberMessageCategory,
  MemberMessageRecord,
  MemberModerationAction,
  MemberModerationEvent,
  MemberModerationReport,
  PublicContributorRecord,
  ReviewerProfile,
  UserRole,
} from '../types/lexicon'

const SANDBOX_MEMBERS_KEY = 'arcode_lexreview_sandbox_gov_members_v1'
const SANDBOX_MESSAGES_KEY = 'arcode_lexreview_sandbox_messages_v1'
const SANDBOX_MOD_EVENTS_KEY = 'arcode_lexreview_sandbox_mod_events_v1'
const SANDBOX_MOD_REPORTS_KEY = 'arcode_lexreview_sandbox_mod_reports_v1'
const LOCAL_READ_MSG_IDS_KEY = 'arcode_lexreview_read_msg_ids_v1'
const LOCAL_DISMISSED_BROADCASTS_KEY = 'arcode_lexreview_dismissed_broadcasts_v1'
const LOCAL_PUBLIC_LISTED_PREF_KEY = 'arcode_lexreview_public_listed_pref_v1'

function createInitialSandboxMembers(): ReviewerProfile[] {
  return [
    {
      id: 'sandbox-member-1',
      display_name: 'د. سلمى الإدريسي',
      dialect_region: 'فاس - مكناس',
      specialty: 'اللسانيات المقارنة والدلالة',
      github_handle: 'salma-ling',
      public_listed: true,
      role: 'editor',
      account_status: 'active',
      accepted_count: 18,
      attestations_count: 64,
      created_at: '2026-02-14T10:00:00.000Z',
      is_sandbox: true,
    },
    {
      id: 'sandbox-member-2',
      display_name: 'ياسين آيت بها',
      dialect_region: 'سوس - ماسة',
      specialty: 'توثيق التعابير الشفوية والامثال',
      github_handle: 'yassine-darija',
      public_listed: true,
      role: 'reviewer',
      account_status: 'active',
      accepted_count: 7,
      attestations_count: 31,
      created_at: '2026-04-02T14:20:00.000Z',
      is_sandbox: true,
    },
    {
      id: 'sandbox-member-3',
      display_name: 'هدى بنجلون',
      dialect_region: 'طنجة - تطوان - الحسيمة',
      specialty: 'المعالجة الآلية للغات الطبيعية NLP',
      github_handle: 'houda-nlp',
      public_listed: true,
      role: 'reviewer',
      account_status: 'warned',
      status_reason: 'إرسال شواهد منقولة دون توثيق مصدرها الأصلي.',
      status_updated_at: '2026-10-28T09:15:00.000Z',
      accepted_count: 2,
      attestations_count: 12,
      created_at: '2026-07-19T11:00:00.000Z',
      is_sandbox: true,
    },
  ]
}

function createWelcomeMessage(recipientId: string | null): MemberMessageRecord {
  return {
    id: 'system-welcome-default',
    recipient_id: recipientId,
    is_broadcast: false,
    sender_id: null,
    sender_label: 'فريق Darija LexReview',
    category: 'welcome',
    title: 'مرحباً بك في مجتمع توثيق ومراجعة الدارجة المغربية',
    body: 'نرحب بانضمامك إلى منصة Darija LexReview. يمكنك البدء فوراً بتدقيق المفردات في «المراجعة السريعة»، أو سد النواقص في «خارطة التغطية»، أو اقتراح مفردات وشواهد جديدة. عند اعتماد مساهماتك سيظهر اسمك وأوسمتك العلمية في «لوحة شرف المساهمين» العامة (مع إمكانية التحكم الكامل بخصوصية ظهورك من ملفك الشخصي).',
    requires_ack: false,
    read_at: null,
    acknowledged_at: null,
    pinned_until: null,
    created_at: '2026-11-01T09:00:00.000Z',
  }
}

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function getLocalPublicListedFallback(userId?: string | null): boolean {
  if (!userId) return true
  const map = safeReadJson<Record<string, boolean>>(LOCAL_PUBLIC_LISTED_PREF_KEY, {})
  return map[userId] ?? true
}

export function saveLocalPublicListedFallback(userId: string, listed: boolean) {
  try {
    const map = safeReadJson<Record<string, boolean>>(LOCAL_PUBLIC_LISTED_PREF_KEY, {})
    map[userId] = listed
    localStorage.setItem(LOCAL_PUBLIC_LISTED_PREF_KEY, JSON.stringify(map))
  } catch {
    // Ignore storage errors
  }
}

export interface UseCommunityGovernanceParams {
  currentProfile: ReviewerProfile | null
  userEmail: string | null
  editorialPreviewMode: boolean
  totalAttestationsCount: number
}

export function useCommunityGovernanceAndMessages({
  currentProfile,
  userEmail,
  editorialPreviewMode,
  totalAttestationsCount,
}: UseCommunityGovernanceParams) {
  const [livePublicContributors, setLivePublicContributors] = useState<PublicContributorRecord[]>(
    [],
  )
  const [liveAdminMembers, setLiveAdminMembers] = useState<ReviewerProfile[]>([])
  const [liveMessages, setLiveMessages] = useState<MemberMessageRecord[]>([])
  const [liveModEvents, setLiveModEvents] = useState<MemberModerationEvent[]>([])
  const [liveModReports, setLiveModReports] = useState<MemberModerationReport[]>([])
  const [loadingDirectory, setLoadingDirectory] = useState(false)
  const [loadingMembers, setLoadingMembers] = useState(false)

  const [sandboxMembers, setSandboxMembers] = useState<ReviewerProfile[]>(() =>
    safeReadJson<ReviewerProfile[]>(SANDBOX_MEMBERS_KEY, createInitialSandboxMembers()),
  )
  const [sandboxMessages, setSandboxMessages] = useState<MemberMessageRecord[]>(() =>
    safeReadJson<MemberMessageRecord[]>(SANDBOX_MESSAGES_KEY, []),
  )
  const [sandboxModEvents, setSandboxModEvents] = useState<MemberModerationEvent[]>(() =>
    safeReadJson<MemberModerationEvent[]>(SANDBOX_MOD_EVENTS_KEY, []),
  )
  const [sandboxModReports, setSandboxModReports] = useState<MemberModerationReport[]>(() =>
    safeReadJson<MemberModerationReport[]>(SANDBOX_MOD_REPORTS_KEY, []),
  )

  const [localReadIds, setLocalReadIds] = useState<string[]>(() =>
    safeReadJson<string[]>(LOCAL_READ_MSG_IDS_KEY, []),
  )
  const [dismissedBroadcastIds, setDismissedBroadcastIds] = useState<string[]>(() =>
    safeReadJson<string[]>(LOCAL_DISMISSED_BROADCASTS_KEY, []),
  )

  useEffect(() => {
    try {
      localStorage.setItem(SANDBOX_MEMBERS_KEY, JSON.stringify(sandboxMembers))
    } catch {
      // Ignore quota
    }
  }, [sandboxMembers])

  useEffect(() => {
    try {
      localStorage.setItem(SANDBOX_MESSAGES_KEY, JSON.stringify(sandboxMessages))
    } catch {
      // Ignore quota
    }
  }, [sandboxMessages])

  useEffect(() => {
    try {
      localStorage.setItem(SANDBOX_MOD_EVENTS_KEY, JSON.stringify(sandboxModEvents))
    } catch {
      // Ignore quota
    }
  }, [sandboxModEvents])

  useEffect(() => {
    try {
      localStorage.setItem(SANDBOX_MOD_REPORTS_KEY, JSON.stringify(sandboxModReports))
    } catch {
      // Ignore quota
    }
  }, [sandboxModReports])

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_READ_MSG_IDS_KEY, JSON.stringify(localReadIds))
    } catch {
      // Ignore quota
    }
  }, [localReadIds])

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_DISMISSED_BROADCASTS_KEY, JSON.stringify(dismissedBroadcastIds))
    } catch {
      // Ignore quota
    }
  }, [dismissedBroadcastIds])

  const isAdmin = currentProfile?.role === 'admin'
  const isEditor = currentProfile?.role === 'editor'

  // 1. Load Sanitized Public Contributors Directory
  const refreshPublicDirectory = useCallback(async () => {
    if (!supabase) return
    setLoadingDirectory(true)
    const { data, error } = await supabase.rpc('get_public_contributors_directory')
    setLoadingDirectory(false)
    if (!error && Array.isArray(data)) {
      setLivePublicContributors(data as PublicContributorRecord[])
    }
  }, [])

  // 2. Load Member Messages (Authenticated Users) or Public Broadcasts Only (Visitors)
  const refreshMessages = useCallback(async () => {
    if (!supabase) return
    let queryBuilder = supabase
      .from('member_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (!userEmail) {
      queryBuilder = queryBuilder.eq('is_broadcast', true)
    }

    const { data, error } = await queryBuilder
    if (!error && Array.isArray(data)) {
      setLiveMessages(data as MemberMessageRecord[])
    } else if (!userEmail) {
      setLiveMessages([])
    }
  }, [userEmail])

  // 3. Load Admin Member Governance Data (Admins & Editors per RLS)
  const refreshAdminGovernance = useCallback(async () => {
    if (!supabase || !currentProfile) return
    if (!isAdmin && !isEditor) return

    setLoadingMembers(true)
    if (isAdmin) {
      const [profilesRes, subsRes, eventsRes, reportsRes] = await Promise.all([
        supabase
          .from('reviewer_profiles')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(300),
        supabase
          .from('review_submissions')
          .select('reviewer_id, status')
          .in('status', ['accepted', 'merged'])
          .limit(2000),
        supabase
          .from('member_moderation_events')
          .select('*')
          .order('occurred_at', { ascending: false })
          .limit(100),
        supabase
          .from('member_moderation_reports')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
      ])

      if (!profilesRes.error && Array.isArray(profilesRes.data)) {
        const acceptedByReviewer = new Map<string, number>()
        if (!subsRes.error && Array.isArray(subsRes.data)) {
          for (const row of subsRes.data as Array<{ reviewer_id?: string }>) {
            if (row.reviewer_id) {
              acceptedByReviewer.set(
                row.reviewer_id,
                (acceptedByReviewer.get(row.reviewer_id) ?? 0) + 1,
              )
            }
          }
        }
        const enriched = (profilesRes.data as ReviewerProfile[]).map((p) => ({
          ...p,
          account_status: p.account_status ?? 'active',
          public_listed: p.public_listed ?? true,
          accepted_count: acceptedByReviewer.get(p.id) ?? 0,
        }))
        setLiveAdminMembers(enriched)
      }
      if (!eventsRes.error && Array.isArray(eventsRes.data)) {
        setLiveModEvents(eventsRes.data as MemberModerationEvent[])
      }
      if (!reportsRes.error && Array.isArray(reportsRes.data)) {
        setLiveModReports(reportsRes.data as MemberModerationReport[])
      }
    } else if (isEditor) {
      const reportsRes = await supabase
        .from('member_moderation_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (!reportsRes.error && Array.isArray(reportsRes.data)) {
        setLiveModReports(reportsRes.data as MemberModerationReport[])
      }
    }
    setLoadingMembers(false)
  }, [currentProfile, isAdmin, isEditor])

  useEffect(() => {
    void refreshPublicDirectory()
    void refreshMessages()
  }, [refreshPublicDirectory, refreshMessages, userEmail])

  useEffect(() => {
    void refreshAdminGovernance()
  }, [refreshAdminGovernance])

  // Combined Public Contributors List (Live + Current Opt-in User + Sandbox when previewing)
  const publicContributors = useMemo<PublicContributorRecord[]>(() => {
    const list: PublicContributorRecord[] = [...livePublicContributors]

    if (currentProfile) {
      const effectivePublic =
        currentProfile.public_listed ?? getLocalPublicListedFallback(currentProfile.id)
      const effectiveStatus = currentProfile.account_status ?? 'active'
      if (effectivePublic && effectiveStatus !== 'suspended' && effectiveStatus !== 'banned') {
        const displayName = currentProfile.display_name?.trim() || 'مساهم موثق'
        const alreadyInLive = list.some(
          (item) =>
            item.display_name === displayName &&
            (item.github_handle ?? '') === (currentProfile.github_handle ?? ''),
        )
        if (!alreadyInLive) {
          list.unshift({
            public_slug: `self-${currentProfile.id.slice(0, 8)}`,
            display_name: displayName,
            dialect_region: currentProfile.dialect_region ?? null,
            specialty: currentProfile.specialty ?? null,
            github_handle: currentProfile.github_handle ?? null,
            role: currentProfile.role,
            accepted_count: currentProfile.accepted_count ?? 0,
            attestations_count: Math.max(
              currentProfile.attestations_count ?? 0,
              totalAttestationsCount,
            ),
            joined_year: currentProfile.created_at
              ? new Date(currentProfile.created_at).getFullYear()
              : new Date().getFullYear(),
          })
        }
      }
    }

    if (editorialPreviewMode || !supabase) {
      for (const sm of sandboxMembers) {
        const status = sm.account_status ?? 'active'
        if ((sm.public_listed ?? true) && status !== 'suspended' && status !== 'banned') {
          list.push({
            public_slug: sm.id,
            display_name: sm.display_name || 'مساهم تجريبي',
            dialect_region: sm.dialect_region ?? null,
            specialty: sm.specialty ?? null,
            github_handle: sm.github_handle ?? null,
            role: sm.role,
            accepted_count: sm.accepted_count ?? 0,
            attestations_count: sm.attestations_count ?? 0,
            joined_year: sm.created_at ? new Date(sm.created_at).getFullYear() : 2026,
            is_sandbox: true,
          })
        }
      }
    }

    return list
  }, [
    livePublicContributors,
    currentProfile,
    totalAttestationsCount,
    editorialPreviewMode,
    sandboxMembers,
  ])

  // Combined Inbox Messages — Strictly for Authenticated Members (or Active Sandbox Preview)
  const isMemberOrPreview = Boolean(userEmail) || editorialPreviewMode

  const inboxMessages = useMemo<MemberMessageRecord[]>(() => {
    if (!isMemberOrPreview) {
      return []
    }

    const currentUserId = currentProfile?.id ?? null
    const relevantSandbox = editorialPreviewMode
      ? sandboxMessages.filter(
          (m) =>
            m.is_broadcast ||
            (currentUserId && m.recipient_id === currentUserId) ||
            m.recipient_id === 'self-preview' ||
            isAdmin,
        )
      : []

    const relevantLive = liveMessages.filter(
      (m) => m.is_broadcast || (currentUserId && m.recipient_id === currentUserId),
    )

    const merged = [...relevantLive, ...relevantSandbox]
    const hasWelcome = merged.some((m) => m.category === 'welcome')
    if (!hasWelcome && userEmail) {
      merged.push(createWelcomeMessage(currentUserId))
    }

    return merged
      .map((m) => ({
        ...m,
        read_at: m.read_at || (localReadIds.includes(m.id) ? new Date().toISOString() : null),
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [
    isMemberOrPreview,
    editorialPreviewMode,
    sandboxMessages,
    liveMessages,
    currentProfile,
    isAdmin,
    userEmail,
    localReadIds,
  ])

  const unreadMessagesCount = useMemo(() => {
    if (!isMemberOrPreview) return 0
    return inboxMessages.filter(
      (m) =>
        !m.read_at &&
        (m.is_broadcast ||
          (currentProfile && m.recipient_id === currentProfile.id) ||
          (editorialPreviewMode && m.recipient_id === 'self-preview') ||
          m.id === 'system-welcome-default'),
    ).length
  }, [isMemberOrPreview, inboxMessages, currentProfile, editorialPreviewMode])

  const unacknowledgedWarnings = useMemo(() => {
    if (!isMemberOrPreview) return []
    return inboxMessages.filter(
      (m) =>
        m.category === 'warning' &&
        m.requires_ack &&
        !m.acknowledged_at &&
        ((currentProfile && m.recipient_id === currentProfile.id) ||
          (editorialPreviewMode && m.recipient_id === 'self-preview')),
    )
  }, [isMemberOrPreview, inboxMessages, currentProfile, editorialPreviewMode])

  const activeAnnouncements = useMemo(() => {
    const broadcastPool = editorialPreviewMode
      ? [...liveMessages, ...sandboxMessages]
      : liveMessages
    return broadcastPool.filter(
      (m) =>
        m.is_broadcast &&
        !dismissedBroadcastIds.includes(m.id) &&
        (!m.pinned_until || new Date(m.pinned_until).getTime() > Date.now()),
    )
  }, [editorialPreviewMode, liveMessages, sandboxMessages, dismissedBroadcastIds])

  // Actions: Mark Read / Acknowledge Warning / Dismiss Broadcast
  const markMessageRead = useCallback(
    async (messageId: string) => {
      setLocalReadIds((prev) => (prev.includes(messageId) ? prev : [...prev, messageId]))
      const now = new Date().toISOString()

      setSandboxMessages((prev) =>
        prev.map((m) => (m.id === messageId && !m.read_at ? { ...m, read_at: now } : m)),
      )

      if (supabase && currentProfile && !messageId.startsWith('sandbox-') && messageId !== 'system-welcome-default') {
        await supabase
          .from('member_messages')
          .update({ read_at: now })
          .eq('id', messageId)
          .is('read_at', null)
        void refreshMessages()
      }
    },
    [currentProfile, refreshMessages],
  )

  const markAllMessagesRead = useCallback(async () => {
    const ids = inboxMessages.map((m) => m.id)
    setLocalReadIds((prev) => Array.from(new Set([...prev, ...ids])))
    const now = new Date().toISOString()

    setSandboxMessages((prev) => prev.map((m) => (m.read_at ? m : { ...m, read_at: now })))

    if (supabase && currentProfile) {
      await supabase
        .from('member_messages')
        .update({ read_at: now })
        .eq('recipient_id', currentProfile.id)
        .is('read_at', null)
      void refreshMessages()
    }
  }, [inboxMessages, currentProfile, refreshMessages])

  const acknowledgeWarning = useCallback(
    async (messageId: string) => {
      const now = new Date().toISOString()
      setLocalReadIds((prev) => (prev.includes(messageId) ? prev : [...prev, messageId]))

      setSandboxMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, read_at: m.read_at ?? now, acknowledged_at: now } : m,
        ),
      )

      if (supabase && currentProfile && !messageId.startsWith('sandbox-')) {
        await supabase
          .from('member_messages')
          .update({ read_at: now, acknowledged_at: now })
          .eq('id', messageId)
        void refreshMessages()
      }
    },
    [currentProfile, refreshMessages],
  )

  const dismissAnnouncement = useCallback((messageId: string) => {
    setDismissedBroadcastIds((prev) => (prev.includes(messageId) ? prev : [...prev, messageId]))
  }, [])

  // Admin / Staff Actions: Change Role, Change Standing (Warn / Suspend / Ban / Restore), Send Message, Submit Report
  const applyMemberGovernanceAction = useCallback(
    async (params: {
      source: 'live' | 'sandbox'
      targetMember: ReviewerProfile
      action: MemberModerationAction
      nextRole?: UserRole
      reason?: string
      suspendDays?: number
    }): Promise<{ ok: boolean; error?: string }> => {
      const now = new Date().toISOString()
      const cleanReason = params.reason?.trim() || null
      const actorName = currentProfile?.display_name || userEmail?.split('@')[0] || 'مشرف عام'

      const nextStatus: AccountStatus =
        params.action === 'warn'
          ? 'warned'
          : params.action === 'suspend'
            ? 'suspended'
            : params.action === 'ban'
              ? 'banned'
              : params.action === 'restore'
                ? 'active'
                : (params.targetMember.account_status ?? 'active')

      const nextRole: UserRole = params.nextRole ?? params.targetMember.role
      const suspendedUntil =
        params.action === 'suspend' && params.suspendDays
          ? new Date(Date.now() + params.suspendDays * 86_400_000).toISOString()
          : null

      if (params.source === 'sandbox' || params.targetMember.is_sandbox) {
        setSandboxMembers((prev) =>
          prev.map((m) =>
            m.id === params.targetMember.id
              ? {
                  ...m,
                  role: nextRole,
                  account_status: nextStatus,
                  status_reason: cleanReason,
                  suspended_until: suspendedUntil,
                  status_updated_at: now,
                }
              : m,
          ),
        )

        const newEvent: MemberModerationEvent = {
          id: `sandbox-evt-${Date.now()}`,
          target_user_id: params.targetMember.id,
          target_display_name: params.targetMember.display_name,
          actor_id: currentProfile?.id ?? 'sandbox-admin',
          actor_display_name: actorName,
          action_type: params.action,
          previous_role: params.targetMember.role,
          new_role: nextRole,
          previous_status: params.targetMember.account_status ?? 'active',
          new_status: nextStatus,
          reason: cleanReason,
          occurred_at: now,
          is_sandbox: true,
        }
        setSandboxModEvents((prev) => [newEvent, ...prev])

        // Also generate corresponding sandbox message
        const msgCategory: MemberMessageCategory =
          params.action === 'promote' || params.action === 'demote'
            ? 'role_update'
            : params.action === 'warn'
              ? 'warning'
              : params.action === 'suspend' || params.action === 'ban'
                ? 'suspension_notice'
                : 'editorial_note'

        const msgTitle =
          params.action === 'promote'
            ? `تمت ترقية صلاحيتك إلى «${nextRole === 'admin' ? 'مشرف عام' : 'محرر معتمد'}»`
            : params.action === 'demote'
              ? 'تحديث مستوى الصلاحية في المنصة'
              : params.action === 'warn'
                ? 'إنذار رسمي بخصوص ضوابط المساهمة المعجمية'
                : params.action === 'ban'
                  ? 'إشعار بطرد وحظر الحساب نهائياً'
                  : params.action === 'suspend'
                    ? 'إشعار بتجميد الحساب مؤقتاً'
                    : 'تمت إعادة تفعيل حسابك بالكامل'

        const msgBody =
          cleanReason ||
          (params.action === 'promote'
            ? 'نقدّر مساهماتك الرصينة في إثراء المعجم المغربي ويسعدنا منحك الصلاحية الجديدة.'
            : 'تم تحديث حالة حسابك من قِبل إدارة الحوكمة.')

        setSandboxMessages((prev) => [
          {
            id: `sandbox-msg-${Date.now()}`,
            recipient_id: params.targetMember.id,
            is_broadcast: false,
            sender_id: currentProfile?.id ?? 'sandbox-admin',
            sender_label: actorName,
            category: msgCategory,
            title: msgTitle,
            body: msgBody,
            requires_ack: params.action === 'warn',
            read_at: null,
            acknowledged_at: null,
            pinned_until: null,
            created_at: now,
            is_sandbox: true,
          },
          ...prev,
        ])

        return { ok: true }
      }

      if (!supabase || !isAdmin) {
        return { ok: false, error: 'تتطلب هذه العملية صلاحية مشرف عام متصل بقاعدة البيانات.' }
      }

      const updatePayload: Record<string, unknown> = {
        role: nextRole,
        account_status: nextStatus,
        status_reason: cleanReason,
        suspended_until: suspendedUntil,
      }

      const { error } = await supabase
        .from('reviewer_profiles')
        .update(updatePayload)
        .eq('id', params.targetMember.id)

      if (error) {
        // Fallback if only `role` column exists before running the latest SQL migration
        if (params.action === 'promote' || params.action === 'demote') {
          const fallbackRes = await supabase
            .from('reviewer_profiles')
            .update({ role: nextRole })
            .eq('id', params.targetMember.id)
          if (!fallbackRes.error) {
            await refreshAdminGovernance()
            await refreshPublicDirectory()
            return { ok: true }
          }
        }
        return {
          ok: false,
          error:
            'تعذر تطبيق الإجراء على قاعدة البيانات. تأكد من تطبيق ملف الترقية الأخير (20261102150000) في Supabase.',
        }
      }

      await Promise.all([
        refreshAdminGovernance(),
        refreshPublicDirectory(),
        refreshMessages(),
      ])
      return { ok: true }
    },
    [
      currentProfile,
      userEmail,
      isAdmin,
      refreshAdminGovernance,
      refreshPublicDirectory,
      refreshMessages,
    ],
  )

  const sendDirectOrBroadcastMessage = useCallback(
    async (params: {
      source: 'live' | 'sandbox'
      recipientId: string | null
      isBroadcast: boolean
      category: MemberMessageCategory
      title: string
      body: string
      requiresAck?: boolean
      pinDays?: number
    }): Promise<{ ok: boolean; error?: string }> => {
      const now = new Date().toISOString()
      const senderLabel =
        currentProfile?.role === 'admin'
          ? `الإدارة العامة (${currentProfile.display_name || 'مشرف'})`
          : currentProfile?.role === 'editor'
            ? `هيئة التحرير (${currentProfile.display_name || 'محرر'})`
            : 'إدارة المعجم (وضع المعاينة)'

      const pinnedUntil =
        params.isBroadcast && params.pinDays
          ? new Date(Date.now() + params.pinDays * 86_400_000).toISOString()
          : null

      if (params.source === 'sandbox' || params.recipientId === 'self-preview' || params.recipientId?.startsWith('sandbox-')) {
        const msg: MemberMessageRecord = {
          id: `sandbox-msg-${Date.now()}`,
          recipient_id: params.isBroadcast ? null : (params.recipientId ?? 'self-preview'),
          is_broadcast: params.isBroadcast,
          sender_id: currentProfile?.id ?? 'sandbox-staff',
          sender_label: senderLabel,
          category: params.category,
          title: params.title.trim(),
          body: params.body.trim(),
          requires_ack: params.isBroadcast ? false : Boolean(params.requiresAck),
          read_at: null,
          acknowledged_at: null,
          pinned_until: pinnedUntil,
          created_at: now,
          is_sandbox: true,
        }
        setSandboxMessages((prev) => [msg, ...prev])
        return { ok: true }
      }

      if (!supabase || (!isAdmin && !isEditor)) {
        return { ok: false, error: 'صلاحية الإرسال متاحة للمحررين والمشرفين المعتمدين فقط.' }
      }

      const { error } = await supabase.from('member_messages').insert({
        recipient_id: params.isBroadcast ? null : params.recipientId,
        is_broadcast: params.isBroadcast,
        sender_id: currentProfile?.id ?? null,
        sender_label: senderLabel,
        category: params.category,
        title: params.title.trim(),
        body: params.body.trim(),
        requires_ack: params.isBroadcast ? false : Boolean(params.requiresAck),
        pinned_until: pinnedUntil,
      })

      if (error) {
        return {
          ok: false,
          error:
            'تعذر إرسال الرسالة عبر قاعدة البيانات. تأكد من تطبيق جدول member_messages في Supabase.',
        }
      }

      await refreshMessages()
      return { ok: true }
    },
    [currentProfile, isAdmin, isEditor, refreshMessages],
  )

  const submitModerationReport = useCallback(
    async (params: {
      source: 'live' | 'sandbox'
      targetUserId: string
      targetDisplayName: string
      recommendedAction: 'warn' | 'suspend' | 'ban'
      reason: string
    }): Promise<{ ok: boolean; error?: string }> => {
      const now = new Date().toISOString()
      const reporterName = currentProfile?.display_name || userEmail?.split('@')[0] || 'محرر معتمد'

      if (params.source === 'sandbox' || params.targetUserId.startsWith('sandbox-')) {
        const report: MemberModerationReport = {
          id: `sandbox-rep-${Date.now()}`,
          target_user_id: params.targetUserId,
          target_display_name: params.targetDisplayName,
          reporter_id: currentProfile?.id ?? 'sandbox-editor',
          reporter_display_name: reporterName,
          recommended_action: params.recommendedAction,
          reason: params.reason.trim(),
          status: 'open',
          reviewed_by: null,
          admin_note: null,
          created_at: now,
          updated_at: now,
          is_sandbox: true,
        }
        setSandboxModReports((prev) => [report, ...prev])
        return { ok: true }
      }

      if (!supabase || (!isEditor && !isAdmin)) {
        return { ok: false, error: 'يتطلب رفع البلاغات صلاحية محرر معتمد.' }
      }

      const { error } = await supabase.from('member_moderation_reports').insert({
        target_user_id: params.targetUserId,
        target_display_name: params.targetDisplayName.trim() || null,
        reporter_id: currentProfile?.id,
        recommended_action: params.recommendedAction,
        reason: params.reason.trim(),
      })

      if (error) {
        return { ok: false, error: 'تعذر إرسال البلاغ حالياً.' }
      }

      await refreshAdminGovernance()
      return { ok: true }
    },
    [currentProfile, userEmail, isEditor, isAdmin, refreshAdminGovernance],
  )

  const resolveModerationReport = useCallback(
    async (params: {
      report: MemberModerationReport
      resolution: 'resolved' | 'dismissed'
      adminNote?: string
    }) => {
      const now = new Date().toISOString()
      if (params.report.is_sandbox) {
        setSandboxModReports((prev) =>
          prev.map((r) =>
            r.id === params.report.id
              ? {
                  ...r,
                  status: params.resolution,
                  admin_note: params.adminNote?.trim() || null,
                  updated_at: now,
                }
              : r,
          ),
        )
        return
      }
      if (!supabase || !isAdmin) return
      await supabase
        .from('member_moderation_reports')
        .update({
          status: params.resolution,
          reviewed_by: currentProfile?.id ?? null,
          admin_note: params.adminNote?.trim() || null,
          updated_at: now,
        })
        .eq('id', params.report.id)
      void refreshAdminGovernance()
    },
    [currentProfile, isAdmin, refreshAdminGovernance],
  )

  const resetSandboxCommunityState = useCallback(() => {
    setSandboxMembers(createInitialSandboxMembers())
    setSandboxMessages([])
    setSandboxModEvents([])
    setSandboxModReports([])
  }, [])

  return {
    publicContributors,
    loadingDirectory,
    liveAdminMembers,
    sandboxMembers,
    loadingMembers,
    liveModEvents,
    sandboxModEvents,
    liveModReports,
    sandboxModReports,
    inboxMessages,
    unreadMessagesCount,
    unacknowledgedWarnings,
    activeAnnouncements,
    markMessageRead,
    markAllMessagesRead,
    acknowledgeWarning,
    dismissAnnouncement,
    applyMemberGovernanceAction,
    sendDirectOrBroadcastMessage,
    submitModerationReport,
    resolveModerationReport,
    resetSandboxCommunityState,
    refreshPublicDirectory,
    refreshAdminGovernance,
    refreshMessages,
  }
}
