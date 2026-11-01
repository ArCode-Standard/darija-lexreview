import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  ExternalLink,
  RotateCcw,
  UserCheck,
  Users,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type {
  PromotionRequestStatus,
  ReviewerProfile,
  RolePromotionRequest,
  SubmissionRecord,
  UserRole,
} from '../../types/lexicon'
import { sanitizeExternalUrl } from '../../utils/validation'

interface RoleGovernancePanelProps {
  queueSource: 'live' | 'sandbox'
  currentUserEmail: string | null
  currentUserProfile: ReviewerProfile | null
  submissions: SubmissionRecord[]
  sandboxProfiles: ReviewerProfile[]
  sandboxPromotionRequests: RolePromotionRequest[]
  onSwitchQueueSource: (next: 'live' | 'sandbox') => void
  onReviewSandboxPromotion: (params: {
    requestId: string
    decision: Exclude<PromotionRequestStatus, 'pending'>
    adminNote: string | null
    adminId?: string
    adminName?: string
  }) => void
  onUpdateSandboxMemberRole: (userId: string, nextRole: UserRole) => void
  onResetSandboxGovernance: () => void
  onOpenAuth: () => void
}

function formatRoleBadgeText(role: UserRole): string {
  if (role === 'admin') return 'مشرف عام (admin)'
  if (role === 'editor') return 'محرر معتمد (editor)'
  return 'مراجع مساهم (reviewer)'
}

function formatPromotionStatusText(status: PromotionRequestStatus): string {
  if (status === 'approved') return 'معتمد — تمت الترقية'
  if (status === 'rejected') return 'مرفوض'
  return 'قيد مراجعة المشرف'
}

