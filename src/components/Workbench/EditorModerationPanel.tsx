import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Edit3,
  ArrowLeft,
  ShieldAlert,
  RotateCcw,
  CheckSquare,
  GitBranch,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type {
  EntryAttestationSummary,
  LexicalEntry,
  PromotionRequestStatus,
  ProposedFields,
  ReviewDecisionEvent,
  ReviewerProfile,
  RolePromotionRequest,
  SubmissionRecord,
  SubmissionStatus,
  UserRole,
} from '../../types/lexicon'
import { formatAccessionCode, formatStatusLabel } from '../../services/dataset'
import { isNewEntrySubmission } from '../../services/exporter'
import { findSimilarCorpusEntries, sanitizeExternalUrl } from '../../utils/validation'
import { checkSubmissionCorpusDrift } from '../../utils/corpusPinning'
import { humanizeSystemError } from '../../utils/humanizeError'
import { ModerationAnalyticsDashboard } from './ModerationAnalyticsDashboard'
import { BulkApprovalModal } from './BulkApprovalModal'
import { RoleGovernancePanel } from './RoleGovernancePanel'
import { DecisionAuditTimeline } from './DecisionAuditTimeline'

interface EditorModerationPanelProps {
  entries: LexicalEntry[]
  categories: string[]
  corpusVersion: string
  userEmail: string | null
  profile: ReviewerProfile | null
  sandboxItems: SubmissionRecord[]
  sandboxEvents: ReviewDecisionEvent[]
  sandboxProfiles: ReviewerProfile[]
  sandboxPromotionRequests: RolePromotionRequest[]
  attestationSummaries: Record<string, EntryAttestationSummary>
  forceSandboxMode?: boolean
  forceGovernanceSection?: boolean
  onClearForceGovernanceSection?: () => void
  onModerateSandbox: (params: {
    id: string
    status: SubmissionStatus
    editorNote: string | null
    proposedData: ProposedFields
    editorId?: string
    editorDisplayName?: string
  }) => void
  onBulkApproveSandbox: (params: {
    ids: string[]
    editorNote: string
    editorId?: string
    editorDisplayName?: string
  }) => void
  onResetSandbox: () => void
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
  onGoToExporter: (source: 'live' | 'sandbox') => void
}

const DIFF_FIELDS: Array<{
  key: keyof ProposedFields
  label: string
  entryProp?: keyof LexicalEntry
  dir?: 'ltr' | 'rtl'
}> = [
  { key: 'word_ar', label: 'الكتابة بالدارجة (عربي)', entryProp: 'word' },
  { key: 'arabizi', label: 'الكتابة اللاتينية (Arabizi)', entryProp: 'latin', dir: 'ltr' },
  { key: 'category', label: 'الفئة المعجمية', entryProp: 'category' },
  { key: 'msa_translation', label: 'المقابل بالعربية الفصحى', entryProp: 'meaning' },
  { key: 'meaning', label: 'الشرح الدلالي البديل', entryProp: 'meaning' },
  { key: 'french_translation', label: 'المقابل الفرنسي', entryProp: 'french', dir: 'ltr' },
  { key: 'usage_note', label: 'ملاحظة التداول / المصدر' },
  { key: 'example_darija', label: 'الشاهد السياقي (دارجة)' },
  { key: 'example_arabizi', label: 'الكتابة اللاتينية للشاهد (Arabizi)', dir: 'ltr' },
  { key: 'example_translation', label: 'ترجمة الشاهد (فصحى)' },
  { key: 'example_french', label: 'ترجمة الشاهد (فرنسية)', dir: 'ltr' },
]

