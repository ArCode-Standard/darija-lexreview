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

const LOCAL_READ_MSG_IDS_KEY = 'arcode_lexreview_read_msg_ids_v1'
const LOCAL_DISMISSED_BROADCASTS_KEY = 'arcode_lexreview_dismissed_broadcasts_v1'
const LOCAL_PUBLIC_LISTED_PREF_KEY = 'arcode_lexreview_public_listed_pref_v1'



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
  totalAttestationsCount: number
}

export function useCommunityGovernanceAndMessages({
  currentProfile,
  userEmail,
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

  const [localReadIds, setLocalReadIds] = useState<string[]>(() =>
    safeReadJson<string[]>(LOCAL_READ_MSG_IDS_KEY, []),
  )
  const [dismissedBroadcastIds, setDismissedBroadcastIds] = useState<string[]>(() =>
    safeReadJson<string[]>(LOCAL_DISMISSED_BROADCASTS_KEY, []),
  )





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
      const [profilesRes, subsRes, eventsRes, reportsRes, contactsRes] = await Promise.all([
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
        supabase
          .from('member_contact_preferences')
          .select('user_id, contact_email')
          .eq('share_with_admins', true),
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
        const sharedContactByUser = new Map<string, string>()
        if (!contactsRes.error && Array.isArray(contactsRes.data)) {
          for (const contact of contactsRes.data as Array<{ user_id: string; contact_email: string | null }>) {
            if (contact.contact_email) sharedContactByUser.set(contact.user_id, contact.contact_email)
          }
        }
        const enriched = (profilesRes.data as ReviewerProfile[]).map((p) => ({
          ...p,
          contact_email: sharedContactByUser.get(p.id) ?? null,
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

  // Subscribe to Realtime member_messages events so the inbox badge updates immediately
  useEffect(() => {
    const client = supabase
    if (!client || !userEmail) return

    const userId = currentProfile?.id ?? null
    const upsertRealtimeRow = (row: MemberMessageRecord) => {
      if (!row?.id) return
      const isRelevant =
        row.is_broadcast || (userId !== null && row.recipient_id === userId)
      if (!isRelevant) return

      setLiveMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === row.id)
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = { ...updated[idx], ...row }
          return updated
        }
        return [row, ...prev]
      })
    }

    const channelName = `member-inbox-realtime-${userId ?? 'session'}`
    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'member_messages',
          ...(userId ? { filter: `recipient_id=eq.${userId}` } : {}),
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string } | null)?.id
            if (oldId) {
              setLiveMessages((prev) => prev.filter((m) => m.id !== oldId))
            }
            return
          }
          upsertRealtimeRow(payload.new as MemberMessageRecord)
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'member_messages',
          filter: 'is_broadcast=eq.true',
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string } | null)?.id
            if (oldId) {
              setLiveMessages((prev) => prev.filter((m) => m.id !== oldId))
            }
            return
          }
          upsertRealtimeRow(payload.new as MemberMessageRecord)
        },
      )
      .subscribe()

    return () => {
      void client.removeChannel(channel)
    }
  }, [userEmail, currentProfile?.id])

  useEffect(() => {
    void refreshAdminGovernance()
  }, [refreshAdminGovernance])

  // Combine the official public directory with the current authenticated contributor.
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
            avatar_source: currentProfile.avatar_source ?? 'arcode',
            avatar_path: currentProfile.avatar_path ?? null,
            avatar_seed: currentProfile.avatar_seed ?? currentProfile.id,
            role: currentProfile.role,
            accepted_count: currentProfile.accepted_count ?? 0,
            attestations_count: Math.max(
              currentProfile.attestations_count ?? 0,
              totalAttestationsCount,
            ),
            documented_words_count: currentProfile.accepted_count ?? 0,
            documented_examples_count: 0,
            weekly_contributions_count: 0,
            joined_year: currentProfile.created_at
              ? new Date(currentProfile.created_at).getFullYear()
              : new Date().getFullYear(),
          })
        }
      }
    }



    return list
  }, [
    livePublicContributors,
    currentProfile,
    totalAttestationsCount,
  ])

  // Inbox messages are limited to authenticated recipients and official broadcasts.
  const isAuthenticatedMember = Boolean(userEmail)

  const inboxMessages = useMemo<MemberMessageRecord[]>(() => {
    if (!userEmail) return []
    const currentUserId = currentProfile?.id ?? null
    const merged = liveMessages.filter(
      (message) => message.is_broadcast || (currentUserId && message.recipient_id === currentUserId),
    )
    if (!merged.some((message) => message.category === 'welcome')) {
      merged.push(createWelcomeMessage(currentUserId))
    }
    return merged
      .map((message) => ({
        ...message,
        read_at: message.read_at || (localReadIds.includes(message.id) ? new Date().toISOString() : null),
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [userEmail, liveMessages, currentProfile, localReadIds])

  const unreadMessagesCount = useMemo(() => {
    if (!isAuthenticatedMember) return 0
    return inboxMessages.filter(
      (m) =>
        !m.read_at &&
        (m.is_broadcast ||
          (currentProfile && m.recipient_id === currentProfile.id) ||
          m.id === 'system-welcome-default'),
    ).length
  }, [isAuthenticatedMember, inboxMessages, currentProfile])

  const unacknowledgedWarnings = useMemo(() => {
    if (!isAuthenticatedMember) return []
    return inboxMessages.filter(
      (m) =>
        m.category === 'warning' &&
        m.requires_ack &&
        !m.acknowledged_at &&
        currentProfile && m.recipient_id === currentProfile.id,
    )
  }, [isAuthenticatedMember, inboxMessages, currentProfile])

  const activeAnnouncements = useMemo(
    () =>
      liveMessages.filter(
        (message) =>
          message.is_broadcast &&
          !dismissedBroadcastIds.includes(message.id) &&
          (!message.pinned_until || new Date(message.pinned_until).getTime() > Date.now()),
      ),
    [liveMessages, dismissedBroadcastIds],
  )

  // Actions: Mark Read / Acknowledge Warning / Dismiss Broadcast
  const markMessageRead = useCallback(
    async (messageId: string) => {
      setLocalReadIds((prev) => (prev.includes(messageId) ? prev : [...prev, messageId]))
      const now = new Date().toISOString()


      if (supabase && currentProfile && messageId !== 'system-welcome-default') {
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


      if (supabase && currentProfile && messageId !== 'system-welcome-default') {
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
      targetMember: ReviewerProfile
      action: MemberModerationAction
      nextRole?: UserRole
      reason?: string
      suspendDays?: number
    }): Promise<{ ok: boolean; error?: string }> => {
      const cleanReason = params.reason?.trim() || null

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
            'تعذر تطبيق الإجراء على سجل المنصة الرسمي. يرجى التواصل مع مسؤول النظام.',
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
      recipientId: string | null
      isBroadcast: boolean
      category: MemberMessageCategory
      title: string
      body: string
      requiresAck?: boolean
      pinDays?: number
    }): Promise<{ ok: boolean; error?: string }> => {
      const senderLabel =
        currentProfile?.role === 'admin'
          ? `الإدارة العامة (${currentProfile.display_name || 'مشرف'})`
          : currentProfile?.role === 'editor'
            ? `هيئة التحرير (${currentProfile.display_name || 'محرر'})`
            : 'إدارة المعجم'

      const pinnedUntil =
        params.isBroadcast && params.pinDays
          ? new Date(Date.now() + params.pinDays * 86_400_000).toISOString()
          : null



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
            'تعذر إرسال الرسالة عبر خدمة المراسلة في المنصة. حاول مجدداً لاحقاً.',
        }
      }

      await refreshMessages()
      return { ok: true }
    },
    [currentProfile, isAdmin, isEditor, refreshMessages],
  )

  const submitModerationReport = useCallback(
    async (params: {
      targetUserId: string
      targetDisplayName: string
      recommendedAction: 'warn' | 'suspend' | 'ban'
      reason: string
    }): Promise<{ ok: boolean; error?: string }> => {



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


  return {
    publicContributors,
    loadingDirectory,
    liveAdminMembers,
    loadingMembers,
    liveModEvents,
    liveModReports,
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
    refreshPublicDirectory,
    refreshAdminGovernance,
    refreshMessages,
  }
}