export function RoleGovernancePanel({
  queueSource,
  currentUserEmail,
  currentUserProfile,
  submissions,
  sandboxProfiles,
  sandboxPromotionRequests,
  onSwitchQueueSource,
  onReviewSandboxPromotion,
  onUpdateSandboxMemberRole,
  onResetSandboxGovernance,
  onOpenAuth,
}: RoleGovernancePanelProps) {
  const [liveRequests, setLiveRequests] = useState<RolePromotionRequest[]>([])
  const [liveProfiles, setLiveProfiles] = useState<ReviewerProfile[]>([])
  const [loadingLive, setLoadingLive] = useState(false)
  const [liveSchemaNotice, setLiveSchemaNotice] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<PromotionRequestStatus | 'all'>('pending')
  const [memberQuery, setMemberQuery] = useState('')
  const [adminNotesById, setAdminNotesById] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  )

  const isLiveAdmin = currentUserProfile?.role === 'admin'

  const fetchLiveGovernanceData = useCallback(async () => {
    if (!supabase || !isLiveAdmin) return
    setLoadingLive(true)
    setLiveSchemaNotice(null)

    const [profilesRes, requestsRes] = await Promise.all([
      supabase
        .from('reviewer_profiles')
        .select('id, display_name, dialect_region, specialty, github_handle, role, created_at')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('role_promotion_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
    ])

    setLoadingLive(false)

    if (profilesRes.error) {
      // Fallback to minimal columns if migration columns haven't been run yet
      const fallbackProfiles = await supabase
        .from('reviewer_profiles')
        .select('id, display_name, role, created_at')
        .order('created_at', { ascending: false })
        .limit(200)
      if (!fallbackProfiles.error && fallbackProfiles.data) {
        setLiveProfiles(fallbackProfiles.data as ReviewerProfile[])
      }
    } else {
      setLiveProfiles((profilesRes.data ?? []) as ReviewerProfile[])
    }

    if (requestsRes.error) {
      setLiveSchemaNotice(
        'جدول طلبات الترقية (role_promotion_requests) غير مفعل بعد في مشروع Supabase الحالي. شغّل ملف supabase/schema.sql المحدّث في محرر SQL لتفعيل السجل الحي، أو جرّب الدورة الكاملة فوراً في وضع المحاكاة.',
      )
      setLiveRequests([])
    } else {
      setLiveRequests((requestsRes.data ?? []) as RolePromotionRequest[])
    }
  }, [isLiveAdmin])

  useEffect(() => {
    setFeedback(null)
    if (queueSource === 'live' && isLiveAdmin) {
      fetchLiveGovernanceData()
    }
  }, [queueSource, isLiveAdmin, fetchLiveGovernanceData])

  const activeProfiles = queueSource === 'live' ? liveProfiles : sandboxProfiles
  const activeRequests = queueSource === 'live' ? liveRequests : sandboxPromotionRequests

  const submissionStatsByUser = useMemo(() => {
    const map = new Map<string, { total: number; accepted: number }>()
    for (const sub of submissions) {
      if (!sub.reviewer_id) continue
      const prev = map.get(sub.reviewer_id) ?? { total: 0, accepted: 0 }
      prev.total += 1
      if (sub.status === 'accepted') prev.accepted += 1
      map.set(sub.reviewer_id, prev)
    }
    return map
  }, [submissions])

  const filteredRequests = useMemo(() => {
    if (statusFilter === 'all') return activeRequests
    return activeRequests.filter((r) => r.status === statusFilter)
  }, [activeRequests, statusFilter])

  const filteredProfiles = useMemo(() => {
    const q = memberQuery.trim().toLowerCase()
    if (!q) return activeProfiles
    return activeProfiles.filter((p) => {
      const hay = [
        p.display_name ?? '',
        p.dialect_region ?? '',
        p.specialty ?? '',
        p.github_handle ?? '',
        p.role,
        p.id,
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [activeProfiles, memberQuery])

  const kpis = useMemo(() => {
    const pendingReqs = activeRequests.filter((r) => r.status === 'pending').length
    const editors = activeProfiles.filter((p) => p.role === 'editor').length
    const admins = activeProfiles.filter((p) => p.role === 'admin').length
    const reviewers = activeProfiles.filter((p) => p.role === 'reviewer').length
    return { pendingReqs, editors, admins, reviewers }
  }, [activeRequests, activeProfiles])

  async function handleAdjudicateRequest(
    req: RolePromotionRequest,
    decision: 'approved' | 'rejected',
  ) {
    const note = (adminNotesById[req.id] ?? '').trim()
    if (decision === 'rejected' && !note) {
      setFeedback({
        type: 'error',
        text: 'يلزم كتابة ملاحظة توضيحية من المشرف لبيان سبب رفض طلب الترقية.',
      })
      return
    }

    if (queueSource === 'sandbox') {
      onReviewSandboxPromotion({
        requestId: req.id,
        decision,
        adminNote: note || null,
        adminId: currentUserProfile?.id ?? 'usr-admin-01',
        adminName:
          currentUserProfile?.display_name?.trim() ||
          currentUserEmail ||
          'المشرف العام (محاكاة)',
      })
      setFeedback({
        type: 'success',
        text:
          decision === 'approved'
            ? `تمت الموافقة على طلب «${req.requester_name}» وترقية صلاحيته إلى محرر معتمد (editor) في بيئة المحاكاة.`
            : `تم رفض طلب الترقية المقدم من «${req.requester_name}» مع حفظ الملاحظة.`,
      })
      return
    }

    if (!supabase || !isLiveAdmin) return
    setBusyId(req.id)
    setFeedback(null)

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'review_role_promotion_request',
      {
        p_request_id: req.id,
        p_decision: decision,
        p_admin_note: note || null,
      },
    )

    if (rpcError) {
      // Fallback to sequential RLS updates if the custom RPC hasn't been created yet
      const { error: reqUpdateErr } = await supabase
        .from('role_promotion_requests')
        .update({
          status: decision,
          reviewed_by: currentUserProfile?.id ?? null,
          admin_note: note || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', req.id)

      if (reqUpdateErr) {
        setBusyId(null)
        setFeedback({
          type: 'error',
          text: `تعذر تحديث طلب الترقية: ${reqUpdateErr.message}`,
        })
        return
      }

      if (decision === 'approved') {
        const { error: roleErr } = await supabase
          .from('reviewer_profiles')
          .update({ role: 'editor' })
          .eq('id', req.requester_id)

        if (roleErr) {
          setBusyId(null)
          setFeedback({
            type: 'error',
            text: `تم تحديث حالة الطلب لكن تعذرت ترقية الدور: ${roleErr.message}`,
          })
          return
        }
      }
    } else if (rpcData) {
      // RPC succeeded atomically
    }

    setBusyId(null)
    await fetchLiveGovernanceData()
    setFeedback({
      type: 'success',
      text:
        decision === 'approved'
          ? `تمت ترقية «${req.requester_name}» رسمياً إلى صلاحية محرر معتمد (editor).`
          : `تم تسجيل قرار رفض طلب «${req.requester_name}».`,
    })
  }

  async function handleDirectRoleChange(member: ReviewerProfile, nextRole: 'reviewer' | 'editor') {
    if (member.role === 'admin') return

    if (queueSource === 'sandbox') {
      onUpdateSandboxMemberRole(member.id, nextRole)
      setFeedback({
        type: 'success',
        text: `تم تحديث صلاحية «${member.display_name || member.id}» إلى ${formatRoleBadgeText(nextRole)} في المحاكاة.`,
      })
      return
    }

    if (!supabase || !isLiveAdmin) return
    setBusyId(member.id)
    setFeedback(null)

    const { error } = await supabase
      .from('reviewer_profiles')
      .update({ role: nextRole })
      .eq('id', member.id)

    setBusyId(null)

    if (error) {
      setFeedback({
        type: 'error',
        text: `تعذر تعديل صلاحية العضو: ${error.message}`,
      })
      return
    }

    setLiveProfiles((prev) =>
      prev.map((p) => (p.id === member.id ? { ...p, role: nextRole } : p)),
    )
    setFeedback({
      type: 'success',
      text: `تم تحديث صلاحية «${member.display_name || member.id}» في قاعدة البيانات إلى ${formatRoleBadgeText(nextRole)}.`,
    })
  }

  if (queueSource === 'live' && !isLiveAdmin) {
    return (
      <div className="rounded-xl border border-[#E5DFD3] bg-white p-6 sm:p-8 dark:border-[#2E2B27] dark:bg-[#1C1A18]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 max-w-[70ch]">
            <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
            <div>
              <h4 className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
                قسم إدارة الصلاحيات وطلبات الترقية مخصص للمشرف العام (admin)
              </h4>
              <p className="mt-1.5 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
                تمنع سياسات أمان الصفوف (RLS) في قاعدة البيانات أي حساب من رفع صلاحيته ذاتياً؛ يبدأ كل مساهم بصلاحية{' '}
                <span className="font-mono font-semibold">reviewer</span>، وتتم الترقية إلى{' '}
                <span className="font-mono font-semibold">editor</span> حصرياً بقرار من حساب يحمل صلاحية{' '}
                <span className="font-mono font-semibold">admin</span>.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
                يمكنك تقديم «طلب صلاحية محرر» من نافذة حسابك الشخصي، أو التبديل إلى وضع المحاكاة لتجربة واجهة المشرف في مراجعة الطلبات وترقية الأعضاء مباشرة.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!currentUserEmail && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="min-h-[38px] rounded-lg bg-[#0F5C4E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B463B] cursor-pointer dark:bg-[#147A67]"
              >
                تسجيل الدخول / إنشاء حساب
              </button>
            )}
            <button
              type="button"
              onClick={() => onSwitchQueueSource('sandbox')}
              className="min-h-[38px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-4 py-2 text-xs font-semibold text-stone-800 hover:bg-[#EFECE4] cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-200"
            >
              معاينة لوحة المشرف في المحاكاة
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Governance Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[#E5DFD3] bg-white p-4 dark:border-[#2E2B27] dark:bg-[#1C1A18]">
          <p className="text-xs text-stone-500 dark:text-stone-400">طلبات ترقية معلقة</p>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-amber-800 dark:text-amber-400">
            {kpis.pendingReqs}
          </p>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
            بانتظار مراجعة المشرف
          </p>
        </div>

        <div className="rounded-xl border border-[#E5DFD3] bg-white p-4 dark:border-[#2E2B27] dark:bg-[#1C1A18]">
          <p className="text-xs text-stone-500 dark:text-stone-400">المحررون المعتمدون</p>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-[#0F5C4E] dark:text-[#4FD1C5]">
            {kpis.editors}
          </p>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
            مخوّلون بالتحكيم والتصدير
          </p>
        </div>

        <div className="rounded-xl border border-[#E5DFD3] bg-white p-4 dark:border-[#2E2B27] dark:bg-[#1C1A18]">
          <p className="text-xs text-stone-500 dark:text-stone-400">المراجعون المساهمون</p>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-stone-900 dark:text-stone-100">
            {kpis.reviewers}
          </p>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
            صلاحية اقتراح وتوثيق افتراضية
          </p>
        </div>

        <div className="rounded-xl border border-[#E5DFD3] bg-white p-4 dark:border-[#2E2B27] dark:bg-[#1C1A18]">
          <p className="text-xs text-stone-500 dark:text-stone-400">المشرفون العامون</p>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-stone-900 dark:text-stone-100">
            {kpis.admins}
          </p>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
            إدارة الحوكمة والأدوار
          </p>
        </div>
      </div>

      {liveSchemaNotice && queueSource === 'live' && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-xs leading-relaxed text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
          {liveSchemaNotice}
        </div>
      )}

      {feedback && (
        <div
          role="status"
          className={`flex items-start gap-2.5 rounded-xl border p-4 text-xs leading-relaxed ${
            feedback.type === 'error'
              ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-200'
              : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200'
          }`}
        >
          {feedback.type === 'error' ? (
            <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-700 dark:text-red-400" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-700 dark:text-emerald-400" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Section 1: Editor Promotion Requests */}
      <div className="rounded-xl border border-[#E5DFD3] bg-white p-5 sm:p-6 space-y-5 dark:border-[#2E2B27] dark:bg-[#1C1A18]">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E5DFD3] dark:border-[#2E2B27]">
          <div className="flex items-start gap-2.5">
            <UserCheck className="h-5 w-5 shrink-0 mt-0.5 text-[#0F5C4E] dark:text-[#4FD1C5]" />
            <div>
              <h4 className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
                طلبات الترقية إلى «محرر معتمد» ({filteredRequests.length})
              </h4>
              <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
                راجع الخبرة اللغوية للمتقدمين وترقيتهم مباشرة إلى صلاحية editor دون الحاجة لكتابة أوامر SQL يدوياً.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-lg bg-[#F3EFE6] p-1 dark:bg-[#141312]">
              {(
                [
                  ['pending', 'المعلقة'],
                  ['approved', 'المعتمدة'],
                  ['rejected', 'المرفوضة'],
                  ['all', 'الكل'],
                ] as const
              ).map(([st, label]) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`min-h-[32px] rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    statusFilter === st
                      ? 'bg-white text-stone-900 shadow-2xs dark:bg-[#2A2622] dark:text-stone-100'
                      : 'text-stone-600 hover:text-stone-900 dark:text-stone-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {queueSource === 'live' ? (
              <button
                type="button"
                disabled={loadingLive}
                onClick={fetchLiveGovernanceData}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-[#EFECE4] cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-300"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingLive ? 'animate-spin' : ''}`} />
                <span>تحديث</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onResetSandboxGovernance}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-[#EFECE4] cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-300"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>إعادة ضبط بيانات الحوكمة</span>
              </button>
            )}
          </div>
        </div>

        {loadingLive && queueSource === 'live' ? (
          <div className="py-10 text-center text-xs text-stone-500">
            جارٍ جلب طلبات الترقية وسجل الأعضاء...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-10 text-center text-xs text-stone-500 dark:text-stone-400">
            لا توجد طلبات ترقية مطابقة لهذا الفلتر حالياً.
          </div>
        ) : (
          <div className="divide-y divide-[#E5DFD3] dark:divide-[#2E2B27]">
            {filteredRequests.map((req) => {
              const safeSampleUrl = req.sample_links
                ? sanitizeExternalUrl(req.sample_links)
                : null
              const userStats = submissionStatsByUser.get(req.requester_id)
              const isBusy = busyId === req.id

              return (
                <div key={req.id} className="py-5 first:pt-1 last:pb-1 space-y-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
                          {req.requester_name}
                        </span>
                        {req.dialect_region && (
                          <>
                            <span className="text-stone-400" aria-hidden="true">·</span>
                            <span className="text-xs text-stone-600 dark:text-stone-400">
                              الرافد اللهجي: {req.dialect_region}
                            </span>
                          </>
                        )}
                        {userStats && (
                          <>
                            <span className="text-stone-400" aria-hidden="true">·</span>
                            <span className="font-mono text-xs tabular-nums text-[#0F5C4E] dark:text-[#4FD1C5]">
                              {userStats.total} مساهمات ({userStats.accepted} معتمدة)
                            </span>
                          </>
                        )}
                      </div>
                      <p className="mt-1 font-mono text-[11px] tabular-nums text-stone-500 dark:text-stone-400">
                        تاريخ التقديم: {new Date(req.created_at).toLocaleString('ar-MA')}
                      </p>
                    </div>

                    <span
                      className={`text-xs font-semibold ${
                        req.status === 'approved'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : req.status === 'rejected'
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-amber-800 dark:text-amber-400'
                      }`}
                    >
                      {formatPromotionStatusText(req.status)}
                    </span>
                  </div>

                  <div className="rounded-lg border border-[#E5DFD3] bg-[#FBF9F5] p-3.5 text-xs leading-relaxed text-stone-800 dark:border-[#2E2B27] dark:bg-[#141312] dark:text-stone-200">
                    <p className="font-semibold text-stone-600 dark:text-stone-400 mb-1">
                      نبذة الخبرة ومسوغات طلب الصلاحية:
                    </p>
                    <p>{req.experience_summary}</p>
                    {safeSampleUrl && (
                      <div className="mt-2.5 pt-2 border-t border-[#E5DFD3] dark:border-[#2E2B27]">
                        <a
                          href={safeSampleUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          dir="ltr"
                          className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#0F5C4E] hover:underline dark:text-[#4FD1C5]"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[340px]">{safeSampleUrl}</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {req.status === 'pending' ? (
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                          ملاحظة المشرف العام (إلزامية عند الرفض، اختيارية عند الترقية)
                        </label>
                        <input
                          type="text"
                          value={adminNotesById[req.id] ?? ''}
                          onChange={(e) =>
                            setAdminNotesById((prev) => ({
                              ...prev,
                              [req.id]: e.target.value,
                            }))
                          }
                          placeholder="مثال: خبرة موثقة في الضبط المعجمي والترجمة، يُعتمد محرراً..."
                          className="mt-1.5 w-full rounded-lg border border-[#D6CEBE] bg-white px-3.5 py-2 text-xs text-stone-900 focus:border-[#0F5C4E] focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleAdjudicateRequest(req, 'approved')}
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#0F5C4E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B463B] disabled:opacity-50 whitespace-nowrap cursor-pointer dark:bg-[#147A67]"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          <span>اعتماد وترقية إلى محرر (editor)</span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleAdjudicateRequest(req, 'rejected')}
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs font-semibold text-red-900 hover:bg-red-100 disabled:opacity-50 whitespace-nowrap cursor-pointer dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
                        >
                          <XCircle className="h-4 w-4" />
                          <span>رفض الطلب</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    req.admin_note && (
                      <p className="text-xs text-stone-600 dark:text-stone-400">
                        <strong className="font-semibold">قرار المشرف:</strong> {req.admin_note}
                      </p>
                    )
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Section 2: Direct Role Directory Management */}
      <div className="rounded-xl border border-[#E5DFD3] bg-white p-5 sm:p-6 space-y-4 dark:border-[#2E2B27] dark:bg-[#1C1A18]">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E5DFD3] dark:border-[#2E2B27]">
          <div className="flex items-start gap-2.5">
            <Users className="h-5 w-5 shrink-0 mt-0.5 text-[#0F5C4E] dark:text-[#4FD1C5]" />
            <div>
              <h4 className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
                دليل المساهمين وإدارة الصلاحيات المباشرة ({filteredProfiles.length})
              </h4>
              <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
                ترقية المراجعين الموثوقين أو تعديل صلاحيات المحررين مباشرة ضمن حدود أمان RBAC.
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-2.5 end-3 h-3.5 w-3.5 text-stone-400" />
            <input
              type="search"
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              placeholder="بحث بالاسم أو المنطقة أو الدور..."
              className="w-full rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] ps-3 pe-8 py-1.5 text-xs text-stone-900 focus:border-[#0F5C4E] focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-[#E5DFD3] text-stone-500 dark:border-[#2E2B27] dark:text-stone-400">
                <th className="py-2.5 pe-3 font-semibold">العضو / اللقب العلمي</th>
                <th className="py-2.5 px-3 font-semibold">المنطقة والتخصص</th>
                <th className="py-2.5 px-3 font-semibold">حساب GitHub</th>
                <th className="py-2.5 px-3 font-semibold">الصلاحية الحالية</th>
                <th className="py-2.5 ps-3 font-semibold text-left">إجراء الحوكمة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3] dark:divide-[#2E2B27]">
              {filteredProfiles.map((member) => {
                const isBusy = busyId === member.id
                return (
                  <tr key={member.id}>
                    <td className="py-3 pe-3">
                      <div className="font-semibold text-stone-900 dark:text-stone-100">
                        {member.display_name || 'مساهم مسجل'}
                      </div>
                      <div
                        dir="ltr"
                        className="font-mono text-[11px] tabular-nums text-stone-500 dark:text-stone-400"
                      >
                        {member.id.slice(0, 14)}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-stone-600 dark:text-stone-400">
                      <div>{member.dialect_region || '—'}</div>
                      {member.specialty && (
                        <div className="text-[11px] text-stone-500 dark:text-stone-500">
                          {member.specialty}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {member.github_handle ? (
                        <span
                          dir="ltr"
                          className="font-mono text-[11px] text-stone-700 dark:text-stone-300"
                        >
                          @{member.github_handle}
                        </span>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`font-semibold ${
                          member.role === 'admin'
                            ? 'text-amber-800 dark:text-amber-400'
                            : member.role === 'editor'
                              ? 'text-[#0F5C4E] dark:text-[#4FD1C5]'
                              : 'text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        {formatRoleBadgeText(member.role)}
                      </span>
                    </td>
                    <td className="py-3 ps-3 text-left">
                      {member.role === 'admin' ? (
                        <span className="text-[11px] text-stone-400">صلاحية مشرف محمية</span>
                      ) : member.role === 'reviewer' ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDirectRoleChange(member, 'editor')}
                          className="inline-flex min-h-[30px] items-center gap-1 rounded-md bg-[#0F5C4E] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#0B463B] disabled:opacity-50 whitespace-nowrap cursor-pointer dark:bg-[#147A67]"
                        >
                          ترقية إلى محرر
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDirectRoleChange(member, 'reviewer')}
                          className="inline-flex min-h-[30px] items-center gap-1 rounded-md border border-[#D6CEBE] bg-[#FBF9F5] px-2.5 py-1 text-[11px] font-semibold text-stone-700 hover:bg-[#EFECE4] disabled:opacity-50 whitespace-nowrap cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-300"
                        >
                          إرجاع إلى مراجع
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
