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
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type {
  LexicalEntry,
  ProposedFields,
  ReviewerProfile,
  SubmissionRecord,
  SubmissionStatus,
} from '../../types/lexicon'
import { formatAccessionCode, formatStatusLabel } from '../../services/dataset'
import { isNewEntrySubmission } from '../../services/exporter'
import { findSimilarCorpusEntries, sanitizeExternalUrl } from '../../utils/validation'
import { ModerationAnalyticsDashboard } from './ModerationAnalyticsDashboard'
import { BulkApprovalModal } from './BulkApprovalModal'

interface EditorModerationPanelProps {
  entries: LexicalEntry[]
  categories: string[]
  userEmail: string | null
  profile: ReviewerProfile | null
  sandboxItems: SubmissionRecord[]
  forceSandboxMode?: boolean
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
  userEmail,
  profile,
  sandboxItems,
  forceSandboxMode,
  onModerateSandbox,
  onBulkApproveSandbox,
  onResetSandbox,
  onOpenAuth,
  onGoToExporter,
}: EditorModerationPanelProps) {
  const isAuthorizedLiveEditor =
    Boolean(userEmail) && (profile?.role === 'editor' || profile?.role === 'admin')

  const [queueSource, setQueueSource] = useState<'live' | 'sandbox'>(() =>
    isAuthorizedLiveEditor && !forceSandboxMode ? 'live' : 'sandbox',
  )

  useEffect(() => {
    if (forceSandboxMode) {
      setQueueSource('sandbox')
    } else if (isAuthorizedLiveEditor) {
      setQueueSource('live')
    }
  }, [forceSandboxMode, isAuthorizedLiveEditor])

  const [liveItems, setLiveItems] = useState<SubmissionRecord[]>([])
  const [editorNamesMap, setEditorNamesMap] = useState<Record<string, string>>({})
  const [loadingLive, setLoadingLive] = useState(false)
  const [liveError, setLiveError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<'all' | SubmissionStatus>('pending')
  const [kindFilter, setKindFilter] = useState<'all' | 'edit' | 'new'>('all')
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
    const [subsRes, profilesRes] = await Promise.all([
      supabase
        .from('review_submissions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('reviewer_profiles').select('id, display_name, role'),
    ])

    setLoadingLive(false)
    if (subsRes.error) {
      setLiveError(subsRes.error.message)
      return
    }
    if (Array.isArray(profilesRes.data)) {
      const nameMap: Record<string, string> = {}
      for (const row of profilesRes.data as Array<{ id: string; display_name: string | null }>) {
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

  const activePool = queueSource === 'live' ? liveItems : sandboxItems

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
  }, [activePool, statusFilter, kindFilter, searchQuery, entryById])

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
          'نقص إلزامي: أحد الحقول الخمسة المطلوبة في schema.json فارغ؛ فعّل «تهذيب الحقول» لاستكماله قبل الاعتماد.',
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
          `تداخل تعديلات: يوجد مقترح آخر معتمد مسبقاً لنفس المدخل (#${activeSubmission.entry_id}). سيسود التحديث الأحدث زمنياً عند التصدير.`,
        )
      }
    }

    if (p.example_darija?.trim() && !p.example_arabizi?.trim()) {
      warnings.push(
        'تنبيه شاهد سياقي: حقل الجملة بالدارجة مملوء دون كتابته بـ Arabizi؛ أضف الكتابة اللاتينية للشاهد حتى يُصدَّر إلى ملف context-examples.json.',
      )
    }

    return warnings
  }, [activeSubmission, editableProposed, entries, activePool])

  const acceptedCountInSource = useMemo(
    () => activePool.filter((s) => s.status === 'accepted').length,
    [activePool],
  )

  async function handleDecision(nextStatus: SubmissionStatus) {
    if (!activeSubmission) return

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

    if (queueSource === 'sandbox') {
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
      setActionMessage({
        type: 'success',
        text: `تم تحديث قرار المحاكاة إلى «${formatStatusLabel(nextStatus)}».`,
      })
      return
    }

    if (!supabase || !isAuthorizedLiveEditor) {
      setActionMessage({
        type: 'error',
        text: 'ليست لديك صلاحية محرر (editor/admin) لتحديث قاعدة البيانات الحية.',
      })
      return
    }

    setSavingDecision(true)
    setActionMessage(null)

    const { data, error } = await supabase
      .from('review_submissions')
      .update({
        status: nextStatus,
        editor_id: profile?.id ?? null,
        editor_note: editorNote.trim() || null,
        proposed_data: editableProposed,
      })
      .eq('id', activeSubmission.id)
      .select()

    setSavingDecision(false)

    if (error) {
      setActionMessage({ type: 'error', text: `فشل حفظ القرار في Supabase: ${error.message}` })
      return
    }
    if (!data || data.length === 0) {
      setActionMessage({
        type: 'error',
        text: 'لم يُسمح بتحديث السجل بموجب سياسات الأمان (RLS). تحقق من امتلاكك دور editor أو admin.',
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
    setActionMessage({
      type: 'success',
      text: `تم تسجيل القرار التحريري «${formatStatusLabel(nextStatus)}» في قاعدة البيانات.`,
    })
  }

  const selectableFilteredIds = useMemo(
    () => filteredQueue.filter((item) => item.status !== 'accepted').map((item) => item.id),
    [filteredQueue],
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

    if (queueSource === 'sandbox') {
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
      setBulkError('ليست لديك صلاحية محرر (editor/admin) لتنفيذ اعتماد جماعي في قاعدة البيانات الحية.')
      return
    }

    setBulkBusy(true)
    setBulkError(null)

    const { data, error } = await supabase
      .from('review_submissions')
      .update({
        status: 'accepted',
        editor_id: profile?.id ?? null,
        editor_note: justificationComment,
      })
      .in('id', eligibleIds)
      .select()

    setBulkBusy(false)

    if (error) {
      setBulkError(`تعذر تنفيذ الاعتماد الجماعي: ${error.message}`)
      return
    }

    if (!data || data.length === 0) {
      setBulkError('لم يُسمح بتحديث السجلات بموجب سياسات أمان الصفوف (RLS).')
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
      text: `تم توقيع واعتماد ${updatedMap.size} مقترحات جماعياً في قاعدة البيانات الحية.`,
    })
  }

  const targetCanonicalEntry = activeSubmission
    ? entryById.get(activeSubmission.entry_id)
    : undefined

  return (
    <div className="space-y-6">
      {/* Top Mode & Authorization Governance Strip */}
      <div className="rounded-xl border border-[#E5DFD3] bg-white p-5 dark:border-[#2E2B27] dark:bg-[#1C1A18]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
              لوحة تحكيم المحررين وفحص المقترحات
            </h3>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
              مقارنة التعديلات المقترحة بالمتن الرسمي، وتهذيب الضبط اللغوي، وفحص سلامة الشواهد قبل الاعتماد.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="مصدر طابور التحكيم"
              className="inline-flex items-center gap-1 rounded-lg border border-[#E5DFD3] bg-[#F3EFE6] p-1 dark:border-[#2E2B27] dark:bg-[#141312]"
            >
              <button
                type="button"
                onClick={() => setQueueSource('live')}
                className={`min-h-[34px] rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  queueSource === 'live'
                    ? 'bg-white text-stone-900 shadow-2xs dark:bg-[#2A2622] dark:text-stone-100'
                    : 'text-stone-600 hover:text-stone-900 dark:text-stone-400'
                }`}
              >
                سجل Supabase الحي
              </button>
              <button
                type="button"
                onClick={() => setQueueSource('sandbox')}
                className={`min-h-[34px] rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  queueSource === 'sandbox'
                    ? 'bg-white text-stone-900 shadow-2xs dark:bg-[#2A2622] dark:text-stone-100'
                    : 'text-stone-600 hover:text-stone-900 dark:text-stone-400'
                }`}
              >
                طابور المحاكاة المحلي ({sandboxItems.length})
              </button>
            </div>

            {acceptedCountInSource > 0 && (
              <button
                type="button"
                onClick={() => onGoToExporter(queueSource)}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#0F5C4E] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0B463B] whitespace-nowrap shrink-0 cursor-pointer dark:bg-[#147A67]"
              >
                <span>تصدير المعتمد ({acceptedCountInSource})</span>
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Permission notice when Live Supabase selected without editor role */}
        {queueSource === 'live' && !isAuthorizedLiveEditor && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-amber-300 bg-amber-50/80 p-4 text-xs text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
            <div className="flex items-start gap-2.5 max-w-[72ch]">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
              <div>
                <p className="font-semibold">
                  {userEmail
                    ? `حسابك الحالي (${userEmail}) يحمل صلاحية «مراجع مساهم» فقط.`
                    : 'يلزم تسجيل الدخول بحساب محرر مخوّل (editor أو admin) لإدارة السجل الحي.'}
                </p>
                <p className="mt-1 leading-relaxed">
                  تفرض سياسات أمان الصفوف (RLS) في قاعدة البيانات اقتصار التحكيم الحي على حسابات المحررين. لتجربة دورة الاعتماد والتصدير فوراً دون المساس بقاعدة البيانات، استخدم «طابور المحاكاة المحلي».
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!userEmail && (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="min-h-[36px] rounded-lg bg-[#0F5C4E] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0B463B] whitespace-nowrap cursor-pointer"
                >
                  تسجيل الدخول
                </button>
              )}
              <button
                type="button"
                onClick={() => setQueueSource('sandbox')}
                className="min-h-[36px] rounded-lg border border-amber-400 bg-white px-3.5 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100/50 whitespace-nowrap cursor-pointer dark:border-amber-700 dark:bg-[#141312] dark:text-amber-200"
              >
                التبديل إلى المحاكاة المحلية
              </button>
            </div>
          </div>
        )}

        {queueSource === 'sandbox' && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-4 py-2.5 text-xs text-stone-700 dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-300">
            <span>
              <strong>وضع المحاكاة التحريرية المعزول:</strong> جميع القرارات هنا محفوظة في متصفحك فقط ولا تختلط بسجل Supabase الحي.
            </span>
            <button
              type="button"
              onClick={onResetSandbox}
              className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 hover:text-stone-900 whitespace-nowrap cursor-pointer dark:text-stone-400 dark:hover:text-stone-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>إعادة ضبط أمثلة المحاكاة</span>
            </button>
          </div>
        )}
      </div>

      {/* Editorial Activity & Turnaround Analytics Dashboard */}
      {(queueSource === 'sandbox' || isAuthorizedLiveEditor) && (
        <ModerationAnalyticsDashboard
          submissions={activePool}
          editorNamesMap={editorNamesMap}
          queueSource={queueSource}
        />
      )}

      {/* Main Queue + Inspection Split */}
      {(queueSource === 'sandbox' || isAuthorizedLiveEditor) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* Queue List Sidebar */}
          <aside className="lg:col-span-4 rounded-xl border border-[#E5DFD3] bg-white p-4 sm:p-5 space-y-3.5 dark:border-[#2E2B27] dark:bg-[#1C1A18]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-sm font-bold text-stone-900 dark:text-stone-100">
                قائمة المقترحات ({filteredQueue.length})
              </span>
              {queueSource === 'live' && (
                <button
                  type="button"
                  onClick={fetchLiveQueue}
                  disabled={loadingLive}
                  className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900 cursor-pointer dark:text-stone-400"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingLive ? 'animate-spin' : ''}`} />
                  <span>تحديث</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1 rounded-lg bg-[#F3EFE6] p-1 dark:bg-[#141312]">
              {(
                [
                  ['pending', 'معلق'],
                  ['needs_changes', 'للتعديل'],
                  ['accepted', 'معتمد'],
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
                      ? 'bg-white text-stone-900 shadow-2xs dark:bg-[#2A2622] dark:text-stone-100'
                      : 'text-stone-600 hover:text-stone-900 dark:text-stone-400'
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
                className="min-h-[36px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-2.5 py-1.5 text-xs text-stone-800 dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-200"
              >
                <option value="all">جميع الأنواع</option>
                <option value="edit">تعديل مدخل قائم</option>
                <option value="new">مفردة جديدة</option>
              </select>

              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث سريع..."
                className="min-h-[36px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-2.5 py-1.5 text-xs text-stone-900 dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
              />
            </div>

            {liveError && queueSource === 'live' && (
              <p className="text-xs text-red-700 dark:text-red-400">{liveError}</p>
            )}

            {/* Batch Selection & Bulk Approval Toolbar */}
            {(selectableFilteredIds.length > 0 || selectedBatchIds.size > 0) && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E5DFD3] bg-[#FBF9F5] px-3 py-2 text-xs dark:border-[#2E2B27] dark:bg-[#141312]">
                {selectableFilteredIds.length > 0 ? (
                  <label className="inline-flex items-center gap-2 font-medium text-stone-700 cursor-pointer dark:text-stone-300">
                    <input
                      type="checkbox"
                      checked={allSelectableChecked}
                      onChange={handleToggleSelectAllVisible}
                      className="h-3.5 w-3.5 accent-[#0F5C4E]"
                    />
                    <span>
                      {selectedBatchIds.size > 0
                        ? `محدد للدفعة (${selectedBatchIds.size})`
                        : 'تحديد للدفعة'}
                    </span>
                  </label>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-stone-700 dark:text-stone-300">
                      محدد للدفعة ({selectedBatchIds.size})
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedBatchIds(new Set())}
                      className="text-[11px] text-stone-500 underline hover:text-stone-800 cursor-pointer dark:text-stone-400 dark:hover:text-stone-200"
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
                    className="inline-flex min-h-[30px] items-center gap-1.5 rounded-md bg-[#0F5C4E] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#0B463B] whitespace-nowrap shrink-0 cursor-pointer dark:bg-[#147A67]"
                  >
                    <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>اعتماد الدفعة ({selectedBatchIds.size})</span>
                  </button>
                )}
              </div>
            )}

            <div className="max-h-[520px] overflow-y-auto space-y-1.5 pe-1">
              {loadingLive && queueSource === 'live' ? (
                <div className="py-8 text-center text-xs text-stone-500">جارٍ جلب الطابور...</div>
              ) : filteredQueue.length === 0 ? (
                <div className="py-10 text-center text-xs text-stone-500 dark:text-stone-400">
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
                  const isAlreadyAccepted = item.status === 'accepted'
                  const isCheckedForBatch = selectedBatchIds.has(item.id)

                  return (
                    <div
                      key={item.id}
                      className={`flex items-start gap-2.5 rounded-lg border px-3 py-3 transition-colors ${
                        isSelected
                          ? 'border-[#B8AE99] bg-[#EFECE4] dark:border-[#4A433B] dark:bg-[#2A2622]'
                          : 'border-transparent hover:border-[#E5DFD3] hover:bg-[#FBF9F5] dark:hover:border-[#2E2B27] dark:hover:bg-[#141312]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={isAlreadyAccepted}
                        checked={isCheckedForBatch}
                        onChange={() => toggleBatchItem(item.id)}
                        aria-label={`تحديد المقترح ${displayTitle} ضمن الدفعة`}
                        title={
                          isAlreadyAccepted
                            ? 'هذا المقترح معتمد مسبقاً'
                            : 'تحديد للاعتماد الجماعي'
                        }
                        className="mt-1 h-4 w-4 accent-[#0F5C4E] shrink-0 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                      />

                      <button
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className="flex-1 min-w-0 text-start cursor-pointer"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-display text-sm font-bold text-stone-900 truncate dark:text-stone-100">
                            {displayTitle}
                          </span>
                          <span className="font-mono text-[11px] tabular-nums text-stone-500 shrink-0 dark:text-stone-400">
                            {isNew ? 'NEW' : formatAccessionCode(item.entry_id, null)}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-stone-600 dark:text-stone-400">
                          <span>{isNew ? 'إضافة جديدة' : 'تعديل مدخل'}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-[#0F5C4E] dark:text-[#4FD1C5]">
                            {formatStatusLabel(item.status)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {new Date(item.created_at).toLocaleDateString('ar-MA')}
                          </span>
                        </div>
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </aside>

          {/* Adjudication Detail Pane */}
          <div className="lg:col-span-8 rounded-xl border border-[#E5DFD3] bg-white p-5 sm:p-8 dark:border-[#2E2B27] dark:bg-[#1C1A18]">
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
                <div className="text-center text-sm text-stone-500 dark:text-stone-400">
                  اختر مقترحاً من القائمة الجانبية لفحصه ومقارنته بالمتن الرسمي.
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-[#E5DFD3] dark:border-[#2E2B27]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                      <span className="font-mono font-semibold text-stone-800 dark:text-stone-200">
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
                    <h4 className="mt-2 font-display text-2xl font-bold text-stone-900 dark:text-stone-100">
                      {isNewEntrySubmission(activeSubmission)
                        ? editableProposed.word_ar || 'مفردة جديدة'
                        : targetCanonicalEntry?.word || `مدخل #${activeSubmission.entry_id}`}
                    </h4>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditMode((v) => !v)}
                    className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      editMode
                        ? 'border-[#0F5C4E] bg-[#0F5C4E] text-white dark:bg-[#147A67]'
                        : 'border-[#D6CEBE] bg-[#FBF9F5] text-stone-800 hover:bg-[#EFECE4] dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-200'
                    }`}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>{editMode ? 'إنهاء تهذيب الحقول' : 'تهذيب الحقول قبل الاعتماد'}</span>
                  </button>
                </div>

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
                  <h5 className="text-xs font-semibold text-stone-800 mb-3 dark:text-stone-200">
                    المقارنة التفصيلية مع المتن الرسمي
                  </h5>
                  <div className="overflow-x-auto rounded-lg border border-[#E5DFD3] dark:border-[#2E2B27]">
                    <table className="w-full text-start border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#E5DFD3] bg-[#FBF9F5] text-stone-600 dark:border-[#2E2B27] dark:bg-[#141312] dark:text-stone-400">
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
                      <tbody className="divide-y divide-[#E5DFD3] dark:divide-[#2E2B27]">
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
                              <td className="py-3 px-3 font-medium text-stone-700 dark:text-stone-300">
                                {field.label}
                              </td>
                              {!isNewEntrySubmission(activeSubmission) && (
                                <td
                                  dir={field.dir}
                                  className={`py-3 px-3 text-stone-500 dark:text-stone-400 ${
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
                                      className="w-full rounded border border-[#D6CEBE] bg-white px-2.5 py-1.5 text-xs text-stone-900 dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
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
                                      className={`w-full rounded border border-[#D6CEBE] bg-white px-2.5 py-1.5 text-xs text-stone-900 dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100 ${
                                        field.dir === 'ltr' ? 'font-mono text-left' : ''
                                      }`}
                                    />
                                  )
                                ) : isModified ? (
                                  <span
                                    dir={field.dir}
                                    className={`font-semibold text-stone-900 dark:text-stone-100 ${
                                      field.dir === 'ltr' ? 'font-mono' : ''
                                    }`}
                                  >
                                    {propStr}
                                  </span>
                                ) : (
                                  <span className="text-stone-400 dark:text-stone-500">
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
                <div className="pt-4 border-t border-[#E5DFD3] space-y-3 dark:border-[#2E2B27]">
                  <h5 className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                    الشواهد المرفقة ومذكرة المراجع
                  </h5>

                  {activeSubmission.reviewer_note && (
                    <p className="text-xs leading-relaxed text-stone-700 bg-[#FBF9F5] rounded-lg border border-[#E5DFD3] p-3 dark:bg-[#141312] dark:border-[#2E2B27] dark:text-stone-300">
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
                            className="rounded-lg border border-[#E5DFD3] bg-[#FBF9F5] p-3 space-y-1 dark:border-[#2E2B27] dark:bg-[#141312]"
                          >
                            {ev.url ? (
                              safeHref ? (
                                <a
                                  href={safeHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  dir="ltr"
                                  className="inline-flex items-center gap-1.5 font-mono text-[#0F5C4E] hover:underline break-all dark:text-[#4FD1C5]"
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
                              <p className="text-stone-600 dark:text-stone-400">{ev.note}</p>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-stone-500">لا توجد روابط خارجية مرفقة.</p>
                  )}
                </div>

                {/* Editor Note & Adjudication Decision Buttons */}
                <div className="pt-4 border-t border-[#E5DFD3] space-y-4 dark:border-[#2E2B27]">
                  <label className="block">
                    <span className="block text-xs font-semibold text-stone-800 dark:text-stone-200">
                      مذكرة المحرر التحكيمية (إلزامية عند الرفض أو طلب التعديل)
                    </span>
                    <textarea
                      rows={2}
                      value={editorNote}
                      onChange={(e) => setEditorNote(e.target.value)}
                      placeholder="سجّل قرار التدقيق، ملاحظات الضبط المعتمدة، أو سبب إعادة المقترح للمراجع..."
                      className="mt-1.5 w-full rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] p-3 text-xs leading-relaxed text-stone-900 focus:border-[#0F5C4E] focus:bg-white focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                    />
                  </label>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={savingDecision}
                      onClick={() => handleDecision('accepted')}
                      className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#0F5C4E] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#0B463B] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer dark:bg-[#147A67]"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>اعتماد المقترح للدمج</span>
                    </button>

                    <button
                      type="button"
                      disabled={savingDecision}
                      onClick={() => handleDecision('needs_changes')}
                      className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-amber-400 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <span>طلب تعديلات إضافية</span>
                    </button>

                    <button
                      type="button"
                      disabled={savingDecision}
                      onClick={() => handleDecision('rejected')}
                      className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-900 hover:bg-red-100 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>رفض المقترح</span>
                    </button>
                  </div>

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
              </div>
            )}
          </div>
        </div>
      )}

      <BulkApprovalModal
        open={bulkModalOpen}
        selectedSubmissions={selectedBatchSubmissions}
        entries={entries}
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
