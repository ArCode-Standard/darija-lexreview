import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  ExternalLink,
  UserCheck,
  Users,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { writeScannedContent } from '../../lib/contentGateway'
import type {
  PromotionRequestStatus,
  ReviewerProfile,
  RolePromotionRequest,
  SubmissionRecord,
  UserRole,
} from '../../types/lexicon'
import { sanitizeExternalUrl } from '../../utils/validation'
import { humanizeSystemError } from '../../utils/humanizeError'

interface RoleGovernancePanelProps {
  currentUserEmail: string | null
  currentUserProfile: ReviewerProfile | null
  submissions: SubmissionRecord[]
  onOpenAuth: () => void
}

function formatRoleBadgeText(role: UserRole): string {
  if (role === 'admin') return 'مشرف عام'
  if (role === 'editor') return 'محرر معتمد'
  return 'مراجع مساهم'
}

function formatPromotionStatusText(status: PromotionRequestStatus): string {
  if (status === 'approved') return 'معتمد — تمت الترقية'
  if (status === 'rejected') return 'مرفوض'
  return 'قيد مراجعة المشرف'
}

export function RoleGovernancePanel({
  currentUserEmail,
  currentUserProfile,
  submissions,
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
        'سجل طلبات الترقية غير متاح حالياً. يرجى مراجعة إعدادات خدمات المنصة قبل إعادة المحاولة.',
      )
      setLiveRequests([])
    } else {
      setLiveRequests((requestsRes.data ?? []) as RolePromotionRequest[])
    }
  }, [isLiveAdmin])

  useEffect(() => {
    setFeedback(null)
    if (isLiveAdmin) {
      fetchLiveGovernanceData()
    }
  }, [isLiveAdmin, fetchLiveGovernanceData])

  const activeProfiles = liveProfiles
  const activeRequests = liveRequests

  const submissionStatsByUser = useMemo(() => {
    const map = new Map<string, { total: number; accepted: number }>()
    for (const sub of submissions) {
      if (!sub.reviewer_id) continue
      const prev = map.get(sub.reviewer_id) ?? { total: 0, accepted: 0 }
      prev.total += 1
      if (sub.status === 'accepted' || sub.status === 'merged') prev.accepted += 1
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



    if (!supabase || !isLiveAdmin) return
    setBusyId(req.id)
    setFeedback(null)

    const { error } = await writeScannedContent('role_promotion_requests.decision', {
      id: req.id,
      decision,
      admin_note: note || null,
    })

    if (error) {
      setBusyId(null)
      setFeedback({
        type: 'error',
        text: humanizeSystemError(error, 'تعذر حفظ قرار الترقية بعد فحص الملاحظة والتحقق من الصلاحيات.'),
      })
      return
    }

    setBusyId(null)
    await fetchLiveGovernanceData()
    setFeedback({
      type: 'success',
      text:
        decision === 'approved'
          ? `تمت ترقية «${req.requester_name}» رسمياً إلى صلاحية محرر معتمد.`
          : `تم تسجيل قرار رفض طلب «${req.requester_name}».`,
    })
  }

  async function handleDirectRoleChange(member: ReviewerProfile, nextRole: 'reviewer' | 'editor') {
    if (member.role === 'admin') return



    if (!supabase || !isLiveAdmin) return
    setBusyId(member.id)
    setFeedback(null)

    const { error } = await writeScannedContent('reviewer_profiles.admin_update', {
      id: member.id,
      role: nextRole,
    })

    setBusyId(null)

    if (error) {
      setFeedback({
        type: 'error',
        text: humanizeSystemError(error, 'تعذر تعديل صلاحية العضو حالياً.'),
      })
      return
    }

    setLiveProfiles((prev) =>
      prev.map((p) => (p.id === member.id ? { ...p, role: nextRole } : p)),
    )
    setFeedback({
      type: 'success',
      text: `تم تحديث صلاحية «${member.display_name || 'العضو'}» إلى ${formatRoleBadgeText(nextRole)}.`,
    })
  }

  if (!isLiveAdmin) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 dark:border-white/10 dark:bg-[#0C0C10]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 max-w-[70ch]">
            <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <h4 className="font-display text-base font-bold text-zinc-950 dark:text-white">
                قسم إدارة الصلاحيات وطلبات الترقية مخصص للمشرف العام
              </h4>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                يبدأ كل مساهم بصلاحية «مراجع مساهم»، وتتم الترقية إلى «محرر معتمد» حصرياً بقرار موثق من المشرف العام للمنصة.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                يمكنك تقديم «طلب صلاحية محرر» من نافذة حسابك الشخصي. تتم مراجعة الطلبات وتغيير الصلاحيات حصرياً عبر السجل الرسمي وبواسطة المشرف العام.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!currentUserEmail && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="min-h-[38px] rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
              >
                تسجيل الدخول / إنشاء حساب
              </button>
            )}
            
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Governance Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#0C0C10]">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">طلبات ترقية معلقة</p>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
            {kpis.pendingReqs}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            بانتظار مراجعة المشرف
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#0C0C10]">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">المحررون المعتمدون</p>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-emerald-700 dark:text-[#D9FF43]">
            {kpis.editors}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            مخوّلون بالتحكيم والتصدير
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#0C0C10]">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">المراجعون المساهمون</p>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-zinc-950 dark:text-white">
            {kpis.reviewers}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            صلاحية اقتراح وتوثيق افتراضية
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#0C0C10]">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">المشرفون العامون</p>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-zinc-950 dark:text-white">
            {kpis.admins}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            إدارة الحوكمة والأدوار
          </p>
        </div>
      </div>

      {liveSchemaNotice && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-xs leading-relaxed text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/25 dark:text-amber-200">
          {liveSchemaNotice}
        </div>
      )}

      {feedback && (
        <div
          role="status"
          className={`flex items-start gap-2.5 rounded-2xl border p-4 text-xs leading-relaxed ${
            feedback.type === 'error'
              ? 'border-red-300 bg-red-50 text-red-900 dark:border-[#FF3B2F]/40 dark:bg-[#FF3B2F]/10 dark:text-red-200'
              : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-[#D9FF43]/35 dark:bg-[#D9FF43]/10 dark:text-zinc-100'
          }`}
        >
          {feedback.type === 'error' ? (
            <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-700 dark:text-[#FF3B2F]" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-700 dark:text-[#D9FF43]" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Section 1: Editor Promotion Requests */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 space-y-5 dark:border-white/10 dark:bg-[#0C0C10]">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-white/10">
          <div className="flex items-start gap-2.5">
            <UserCheck className="h-5 w-5 shrink-0 mt-0.5 text-emerald-700 dark:text-[#D9FF43]" />
            <div>
              <h4 className="font-display text-base font-bold text-zinc-950 dark:text-white">
                طلبات الترقية إلى «محرر معتمد» ({filteredRequests.length})
              </h4>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                راجع الخبرة اللغوية للمتقدمين واعتمد ترقيتهم مباشرة إلى صلاحية محرر معتمد.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-100 p-1 dark:border-white/12 dark:bg-[#07070A]">
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
                  className={`min-h-[30px] rounded-full px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    statusFilter === st
                      ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                      : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
                type="button"
                disabled={loadingLive}
                onClick={fetchLiveGovernanceData}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-50 px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-300 dark:hover:border-white/30"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingLive ? 'animate-spin' : ''}`} />
                <span>تحديث</span>
            </button>
          </div>
        </div>

        {loadingLive ? (
          <div className="py-10 text-center text-xs text-zinc-500">
            جارٍ جلب طلبات الترقية وسجل الأعضاء...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-10 text-center text-xs text-zinc-500 dark:text-zinc-400">
            لا توجد طلبات ترقية مطابقة لهذا الفلتر حالياً.
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-white/10">
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
                        <span className="font-display text-base font-bold text-zinc-950 dark:text-white">
                          {req.requester_name}
                        </span>
                        {req.dialect_region && (
                          <>
                            <span className="text-zinc-400" aria-hidden="true">·</span>
                            <span className="text-xs text-zinc-600 dark:text-zinc-400">
                              الرافد اللهجي: {req.dialect_region}
                            </span>
                          </>
                        )}
                        {userStats && (
                          <>
                            <span className="text-zinc-400" aria-hidden="true">·</span>
                            <span className="font-mono text-xs tabular-nums text-emerald-700 dark:text-[#D9FF43]">
                              {userStats.total} مساهمات ({userStats.accepted} معتمدة)
                            </span>
                          </>
                        )}
                      </div>
                      <p className="mt-1 font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                        تاريخ التقديم: {new Date(req.created_at).toLocaleString('ar-MA')}
                      </p>
                    </div>

                    <span
                      className={`text-xs font-semibold ${
                        req.status === 'approved'
                          ? 'text-emerald-700 dark:text-[#D9FF43]'
                          : req.status === 'rejected'
                            ? 'text-red-700 dark:text-[#FF3B2F]'
                            : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {formatPromotionStatusText(req.status)}
                    </span>
                  </div>

                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-xs leading-relaxed text-zinc-800 dark:border-white/10 dark:bg-[#07070A] dark:text-zinc-200">
                    <p className="font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                      نبذة الخبرة ومسوغات طلب الصلاحية:
                    </p>
                    <p>{req.experience_summary}</p>
                    {safeSampleUrl && (
                      <div className="mt-2.5 pt-2 border-t border-zinc-200 dark:border-white/10">
                        <a
                          href={safeSampleUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          dir="ltr"
                          className="inline-flex items-center gap-1.5 font-mono text-[11px] text-emerald-700 hover:underline dark:text-[#D9FF43]"
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
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
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
                          className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs text-zinc-950 focus:border-zinc-900 focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleAdjudicateRequest(req, 'approved')}
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 whitespace-nowrap cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          <span>اعتماد وترقية إلى محرر معتمد</span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleAdjudicateRequest(req, 'rejected')}
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-4 py-2 text-xs font-semibold text-red-900 hover:bg-red-100 disabled:opacity-50 whitespace-nowrap cursor-pointer dark:border-[#FF3B2F]/40 dark:bg-[#FF3B2F]/10 dark:text-[#FF3B2F] dark:hover:bg-[#FF3B2F]/20"
                        >
                          <XCircle className="h-4 w-4" />
                          <span>رفض الطلب</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    req.admin_note && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
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
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 space-y-4 dark:border-white/10 dark:bg-[#0C0C10]">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-white/10">
          <div className="flex items-start gap-2.5">
            <Users className="h-5 w-5 shrink-0 mt-0.5 text-emerald-700 dark:text-[#D9FF43]" />
            <div>
              <h4 className="font-display text-base font-bold text-zinc-950 dark:text-white">
                دليل المساهمين وإدارة الصلاحيات المباشرة ({filteredProfiles.length})
              </h4>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                ترقية المراجعين الموثوقين أو تعديل صلاحيات المحررين مباشرة ضمن ضوابط الحوكمة.
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-2.5 end-3 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="search"
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              placeholder="بحث بالاسم أو المنطقة أو الدور..."
              className="w-full rounded-full border border-zinc-300 bg-zinc-50 ps-3.5 pe-8 py-1.5 text-xs text-zinc-950 focus:border-zinc-900 focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                <th className="py-2.5 pe-3 font-semibold">العضو / اللقب العلمي</th>
                <th className="py-2.5 px-3 font-semibold">المنطقة والتخصص</th>
                <th className="py-2.5 px-3 font-semibold">حساب GitHub</th>
                <th className="py-2.5 px-3 font-semibold">الصلاحية الحالية</th>
                <th className="py-2.5 ps-3 font-semibold text-left">إجراء الحوكمة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-white/10">
              {filteredProfiles.map((member) => {
                const isBusy = busyId === member.id
                return (
                  <tr key={member.id}>
                    <td className="py-3 pe-3">
                      <div className="font-semibold text-zinc-950 dark:text-white">
                        {member.display_name || 'مساهم مسجل'}
                      </div>
                      <div
                        dir="ltr"
                        className="font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400"
                      >
                        {member.id.slice(0, 14)}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400">
                      <div>{member.dialect_region || '—'}</div>
                      {member.specialty && (
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-500">
                          {member.specialty}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {member.github_handle ? (
                        <span
                          dir="ltr"
                          className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300"
                        >
                          @{member.github_handle}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`font-semibold ${
                          member.role === 'admin'
                            ? 'text-amber-700 dark:text-amber-400'
                            : member.role === 'editor'
                              ? 'text-emerald-700 dark:text-[#D9FF43]'
                              : 'text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {formatRoleBadgeText(member.role)}
                      </span>
                    </td>
                    <td className="py-3 ps-3 text-left">
                      {member.role === 'admin' ? (
                        <span className="text-[11px] text-zinc-400">صلاحية مشرف محمية</span>
                      ) : member.role === 'reviewer' ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDirectRoleChange(member, 'editor')}
                          className="inline-flex min-h-[30px] items-center gap-1 rounded-full bg-zinc-950 px-3 py-1 text-[11px] font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 whitespace-nowrap cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
                        >
                          ترقية إلى محرر
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDirectRoleChange(member, 'reviewer')}
                          className="inline-flex min-h-[30px] items-center gap-1 rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 whitespace-nowrap cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-300 dark:hover:border-white/30"
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
