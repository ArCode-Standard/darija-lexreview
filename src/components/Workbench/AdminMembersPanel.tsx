import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Award,
  Ban,
  CheckCircle2,
  Clock,
  Flag,
  Github,
  Megaphone,
  RefreshCcw,
  Search,
  Send,
  Shield,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import { isSupabaseConfigured } from '../../lib/supabase'
import { Avatar } from '../Avatar'
import type {
  AccountStatus,
  MemberMessageCategory,
  MemberModerationAction,
  MemberModerationEvent,
  MemberModerationReport,
  ReviewerProfile,
  UserRole,
} from '../../types/lexicon'
import { computeContributorBadges, getBadgeClasses } from '../../utils/meritBadges'

interface AdminMembersPanelProps {
  currentProfile: ReviewerProfile | null
  userEmail: string | null
  isAdmin: boolean
  isEditor: boolean
  liveMembers: ReviewerProfile[]
  loadingMembers: boolean
  liveModEvents: MemberModerationEvent[]
  liveModReports: MemberModerationReport[]
  onApplyGovernanceAction: (params: {
    targetMember: ReviewerProfile
    action: MemberModerationAction
    nextRole?: UserRole
    reason?: string
    suspendDays?: number
  }) => Promise<{ ok: boolean; error?: string }>
  onSendMessage: (params: {
    recipientId: string | null
    isBroadcast: boolean
    category: MemberMessageCategory
    title: string
    body: string
    requiresAck?: boolean
    pinDays?: number
  }) => Promise<{ ok: boolean; error?: string }>
  onSubmitReport: (params: {
    targetUserId: string
    targetDisplayName: string
    recommendedAction: 'warn' | 'suspend' | 'ban'
    reason: string
  }) => Promise<{ ok: boolean; error?: string }>
  onResolveReport: (params: {
    report: MemberModerationReport
    resolution: 'resolved' | 'dismissed'
    adminNote?: string
  }) => Promise<void>
  onOpenPublicDirectory: () => void
}

const ROLE_LABELS: Record<UserRole, string> = {
  reviewer: 'مراجع مساهم',
  editor: 'محرر معتمد',
  admin: 'مشرف عام',
}

const STATUS_META: Record<
  AccountStatus,
  { label: string; badgeClass: string }
> = {
  active: {
    label: 'نشط',
    badgeClass:
      'border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-950/35 dark:text-emerald-300',
  },
  warned: {
    label: 'منذَر',
    badgeClass:
      'border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300',
  },
  suspended: {
    label: 'مجمّد مؤقتاً',
    badgeClass:
      'border-orange-300/80 bg-orange-50 text-orange-900 dark:border-orange-500/40 dark:bg-orange-950/40 dark:text-orange-300',
  },
  banned: {
    label: 'مطرود / محظور',
    badgeClass:
      'border-red-300/80 bg-red-50 text-red-900 dark:border-red-500/45 dark:bg-red-950/40 dark:text-red-300',
  },
}

const MESSAGE_TEMPLATES: Array<{
  id: string
  label: string
  category: MemberMessageCategory
  requiresAck: boolean
  title: string
  body: string
}> = [
  {
    id: 'welcome',
    label: 'ترحيب بعضو جديد',
    category: 'welcome',
    requiresAck: false,
    title: 'مرحباً بك في مجتمع توثيق الدارجة المغربية',
    body: 'يسعدنا انضمامك إلى Darija LexReview. نتطلع لمساهماتك في توثيق مفردات وشواهد منطقتك اللهجية وفق المعايير العلمية المعتمدة.',
  },
  {
    id: 'appreciation',
    label: 'رسالة شكر وتقدير',
    category: 'appreciation',
    requiresAck: false,
    title: 'شكر وتقدير على جودة مساهماتك المعجمية',
    body: 'تتقدم هيئة التحرير بجزيل الشكر لدقة الشواهد السياقية والمقترحات التي أرسلتها مؤخراً، والتي أسهمت في إثراء المتن الرسمي.',
  },
  {
    id: 'editorial_note',
    label: 'توجيه تحريري لطيف',
    category: 'editorial_note',
    requiresAck: false,
    title: 'ملاحظة منهجية لتحسين توثيق الشواهد',
    body: 'نرجو عند اقتراح مفردة جديدة إرفاق جملة دارجة طبيعية مستعملة فعلياً في الحياة اليومية مع معناها الفصيح الدقيق لتسريع اعتمادها.',
  },
  {
    id: 'official_warning',
    label: 'إنذار رسمي (يلزم الإقرار)',
    category: 'warning',
    requiresAck: true,
    title: 'إنذار رسمي بخصوص الالتزام بضوابط المساهمة',
    body: 'لوحظ إرسال مدخلات غير مستوفية للضوابط العلمية أو تتضمن محتوى غير موثّق. يرجى الالتزام الصارم بمنهجية المعجم تجنباً لتجميد أو حظر الحساب.',
  },
]

type AdminTab = 'members' | 'reports' | 'broadcast' | 'audit'
type MemberFilter = 'all' | 'reviewers' | 'staff' | 'warned' | 'restricted'

