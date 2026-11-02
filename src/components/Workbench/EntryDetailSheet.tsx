import { useEffect, useMemo, useState } from 'react'
import {
  ChevronRight,
  ChevronLeft,
  Copy,
  Check,
  ExternalLink,
  Plus,
  Trash2,
  Send,
  Bookmark,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  FlaskConical,
  ArrowLeft,
  GitBranch,
  Wand2,
  X,
  Volume2,
  AlertTriangle,
  Link2,
  Edit3,
  SlidersHorizontal,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type {
  AttestationVerdict,
  CommunityAttestationRecord,
  DataPermission,
  EvidenceItem,
  ExampleAttestationSummary,
  LexicalEntry,
  LocalDraft,
  ProposedFields,
  SubmissionRecord,
} from '../../types/lexicon'
import type { RapidSessionPrefs } from '../../hooks/useCommunityAttestations'
import {
  formatAccessionCode,
  formatRegisterLabel,
  formatStatusLabel,
} from '../../services/dataset'
import {
  MAX_EVIDENCE_ITEMS,
  MOROCCAN_REGIONS,
  isValidArabizi,
  validateEvidenceItems,
} from '../../utils/validation'
import {
  buildCorpusArabiziLookup,
  suggestMoroccanArabizi,
} from '../../utils/arabiziTransliterator'
import { computeEntryFingerprint } from '../../utils/corpusPinning'
import { analyzeDarijaPhoneticsAndHomographs } from '../../utils/phoneticGuide'
import { humanizeSystemError } from '../../utils/humanizeError'
import { buildCleanEntryUrl } from '../../utils/urlState'

interface EntryDetailSheetProps {
  entry: LexicalEntry
  allEntries: LexicalEntry[]
  corpusVersion: string
  canAccessEditorialTools: boolean
  currentIndex: number
  totalFiltered: number
  existingDraft?: LocalDraft
  revisionTarget?: SubmissionRecord | null
  sessionPrefs: RapidSessionPrefs
  onUpdateSessionPrefs: (patch: Partial<RapidSessionPrefs>) => void
  userVerdictsByExampleId?: Record<string, CommunityAttestationRecord>
  summariesByExampleId?: Record<string, ExampleAttestationSummary>
  onRecordExampleAttestation?: (params: {
    entryId: string
    exampleId: string
    verdict: AttestationVerdict
    note?: string | null
  }) => Promise<{ storedLive: boolean }>
  onClearRevisionTarget?: () => void
  onPrev: () => void
  onNext: () => void
  onSaveDraft: (draft: LocalDraft) => void
  onRemoveDraft: (entryId: string) => void
  onAddSandboxSubmission: (params: {
    entryId: string
    proposedData: ProposedFields
    evidence: EvidenceItem[]
    reviewerNote: string | null
    supersedesId?: string | null
  }) => void
  onOpenModerationSandbox: () => void
  onRequireLogin: () => void
  onSubmissionSuccess: () => void
}

const EDITABLE_FIELD_GROUPS: Array<{
  groupTitle: string
  fields: Array<{
    key: keyof ProposedFields
    label: string
    placeholder: string
    dir?: 'ltr' | 'rtl'
  }>
}> = [
  {
    groupTitle: '١. تصويب الكلمة أو نطقها',
    fields: [
      {
        key: 'word_ar',
        label: 'الكتابة الصحيحة بالدارجة',
        placeholder: 'اتركه فارغاً إذا كانت الكلمة الحالية دقيقة',
      },
      {
        key: 'arabizi',
        label: 'النطق بالحروف اللاتينية (يتولد تلقائياً)',
        placeholder: 'مثال: bzzaf / wakha',
        dir: 'ltr',
      },
    ],
  },
  {
    groupTitle: '٢. تصويب المعنى والترجمة',
    fields: [
      {
        key: 'msa_translation',
        label: 'المعنى بالعربية الفصحى',
        placeholder: 'المرادف الفصيح المباشر...',
      },
      {
        key: 'french_translation',
        label: 'المقابل بالفرنسية (اختياري)',
        placeholder: 'Ex: Beaucoup, tout à fait...',
        dir: 'ltr',
      },
      {
        key: 'meaning',
        label: 'توضيح إضافي للمعنى (اختياري)',
        placeholder: 'تفصيل المعاني الفرعية إن وجدت...',
      },
      {
        key: 'usage_note',
        label: 'ملاحظة الاستعمال أو المنطقة (اختياري)',
        placeholder: 'متى وأين تُستعمل هذه المفردة...',
      },
    ],
  },
  {
    groupTitle: '٣. إضافة مثال جديد من الحياة اليومية',
    fields: [
      {
        key: 'example_darija',
        label: 'جملة مثال بالدارجة المغربية',
        placeholder: 'أدخل جملة طبيعية يظهر فيها معنى المفردة...',
      },
      {
        key: 'example_arabizi',
        label: 'نطق الجملة بالحروف اللاتينية (تلقائي)',
        placeholder: 'يتولد تلقائياً بمجرد كتابة الجملة بالعربية...',
        dir: 'ltr',
      },
      {
        key: 'example_translation',
        label: 'معنى الجملة بالعربية الفصحى (اختياري)',
        placeholder: 'ترجمة مبسطة لمعنى الجملة...',
      },
      {
        key: 'example_french',
        label: 'ترجمة الجملة بالفرنسية (اختياري)',
        placeholder: 'Traduction en français...',
        dir: 'ltr',
      },
    ],
  },
]

export function EntryDetailSheet({
  entry,
  allEntries,
  corpusVersion,
  canAccessEditorialTools,
  currentIndex,
  totalFiltered,
  existingDraft,
  revisionTarget,
  sessionPrefs,
  onUpdateSessionPrefs,
  userVerdictsByExampleId,
  summariesByExampleId,
  onRecordExampleAttestation,
  onClearRevisionTarget,
  onPrev,
  onNext,
  onSaveDraft,
  onRemoveDraft,
  onAddSandboxSubmission,
  onOpenModerationSandbox,
  onRequireLogin,
  onSubmissionSuccess,
}: EntryDetailSheetProps) {
  const phoneticAnalysis = useMemo(
    () => analyzeDarijaPhoneticsAndHomographs(entry, allEntries),
    [entry, allEntries],
  )
  const corpusArabiziLookup = useMemo(
    () => buildCorpusArabiziLookup(allEntries),
    [allEntries],
  )

  const activeRevision =
    revisionTarget && revisionTarget.entry_id === entry.id ? revisionTarget : null

  const [isEditOpen, setIsEditOpen] = useState<boolean>(
    Boolean(activeRevision || existingDraft),
  )
  const [showAdvancedEvidence, setShowAdvancedEvidence] = useState(false)
  const [showPrefsEditor, setShowPrefsEditor] = useState(false)

  const [form, setForm] = useState<ProposedFields>({})
  const [arabiziManuallyEdited, setArabiziManuallyEdited] = useState(false)
  const [exampleArabiziManuallyEdited, setExampleArabiziManuallyEdited] = useState(false)
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([{ url: '', note: '' }])
  const [reviewerNote, setReviewerNote] = useState('')
  const [showProvenance, setShowProvenance] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: 'error' | 'success' | 'info'
    text: string
    showSandboxJump?: boolean
  } | null>(null)

  useEffect(() => {
    if (activeRevision) {
      setIsEditOpen(true)
      setForm(activeRevision.proposed_data ?? {})
      setArabiziManuallyEdited(Boolean(activeRevision.proposed_data?.arabizi))
      setExampleArabiziManuallyEdited(Boolean(activeRevision.proposed_data?.example_arabizi))
      const ev =
        Array.isArray(activeRevision.evidence) && activeRevision.evidence.length > 0
          ? activeRevision.evidence
          : [{ url: '', note: '' }]
      setEvidenceList(ev)
      setShowAdvancedEvidence(Boolean(ev[0]?.url || activeRevision.reviewer_note))
      setReviewerNote(activeRevision.reviewer_note ?? '')
    } else if (existingDraft) {
      setIsEditOpen(true)
      setForm(existingDraft.proposedData ?? {})
      setArabiziManuallyEdited(Boolean(existingDraft.proposedData?.arabizi))
      setExampleArabiziManuallyEdited(Boolean(existingDraft.proposedData?.example_arabizi))
      const ev =
        existingDraft.evidence.length > 0 ? existingDraft.evidence : [{ url: '', note: '' }]
      setEvidenceList(ev)
      setShowAdvancedEvidence(Boolean(ev[0]?.url || existingDraft.reviewerNote))
      setReviewerNote(existingDraft.reviewerNote ?? '')
    } else {
      setIsEditOpen(false)
      setForm({})
      setArabiziManuallyEdited(false)
      setExampleArabiziManuallyEdited(false)
      setEvidenceList([{ url: '', note: '' }])
      setShowAdvancedEvidence(false)
      setReviewerNote('')
    }
    setFeedback(null)
  }, [entry.id, existingDraft, activeRevision])

  const accessionCode = formatAccessionCode(entry.id, entry.numericId)

  const filledFieldsCount = Object.entries(form).filter(
    ([key, v]) =>
      key !== 'submission_kind' &&
      key !== 'corpus_version' &&
      key !== 'baseline_fingerprint' &&
      typeof v === 'string' &&
      v.trim() !== '',
  ).length

  function updateField(key: keyof ProposedFields, value: string) {
    setForm((prev) => {
      const next: ProposedFields = { ...prev, [key]: value }
      if (key === 'word_ar' && !arabiziManuallyEdited) {
        next.arabizi = value.trim()
          ? suggestMoroccanArabizi(value, corpusArabiziLookup)
          : ''
      }
      if (key === 'example_darija' && !exampleArabiziManuallyEdited) {
        next.example_arabizi = value.trim()
          ? suggestMoroccanArabizi(value, corpusArabiziLookup)
          : ''
      }
      return next
    })
    if (key === 'arabizi') {
      setArabiziManuallyEdited(Boolean(value.trim()))
    }
    if (key === 'example_arabizi') {
      setExampleArabiziManuallyEdited(Boolean(value.trim()))
    }
  }

  function updateEvidence(idx: number, key: keyof EvidenceItem, value: string) {
    setEvidenceList((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [key]: value } : item)),
    )
  }

  function addEvidenceRow() {
    setEvidenceList((prev) =>
      prev.length < MAX_EVIDENCE_ITEMS ? [...prev, { url: '', note: '' }] : prev,
    )
  }

  function removeEvidenceRow(idx: number) {
    setEvidenceList((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))
  }

  function handleCopyReference() {
    const refText = `${entry.word}${entry.latin ? ` (${entry.latin})` : ''} — ${entry.meaning}`
    navigator.clipboard?.writeText(refText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  function handleCopyShareLink() {
    const shareUrl = buildCleanEntryUrl(entry.id)
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 1800)
    })
  }

  function buildCleanProposedData(): ProposedFields {
    const out: ProposedFields = {
      submission_kind: 'edit_entry',
      corpus_version: corpusVersion,
      baseline_fingerprint: computeEntryFingerprint(entry),
    }
    for (const [k, v] of Object.entries(form)) {
      if (
        k === 'rights_holder' ||
        k === 'license' ||
        k === 'redistribution_permission' ||
        k === 'training_permission' ||
        k === 'commercial_permission' ||
        k === 'corpus_version' ||
        k === 'baseline_fingerprint'
      ) {
        continue
      }
      if (typeof v === 'string' && v.trim()) {
        ;(out as Record<string, unknown>)[k] = v.trim()
      }
    }

    // Silent auto-Arabizi fallback if contributor typed an Arabic word/example without touching Latin
    if (out.word_ar && !out.arabizi) {
      const autoWordLat = suggestMoroccanArabizi(out.word_ar, corpusArabiziLookup)
      if (autoWordLat && isValidArabizi(autoWordLat)) {
        out.arabizi = autoWordLat
      }
    }
    if (out.example_darija && !out.example_arabizi) {
      const autoExLat = suggestMoroccanArabizi(out.example_darija, corpusArabiziLookup)
      if (autoExLat && isValidArabizi(autoExLat)) {
        out.example_arabizi = autoExLat
      }
    }

    if (sessionPrefs.dialectRegion && !out.regions) {
      out.regions = [sessionPrefs.dialectRegion]
    }

    const confirmed = sessionPrefs.rightsConfirmedOnce
    out.rights_confirmed = confirmed
    out.rights_holder = confirmed ? 'contributor' : 'unknown'
    out.license = confirmed ? 'CC BY-NC 4.0' : 'unknown'
    out.redistribution_permission = confirmed ? 'allowed' : 'unknown'
    out.training_permission = confirmed ? sessionPrefs.trainingPermission : 'unknown'
    out.commercial_permission = confirmed ? 'not_allowed' : 'unknown'
    return out
  }

  function validateProposalInputs(): {
    valid: boolean
    error?: string
    cleanedEvidence: EvidenceItem[]
  } {
    if (filledFieldsCount === 0 && !reviewerNote.trim()) {
      return {
        valid: false,
        error: 'أدخل تعديلاً في حقل واحد على الأقل أو أضف جملة مثال قبل الإرسال.',
        cleanedEvidence: [],
      }
    }

    if (form.arabizi?.trim() && !isValidArabizi(form.arabizi.trim())) {
      return {
        valid: false,
        error: 'النطق اللاتيني يجب أن يقتصر على الحروف اللاتينية والأرقام الصوتية دون حروف عربية.',
        cleanedEvidence: [],
      }
    }

    if (form.example_arabizi?.trim() && !isValidArabizi(form.example_arabizi.trim())) {
      return {
        valid: false,
        error: 'نطق الجملة اللاتيني يجب أن يقتصر على الحروف اللاتينية والأرقام الصوتية.',
        cleanedEvidence: [],
      }
    }

    if (!sessionPrefs.rightsConfirmedOnce) {
      return {
        valid: false,
        error: 'يرجى تفعيل الإقرار بالرخصة المفتوحة مرة واحدة قبل إرسال المساهمة.',
        cleanedEvidence: [],
      }
    }

    const { cleaned, invalidUrls, tooMany } = validateEvidenceItems(evidenceList)
    if (tooMany) {
      return {
        valid: false,
        error: `لا يمكن إرفاق أكثر من ${MAX_EVIDENCE_ITEMS} روابط في المقترح الواحد.`,
        cleanedEvidence: [],
      }
    }
    if (invalidUrls.length > 0) {
      return {
        valid: false,
        error: `الرابط المرفق غير صالح (${invalidUrls[0]}). يُسمح فقط بروابط https:// أو http:// الصحيحة.`,
        cleanedEvidence: [],
      }
    }

    return { valid: true, cleanedEvidence: cleaned }
  }

  function handleSaveLocalDraft() {
    const { cleaned, invalidUrls } = validateEvidenceItems(evidenceList)
    if (invalidUrls.length > 0) {
      setFeedback({
        type: 'error',
        text: `تحقق من صحة الرابط (${invalidUrls[0]}) قبل الحفظ.`,
      })
      return
    }
    if (filledFieldsCount === 0 && cleaned.length === 0 && !reviewerNote.trim()) {
      setFeedback({
        type: 'error',
        text: 'أضف تعديلاً واحداً أو مثالاً على الأقل قبل حفظ المسودة.',
      })
      return
    }
    onSaveDraft({
      entryId: entry.id,
      headword: entry.word,
      category: entry.category,
      proposedData: buildCleanProposedData(),
      evidence: cleaned,
      reviewerNote: reviewerNote.trim(),
      updatedAt: new Date().toISOString(),
    })
    setFeedback({
      type: 'info',
      text: 'حُفظت مسودتك تلقائياً على هذا الجهاز، ويمكنك العودة إليها أو إرسالها في أي وقت.',
    })
  }

  function handleSendToSandbox() {
    const check = validateProposalInputs()
    if (!check.valid) {
      setFeedback({ type: 'error', text: check.error ?? 'تحقق من المدخلات.' })
      return
    }

    onAddSandboxSubmission({
      entryId: entry.id,
      proposedData: buildCleanProposedData(),
      evidence: check.cleanedEvidence,
      reviewerNote: reviewerNote.trim() || `مقترح تحديث على «${entry.word}»`,
      supersedesId: activeRevision ? activeRevision.id : null,
    })

    if (existingDraft) onRemoveDraft(entry.id)
    if (activeRevision) onClearRevisionTarget?.()
    setForm({})
    setEvidenceList([{ url: '', note: '' }])
    setReviewerNote('')
    setFeedback({
      type: 'success',
      text: 'أُضيف المقترح إلى طابور المحررين المحلي للفحص.',
      showSandboxJump: true,
    })
  }

  function handleResetForm() {
    setForm({})
    setArabiziManuallyEdited(false)
    setExampleArabiziManuallyEdited(false)
    setEvidenceList([{ url: '', note: '' }])
    setReviewerNote('')
    if (existingDraft) {
      onRemoveDraft(entry.id)
    }
    if (activeRevision) {
      onClearRevisionTarget?.()
    }
    setFeedback(null)
  }

  async function handleSubmit() {
    const check = validateProposalInputs()
    if (!check.valid) {
      setFeedback({ type: 'error', text: check.error ?? 'تحقق من المدخلات.' })
      return
    }

    if (!supabase) {
      handleSaveLocalDraft()
      setFeedback({
        type: 'info',
        text: 'حُفظ تعديلك كمسودة محلية بأمان لعدم توفر اتصال بالخادم حالياً.',
      })
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      // Save draft automatically so the contributor loses zero work when signing in
      onSaveDraft({
        entryId: entry.id,
        headword: entry.word,
        category: entry.category,
        proposedData: buildCleanProposedData(),
        evidence: check.cleanedEvidence,
        reviewerNote: reviewerNote.trim(),
        updatedAt: new Date().toISOString(),
      })
      setFeedback({
        type: 'info',
        text: 'حفظنا تعديلك كمسودة على جهازك؛ سجّل الدخول الآن ليُرسل باسمك مباشرةً.',
      })
      onRequireLogin()
      return
    }

    setBusy(true)
    setFeedback(null)
    const cleanProposed = buildCleanProposedData()
    const autoNote =
      reviewerNote.trim() || `مساهمة تحديث معجمي (${sessionPrefs.dialectRegion})`
    const baseInsert: Record<string, unknown> = {
      entry_id: entry.id,
      proposed_data: cleanProposed,
      evidence: check.cleanedEvidence,
      reviewer_note: autoNote,
      status: 'pending',
    }
    if (activeRevision && !activeRevision.is_sandbox) {
      baseInsert.supersedes_id = activeRevision.id
    }

    let insertRes = await supabase.from('review_submissions').insert({
      ...baseInsert,
      corpus_version: corpusVersion,
      baseline_fingerprint: cleanProposed.baseline_fingerprint ?? null,
    })
    if (insertRes.error) {
      insertRes = await supabase.from('review_submissions').insert(baseInsert)
    }
    setBusy(false)

    if (insertRes.error) {
      setFeedback({
        type: 'error',
        text: humanizeSystemError(
          insertRes.error,
          'تعذر إرسال المقترح حالياً. يرجى المحاولة لاحقاً.',
        ),
      })
      return
    }

    if (existingDraft) {
      onRemoveDraft(entry.id)
    }
    const wasRevision = Boolean(activeRevision)
    if (activeRevision) {
      onClearRevisionTarget?.()
    }
    setForm({})
    setArabiziManuallyEdited(false)
    setExampleArabiziManuallyEdited(false)
    setEvidenceList([{ url: '', note: '' }])
    setReviewerNote('')
    setIsEditOpen(false)
    setFeedback({
      type: 'success',
      text: wasRevision
        ? 'تم إرسال النسخة المنقحة بنجاح وربطها بمقترحك السابق.'
        : 'شكراً لمساهمتك! أُرسل مقترحك بنجاح وهو الآن قيد مراجعة المحررين.',
    })
    onSubmissionSuccess()
  }

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-8 dark:border-white/10 dark:bg-[#0C0C10]">
      {/* Clean Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-white/10">
        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-zinc-400">
          {canAccessEditorialTools && (
            <>
              <span className="font-mono font-semibold tabular-nums text-stone-800 dark:text-zinc-200">
                {accessionCode}
              </span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <span>الفئة: {entry.category}</span>
          {canAccessEditorialTools && (
            <>
              <span aria-hidden="true">·</span>
              <span>{formatStatusLabel(entry.status)}</span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyShareLink}
            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-xs font-medium text-stone-700 hover:bg-zinc-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-300 dark:hover:bg-white/10"
          >
            {copiedLink ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
                <span>تم نسخ الرابط</span>
              </>
            ) : (
              <>
                <Link2 className="h-3.5 w-3.5" />
                <span>مشاركة المفردة</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleCopyReference}
            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-xs font-medium text-stone-700 hover:bg-zinc-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-300 dark:hover:bg-white/10"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
                <span>تم النسخ</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>نسخ النص</span>
              </>
            )}
          </button>

          {totalFiltered > 1 && (
            <div className="flex items-center gap-1 ps-2 border-s border-zinc-200 dark:border-white/10">
              <button
                type="button"
                onClick={onPrev}
                disabled={currentIndex <= 0}
                aria-label="المفردة السابقة"
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-zinc-300 bg-zinc-50 text-stone-700 hover:bg-zinc-100 disabled:opacity-40 cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-300"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="px-1.5 font-mono text-xs tabular-nums text-stone-500 dark:text-zinc-400">
                {(currentIndex + 1).toLocaleString('en-US')} /{' '}
                {totalFiltered.toLocaleString('en-US')}
              </span>
              <button
                type="button"
                onClick={onNext}
                disabled={currentIndex >= totalFiltered - 1}
                aria-label="المفردة التالية"
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-zinc-300 bg-zinc-50 text-stone-700 hover:bg-zinc-100 disabled:opacity-40 cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-300"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Headword Focal Anchor */}
      <div className="py-6 border-b border-zinc-200 dark:border-white/10">
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h3 className="font-display text-3xl sm:text-4xl font-bold text-stone-900 dark:text-white">
              {entry.word}
            </h3>
            <span
              dir="ltr"
              className="font-mono text-base font-medium text-emerald-700 dark:text-[#D9FF43]"
            >
              {entry.latin || '—'}
            </span>
          </div>

          {phoneticAnalysis.phoneticCues.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-zinc-400">
              <Volume2
                className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-[#D9FF43]"
                aria-hidden="true"
              />
              <span>دليل النطق:</span>
              {phoneticAnalysis.phoneticCues.map((cue, idx) => (
                <span key={cue.symbol} className="inline-flex items-center gap-1">
                  {idx > 0 && <span aria-hidden="true">·</span>}
                  <strong className="font-mono text-stone-800 dark:text-zinc-200" dir="ltr">
                    {cue.symbol}
                  </strong>
                  <span>= {cue.exampleNote}</span>
                </span>
              ))}
            </div>
          )}

          {phoneticAnalysis.homographNotice && (
            <div className="rounded-xl border border-amber-300/80 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400"
                  aria-hidden="true"
                />
                <p className="leading-relaxed">
                  <strong className="font-semibold">تمييز النطق:</strong> تُقرأ هذه الكلمة{' '}
                  <span className="font-mono font-semibold" dir="ltr">
                    {entry.latin}
                  </span>
                  ، وتختلف عن:{' '}
                  {phoneticAnalysis.homographNotice.contrastReadings.map((sib, i) => (
                    <span key={sib.latin + i}>
                      {i > 0 ? ' أو ' : ''}
                      <span className="font-mono font-semibold" dir="ltr">
                        {sib.latin}
                      </span>{' '}
                      ({sib.meaningAr})
                    </span>
                  ))}
                  .
                </p>
              </div>
            </div>
          )}
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-y-5 sm:grid-cols-2 sm:gap-x-8 pt-5 border-t border-zinc-200/80 dark:border-white/10">
          <div>
            <dt className="text-xs font-medium text-stone-500 dark:text-zinc-400">
              المعنى بالعربية الفصحى
            </dt>
            <dd className="mt-1.5 text-sm font-medium leading-relaxed text-stone-900 dark:text-white">
              {entry.meaning}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium text-stone-500 dark:text-zinc-400">
              المقابل بالفرنسية
            </dt>
            <dd
              dir="ltr"
              className="mt-1.5 text-sm font-medium leading-relaxed text-end sm:text-start text-stone-900 dark:text-white"
            >
              {entry.french || '—'}
            </dd>
          </div>

          {entry.reviewNotes && (
            <div className="sm:col-span-2 pt-3 border-t border-zinc-200/80 dark:border-white/10">
              <dt className="text-xs font-medium text-stone-500 dark:text-zinc-400">
                ملاحظة تداولية
              </dt>
              <dd className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-zinc-300">
                {entry.reviewNotes}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Linked Contextual Examples */}
      <div className="py-6 border-b border-zinc-200 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-display text-sm font-bold text-stone-900 dark:text-white">
            الأمثلة السياقية ({entry.examples.length.toLocaleString('en-US')})
          </h4>
          {canAccessEditorialTools && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-emerald-700 dark:text-[#D9FF43]">
              <a
                target="_blank"
                rel="noopener noreferrer"
                href={`https://www.google.com/search?q=${encodeURIComponent(`"${entry.word}" الدارجة المغربية`)}`}
                className="inline-flex items-center gap-1 hover:underline whitespace-nowrap"
              >
                <span>بحث Google</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
              <span className="text-stone-300 dark:text-zinc-700" aria-hidden="true">
                ·
              </span>
              <a
                target="_blank"
                rel="noopener noreferrer"
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${entry.word} الدارجة المغربية`)}`}
                className="inline-flex items-center gap-1 hover:underline whitespace-nowrap"
              >
                <span>سياقات YouTube</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>
          )}
        </div>

        {entry.examples.length > 0 ? (
          <div className="mt-4 divide-y divide-zinc-200 dark:divide-white/10">
            {entry.examples.map((ex) => {
              const exVerdict = userVerdictsByExampleId?.[ex.id]?.verdict
              const exSummary = summariesByExampleId?.[ex.id]

              return (
                <div key={ex.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-[220px]">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-500 dark:text-zinc-400">
                        {canAccessEditorialTools && (
                          <>
                            <span className="font-mono tabular-nums text-stone-700 dark:text-zinc-300">
                              {ex.id}
                            </span>
                            <span aria-hidden="true">·</span>
                          </>
                        )}
                        <span>{formatRegisterLabel(ex.register)}</span>
                        {exSummary &&
                          (exSummary.accurateCount > 0 || exSummary.flaggedCount > 0) && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums text-emerald-700 dark:text-[#D9FF43]">
                                {exSummary.accurateCount} تأكيد
                                {exSummary.flaggedCount > 0
                                  ? ` / ${exSummary.flaggedCount} ملاحظة`
                                  : ''}
                              </span>
                            </>
                          )}
                      </div>

                      <p className="text-sm font-semibold leading-relaxed text-stone-900 dark:text-white">
                        «{ex.darijaAr}»
                      </p>
                      {ex.darijaLatin && (
                        <p
                          dir="ltr"
                          className="font-mono text-xs text-stone-500 text-end sm:text-start dark:text-zinc-400"
                        >
                          {ex.darijaLatin}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600 dark:text-zinc-400">
                        {ex.meaningAr && <span>المعنى: {ex.meaningAr}</span>}
                        {ex.meaningFr && (
                          <>
                            {ex.meaningAr && <span aria-hidden="true">·</span>}
                            <span dir="ltr">{ex.meaningFr}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {onRecordExampleAttestation && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            onRecordExampleAttestation({
                              entryId: entry.id,
                              exampleId: ex.id,
                              verdict: 'accurate',
                            })
                          }
                          className={`inline-flex min-h-[32px] items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                            exVerdict === 'accurate'
                              ? 'border-zinc-950 bg-zinc-950 text-white dark:border-[#D9FF43] dark:bg-[#D9FF43] dark:text-[#050507]'
                              : 'border-zinc-300 bg-zinc-50 text-stone-700 hover:bg-zinc-100 dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-300'
                          }`}
                        >
                          <Check className="h-3 w-3" aria-hidden="true" />
                          <span>مثال سليم</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onRecordExampleAttestation({
                              entryId: entry.id,
                              exampleId: ex.id,
                              verdict: 'needs_correction',
                              note: 'ملاحظة تدقيق على المثال السياقي',
                            })
                            setIsEditOpen(true)
                            setForm((prev) => ({
                              ...prev,
                              example_darija: prev.example_darija || ex.darijaAr,
                              example_arabizi: prev.example_arabizi || ex.darijaLatin,
                              example_translation: prev.example_translation || ex.meaningAr,
                              example_french: prev.example_french || ex.meaningFr,
                            }))
                            setExampleArabiziManuallyEdited(Boolean(ex.darijaLatin))
                            setTimeout(() => {
                              const inputEl = document.getElementById(
                                'detail-field-example_darija',
                              )
                              if (inputEl) {
                                inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                inputEl.focus()
                              }
                            }, 60)
                          }}
                          className={`inline-flex min-h-[32px] items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                            exVerdict === 'needs_correction'
                              ? 'border-[#FF3B2F] bg-[#FF3B2F]/10 text-[#FF3B2F] dark:border-[#FF3B2F] dark:bg-[#FF3B2F]/15 dark:text-white'
                              : 'border-zinc-300 bg-zinc-50 text-stone-700 hover:bg-zinc-100 dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-300'
                          }`}
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                          <span>تصويب المثال</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs leading-relaxed text-stone-600 dark:text-zinc-400">
              لا توجد جملة مثال مسجلة لهذه المفردة بعد. هل تود إثراءها بمثال من كلامك اليومي؟
            </p>
            {!isEditOpen && (
              <button
                type="button"
                onClick={() => {
                  setIsEditOpen(true)
                  setTimeout(() => {
                    document
                      .getElementById('detail-field-example_darija')
                      ?.focus()
                  }, 60)
                }}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-zinc-900/30 bg-zinc-50 px-3.5 py-1 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 cursor-pointer dark:border-[#D9FF43]/40 dark:bg-[#07070A] dark:text-[#D9FF43]"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>أضف مثالاً الآن</span>
              </button>
            )}
          </div>
        )}

        {/* Quiet Provenance Disclosure */}
        <div className="mt-4 pt-3 border-t border-zinc-200/80 dark:border-white/10">
          <button
            type="button"
            onClick={() => setShowProvenance((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-900 cursor-pointer dark:text-zinc-400 dark:hover:text-white"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-150 ${showProvenance ? 'rotate-180' : ''}`}
            />
            <span>معلومات المصدر والرخصة المفتوحة</span>
          </button>

          {showProvenance && (
            <dl className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-stone-600 dark:text-zinc-400">
              <div>
                <dt className="text-stone-400 dark:text-zinc-500">المصدر</dt>
                <dd className="mt-0.5 font-medium text-stone-800 dark:text-zinc-200">
                  {entry.provenance.sourceName}
                </dd>
              </div>
              <div>
                <dt className="text-stone-400 dark:text-zinc-500">الرخصة</dt>
                <dd className="mt-0.5 font-medium text-stone-800 dark:text-zinc-200">
                  {entry.provenance.license}
                </dd>
              </div>
              <div>
                <dt className="text-stone-400 dark:text-zinc-500">الاستخدام التجاري</dt>
                <dd className="mt-0.5 font-medium text-stone-800 dark:text-zinc-200">
                  {entry.provenance.commercialPermission === 'allowed'
                    ? 'مسموح'
                    : 'غير تجاري (مفتوح للبحث والتعليم)'}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </div>

      {/* Feedback Banner (Visible even after drawer closes on submit) */}
      {feedback && !isEditOpen && (
        <div
          role="status"
          className={`mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 text-xs leading-relaxed ${
            feedback.type === 'error'
              ? 'border-red-300 bg-red-50 text-red-950 dark:border-[#FF3B2F]/40 dark:bg-[#FF3B2F]/10 dark:text-red-200'
              : feedback.type === 'success'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-[#D9FF43]/40 dark:bg-[#D9FF43]/10 dark:text-[#F5F5F7]'
                : 'border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {feedback.type === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600 dark:text-[#FF3B2F]" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-700 dark:text-[#D9FF43]" />
            )}
            <span>{feedback.text}</span>
          </div>
        </div>
      )}

      {/* Progressive Disclosure CTA vs Full Contribution Drawer */}
      <div className="pt-6">
        {!isEditOpen ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-[#F5F5F7]">
                هل لديك تعديل أدق أو مثال إضافي لهذه المفردة؟
              </p>
              <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                افتح نافذة المساهمة لتصويب الكلمة أو المعنى أو إضافة جملة مثال من منطقتك.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsEditOpen(true)}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-zinc-950 px-5 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
            >
              <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>اقترح تعديلاً أو أضف مثالاً</span>
            </button>
          </div>
        ) : (
          <div>
            {activeRevision && (
              <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <GitBranch className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
                    <div>
                      <p className="font-semibold">
                        تعديل وإعادة إرسال مقترحك السابق على هذه المفردة
                      </p>
                      {activeRevision.editor_note && (
                        <p className="mt-1 leading-relaxed">
                          <strong>ملاحظة المحرر:</strong> {activeRevision.editor_note}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onClearRevisionTarget?.()}
                    aria-label="إلغاء وضع التنقيح"
                    className="inline-flex items-center gap-1 rounded-full border border-amber-400/70 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-950 hover:bg-amber-100/50 cursor-pointer dark:border-amber-500/40 dark:bg-[#07070A] dark:text-amber-200"
                  >
                    <X className="h-3 w-3" />
                    <span>إلغاء</span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-display text-base font-bold text-zinc-900 dark:text-[#F5F5F7]">
                  {activeRevision ? 'تعديل المقترح وإعادة إرساله' : 'اقتراح تعديل أو إضافة مثال'}
                </h4>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  املأ فقط الحقل الذي ترغب في تعديله أو إضافته، وستتولد الكتابة اللاتينية تلقائياً.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 cursor-pointer dark:text-zinc-400 dark:hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
                <span>طيّ النموذج</span>
              </button>
            </div>

            <div className="mt-6 space-y-6">
              {EDITABLE_FIELD_GROUPS.map((group) => (
                <fieldset key={group.groupTitle} className="space-y-3.5">
                  <legend className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                    {group.groupTitle}
                  </legend>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {group.fields.map((field) => {
                      const canAutoArabizi =
                        field.key === 'arabizi' || field.key === 'example_arabizi'
                      return (
                        <div key={field.key} className="block">
                          <div className="flex items-center justify-between gap-2">
                            <label
                              htmlFor={`detail-field-${field.key}`}
                              className="block text-xs text-zinc-600 dark:text-zinc-400"
                            >
                              {field.label}
                            </label>
                            {canAutoArabizi && (
                              <button
                                type="button"
                                onClick={() => {
                                  const sourceAr =
                                    field.key === 'arabizi'
                                      ? form.word_ar?.trim() || entry.word
                                      : form.example_darija?.trim() || ''
                                  if (sourceAr) {
                                    if (field.key === 'arabizi') setArabiziManuallyEdited(false)
                                    if (field.key === 'example_arabizi')
                                      setExampleArabiziManuallyEdited(false)
                                    setForm((prev) => ({
                                      ...prev,
                                      [field.key]: suggestMoroccanArabizi(
                                        sourceAr,
                                        corpusArabiziLookup,
                                      ),
                                    }))
                                  }
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline whitespace-nowrap cursor-pointer dark:text-[#D9FF43]"
                              >
                                <Wand2 className="h-3 w-3" />
                                <span>تحديث تلقائي</span>
                              </button>
                            )}
                          </div>
                          <input
                            id={`detail-field-${field.key}`}
                            type="text"
                            dir={field.dir}
                            value={(form[field.key] as string | undefined) ?? ''}
                            onChange={(e) => updateField(field.key, e.target.value)}
                            placeholder={field.placeholder}
                            className={`mt-1.5 w-full min-h-[40px] rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-[#F5F5F7] dark:placeholder:text-zinc-500 dark:focus:border-[#D9FF43] ${
                              field.dir === 'ltr' ? 'text-left font-mono' : ''
                            }`}
                          />
                        </div>
                      )
                    })}
                  </div>
                </fieldset>
              ))}

              {/* Collapsible Optional Sources & Note */}
              <div className="pt-4 border-t border-zinc-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAdvancedEvidence((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-950 cursor-pointer dark:text-zinc-300 dark:hover:text-white"
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-150 ${
                      showAdvancedEvidence ? 'rotate-180' : ''
                    }`}
                  />
                  <span>إرفاق ملاحظة أو رابط مصدر داعم (اختياري)</span>
                </button>

                {showAdvancedEvidence && (
                  <div className="mt-4 space-y-4">
                    <label className="block">
                      <span className="block text-xs text-zinc-600 dark:text-zinc-400">
                        ملاحظة توضيحية للمحررين (اختياري)
                      </span>
                      <textarea
                        rows={2}
                        value={reviewerNote}
                        onChange={(e) => setReviewerNote(e.target.value)}
                        placeholder="اشرح سياق الاستعمال أو سبب التعديل باختصار..."
                        className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-[#F5F5F7] dark:placeholder:text-zinc-500 dark:focus:border-[#D9FF43]"
                      />
                    </label>

                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-zinc-600 dark:text-zinc-400">
                          روابط شواهد مساندة إن وجدت (اختياري)
                        </span>
                        <button
                          type="button"
                          disabled={evidenceList.length >= MAX_EVIDENCE_ITEMS}
                          onClick={addEvidenceRow}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-40 cursor-pointer dark:text-[#D9FF43]"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>إضافة رابط آخر</span>
                        </button>
                      </div>

                      {evidenceList.map((ev, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 items-start"
                        >
                          <div className="sm:col-span-5">
                            <input
                              type="url"
                              dir="ltr"
                              placeholder="https://..."
                              value={ev.url}
                              onChange={(e) => updateEvidence(index, 'url', e.target.value)}
                              aria-label={`رابط المصدر ${index + 1}`}
                              className="w-full min-h-[40px] rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-xs text-left text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-[#F5F5F7] dark:focus:border-[#D9FF43]"
                            />
                          </div>
                          <div
                            className={
                              evidenceList.length > 1 ? 'sm:col-span-6' : 'sm:col-span-7'
                            }
                          >
                            <input
                              type="text"
                              placeholder="وصف مختصر للمصدر..."
                              value={ev.note}
                              onChange={(e) => updateEvidence(index, 'note', e.target.value)}
                              aria-label={`توضيح المصدر ${index + 1}`}
                              className="w-full min-h-[40px] rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-[#F5F5F7] dark:focus:border-[#D9FF43]"
                            />
                          </div>
                          {evidenceList.length > 1 && (
                            <div className="sm:col-span-1 flex justify-end">
                              <button
                                type="button"
                                onClick={() => removeEvidenceRow(index)}
                                aria-label="حذف هذا الرابط"
                                className="flex h-[40px] w-[40px] items-center justify-center rounded-xl border border-zinc-300 text-zinc-500 hover:text-red-700 hover:border-red-300 cursor-pointer dark:border-white/15 dark:text-zinc-400 dark:hover:text-[#FF3B2F] dark:hover:border-[#FF3B2F]/40"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Compact One-Time Session Preferences Bar */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 space-y-3 dark:border-white/10 dark:bg-[#07070A]">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                      <span>منطقتي:</span>
                      <select
                        value={sessionPrefs.dialectRegion}
                        onChange={(e) =>
                          onUpdateSessionPrefs({ dialectRegion: e.target.value })
                        }
                        className="min-h-[32px] rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-900 dark:border-white/15 dark:bg-[#0C0C10] dark:text-[#F5F5F7]"
                      >
                        {MOROCCAN_REGIONS.map((reg) => (
                          <option key={reg} value={reg}>
                            {reg}
                          </option>
                        ))}
                      </select>
                    </label>

                    <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">
                      ·
                    </span>

                    <label className="inline-flex items-center gap-2 cursor-pointer text-zinc-700 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        checked={sessionPrefs.rightsConfirmedOnce}
                        onChange={(e) =>
                          onUpdateSessionPrefs({ rightsConfirmedOnce: e.target.checked })
                        }
                        className="h-4 w-4 accent-zinc-950 dark:accent-[#D9FF43]"
                      />
                      <span>مساهمة أصلية متاحة للمعجم المفتوح (تُحفظ تلقائياً)</span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowPrefsEditor((v) => !v)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-900 cursor-pointer dark:text-zinc-400 dark:hover:text-white"
                  >
                    <SlidersHorizontal className="h-3 w-3" />
                    <span>{showPrefsEditor ? 'إخفاء الخيارات' : 'خيارات الرخصة'}</span>
                  </button>
                </div>

                {showPrefsEditor && (
                  <div className="pt-2.5 border-t border-zinc-200 dark:border-white/10">
                    <label className="block max-w-md text-xs text-zinc-600 dark:text-zinc-400">
                      <span>إذن استخدام مساهماتي في تدريب النماذج اللغوية مستقبلاً:</span>
                      <select
                        value={sessionPrefs.trainingPermission}
                        onChange={(e) =>
                          onUpdateSessionPrefs({
                            trainingPermission: e.target.value as DataPermission,
                          })
                        }
                        className="mt-1.5 w-full min-h-[36px] rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 dark:border-white/15 dark:bg-[#0C0C10] dark:text-[#F5F5F7]"
                      >
                        <option value="not_allowed">غير مسموح (للبحث والمعجم فقط)</option>
                        <option value="allowed">مسموح</option>
                        <option value="not_applicable">لا ينطبق</option>
                      </select>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Form Actions */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-5 border-t border-zinc-200 dark:border-white/10">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={busy}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-zinc-950 px-5 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
                >
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{busy ? 'جارٍ الإرسال...' : 'إرسال للمراجعة'}</span>
                </button>

                {canAccessEditorialTools && (
                  <button
                    type="button"
                    onClick={handleSendToSandbox}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-emerald-700/40 bg-zinc-50 px-4 py-2.5 text-xs font-semibold text-emerald-800 hover:bg-zinc-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer dark:border-[#D9FF43]/40 dark:bg-[#07070A] dark:text-[#D9FF43] dark:hover:bg-white/5"
                  >
                    <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>إرسال لطابور الاختبار</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSaveLocalDraft}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:bg-white/5"
                >
                  <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>حفظ كمسودة</span>
                </button>

                {(filledFieldsCount > 0 || reviewerNote || existingDraft) && (
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="min-h-[42px] px-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-900 whitespace-nowrap shrink-0 cursor-pointer dark:text-zinc-400 dark:hover:text-white"
                  >
                    مسح الحقول
                  </button>
                )}
              </div>
            </div>

            {feedback && (
              <div
                role="status"
                className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 text-xs leading-relaxed ${
                  feedback.type === 'error'
                    ? 'border-red-300 bg-red-50 text-red-950 dark:border-[#FF3B2F]/40 dark:bg-[#FF3B2F]/10 dark:text-red-200'
                    : feedback.type === 'success'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-[#D9FF43]/40 dark:bg-[#D9FF43]/10 dark:text-[#F5F5F7]'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {feedback.type === 'error' ? (
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600 dark:text-[#FF3B2F]" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-700 dark:text-[#D9FF43]" />
                  )}
                  <span>{feedback.text}</span>
                </div>
                {feedback.showSandboxJump && canAccessEditorialTools && (
                  <button
                    type="button"
                    onClick={onOpenModerationSandbox}
                    className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline whitespace-nowrap cursor-pointer dark:text-[#D9FF43]"
                  >
                    <span>افتح لوحة المحررين</span>
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