export function EditorModerationPanel({
  entries,
  categories,
  corpusVersion,
  userEmail,
  profile,
  sandboxItems,
  sandboxEvents,
  sandboxProfiles,
  sandboxPromotionRequests,
  attestationSummaries,
  forceSandboxMode,
  forceGovernanceSection,
  onClearForceGovernanceSection,
  onModerateSandbox,
  onBulkApproveSandbox,
  onResetSandbox,
  onReviewSandboxPromotion,
  onUpdateSandboxMemberRole,
  onResetSandboxGovernance,
  onOpenAuth,
  onGoToExporter,
}: EditorModerationPanelProps) {
  const isAuthorizedLiveEditor =
    Boolean(userEmail) && (profile?.role === 'editor' || profile?.role === 'admin')

  const [queueSource, setQueueSource] = useState<'live' | 'sandbox'>('live')
  const [moderationSection, setModerationSection] = useState<'adjudication' | 'governance'>(
    () => (forceGovernanceSection ? 'governance' : 'adjudication'),
  )

  useEffect(() => { setQueueSource('live') }, [forceSandboxMode, isAuthorizedLiveEditor])

  useEffect(() => {
    if (forceGovernanceSection) {
      setModerationSection('governance')
      onClearForceGovernanceSection?.()
    }
  }, [forceGovernanceSection, onClearForceGovernanceSection])

  const [liveItems, setLiveItems] = useState<SubmissionRecord[]>([])
  const [editorNamesMap, setEditorNamesMap] = useState<Record<string, string>>({})
  const [loadingLive, setLoadingLive] = useState(false)
  const [liveError, setLiveError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<'all' | SubmissionStatus>('pending')
  const [kindFilter, setKindFilter] = useState<'all' | 'edit' | 'new'>('all')
  const [crowdSignalFilter, setCrowdSignalFilter] = useState<'all' | 'flagged' | 'verified'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string>('')

  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set())
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)

  const [editMode, setEditMode] = useState(false)
  const [editableProposed, setEditableProposed] = useState<ProposedFields>({})
  const [editorNote, setEditorNote] = useState('')
  const [savingDecision, setSavingDecision] = useState(false)
  const [auditRefreshCounter, setAuditRefreshCounter] = useState(0)
  const [actionMessage, setActionMessage] = useState<{
    type: 'error' | 'success'
    text: string
  } | null>(null)

  const fetchLiveQueue = useCallback(async () => {
    if (!supabase || !isAuthorizedLiveEditor) {
      setLiveItems([])
      return
    }
    setLoadingLive(true)
    setLiveError(null)
    const [subsRes, staffRpcRes] = await Promise.all([
      supabase
        .from('review_submissions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.rpc('list_staff_display_names'),
    ])

    let staffRows = staffRpcRes.data as Array<{ id: string; display_name: string | null }> | null
    if (staffRpcRes.error) {
      // Fallback if migration 20261101132000 has not been applied yet
      const fallbackRes = await supabase
        .from('reviewer_profiles')
        .select('id, display_name, role')
      staffRows = (fallbackRes.data as Array<{ id: string; display_name: string | null }> | null) ?? null
    }

    setLoadingLive(false)
    if (subsRes.error) {
      setLiveError(humanizeSystemError(subsRes.error, 'تعذر جلب طابور التحكيم الحي حالياً.'))
      return
    }
    if (Array.isArray(staffRows)) {
      const nameMap: Record<string, string> = {}
      for (const row of staffRows) {
        if (row.id && row.display_name?.trim()) {
          nameMap[row.id] = row.display_name.trim()
        }
      }
      setEditorNamesMap(nameMap)
    }
    setLiveItems((subsRes.data ?? []) as SubmissionRecord[])
  }, [isAuthorizedLiveEditor])

  useEffect(() => {
    setSelectedBatchIds(new Set())
    setBulkModalOpen(false)
    setBulkError(null)
    if (queueSource === 'live') {
      fetchLiveQueue()
    }
  }, [queueSource, fetchLiveQueue])

  const activePool = liveItems

  const entryById = useMemo(() => {
    const map = new Map<string, LexicalEntry>()
    for (const e of entries) map.set(e.id, e)
    return map
  }, [entries])

  const filteredQueue = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return activePool.filter((sub) => {
      if (statusFilter !== 'all' && sub.status !== statusFilter) return false
      const isNew = isNewEntrySubmission(sub)
      if (kindFilter === 'new' && !isNew) return false
      if (kindFilter === 'edit' && isNew) return false

      const att = attestationSummaries[sub.entry_id]
      if (crowdSignalFilter === 'flagged' && (att?.flaggedCount ?? 0) === 0) return false
      if (crowdSignalFilter === 'verified' && (att?.accurateCount ?? 0) === 0) return false

      if (!q) return true

      const targetEntry = entryById.get(sub.entry_id)
      const haystack = [
        sub.id,
        sub.entry_id,
        targetEntry?.word ?? '',
        targetEntry?.latin ?? '',
        sub.proposed_data?.word_ar ?? '',
        sub.proposed_data?.arabizi ?? '',
        sub.reviewer_note ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [activePool, statusFilter, kindFilter, crowdSignalFilter, attestationSummaries, searchQuery, entryById])

  const activeSubmission = useMemo(() => {
    return (
      filteredQueue.find((s) => s.id === selectedId) ??
      activePool.find((s) => s.id === selectedId) ??
      filteredQueue[0] ??
      null
    )
  }, [filteredQueue, activePool, selectedId])

  useEffect(() => {
    if (activeSubmission) {
      setEditableProposed({ ...activeSubmission.proposed_data })
      setEditorNote(activeSubmission.editor_note ?? '')
      setEditMode(false)
      setActionMessage(null)
    }
  }, [activeSubmission?.id])

  // Pre-flight audit checks on the currently selected submission
  const submissionWarnings = useMemo(() => {
    if (!activeSubmission) return []
    const warnings: string[] = []
    const p = editableProposed
    const isNew = isNewEntrySubmission(activeSubmission)

    if (isNew) {
      const matches = findSimilarCorpusEntries(
        entries,
        p.word_ar ?? '',
        p.arabizi ?? '',
      )
      if (matches.length > 0) {
        warnings.push(
          `تنبيه تكرار: المفردة المقترحة تتطابق إملائياً مع مدخل قائم في المعجم (${formatAccessionCode(matches[0].id, matches[0].numericId)} — ${matches[0].word}).`,
        )
      }
      if (
        !p.word_ar?.trim() ||
        !p.arabizi?.trim() ||
        !p.category?.trim() ||
        !(p.msa_translation?.trim() || p.meaning?.trim()) ||
        !p.french_translation?.trim()
      ) {
        warnings.push(
          'نقص إلزامي: أحد الحقول الخمسة المطلوبة في المعجم فارغ؛ فعّل «تهذيب الحقول» لاستكماله قبل الاعتماد.',
        )
      }
    } else {
      const otherAcceptedSameEntry = activePool.filter(
        (other) =>
          other.id !== activeSubmission.id &&
          other.status === 'accepted' &&
          other.entry_id === activeSubmission.entry_id,
      )
      if (otherAcceptedSameEntry.length > 0) {
        warnings.push(
          `تعارض تصدير: يوجد مقترح آخر معتمد مسبقاً لنفس المدخل (${formatAccessionCode(activeSubmission.entry_id, null)}). المقترحات المتعارضة على المدخل نفسه تُوقف من التصدير حتى تسويتها.`,
        )
      }
    }

    if (p.example_darija?.trim() && !p.example_arabizi?.trim()) {
      warnings.push(
        'تنبيه شاهد سياقي: حقل الجملة بالدارجة مملوء دون كتابته بـ Arabizi؛ أضف الكتابة اللاتينية للشاهد ليُدرج ضمن ملف الشواهد.',
      )
    }

    return warnings
  }, [activeSubmission, editableProposed, entries, activePool])

  const acceptedCountInSource = useMemo(
    () => activePool.filter((s) => s.status === 'accepted' && !s.exported_in_version).length,
    [activePool],
  )

  async function handleDecision(nextStatus: SubmissionStatus) {
    if (!activeSubmission || activeSubmission.status === 'merged') return

    const isRevokingAccepted =
      activeSubmission.status === 'accepted' &&
      (nextStatus === 'needs_changes' || nextStatus === 'rejected')

    if (isRevokingAccepted && editorNote.trim().length < 10) {
      setActionMessage({
        type: 'error',
        text: 'يتطلب سحب الاعتماد وإعادة فتح المقترح مذكرة تعليل تحكيمية لا تقل عن 10 أحرف لتوثيقها في سجل التدقيق.',
      })
      return
    }

    if (
      (nextStatus === 'rejected' || nextStatus === 'needs_changes') &&
      !editorNote.trim()
    ) {
      setActionMessage({
        type: 'error',
        text: 'يلزم كتابة مذكرة المحرر التحكيمية لتوضيح سبب الرفض أو التعديلات المطلوبة للمساهم.',
      })
      return
    }

    if (nextStatus === 'accepted' && isNewEntrySubmission(activeSubmission)) {
      const p = editableProposed
      if (
        !p.word_ar?.trim() ||
        !p.arabizi?.trim() ||
        !p.category?.trim() ||
        !(p.msa_translation?.trim() || p.meaning?.trim()) ||
        !p.french_translation?.trim()
      ) {
        setActionMessage({
          type: 'error',
          text: 'لا يمكن اعتماد مفردة جديدة قبل استكمال الحقول الخمسة الإلزامية (الدارجة، Arabizi، الفئة، الفصحى، الفرنسية). استخدم «تهذيب الحقول» أولاً.',
        })
        return
      }
    }

    if (false) {
      onModerateSandbox({
        id: activeSubmission.id,
        status: nextStatus,
        editorNote: editorNote.trim() || null,
        proposedData: editableProposed,
        editorId: profile?.id ?? 'ed-session',
        editorDisplayName:
          profile?.display_name?.trim() || userEmail || 'المحرر الحالي (جلسة محاكاة)',
      })
      setEditMode(false)
      setAuditRefreshCounter((c) => c + 1)
      setActionMessage({
        type: 'success',
        text: isRevokingAccepted
          ? `تم سحب الاعتماد وتحويل الحالة إلى «${formatStatusLabel(nextStatus)}» مع تسجيل الحدث في سجل التدقيق.`
          : `تم تحديث قرار المحاكاة إلى «${formatStatusLabel(nextStatus)}».`,
      })
      return
    }

    if (!supabase || !isAuthorizedLiveEditor) {
      setActionMessage({
        type: 'error',
        text: 'ليست لديك صلاحية محرر (editor/admin) لتحديث سجل المنصة الرسمي.',
      })
      return
    }

    if (profile?.id && activeSubmission.reviewer_id === profile.id) {
      setActionMessage({
        type: 'error',
        text: 'لا يُسمح للمحرر بمراجعة مقترحه الشخصي بموجب قواعد الحوكمة.',
      })
      return
    }

    const validOriginStatus =
      activeSubmission.status === 'pending' ||
      activeSubmission.status === 'needs_changes' ||
      isRevokingAccepted

    if (!validOriginStatus || activeSubmission.status === nextStatus) {
      setActionMessage({
        type: 'error',
        text: `لا يُسمح بالانتقال من حالة «${formatStatusLabel(activeSubmission.status)}» إلى «${formatStatusLabel(nextStatus)}» في السجل الحي.`,
      })
      return
    }

    setSavingDecision(true)
    setActionMessage(null)

    // Update strictly decision columns (status, editor_note); editor_id and audit event are stamped by DB trigger
    const { data, error } = await supabase
      .from('review_submissions')
      .update({
        status: nextStatus,
        editor_note: editorNote.trim() || null,
      })
      .eq('id', activeSubmission.id)
      .select()

    setSavingDecision(false)

    if (error) {
      setActionMessage({
        type: 'error',
        text: humanizeSystemError(error, 'تعذر حفظ القرار التحريري حالياً.'),
      })
      return
    }
    if (!data || data.length === 0) {
      setActionMessage({
        type: 'error',
        text: 'لم يُسمح بتحديث السجل. تحقق من امتلاكك صلاحية محرر معتمد وعدم كون المقترح مرسلاً من حسابك الشخصي.',
      })
      return
    }

    setLiveItems((prev) =>
      prev.map((item) => (item.id === activeSubmission.id ? (data[0] as SubmissionRecord) : item)),
    )
    setSelectedBatchIds((prev) => {
      if (!prev.has(activeSubmission.id)) return prev
      const next = new Set(prev)
      next.delete(activeSubmission.id)
      return next
    })
    setEditMode(false)
    setAuditRefreshCounter((c) => c + 1)
    setActionMessage({
      type: 'success',
      text: isRevokingAccepted
        ? `تم سحب الاعتماد وتحويل المقترح إلى «${formatStatusLabel(nextStatus)}» وتوثيق التعليل في سجل التدقيق.`
        : `تم تسجيل القرار التحريري «${formatStatusLabel(nextStatus)}» في سجل القرارات المستقل.`,
    })
  }

  const selectableFilteredIds = useMemo(
    () =>
      filteredQueue
        .filter((item) => {
          if (item.status === 'accepted' || item.status === 'merged') return false
          if (queueSource === 'live') {
            if (item.status !== 'pending' && item.status !== 'needs_changes') return false
            if (profile?.id && item.reviewer_id === profile.id) return false
          }
          return true
        })
        .map((item) => item.id),
    [filteredQueue, queueSource, profile?.id],
  )

  const allSelectableChecked =
    selectableFilteredIds.length > 0 &&
    selectableFilteredIds.every((id) => selectedBatchIds.has(id))

  const selectedBatchSubmissions = useMemo(
    () => activePool.filter((item) => selectedBatchIds.has(item.id)),
    [activePool, selectedBatchIds],
  )

  function toggleBatchItem(id: string) {
    setSelectedBatchIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleToggleSelectAllVisible() {
    setSelectedBatchIds((prev) => {
      const next = new Set(prev)
      if (allSelectableChecked) {
        for (const id of selectableFilteredIds) next.delete(id)
      } else {
        for (const id of selectableFilteredIds) next.add(id)
      }
      return next
    })
  }

  async function handleConfirmBulkApprove({
    eligibleIds,
    justificationComment,
  }: {
    eligibleIds: string[]
    justificationComment: string
  }) {
    if (eligibleIds.length === 0) return

    if (false) {
      onBulkApproveSandbox({
        ids: eligibleIds,
        editorNote: justificationComment,
        editorId: profile?.id ?? 'ed-session',
        editorDisplayName:
          profile?.display_name?.trim() || userEmail || 'المحرر الحالي (جلسة محاكاة)',
      })
      if (activeSubmission && eligibleIds.includes(activeSubmission.id)) {
        setEditorNote(justificationComment)
      }
      setSelectedBatchIds(new Set())
      setBulkModalOpen(false)
      setActionMessage({
        type: 'success',
        text: `تم توقيع واعتماد دفعة مكونة من ${eligibleIds.length} مقترحات بنجاح في بيئة المحاكاة.`,
      })
      return
    }

    if (!supabase || !isAuthorizedLiveEditor) {
      setBulkError('ليست لديك صلاحية محرر (editor/admin) لتنفيذ اعتماد جماعي في سجل المنصة الرسمي.')
      return
    }

    setBulkBusy(true)
    setBulkError(null)

    // Update strictly decision columns (status, editor_note) per DB governance policy
    const { data, error } = await supabase
      .from('review_submissions')
      .update({
        status: 'accepted',
        editor_note: justificationComment,
      })
      .in('id', eligibleIds)
      .select()

    setBulkBusy(false)

    if (error) {
      setBulkError(humanizeSystemError(error, 'تعذر تنفيذ الاعتماد الجماعي حالياً.'))
      return
    }

    if (!data || data.length === 0) {
      setBulkError('لم يُسمح بتحديث السجلات المحددة وفق ضوابط الصلاحيات التحريرية.')
      return
    }

    const updatedMap = new Map<string, SubmissionRecord>()
    for (const row of data as SubmissionRecord[]) {
      updatedMap.set(row.id, row)
    }

    setLiveItems((prev) => prev.map((item) => updatedMap.get(item.id) ?? item))
    if (activeSubmission && updatedMap.has(activeSubmission.id)) {
      setEditorNote(justificationComment)
    }
    setSelectedBatchIds(new Set())
    setBulkModalOpen(false)
    setActionMessage({
      type: 'success',
      text: `تم توقيع واعتماد ${updatedMap.size} مقترحات جماعياً في السجل الحي.`,
    })
  }

  const targetCanonicalEntry = activeSubmission
    ? entryById.get(activeSubmission.entry_id)
    : undefined

  const corpusDriftReport = useMemo(() => {
    if (!activeSubmission) return { drifted: false, reason: null }
    return checkSubmissionCorpusDrift(activeSubmission, targetCanonicalEntry, corpusVersion)
  }, [activeSubmission, targetCanonicalEntry, corpusVersion])

  return (
    <div className="space-y-6">
      {/* Top Mode & Authorization Governance Strip */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#0B0B10]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-lg font-bold text-zinc-950 dark:text-white">
              لوحة تحكيم المحررين وفحص المقترحات
            </h3>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              مقارنة التعديلات المقترحة بالمتن الرسمي، وتهذيب الضبط اللغوي، وفحص سلامة الشواهد قبل الاعتماد.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="مصدر طابور التحكيم"
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-white/10 dark:bg-[#07070A]"
            >
              <button
                type="button"
                onClick={() => setQueueSource('live')}
                className={`min-h-[34px] rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  queueSource === 'live'
                    ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                    : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400'
                }`}
              >
                سجل المراجعة الرسمي
              </button>
              
            </div>

            {acceptedCountInSource > 0 && (
              <button
                type="button"
                onClick={() => onGoToExporter(queueSource)}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-zinc-950 px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
              >
                <span>تصدير المعتمد ({acceptedCountInSource})</span>
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-zinc-200/80 pt-4 sm:grid-cols-4 dark:border-white/10">
          {[
            { label: 'إجمالي السجلات', value: activePool.length },
            { label: 'بانتظار القرار', value: activePool.filter((item) => item.status === 'pending').length },
            { label: 'تحتاج تعديلاً', value: activePool.filter((item) => item.status === 'needs_changes').length },
            { label: 'جاهزة للتصدير', value: acceptedCountInSource },
          ].map((metric) => (
            <div key={metric.label} className="rounded-xl bg-zinc-50/70 px-4 py-3 dark:bg-[#07070A]">
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{metric.label}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-zinc-950 dark:text-white">{metric.value.toLocaleString('en-US')}</p>
            </div>
          ))}
        </div>

        {/* Permission notice for accounts without editorial privileges */}
        {queueSource === 'live' && !isAuthorizedLiveEditor && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-amber-300 bg-amber-50/80 p-4 text-xs text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
            <div className="flex items-start gap-2.5 max-w-[72ch]">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
              <div>
                <p className="font-semibold">
                  {userEmail
                    ? `حسابك الحالي (${userEmail}) يحمل صلاحية «مراجع مساهم» فقط.`
                    : 'يلزم تسجيل الدخول بحساب محرر معتمد لإدارة السجل الحي.'}
                </p>
                <p className="mt-1 leading-relaxed">
                  يقتصر التحكيم وإدارة القرارات على حسابات المحررين المعتمدين والمشرفين، وتُسجّل جميع القرارات في سجل المنصة الرسمي.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!userEmail && (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="min-h-[36px] rounded-lg bg-zinc-950 px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73] whitespace-nowrap cursor-pointer"
                >
                  تسجيل الدخول
                </button>
              )}
              
            </div>
          </div>
        )}

        {false && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-xs text-zinc-700 dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-300">
            <span>
              <strong>وضع المحاكاة التحريرية المعزول:</strong> جميع القرارات هنا محفوظة في متصفحك فقط ولا تختلط بالسجل الرسمي.
            </span>
            
          </div>
        )}
        {/* Sub-view Switcher: Submissions Adjudication vs RBAC Role Governance */}
        <div className="mt-4 pt-4 border-t border-zinc-200 flex flex-wrap items-center justify-between gap-3 dark:border-white/10">
          <div
            role="tablist"
            aria-label="أقسام التحكيم والحوكمة"
            className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-[#07070A]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={moderationSection === 'adjudication'}
              onClick={() => setModerationSection('adjudication')}
              className={`min-h-[34px] rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                moderationSection === 'adjudication'
                  ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                  : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400'
              }`}
            >
              طابور التحكيم ولوحة النشاط
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={moderationSection === 'governance'}
              onClick={() => setModerationSection('governance')}
              className={`min-h-[34px] rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                moderationSection === 'governance'
                  ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                  : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400'
              }`}
            >
              حوكمة الصلاحيات وطلبات الترقية
              {false &&
              sandboxPromotionRequests.filter((r) => r.status === 'pending').length > 0
                ? ` (${sandboxPromotionRequests.filter((r) => r.status === 'pending').length})`
                : ''}
            </button>
          </div>

          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {moderationSection === 'governance'
              ? 'مراجعة طلبات الترقية إلى «محرر معتمد» وإدارة صلاحيات الأعضاء (RBAC)'
              : 'مراجعة المقترحات المعجمية واعتماد الدفعات للمتن الرسمي'}
          </span>
        </div>
      </div>

      {moderationSection === 'governance' ? (
        <RoleGovernancePanel
          queueSource={queueSource}
          currentUserEmail={userEmail}
          currentUserProfile={profile}
          submissions={activePool}
          sandboxProfiles={sandboxProfiles}
          sandboxPromotionRequests={sandboxPromotionRequests}
          onSwitchQueueSource={setQueueSource}
          onReviewSandboxPromotion={onReviewSandboxPromotion}
          onUpdateSandboxMemberRole={onUpdateSandboxMemberRole}
          onResetSandboxGovernance={onResetSandboxGovernance}
          onOpenAuth={onOpenAuth}
        />
      ) : (
        <>
          {/* Editorial Activity & Turnaround Analytics Dashboard */}
          {(false || isAuthorizedLiveEditor) && (
            <ModerationAnalyticsDashboard
              submissions={activePool}
              editorNamesMap={editorNamesMap}
              queueSource={queueSource}
            />
          )}

          {/* Main Queue + Inspection Split */}
          {(false || isAuthorizedLiveEditor) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* Queue List Sidebar */}
          <aside className="lg:col-span-4 rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 space-y-3.5 dark:border-white/10 dark:bg-[#0B0B10]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-sm font-bold text-zinc-950 dark:text-white">
                قائمة المقترحات ({filteredQueue.length})
              </span>
              {queueSource === 'live' && (
                <button
                  type="button"
                  onClick={fetchLiveQueue}
                  disabled={loadingLive}
                  className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-950 cursor-pointer dark:text-zinc-400"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingLive ? 'animate-spin' : ''}`} />
                  <span>تحديث</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-[#07070A]">
              {(
                [
                  ['pending', 'معلق'],
                  ['needs_changes', 'للتعديل'],
                  ['accepted', 'معتمد'],
                  ['merged', 'مدمج'],
                  ['superseded', 'مستبدل'],
                  ['withdrawn', 'مسحوب'],
                  ['rejected', 'مرفوض'],
                  ['all', 'الكل'],
                ] as const
              ).map(([st, label]) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`flex-1 min-h-[30px] rounded-md px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    statusFilter === st
                      ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                      : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="نوع المقترح"
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value as 'all' | 'edit' | 'new')}
                className="min-h-[36px] rounded-lg border border-zinc-300 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-800 dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200"
              >
                <option value="all">جميع الأنواع</option>
                <option value="edit">تعديل مدخل قائم</option>
                <option value="new">مفردة جديدة</option>
              </select>

              <select
                aria-label="إشارات المراجعة البشرية السريعة"
                value={crowdSignalFilter}
                onChange={(e) =>
                  setCrowdSignalFilter(e.target.value as 'all' | 'flagged' | 'verified')
                }
                className="min-h-[36px] rounded-lg border border-zinc-300 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-800 dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200"
              >
                <option value="all">كل إشارات المجتمع</option>
                <option value="flagged">عليها اعتراض بشري (لا)</option>
                <option value="verified">مؤكدة بشرياً (نعم)</option>
              </select>
            </div>

            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث سريع في الطابور..."
              className="w-full min-h-[36px] rounded-lg border border-zinc-300 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-950 dark:border-white/15 dark:bg-[#07070A] dark:text-white"
            />

            {liveError && queueSource === 'live' && (
              <p className="text-xs text-red-700 dark:text-red-400">{liveError}</p>
            )}

            {/* Batch Selection & Bulk Approval Toolbar */}
            {(selectableFilteredIds.length > 0 || selectedBatchIds.size > 0) && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-white/10 dark:bg-[#07070A]">
                {selectableFilteredIds.length > 0 ? (
                  <label className="inline-flex items-center gap-2 font-medium text-zinc-700 cursor-pointer dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={allSelectableChecked}
                      onChange={handleToggleSelectAllVisible}
                      className="h-3.5 w-3.5 accent-zinc-950 dark:accent-[#D9FF43]"
                    />
                    <span>
                      {selectedBatchIds.size > 0
                        ? `محدد للدفعة (${selectedBatchIds.size})`
                        : 'تحديد للدفعة'}
                    </span>
                  </label>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      محدد للدفعة ({selectedBatchIds.size})
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedBatchIds(new Set())}
                      className="text-[11px] text-zinc-500 underline hover:text-zinc-800 cursor-pointer dark:text-zinc-400 dark:hover:text-zinc-200"
                    >
                      إلغاء التحديد
                    </button>
                  </div>
                )}

                {selectedBatchIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setBulkError(null)
                      setBulkModalOpen(true)
                    }}
                    className="inline-flex min-h-[30px] items-center gap-1.5 rounded-md bg-zinc-950 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
                  >
                    <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>اعتماد الدفعة ({selectedBatchIds.size})</span>
                  </button>
                )}
              </div>
            )}

            <div className="max-h-[520px] overflow-y-auto space-y-1.5 pe-1">
              {loadingLive && queueSource === 'live' ? (
                <div className="py-8 text-center text-xs text-zinc-500">جارٍ جلب الطابور...</div>
              ) : filteredQueue.length === 0 ? (
                <div className="py-10 text-center text-xs text-zinc-500 dark:text-zinc-400">
                  لا توجد مقترحات مطابقة لهذا الفلتر حالياً.
                </div>
              ) : (
                filteredQueue.map((item) => {
                  const isNew = isNewEntrySubmission(item)
                  const canonical = entryById.get(item.entry_id)
                  const displayTitle = isNew
                    ? item.proposed_data?.word_ar || 'مفردة جديدة'
                    : canonical?.word || `مدخل #${item.entry_id}`
                  const isSelected = activeSubmission?.id === item.id
                  const isAlreadyLocked = item.status === 'accepted' || item.status === 'merged'
                  const isCheckedForBatch = selectedBatchIds.has(item.id)

                  return (
                    <div
                      key={item.id}
                      className={`flex items-start gap-2.5 rounded-lg border px-3 py-3 transition-colors ${
                        isSelected
                          ? 'border-zinc-950 bg-zinc-100 dark:border-[#D9FF43]/60 dark:bg-[#D9FF43]/10'
                          : 'border-transparent hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-white/10 dark:hover:bg-[#07070A]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={isAlreadyLocked}
                        checked={isCheckedForBatch}
                        onChange={() => toggleBatchItem(item.id)}
                        aria-label={`تحديد المقترح ${displayTitle} ضمن الدفعة`}
                        title={
                          item.status === 'merged'
                            ? 'هذا المقترح مدمج مسبقاً في إصدار رسمي'
                            : isAlreadyLocked
                              ? 'هذا المقترح معتمد مسبقاً'
                              : 'تحديد للاعتماد الجماعي'
                        }
                        className="mt-1 h-4 w-4 accent-zinc-950 dark:accent-[#D9FF43] shrink-0 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                      />

                      <button
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className="flex-1 min-w-0 text-start cursor-pointer"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-display text-sm font-bold text-zinc-950 truncate dark:text-white">
                            {displayTitle}
                          </span>
                          <span className="font-mono text-[11px] tabular-nums text-zinc-500 shrink-0 dark:text-zinc-400">
                            {isNew ? 'NEW' : formatAccessionCode(item.entry_id, null)}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                          <span>{isNew ? 'إضافة جديدة' : 'تعديل مدخل'}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-emerald-700 dark:text-[#D9FF43]">
                            {formatStatusLabel(item.status)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {new Date(item.created_at).toLocaleDateString('ar-MA')}
                          </span>
                          {attestationSummaries[item.entry_id] && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                                {attestationSummaries[item.entry_id].accurateCount} نعم /{' '}
                                {attestationSummaries[item.entry_id].flaggedCount} لا
                              </span>
                            </>
                          )}
                        </div>
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </aside>

          {/* Adjudication Detail Pane */}
          <div className="lg:col-span-8 rounded-xl border border-zinc-200 bg-white p-5 sm:p-8 dark:border-white/10 dark:bg-[#0B0B10]">
            {!activeSubmission ? (
              <div className="space-y-4 py-12">
                {actionMessage && (
                  <div
                    role="status"
                    className={`mx-auto max-w-lg rounded-lg border p-3.5 text-xs leading-relaxed ${
                      actionMessage.type === 'error'
                        ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200'
                    }`}
                  >
                    {actionMessage.text}
                  </div>
                )}
                <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                  اختر مقترحاً من القائمة الجانبية لفحصه ومقارنته بالمتن الرسمي.
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-white/10">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                        {isNewEntrySubmission(activeSubmission)
                          ? 'مقترح مفردة جديدة (NEW)'
                          : `تعديل على ${formatAccessionCode(activeSubmission.entry_id, targetCanonicalEntry?.numericId ?? null)}`}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>الحالة الحالية: {formatStatusLabel(activeSubmission.status)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {new Date(activeSubmission.created_at).toLocaleString('ar-MA')}
                      </span>
                    </div>
                    <h4 className="mt-2 font-display text-2xl font-bold text-zinc-950 dark:text-white">
                      {isNewEntrySubmission(activeSubmission)
                        ? editableProposed.word_ar || 'مفردة جديدة'
                        : targetCanonicalEntry?.word || `مدخل #${activeSubmission.entry_id}`}
                    </h4>
                  </div>

                  {false && activeSubmission.status !== 'merged' ? (
                    <button
                      type="button"
                      onClick={() => setEditMode((v) => !v)}
                      className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        editMode
                          ? 'border-zinc-950 bg-zinc-950 text-white dark:border-[#D9FF43] dark:bg-[#D9FF43] dark:text-[#050507]'
                          : 'border-zinc-300 bg-zinc-50 text-zinc-800 hover:bg-zinc-100 dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200'
                      }`}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>{editMode ? 'إنهاء تهذيب الحقول' : 'تهذيب الحقول'}</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {activeSubmission.status === 'merged'
                        ? `مدمج ومؤرشف رسمياً${activeSubmission.exported_in_version ? ` (v${activeSubmission.exported_in_version})` : ''}`
                        : 'محتوى المقترح ثابت بعد الإرسال (اطلب تعديلاً عند الحاجة)'}
                    </span>
                  )}
                </div>

                {/* Crowd Human Validation Signals + Weighted Trust Score on Target Entry */}
                {!isNewEntrySubmission(activeSubmission) &&
                  attestationSummaries[activeSubmission.entry_id] && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-700 dark:border-white/10 dark:bg-[#07070A] dark:text-zinc-300">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-zinc-950 dark:text-white">
                          إشارات المراجعة البشرية الموزونة:
                        </span>
                        <span className="font-mono tabular-nums text-emerald-700 dark:text-[#D9FF43]">
                          {attestationSummaries[activeSubmission.entry_id].accurateCount} نعم (وزن الثقة:{' '}
                          {(
                            attestationSummaries[activeSubmission.entry_id].weightedAccurateScore ??
                            attestationSummaries[activeSubmission.entry_id].accurateCount
                          ).toFixed(1)}
                          )
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums text-amber-800 dark:text-amber-300">
                          {attestationSummaries[activeSubmission.entry_id].flaggedCount} طلبوا تصحيحها
                        </span>
                        {attestationSummaries[activeSubmission.entry_id].regions.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              المناطق الموثقة:{' '}
                              {attestationSummaries[activeSubmission.entry_id].regions.join('، ')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                {/* Corpus Version Pinning & Drift Detection Warning */}
                {corpusDriftReport.drifted && corpusDriftReport.reason && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50/90 p-3.5 text-xs leading-relaxed text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
                    <div>
                      <p className="font-bold">تنبيه تغيّر إصدار المدخل الأساسي (Version Drift)</p>
                      <p className="mt-0.5">{corpusDriftReport.reason}</p>
                    </div>
                  </div>
                )}

                {/* Supersedes Lineage Notice */}
                {activeSubmission.supersedes_id && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-xs text-zinc-800 dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 shrink-0 text-emerald-700 dark:text-[#D9FF43]" />
                      <span>
                        هذا المقترح <strong>نسخة منقحة</strong> تحل محل مقترح سابق لنفس المساهم.
                      </span>
                    </div>
                    {activePool.some((s) => s.id === activeSubmission.supersedes_id) && (
                      <button
                        type="button"
                        onClick={() => {
                          setStatusFilter('all')
                          setSelectedId(activeSubmission.supersedes_id ?? '')
                        }}
                        className="font-semibold text-emerald-700 hover:underline whitespace-nowrap cursor-pointer dark:text-[#D9FF43]"
                      >
                        عرض المقترح السابق
                      </button>
                    )}
                  </div>
                )}

                {/* Automated Integrity Warnings */}
                {submissionWarnings.length > 0 && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50/80 p-4 space-y-1.5 dark:border-amber-800/60 dark:bg-amber-950/30">
                    {submissionWarnings.map((w, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 text-xs text-amber-950 dark:text-amber-200"
                      >
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Side-by-Side Comparison / Inline Polish Table */}
                <div>
                  <h5 className="text-xs font-semibold text-zinc-800 mb-3 dark:text-zinc-200">
                    المقارنة التفصيلية مع المتن الرسمي
                  </h5>
                  <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-white/10">
                    <table className="w-full text-start border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-white/10 dark:bg-[#07070A] dark:text-zinc-400">
                          <th className="py-2.5 px-3 text-start font-medium w-1/4">الحقل</th>
                          {!isNewEntrySubmission(activeSubmission) && (
                            <th className="py-2.5 px-3 text-start font-medium w-1/3">
                              النص الحالي في المعجم
                            </th>
                          )}
                          <th className="py-2.5 px-3 text-start font-medium">
                            القيمة المقترحة {editMode ? '(قابلة للتعديل)' : ''}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-white/10">
                        {DIFF_FIELDS.map((field) => {
                          const propVal = editableProposed[field.key]
                          const propStr = typeof propVal === 'string' ? propVal : ''
                          const currentStr =
                            field.entryProp && targetCanonicalEntry
                              ? String(targetCanonicalEntry[field.entryProp] ?? '—')
                              : '—'

                          if (!editMode && !propStr && !field.entryProp) {
                            return null
                          }

                          const isModified = propStr.trim() !== ''

                          return (
                            <tr
                              key={field.key}
                              className={
                                isModified
                                  ? 'bg-emerald-50/35 dark:bg-emerald-950/15'
                                  : ''
                              }
                            >
                              <td className="py-3 px-3 font-medium text-zinc-700 dark:text-zinc-300">
                                {field.label}
                              </td>
                              {!isNewEntrySubmission(activeSubmission) && (
                                <td
                                  dir={field.dir}
                                  className={`py-3 px-3 text-zinc-500 dark:text-zinc-400 ${
                                    field.dir === 'ltr' ? 'font-mono text-left' : ''
                                  }`}
                                >
                                  {currentStr}
                                </td>
                              )}
                              <td className="py-2.5 px-3">
                                {editMode ? (
                                  field.key === 'category' ? (
                                    <select
                                      value={propStr}
                                      onChange={(e) =>
                                        setEditableProposed((prev) => ({
                                          ...prev,
                                          category: e.target.value,
                                        }))
                                      }
                                      className="w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-950 dark:border-white/15 dark:bg-[#07070A] dark:text-white"
                                    >
                                      <option value="">بدون تغيير</option>
                                      {categories.map((c) => (
                                        <option key={c} value={c}>
                                          {c}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      dir={field.dir}
                                      value={propStr}
                                      onChange={(e) =>
                                        setEditableProposed((prev) => ({
                                          ...prev,
                                          [field.key]: e.target.value,
                                        }))
                                      }
                                      placeholder="فارغ (يبقى النص الأصلي دون تعديل)"
                                      className={`w-full rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-950 dark:border-white/15 dark:bg-[#07070A] dark:text-white ${
                                        field.dir === 'ltr' ? 'font-mono text-left' : ''
                                      }`}
                                    />
                                  )
                                ) : isModified ? (
                                  <span
                                    dir={field.dir}
                                    className={`font-semibold text-zinc-950 dark:text-white ${
                                      field.dir === 'ltr' ? 'font-mono' : ''
                                    }`}
                                  >
                                    {propStr}
                                  </span>
                                ) : (
                                  <span className="text-zinc-400 dark:text-zinc-500">
                                    بدون تعديل مقترح
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Sanitized Evidence & Reviewer Note */}
                <div className="pt-4 border-t border-zinc-200 space-y-3 dark:border-white/10">
                  <h5 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                    الشواهد المرفقة ومذكرة المراجع
                  </h5>

                  {activeSubmission.reviewer_note && (
                    <p className="text-xs leading-relaxed text-zinc-700 bg-zinc-50 rounded-lg border border-zinc-200 p-3 dark:bg-[#07070A] dark:border-white/10 dark:text-zinc-300">
                      <strong className="font-semibold">مذكرة المساهم:</strong>{' '}
                      {activeSubmission.reviewer_note}
                    </p>
                  )}

                  {Array.isArray(activeSubmission.evidence) &&
                  activeSubmission.evidence.length > 0 ? (
                    <ul className="space-y-2 text-xs">
                      {activeSubmission.evidence.map((ev, idx) => {
                        const safeHref = ev.url ? sanitizeExternalUrl(ev.url) : null
                        return (
                          <li
                            key={idx}
                            className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-1 dark:border-white/10 dark:bg-[#07070A]"
                          >
                            {ev.url ? (
                              safeHref ? (
                                <a
                                  href={safeHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  dir="ltr"
                                  className="inline-flex items-center gap-1.5 font-mono text-emerald-700 hover:underline break-all dark:text-[#D9FF43]"
                                >
                                  <span>{safeHref}</span>
                                  <ExternalLink className="h-3 w-3 shrink-0" />
                                </a>
                              ) : (
                                <span className="text-red-700 dark:text-red-400">
                                  تم حجب رابط غير قياسي لأغراض الأمان: <code>{ev.url}</code>
                                </span>
                              )
                            ) : null}
                            {ev.note && (
                              <p className="text-zinc-600 dark:text-zinc-400">{ev.note}</p>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-zinc-500">لا توجد روابط خارجية مرفقة.</p>
                  )}
                </div>

                {/* Editor Note & Adjudication Decision Buttons */}
                <div className="pt-4 border-t border-zinc-200 space-y-4 dark:border-white/10">
                  {activeSubmission.status === 'merged' ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 text-xs leading-relaxed text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
                      <p className="font-bold">
                        مقترح مدمج ومؤرشف في الإصدار الرسمي{' '}
                        {activeSubmission.exported_in_version
                          ? `(v${activeSubmission.exported_in_version})`
                          : ''}
                      </p>
                      <p className="mt-1">
                        تم تصدير هذا المقترح وإدراجه في حزمة المعجم الرسمية، لذا أُغلق باب تعديل حالته حفاظاً على تطابق السجل التاريخي مع المستودع الرسمي.
                      </p>
                      {activeSubmission.editor_note && (
                        <p className="mt-2 pt-2 border-t border-emerald-200/70 dark:border-emerald-800/50">
                          <strong>مذكرة الاعتماد المسجلة:</strong> {activeSubmission.editor_note}
                        </p>
                      )}
                    </div>
                  ) : activeSubmission.status === 'withdrawn' ||
                    activeSubmission.status === 'superseded' ? (
                    <div className="rounded-lg border border-zinc-300 bg-zinc-50 p-4 text-xs leading-relaxed text-zinc-700 dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-300">
                      <p className="font-bold text-zinc-950 dark:text-white">
                        {activeSubmission.status === 'withdrawn'
                          ? 'مقترح مسحوب من قِبل المساهم'
                          : 'مقترح مُستبدل بنسخة منقحة أحدث'}
                      </p>
                      <p className="mt-1">
                        {activeSubmission.status === 'withdrawn'
                          ? 'سحب المساهم هذا المقترح قبل البت فيه؛ يُحفظ السجل لأغراض التدقيق التاريخي دون إجراءات تحكيمية.'
                          : 'قدّم المساهم نسخة منقحة تحل محل هذا المقترح تلقائياً؛ يرجى تحكيم النسخة الأحدث في طابور المقترحات المعلقة.'}
                      </p>
                    </div>
                  ) : (
                    <>
                      <label className="block">
                        <span className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                          {activeSubmission.status === 'accepted'
                            ? 'مذكرة تعليل سحب الاعتماد (إلزامية بحد أدنى 10 أحرف لفك تعارض أو تصحيح حقوق)'
                            : 'مذكرة المحرر التحكيمية (إلزامية عند الرفض أو طلب التعديل)'}
                        </span>
                        <textarea
                          rows={2}
                          value={editorNote}
                          onChange={(e) => setEditorNote(e.target.value)}
                          placeholder="سجّل قرار التدقيق، ملاحظات الضبط المعتمدة، أو سبب إعادة المقترح للمراجع..."
                          className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-950 focus:border-zinc-950 dark:focus:border-[#D9FF43] focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-white"
                        />
                      </label>

                      <div className="flex flex-wrap items-center gap-3">
                        {activeSubmission.status !== 'accepted' && (
                          <button
                            type="button"
                            disabled={savingDecision}
                            onClick={() => handleDecision('accepted')}
                            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-zinc-950 px-5 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span>اعتماد المقترح للدمج</span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={savingDecision}
                          onClick={() => handleDecision('needs_changes')}
                          className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-amber-400 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                        >
                          <AlertTriangle className="h-4 w-4" />
                          <span>
                            {activeSubmission.status === 'accepted'
                              ? 'سحب الاعتماد وطلب تعديل'
                              : 'طلب تعديلات إضافية'}
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={savingDecision}
                          onClick={() => handleDecision('rejected')}
                          className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-900 hover:bg-red-100 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
                        >
                          <XCircle className="h-4 w-4" />
                          <span>
                            {activeSubmission.status === 'accepted'
                              ? 'سحب الاعتماد ورفض المقترح'
                              : 'رفض المقترح'}
                          </span>
                        </button>
                      </div>
                    </>
                  )}

                  {actionMessage && (
                    <div
                      role="status"
                      className={`rounded-lg border p-3 text-xs leading-relaxed ${
                        actionMessage.type === 'error'
                          ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200'
                      }`}
                    >
                      {actionMessage.text}
                    </div>
                  )}
                </div>

                {/* Immutable Decision Audit Trail */}
                <DecisionAuditTimeline
                  submissionId={activeSubmission.id}
                  queueSource={queueSource}
                  sandboxEvents={sandboxEvents}
                  editorNamesMap={editorNamesMap}
                  refreshKey={auditRefreshCounter}
                />
              </div>
            )}
          </div>
        </div>
      )}
        </>
      )}

      <BulkApprovalModal
        open={bulkModalOpen}
        selectedSubmissions={selectedBatchSubmissions}
        entries={entries}
        currentEditorId={profile?.id ?? null}
        editorLabel={
          profile?.display_name?.trim() || userEmail || 'المحرر الحالي (جلسة محاكاة)'
        }
        queueSource={queueSource}
        busy={bulkBusy}
        errorMessage={bulkError}
        onClose={() => {
          if (!bulkBusy) setBulkModalOpen(false)
        }}
        onConfirmBulkApprove={handleConfirmBulkApprove}
      />
    </div>
  )
}