export function AdminMembersPanel({
  currentProfile,
  isAdmin,
  isEditor,
  liveMembers,
  loadingMembers,
  liveModEvents,
  liveModReports,
  onApplyGovernanceAction,
  onSendMessage,
  onSubmitReport,
  onResolveReport,
  onOpenPublicDirectory,
}: AdminMembersPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('members')
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('all')
  const [query, setQuery] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Modal state for Warn / Suspend / Ban action with reason
  const [actionModal, setActionModal] = useState<{
    member: ReviewerProfile
    action: 'warn' | 'suspend' | 'ban'
  } | null>(null)
  const [actionReason, setActionReason] = useState('')
  const [suspendDays, setSuspendDays] = useState(7)

  // Modal state for Direct Message Composer
  const [messageModalMember, setMessageModalMember] = useState<ReviewerProfile | null>(null)
  const [msgCategory, setMsgCategory] = useState<MemberMessageCategory>('appreciation')
  const [msgTitle, setMsgTitle] = useState(MESSAGE_TEMPLATES[1].title)
  const [msgBody, setMsgBody] = useState(MESSAGE_TEMPLATES[1].body)
  const [msgRequiresAck, setMsgRequiresAck] = useState(false)

  // Editor Escalation Report Form state
  const [reportTargetId, setReportTargetId] = useState('')
  const [reportTargetName, setReportTargetName] = useState('')
  const [reportRecommended, setReportRecommended] = useState<'warn' | 'suspend' | 'ban'>('warn')
  const [reportReason, setReportReason] = useState('')

  // Global Broadcast Form state
  const [broadcastTitle, setBroadcastTitle] = useState('')
  const [broadcastBody, setBroadcastBody] = useState('')
  const [broadcastPinDays, setBroadcastPinDays] = useState(7)

  const effectiveIsAdmin = isAdmin

  const members = liveMembers
  const modEvents = liveModEvents
  const modReports = liveModReports

  const filteredMembers = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    return members.filter((m) => {
      const status = m.account_status ?? 'active'
      if (memberFilter === 'reviewers' && m.role !== 'reviewer') return false
      if (memberFilter === 'staff' && m.role === 'reviewer') return false
      if (memberFilter === 'warned' && status !== 'warned') return false
      if (memberFilter === 'restricted' && status !== 'suspended' && status !== 'banned') {
        return false
      }

      if (!trimmed) return true
      const haystack = [
        m.display_name ?? '',
        m.dialect_region ?? '',
        m.specialty ?? '',
        m.github_handle ?? '',
        ROLE_LABELS[m.role],
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(trimmed)
    })
  }, [members, memberFilter, query])

  const kpis = useMemo(() => {
    const staff = members.filter((m) => m.role !== 'reviewer').length
    const warned = members.filter((m) => m.account_status === 'warned').length
    const restricted = members.filter(
      (m) => m.account_status === 'suspended' || m.account_status === 'banned',
    ).length
    const openReports = modReports.filter((r) => r.status === 'open').length
    return {
      total: members.length,
      staff,
      warned,
      restricted,
      openReports,
    }
  }, [members, modReports])

  async function handleRoleChange(member: ReviewerProfile, nextRole: UserRole) {
    if (nextRole === member.role) return
    setBusyId(member.id)
    setFeedback(null)
    const action: MemberModerationAction =
      nextRole === 'admin' || (nextRole === 'editor' && member.role === 'reviewer')
        ? 'promote'
        : 'demote'
    const res = await onApplyGovernanceAction({
      targetMember: member,
      action,
      nextRole,
      reason: `تغيير الدور من «${ROLE_LABELS[member.role]}» إلى «${ROLE_LABELS[nextRole]}».`,
    })
    setBusyId(null)
    setFeedback(
      res.ok
        ? {
            type: 'ok',
            text: `تم تحديث صلاحية «${member.display_name || 'العضو'}» إلى ${ROLE_LABELS[nextRole]} وإرسال إشعار تلقائي له.`,
          }
        : { type: 'err', text: res.error ?? 'تعذر تحديث الدور.' },
    )
  }

  async function handleConfirmDisciplinaryAction() {
    if (!actionModal) return
    const trimmedReason = actionReason.trim()
    if (trimmedReason.length < 6) {
      setFeedback({ type: 'err', text: 'يرجى كتابة سبب واضح (6 أحرف على الأقل) لتوثيقه في السجل وإبلاغ العضو.' })
      return
    }
    setBusyId(actionModal.member.id)
    const res = await onApplyGovernanceAction({
      targetMember: actionModal.member,
      action: actionModal.action,
      reason: trimmedReason,
      suspendDays: actionModal.action === 'suspend' ? suspendDays : undefined,
    })
    setBusyId(null)
    setActionModal(null)
    setActionReason('')
    setFeedback(
      res.ok
        ? {
            type: 'ok',
            text:
              actionModal.action === 'ban'
                ? `تم طرد وحظر «${actionModal.member.display_name || 'العضو'}» نهائياً وإخفاؤه من لوحة المساهمين العامة.`
                : actionModal.action === 'suspend'
                  ? `تم تجميد حساب «${actionModal.member.display_name || 'العضو'}» لمدة ${suspendDays} أيام.`
                  : `تم توجيه إنذار رسمي إلى «${actionModal.member.display_name || 'العضو'}» مع إلزامه بالإقرار.`,
          }
        : { type: 'err', text: res.error ?? 'تعذر تنفيذ الإجراء.' },
    )
  }

  async function handleRestoreMember(member: ReviewerProfile) {
    setBusyId(member.id)
    const res = await onApplyGovernanceAction({
      targetMember: member,
      action: 'restore',
      reason: 'إعادة تفعيل الحساب بعد المراجعة الإدارية.',
    })
    setBusyId(null)
    setFeedback(
      res.ok
        ? { type: 'ok', text: `تمت إعادة تفعيل حساب «${member.display_name || 'العضو'}» بنجاح.` }
        : { type: 'err', text: res.error ?? 'تعذر إعادة التفعيل.' },
    )
  }

  async function handleConfirmSendMessage() {
    if (!messageModalMember) return
    if (msgTitle.trim().length < 3 || msgBody.trim().length < 6) {
      setFeedback({ type: 'err', text: 'يرجى استيفاء عنوان ونص الرسالة قبل الإرسال.' })
      return
    }
    setBusyId(messageModalMember.id)
    const res = await onSendMessage({
      recipientId: messageModalMember.id,
      isBroadcast: false,
      category: msgCategory,
      title: msgTitle,
      body: msgBody,
      requiresAck: msgCategory === 'warning' ? msgRequiresAck : false,
    })
    setBusyId(null)
    const targetName = messageModalMember.display_name || 'العضو'
    setMessageModalMember(null)
    setFeedback(
      res.ok
        ? { type: 'ok', text: `أُرسلت الرسالة إلى صندوق وارد «${targetName}» بنجاح.` }
        : { type: 'err', text: res.error ?? 'تعذر إرسال الرسالة.' },
    )
  }

  async function handlePublishBroadcast() {
    if (broadcastTitle.trim().length < 3 || broadcastBody.trim().length < 6) {
      setFeedback({ type: 'err', text: 'أدخل عنواناً ونصاً واضحين للإعلان العام.' })
      return
    }
    const res = await onSendMessage({
      recipientId: null,
      isBroadcast: true,
      category: 'announcement',
      title: broadcastTitle,
      body: broadcastBody,
      pinDays: broadcastPinDays,
    })
    if (res.ok) {
      setBroadcastTitle('')
      setBroadcastBody('')
      setFeedback({
        type: 'ok',
        text: 'تم نشر الإعلان العام وتثبيته في أعلى المنصة وصناديق رسائل الأعضاء.',
      })
    } else {
      setFeedback({ type: 'err', text: res.error ?? 'تعذر نشر الإعلان.' })
    }
  }

  async function handleEditorSubmitReport() {
    if (!reportTargetId.trim() || !reportTargetName.trim() || reportReason.trim().length < 10) {
      setFeedback({
        type: 'err',
        text: 'يرجى اختيار العضو المعني وكتابة سبب مفصّل لا يقل عن 10 أحرف لرفعه للمسؤول.',
      })
      return
    }
    const res = await onSubmitReport({
      targetUserId: reportTargetId,
      targetDisplayName: reportTargetName,
      recommendedAction: reportRecommended,
      reason: reportReason,
    })
    if (res.ok) {
      setReportTargetName('')
      setReportReason('')
      setFeedback({
        type: 'ok',
        text: 'تم رفع البلاغ بنجاح إلى قائمة مراجعة المسؤول العام.',
      })
    } else {
      setFeedback({ type: 'err', text: res.error ?? 'تعذر إرسال البلاغ.' })
    }
  }

  return (
    <section className="space-y-6" aria-labelledby="admin-members-heading">
      {/* Top Mode & Role Perspective Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#0B0B10]">
        <div className="flex flex-wrap items-center gap-2">
          {isSupabaseConfigured && (isAdmin || isEditor) && (
            <div
              role="group"
              aria-label="مصدر بيانات الحوكمة"
              className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-white/10 dark:bg-[#07070A]"
            >
              <span className="inline-flex min-h-[32px] items-center rounded-lg px-3 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">سجل الأعضاء المعتمد</span>
              
            </div>
          )}

          
        </div>

        <div className="flex flex-wrap items-center gap-2">
          

          <button
            type="button"
            onClick={onOpenPublicDirectory}
            className="inline-flex min-h-[34px] items-center gap-1 rounded-full border border-zinc-300 bg-white px-3.5 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60"
          >
            <span>لوحة المساهمين العامة</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>

          
        </div>
      </div>

      {feedback && (
        <div
          role={feedback.type === 'err' ? 'alert' : 'status'}
          className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs font-semibold ${
            feedback.type === 'ok'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-[#D9FF43]/40 dark:bg-[#0C0F06] dark:text-[#D9FF43]'
              : 'border-red-300 bg-red-50 text-red-900 dark:border-red-500/45 dark:bg-red-950/35 dark:text-red-300'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="cursor-pointer opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <h2 id="admin-members-heading" className="sr-only">
        إدارة الأعضاء والرتب والإنذارات
      </h2>

      {/* ADMIN FULL CONSOLE */}
      {effectiveIsAdmin ? (
        <>
          {/* Admin KPI Strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#0B0B10]">
              <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-zinc-500">
                TOTAL MEMBERS
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-zinc-950 dark:text-white">
                {kpis.total}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">إجمالي الأعضاء</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#0B0B10]">
              <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-zinc-500">
                STAFF ROLES
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-emerald-700 dark:text-[#D9FF43]">
                {kpis.staff}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">محررون ومشرفون</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#0B0B10]">
              <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-zinc-500">
                WARNED
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-amber-600 dark:text-amber-400">
                {kpis.warned}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">حسابات منذَرة</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#0B0B10]">
              <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-zinc-500">
                RESTRICTED / BANNED
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-red-600 dark:text-red-400">
                {kpis.restricted}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">مجمّدون ومطرودون</p>
            </div>
            <div className="col-span-2 sm:col-span-1 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#0B0B10]">
              <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-zinc-500">
                OPEN REPORTS
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-zinc-950 dark:text-white">
                {kpis.openReports}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">بلاغات المحررين</p>
            </div>
          </div>

          {/* Primary Admin Section Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-zinc-200 bg-white p-2 dark:border-white/10 dark:bg-[#0B0B10]">
            {(
              [
                { id: 'members', label: `سجل الأعضاء والرتب (${members.length})`, icon: Users },
                { id: 'reports', label: `بلاغات المحررين (${kpis.openReports})`, icon: Flag },
                { id: 'broadcast', label: 'نشر إعلان عام للمنصة', icon: Megaphone },
                { id: 'audit', label: `سجل القرارات الإدارية (${modEvents.length})`, icon: Shield },
              ] as const
            ).map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`inline-flex min-h-[38px] items-center gap-2 rounded-xl px-4 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    activeTab === t.id
                      ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/[0.05] dark:hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{t.label}</span>
                </button>
              )
            })}
          </div>

          {/* TAB 1: MEMBERS DIRECTORY & GOVERNANCE ACTIONS */}
          {activeTab === 'members' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#0B0B10]">
                <div className="relative min-w-[230px] flex-1">
                  <Search className="pointer-events-none absolute top-1/2 start-3.5 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-[#D9FF43]" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="ابحث عن عضو بالاسم، المنطقة، أو حساب GitHub..."
                    className="min-h-[40px] w-full rounded-xl border border-zinc-200 bg-zinc-50/80 ps-10 pe-3.5 text-xs sm:text-sm text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-white/10 dark:bg-[#07070A]">
                  {(
                    [
                      { id: 'all', label: 'الكل' },
                      { id: 'reviewers', label: 'المساهمون' },
                      { id: 'staff', label: 'المحررون والمشرفون' },
                      { id: 'warned', label: 'منذَرون' },
                      { id: 'restricted', label: 'مجمّدون ومطرودون' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setMemberFilter(f.id)}
                      className={`min-h-[30px] rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                        memberFilter === f.id
                          ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                          : 'text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {loadingMembers ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500 dark:border-white/10 dark:bg-[#0B0B10]">
                  جارٍ تحميل قائمة الأعضاء من قاعدة البيانات…
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500 dark:border-white/10 dark:bg-[#0B0B10]">
                  لا يوجد أعضاء ضمن الفلتر المحدد حالياً.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredMembers.map((member) => {
                    const status = member.account_status ?? 'active'
                    const statusMeta = STATUS_META[status]
                    const badges = computeContributorBadges({
                      role: member.role,
                      acceptedCount: member.accepted_count,
                      attestationsCount: member.attestations_count,
                      dialectRegion: member.dialect_region,
                      githubHandle: member.github_handle,
                    })
                    const isSelf = currentProfile?.id === member.id

                    return (
                      <article
                        key={member.id}
                        className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#0B0B10]"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="flex min-w-0 items-start gap-3">
                            <Avatar source={member.avatar_source} path={member.avatar_path} seed={member.avatar_seed || member.id} githubHandle={member.github_handle} displayName={member.display_name} size={44} />
                            <div className="space-y-2 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-display text-base font-bold text-zinc-950 dark:text-white">
                                  {member.display_name || 'عضو بدون اسم معلَن'}
                                </h3>
                              <span
                                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusMeta.badgeClass}`}
                              >
                                {statusMeta.label}
                              </span>
                              <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 dark:border-white/10 dark:bg-[#07070A] dark:text-zinc-300">
                                {ROLE_LABELS[member.role]}
                              </span>
                              {member.public_listed === false && (
                                <span className="rounded-md border border-zinc-200 px-2 py-0.5 text-[10px] text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                                  مخفي بطلب العضو من لوحة الشرف
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                              {member.dialect_region && <span>المنطقة: {member.dialect_region}</span>}
                              {member.specialty && <span>· {member.specialty}</span>}
                              {member.github_handle && (
                                <span className="inline-flex items-center gap-1 font-mono" dir="ltr">
                                  <Github className="h-3 w-3" /> @{member.github_handle}
                                </span>
                              )}
                              <span>
                                · مقبولة:{' '}
                                <strong className="font-mono text-zinc-900 dark:text-white">
                                  {member.accepted_count ?? 0}
                                </strong>
                              </span>
                            </div>

                            {badges.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {badges.map((b) => (
                                  <span
                                    key={b.id}
                                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${getBadgeClasses(b.tone)}`}
                                  >
                                    <Award className="h-2.5 w-2.5" />
                                    <span>{b.label}</span>
                                  </span>
                                ))}
                              </div>
                            )}

                            {member.status_reason && status !== 'active' && (
                              <p className="rounded-xl border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-xs text-zinc-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-zinc-300">
                                <strong>السبب المسجّل:</strong> {member.status_reason}
                              </p>
                            )}
                            </div>
                          </div>

                          {/* Governance Controls */}
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Role Selector (Promote / Demote) */}
                            <label className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs dark:border-white/12 dark:bg-[#07070A]">
                              <UserCheck className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
                              <span className="text-zinc-500 dark:text-zinc-400">الرتبة:</span>
                              <select
                                value={member.role}
                                disabled={busyId === member.id || isSelf}
                                onChange={(e) =>
                                  void handleRoleChange(member, e.target.value as UserRole)
                                }
                                className="bg-transparent font-bold text-zinc-950 focus:outline-none disabled:opacity-60 cursor-pointer dark:text-white"
                              >
                                <option value="reviewer" className="bg-white dark:bg-[#0B0B10]">
                                  مراجع مساهم
                                </option>
                                <option value="editor" className="bg-white dark:bg-[#0B0B10]">
                                  محرر معتمد (ترقية)
                                </option>
                                <option value="admin" className="bg-white dark:bg-[#0B0B10]">
                                  مشرف عام
                                </option>
                              </select>
                            </label>

                            {/* Direct Message Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setMessageModalMember(member)
                                setMsgCategory('appreciation')
                                setMsgTitle(MESSAGE_TEMPLATES[1].title)
                                setMsgBody(MESSAGE_TEMPLATES[1].body)
                                setMsgRequiresAck(false)
                              }}
                              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 cursor-pointer dark:border-white/12 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60"
                            >
                              <Send className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
                              <span>مراسلة</span>
                            </button>

                            {/* Disciplinary Actions: Warn / Suspend / Ban / Restore */}
                            {!isSelf && (
                              <>
                                {status === 'suspended' || status === 'banned' ? (
                                  <button
                                    type="button"
                                    disabled={busyId === member.id}
                                    onClick={() => void handleRestoreMember(member)}
                                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507]"
                                  >
                                    <RefreshCcw className="h-3.5 w-3.5" />
                                    <span>فك الحظر وتفعيل</span>
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActionModal({ member, action: 'warn' })
                                        setActionReason(
                                          'نرجو الالتزام بتوثيق الشواهد السياقية وتجنب الإرسال العشوائي.',
                                        )
                                      }}
                                      className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-300"
                                    >
                                      <AlertTriangle className="h-3.5 w-3.5" />
                                      <span>إنذار</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActionModal({ member, action: 'suspend' })
                                        setActionReason(
                                          'تجميد مؤقت لمخالفة ضوابط الإرسال المتكرر دون مصادر.',
                                        )
                                      }}
                                      className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-900 hover:bg-orange-100 cursor-pointer dark:border-orange-500/40 dark:bg-orange-950/30 dark:text-orange-300"
                                    >
                                      <Clock className="h-3.5 w-3.5" />
                                      <span>تجميد</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActionModal({ member, action: 'ban' })
                                        setActionReason('')
                                      }}
                                      className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-100 cursor-pointer dark:border-red-500/45 dark:bg-red-950/35 dark:text-red-300"
                                    >
                                      <Ban className="h-3.5 w-3.5" />
                                      <span>طرد وحظر</span>
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EDITOR ESCALATION REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-3">
              {modReports.length === 0 ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500 dark:border-white/10 dark:bg-[#0B0B10]">
                  لا توجد بلاغات مرفوعة من المحررين حالياً.
                </div>
              ) : (
                modReports.map((rep) => (
                  <div
                    key={rep.id}
                    className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#0B0B10]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/35 dark:text-amber-300">
                            توصية المحرر:{' '}
                            {rep.recommended_action === 'ban'
                              ? 'طرد نهائي'
                              : rep.recommended_action === 'suspend'
                                ? 'تجميد مؤقت'
                                : 'توجيه إنذار'}
                          </span>
                          <span className="text-xs text-zinc-500">
                            الحالة: {rep.status === 'open' ? 'قيد المراجعة' : rep.status === 'resolved' ? 'تم التنفيذ' : 'مغلق'}
                          </span>
                        </div>
                        <h3 className="mt-2 font-display text-base font-bold text-zinc-950 dark:text-white">
                          العضو المُبلَّغ عنه: {rep.target_display_name || rep.target_user_id}
                        </h3>
                        <p className="mt-1 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                          {rep.reason}
                        </p>
                      </div>

                      {rep.status === 'open' && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void onResolveReport({
                                report: rep,
                                resolution: 'resolved',
                                adminNote: 'تمت معالجة البلاغ من المسؤول العام.',
                              })
                            }
                            className="rounded-full bg-zinc-950 px-4 py-1.5 text-xs font-bold text-white cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507]"
                          >
                            اعتماد وإغلاق البلاغ
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void onResolveReport({
                                report: rep,
                                resolution: 'dismissed',
                              })
                            }
                            className="rounded-full border border-zinc-300 px-3.5 py-1.5 text-xs font-semibold text-zinc-600 cursor-pointer dark:border-white/15 dark:text-zinc-300"
                          >
                            حفظ دون إجراء
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: GLOBAL BROADCAST COMPOSER */}
          {activeTab === 'broadcast' && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-[#0B0B10]">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-[#D9FF43]">
                <Megaphone className="h-4 w-4" />
                <span className="font-mono text-[11px] tracking-[0.14em] uppercase">
                  PLATFORM ANNOUNCEMENT
                </span>
              </div>
              <h3 className="mt-1.5 font-display text-lg font-bold text-zinc-950 dark:text-white">
                نشر إعلان عام أو رسالة ترحيبية مثبتة لجميع الزوار والمساهمين
              </h3>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                يظهر الإعلان المثبت في الشريط العلوي للمنصة وفي تبويب «إعلانات عامة» داخل صندوق رسائل كل عضو.
              </p>

              <div className="mt-5 grid gap-4">
                <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
                  <label className="space-y-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    <span>عنوان الإعلان العام</span>
                    <input
                      value={broadcastTitle}
                      onChange={(e) => setBroadcastTitle(e.target.value)}
                      maxLength={140}
                      placeholder="مثال: انطلاق حملة توثيق مفردات الحِرف التقليدية المغربية"
                      className="min-h-[42px] w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-sm text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-white/12 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
                    />
                  </label>
                  <label className="space-y-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    <span>مدة التثبيت</span>
                    <select
                      value={broadcastPinDays}
                      onChange={(e) => setBroadcastPinDays(Number(e.target.value))}
                      className="min-h-[42px] w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-950 dark:border-white/12 dark:bg-[#07070A] dark:text-white"
                    >
                      <option value={3}>3 أيام</option>
                      <option value={7}>7 أيام</option>
                      <option value={14}>14 يوماً</option>
                      <option value={30}>30 يوماً</option>
                    </select>
                  </label>
                </div>

                <label className="space-y-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  <span>نص الإعلان</span>
                  <textarea
                    rows={3}
                    value={broadcastBody}
                    onChange={(e) => setBroadcastBody(e.target.value)}
                    maxLength={1500}
                    placeholder="اكتب تفاصيل الإعلان أو التوجيه العام للمجتمع..."
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-sm text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-white/12 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
                  />
                </label>

                <div>
                  <button
                    type="button"
                    onClick={() => void handlePublishBroadcast()}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-zinc-950 px-6 py-2 text-xs sm:text-sm font-bold text-white hover:bg-zinc-800 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
                  >
                    <Megaphone className="h-4 w-4" />
                    <span>نشر وتثبيت الإعلان الآن</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: IMMUTABLE MODERATION AUDIT LEDGER */}
          {activeTab === 'audit' && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#0B0B10]">
              <h3 className="font-display text-base font-bold text-zinc-950 dark:text-white">
                سجل تدقيق قرارات الترقية والإنذار والحظر
              </h3>
              {modEvents.length === 0 ? (
                <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                  لم تُسجّل قرارات إدارية بعد في هذا المصدر. جرّب ترقية أو إنذار أو حظر عضو لتوثيق العملية تلقائياً.
                </p>
              ) : (
                <div className="mt-4 divide-y divide-zinc-100 dark:divide-white/10">
                  {modEvents.map((ev) => (
                    <div key={ev.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-zinc-900 dark:text-white">
                          [{ev.action_type.toUpperCase()}]{' '}
                          {ev.target_display_name || ev.target_user_id}
                          {ev.new_role && ev.previous_role !== ev.new_role
                            ? ` — الدور: ${ROLE_LABELS[ev.previous_role ?? 'reviewer']} ← ${ROLE_LABELS[ev.new_role]}`
                            : ''}
                          {ev.new_status && ev.previous_status !== ev.new_status
                            ? ` — الحالة: ${STATUS_META[ev.new_status]?.label ?? ev.new_status}`
                            : ''}
                        </p>
                        {ev.reason && (
                          <p className="text-zinc-500 dark:text-zinc-400">السبب: {ev.reason}</p>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-zinc-400">
                        {new Date(ev.occurred_at).toLocaleString('ar-MA')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* EDITOR SCOPED VIEW (Respects RLS: No Raw Private Profile Leak, Allows Guidance & Escalation Reports) */
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-[#0B0B10]">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-[#D9FF43]">
              <ShieldCheck className="h-4 w-4" />
              <span className="font-mono text-[11px] tracking-[0.14em] uppercase">
                EDITOR ESCALATION REPORT
              </span>
            </div>
            <h3 className="mt-1.5 font-display text-lg font-bold text-zinc-950 dark:text-white">
              رفع طلب إنذار أو إيقاف عضو إلى المسؤول العام
            </h3>
            <p className="mt-1 text-xs leading-6 text-zinc-600 dark:text-zinc-400">
              احتراماً لسياسات الخصوصية (RLS)، تقتصر صلاحية الطرد النهائي وتغيير الرتب على المسؤول العام، بينما يمكن للمحرر المعتمد رفع بلاغ موثّق أو توجيه رسالة إرشادية.
            </p>

            <div className="mt-4 space-y-3.5">
              {isAdmin ? (
                <label className="block space-y-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  <span>اختر العضو المعني</span>
                  <select
                    value={reportTargetId}
                    onChange={(e) => {
                      const found = members.find((m) => m.id === e.target.value)
                      setReportTargetId(e.target.value)
                      if (found) setReportTargetName(found.display_name || found.id)
                    }}
                    className="min-h-[40px] w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs dark:border-white/12 dark:bg-[#07070A] dark:text-white"
                  >
                    <option value="">-- اختر عضواً --</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.display_name} ({ROLE_LABELS[m.role]})
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="block space-y-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  <span>معرّف حساب العضو المستهدف</span>
                  <input
                    value={reportTargetId}
                    onChange={(e) => setReportTargetId(e.target.value.trim())}
                    placeholder="أدخل UUID الخاص بحساب العضو"
                    className="min-h-[40px] w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-xs dark:border-white/12 dark:bg-[#07070A] dark:text-white"
                  />
                </label>
              )}

              <label className="block space-y-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <span>اسم المساهم أو معرّف المقترح المخالف</span>
                <input
                  value={reportTargetName}
                  onChange={(e) => setReportTargetName(e.target.value)}
                  placeholder="اسم العضو أو رقم المقترح..."
                  className="min-h-[40px] w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-xs dark:border-white/12 dark:bg-[#07070A] dark:text-white"
                />
              </label>

              <label className="block space-y-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <span>الإجراء المقترح على المسؤول</span>
                <select
                  value={reportRecommended}
                  onChange={(e) =>
                    setReportRecommended(e.target.value as 'warn' | 'suspend' | 'ban')
                  }
                  className="min-h-[40px] w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs dark:border-white/12 dark:bg-[#07070A] dark:text-white"
                >
                  <option value="warn">توجيه إنذار رسمي</option>
                  <option value="suspend">تجميد مؤقت للحساب</option>
                  <option value="ban">طرد وحظر نهائي</option>
                </select>
              </label>

              <label className="block space-y-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <span>تفاصيل المخالفة ومبررات البلاغ</span>
                <textarea
                  rows={3}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="اشرح سبب البلاغ بدقة ليتمكن المسؤول العام من اتخاذ القرار..."
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-white/12 dark:bg-[#07070A] dark:text-white"
                />
              </label>

              <button
                type="button"
                onClick={() => void handleEditorSubmitReport()}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-zinc-950 px-5 py-2 text-xs font-bold text-white cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507]"
              >
                <Flag className="h-3.5 w-3.5" />
                <span>رفع البلاغ للمسؤول العام</span>
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-[#0B0B10]">
            <h3 className="font-display text-base font-bold text-zinc-950 dark:text-white">
              بلاغاتي المرفوعة للإدارة ({modReports.length})
            </h3>
            {modReports.length === 0 ? (
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                لم ترفع أي بلاغات حتى الآن.
              </p>
            ) : (
              <div className="mt-4 space-y-2.5">
                {modReports.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-zinc-100 bg-zinc-50 p-3.5 text-xs dark:border-white/10 dark:bg-[#07070A]"
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-zinc-950 dark:text-white">
                        {r.target_display_name || r.target_user_id}
                      </strong>
                      <span className="font-mono text-[11px] text-emerald-700 dark:text-[#D9FF43]">
                        {r.status === 'open' ? 'قيد المراجعة' : 'تمت المعالجة'}
                      </span>
                    </div>
                    <p className="mt-1 text-zinc-600 dark:text-zinc-400">{r.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: Disciplinary Confirm (Warn / Suspend / Ban) */}
      {actionModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-white/15 dark:bg-[#0B0B10]">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-zinc-950 dark:text-white">
                {actionModal.action === 'ban'
                  ? `طرد وحظر «${actionModal.member.display_name || 'العضو'}» نهائياً`
                  : actionModal.action === 'suspend'
                    ? `تجميد حساب «${actionModal.member.display_name || 'العضو'}» مؤقتاً`
                    : `توجيه إنذار رسمي إلى «${actionModal.member.display_name || 'العضو'}»`}
              </h3>
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className="text-zinc-400 hover:text-zinc-900 cursor-pointer dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2 text-xs leading-6 text-zinc-600 dark:text-zinc-400">
              {actionModal.action === 'ban'
                ? 'سيُمنع هذا العضو فوراً على مستوى قاعدة البيانات (RLS) من إرسال أي مساهمة أو تصديق، وسيُخفى اسمه تلقائياً من لوحة المساهمين العامة.'
                : actionModal.action === 'suspend'
                  ? 'سيتم إيقاف صلاحية الإرسال مؤقتاً للمدة المحددة مع إشعار العضو بسبب التجميد.'
                  : 'سيصل للعضو إنذار رسمي يظهر في نافذة إلزامية تتطلب إقراره بالالتزام بضوابط المنصة.'}
            </p>

            {actionModal.action === 'suspend' && (
              <label className="mt-4 block space-y-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <span>مدة التجميد المؤقت</span>
                <select
                  value={suspendDays}
                  onChange={(e) => setSuspendDays(Number(e.target.value))}
                  className="min-h-[40px] w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs dark:border-white/12 dark:bg-[#07070A] dark:text-white"
                >
                  <option value={3}>3 أيام</option>
                  <option value={7}>7 أيام</option>
                  <option value={14}>14 يوماً</option>
                  <option value={30}>30 يوماً</option>
                </select>
              </label>
            )}

            <label className="mt-4 block space-y-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              <span>سبب القرار (يُحفظ في سجل الحوكمة ويُبلّغ للعضو)</span>
              <textarea
                rows={3}
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="اكتب السبب بوضوح..."
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-950 focus:outline-none dark:border-white/12 dark:bg-[#07070A] dark:text-white"
              />
            </label>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className="min-h-[38px] rounded-full border border-zinc-300 px-4 py-1.5 text-xs font-semibold text-zinc-700 cursor-pointer dark:border-white/15 dark:text-zinc-300"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDisciplinaryAction()}
                className={`min-h-[38px] rounded-full px-5 py-1.5 text-xs font-bold text-white cursor-pointer ${
                  actionModal.action === 'ban'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-zinc-950 hover:bg-zinc-800 dark:bg-[#D9FF43] dark:text-[#050507]'
                }`}
              >
                تأكيد القرار وإرسال الإشعار
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Direct Member Message Composer with Templates */}
      {messageModalMember && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-white/15 dark:bg-[#0B0B10]">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-zinc-950 dark:text-white">
                إرسال رسالة إلى «{messageModalMember.display_name || 'العضو'}»
              </h3>
              <button
                type="button"
                onClick={() => setMessageModalMember(null)}
                className="text-zinc-400 hover:text-zinc-900 cursor-pointer dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3">
              <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                قوالب جاهزة سريعة:
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {MESSAGE_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      setMsgCategory(tpl.category)
                      setMsgTitle(tpl.title)
                      setMsgBody(tpl.body)
                      setMsgRequiresAck(tpl.requiresAck)
                    }}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 hover:border-zinc-400 cursor-pointer dark:border-white/12 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block space-y-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <span>نوع الرسالة</span>
                <select
                  value={msgCategory}
                  onChange={(e) => {
                    const cat = e.target.value as MemberMessageCategory
                    setMsgCategory(cat)
                    if (cat === 'warning') setMsgRequiresAck(true)
                  }}
                  className="min-h-[40px] w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs dark:border-white/12 dark:bg-[#07070A] dark:text-white"
                >
                  <option value="welcome">رسالة ترحيب</option>
                  <option value="appreciation">شكر وتقدير</option>
                  <option value="editorial_note">ملاحظة تحريرية</option>
                  <option value="warning">إنذار رسمي</option>
                </select>
              </label>

              <label className="block space-y-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <span>عنوان الرسالة</span>
                <input
                  value={msgTitle}
                  onChange={(e) => setMsgTitle(e.target.value)}
                  maxLength={150}
                  className="min-h-[40px] w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-xs text-zinc-950 dark:border-white/12 dark:bg-[#07070A] dark:text-white"
                />
              </label>

              <label className="block space-y-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <span>محتوى الرسالة</span>
                <textarea
                  rows={4}
                  value={msgBody}
                  onChange={(e) => setMsgBody(e.target.value)}
                  maxLength={2000}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-950 dark:border-white/12 dark:bg-[#07070A] dark:text-white"
                />
              </label>

              {msgCategory === 'warning' && (
                <label className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                  <input
                    type="checkbox"
                    checked={msgRequiresAck}
                    onChange={(e) => setMsgRequiresAck(e.target.checked)}
                    className="h-4 w-4 rounded accent-amber-600"
                  />
                  <span>إلزام العضو بالضغط على «اطّلعت وألتزم» قبل متابعة التصفح</span>
                </label>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setMessageModalMember(null)}
                className="min-h-[38px] rounded-full border border-zinc-300 px-4 py-1.5 text-xs font-semibold text-zinc-700 cursor-pointer dark:border-white/15 dark:text-zinc-300"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmSendMessage()}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full bg-zinc-950 px-5 py-1.5 text-xs font-bold text-white cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507]"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>إرسال الرسالة الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
