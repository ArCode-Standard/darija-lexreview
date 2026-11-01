import { useEffect, useState } from 'react'
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
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type {
  DataPermission,
  EvidenceItem,
  LexicalEntry,
  LocalDraft,
  ProposedFields,
} from '../../types/lexicon'
import {
  formatAccessionCode,
  formatRegisterLabel,
  formatStatusLabel,
} from '../../services/dataset'
import { validateEvidenceItems } from '../../utils/validation'

interface EntryDetailSheetProps {
  entry: LexicalEntry
  currentIndex: number
  totalFiltered: number
  existingDraft?: LocalDraft
  onPrev: () => void
  onNext: () => void
  onSaveDraft: (draft: LocalDraft) => void
  onRemoveDraft: (entryId: string) => void
  onAddSandboxSubmission: (params: {
    entryId: string
    proposedData: ProposedFields
    evidence: EvidenceItem[]
    reviewerNote: string | null
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
    groupTitle: '١. الضبط الكتابي والصوتي',
    fields: [
      {
        key: 'word_ar',
        label: 'الكتابة بالعربية المقترحة',
        placeholder: 'اتركه فارغاً إذا كان الرسم الحالي دقيقاً',
      },
      {
        key: 'arabizi',
        label: 'الكتابة اللاتينية (Arabizi)',
        placeholder: 'مثال: bzzaf / wakha',
        dir: 'ltr',
      },
    ],
  },
  {
    groupTitle: '٢. الدلالة والمقابلات الترجمية',
    fields: [
      {
        key: 'msa_translation',
        label: 'المقابل بالعربية الفصحى',
        placeholder: 'المرادف الفصيح المباشر...',
      },
      {
        key: 'french_translation',
        label: 'المقابل بالفرنسية',
        placeholder: 'Ex: Beaucoup, tout à fait...',
        dir: 'ltr',
      },
      {
        key: 'meaning',
        label: 'توضيح دلالي إضافي',
        placeholder: 'تفصيل المعاني الفرعية إن وجدت...',
      },
      {
        key: 'usage_note',
        label: 'ملاحظة تداولية أو لهجية',
        placeholder: 'سياق الاستعمال، التوزيع الجغرافي، أو القيود النحوية...',
      },
    ],
  },
  {
    groupTitle: '٣. إضافة شاهد سياقي جديد للمدخل',
    fields: [
      {
        key: 'example_darija',
        label: 'جملة طبيعية بالدارجة المغربية (عربي)',
        placeholder: 'أدخل جملة متداولة يظهر فيها معنى المدخل بوضوح...',
      },
      {
        key: 'example_arabizi',
        label: 'الكتابة اللاتينية للشاهد (Arabizi)',
        placeholder: 'مطلوب لإدراج الشاهد في context-examples.json',
        dir: 'ltr',
      },
      {
        key: 'example_translation',
        label: 'ترجمة الشاهد إلى الفصحى',
        placeholder: 'المعنى المقابل بالعربية الفصحى...',
      },
      {
        key: 'example_french',
        label: 'ترجمة الشاهد إلى الفرنسية',
        placeholder: 'Traduction de la phrase en français...',
        dir: 'ltr',
      },
    ],
  },
]

export function EntryDetailSheet({
  entry,
  currentIndex,
  totalFiltered,
  existingDraft,
  onPrev,
  onNext,
  onSaveDraft,
  onRemoveDraft,
  onAddSandboxSubmission,
  onOpenModerationSandbox,
  onRequireLogin,
  onSubmissionSuccess,
}: EntryDetailSheetProps) {
  const [form, setForm] = useState<ProposedFields>({})
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [trainingPermission, setTrainingPermission] = useState<DataPermission>('not_allowed')
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([{ url: '', note: '' }])
  const [reviewerNote, setReviewerNote] = useState('')
  const [showProvenance, setShowProvenance] = useState(false)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: 'error' | 'success' | 'info'
    text: string
    showSandboxJump?: boolean
  } | null>(null)

  useEffect(() => {
    if (existingDraft) {
      setForm(existingDraft.proposedData ?? {})
      setRightsConfirmed(Boolean(existingDraft.proposedData?.rights_confirmed))
      setTrainingPermission(existingDraft.proposedData?.training_permission ?? 'not_allowed')
      setEvidenceList(
        existingDraft.evidence.length > 0 ? existingDraft.evidence : [{ url: '', note: '' }],
      )
      setReviewerNote(existingDraft.reviewerNote ?? '')
    } else {
      setForm({})
      setRightsConfirmed(false)
      setTrainingPermission('not_allowed')
      setEvidenceList([{ url: '', note: '' }])
      setReviewerNote('')
    }
    setFeedback(null)
  }, [entry.id, existingDraft])

  const accessionCode = formatAccessionCode(entry.id, entry.numericId)

  const filledFieldsCount = Object.entries(form).filter(
    ([key, v]) => key !== 'submission_kind' && typeof v === 'string' && v.trim() !== '',
  ).length

  function updateField(key: keyof ProposedFields, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function updateEvidence(idx: number, key: keyof EvidenceItem, value: string) {
    setEvidenceList((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [key]: value } : item)),
    )
  }

  function addEvidenceRow() {
    setEvidenceList((prev) => [...prev, { url: '', note: '' }])
  }

  function removeEvidenceRow(idx: number) {
    setEvidenceList((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))
  }

  function handleCopyReference() {
    const refText = `${accessionCode} — ${entry.word} (${entry.latin}): ${entry.meaning}`
    navigator.clipboard?.writeText(refText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  function buildCleanProposedData(): ProposedFields {
    const out: ProposedFields = { submission_kind: 'edit_entry' }
    for (const [k, v] of Object.entries(form)) {
      if (
        k === 'rights_holder' ||
        k === 'license' ||
        k === 'redistribution_permission' ||
        k === 'training_permission' ||
        k === 'commercial_permission'
      ) {
        continue
      }
      if (typeof v === 'string' && v.trim()) {
        ;(out as Record<string, unknown>)[k] = v.trim()
      }
    }
    out.rights_confirmed = rightsConfirmed
    out.rights_holder = rightsConfirmed ? 'contributor' : 'unknown'
    out.license = rightsConfirmed ? 'CC BY-NC 4.0' : 'unknown'
    out.redistribution_permission = rightsConfirmed ? 'allowed' : 'unknown'
    out.training_permission = rightsConfirmed ? trainingPermission : 'unknown'
    out.commercial_permission = rightsConfirmed ? 'not_allowed' : 'unknown'
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
        error: 'أدخل تعديلاً في حقل واحد على الأقل أو اكتب ملاحظة مراجعة.',
        cleanedEvidence: [],
      }
    }

    if (form.example_darija?.trim() && !form.example_arabizi?.trim()) {
      return {
        valid: false,
        error: 'أدخل الكتابة اللاتينية (Arabizi) للشاهد السياقي الجديد حتى يتوافق مع مخطط context-schema.json.',
        cleanedEvidence: [],
      }
    }

    const { cleaned, invalidUrls } = validateEvidenceItems(evidenceList)
    if (invalidUrls.length > 0) {
      return {
        valid: false,
        error: `رابط شاهد غير صالح أو غير آمن (${invalidUrls[0]}). يُسمح فقط بروابط https:// أو http:// الصحيحة.`,
        cleanedEvidence: [],
      }
    }

    if (cleaned.length === 0 && !reviewerNote.trim()) {
      return {
        valid: false,
        error: 'أرفق رابط شاهد واحداً على الأقل أو اشرح مبرر المراجعة في حقل الملاحظات التحريرية.',
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
        text: `تحقق من صحة رابط الشاهد (${invalidUrls[0]}) قبل الحفظ.`,
      })
      return
    }
    if (filledFieldsCount === 0 && cleaned.length === 0 && !reviewerNote.trim()) {
      setFeedback({
        type: 'error',
        text: 'أضف تعديلاً واحداً أو ملاحظة على الأقل قبل حفظ المسودة.',
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
      text: 'تم حفظ المسودة محلياً في متصفحك. يمكنك العودة إليها أو تصديرها في أي وقت.',
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
      reviewerNote: reviewerNote.trim() || null,
    })

    if (existingDraft) onRemoveDraft(entry.id)
    setForm({})
    setRightsConfirmed(false)
    setTrainingPermission('not_allowed')
    setEvidenceList([{ url: '', note: '' }])
    setReviewerNote('')
    setFeedback({
      type: 'success',
      text: 'أُضيف المقترح إلى طابور المحاكاة التحريرية المحلية لفحصه واعتماده وتجربة تصديره.',
      showSandboxJump: true,
    })
  }

  function handleResetForm() {
    setForm({})
    setRightsConfirmed(false)
    setTrainingPermission('not_allowed')
    setEvidenceList([{ url: '', note: '' }])
    setReviewerNote('')
    if (existingDraft) {
      onRemoveDraft(entry.id)
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
      setFeedback({
        type: 'error',
        text: 'اتصال Supabase غير مهيأ. يمكنك إرسال مقترحك إلى «طابور المحاكاة المحلي» أو حفظه كمسودة.',
      })
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setFeedback({
        type: 'error',
        text: 'يلزم تسجيل الدخول بحساب مراجع قبل إرسال المقترح إلى سجل التحكيم الحي.',
      })
      onRequireLogin()
      return
    }

    setBusy(true)
    setFeedback(null)
    const { error } = await supabase.from('review_submissions').insert({
      entry_id: entry.id,
      proposed_data: buildCleanProposedData(),
      evidence: check.cleanedEvidence,
      reviewer_note: reviewerNote.trim() || null,
      status: 'pending',
    })
    setBusy(false)

    if (error) {
      setFeedback({ type: 'error', text: `تعذر إرسال المقترح: ${error.message}` })
      return
    }

    if (existingDraft) {
      onRemoveDraft(entry.id)
    }
    setForm({})
    setEvidenceList([{ url: '', note: '' }])
    setReviewerNote('')
    setFeedback({
      type: 'success',
      text: 'تم تسجيل المقترح في سجل التحكيم بحالة قيد المراجعة (pending). لا يتغير المعجم الرسمي إلا بعد اعتماد المحررين.',
    })
    onSubmissionSuccess()
  }

  return (
    <article className="rounded-xl border border-[#E5DFD3] bg-white p-5 sm:p-8 dark:border-[#2E2B27] dark:bg-[#1C1A18]">
      {/* Accession Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E5DFD3] dark:border-[#2E2B27]">
        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
          <span className="font-mono font-semibold tabular-nums text-stone-800 dark:text-stone-200">
            {accessionCode}
          </span>
          <span aria-hidden="true">·</span>
          <span>الفئة: {entry.category}</span>
          <span aria-hidden="true">·</span>
          <span>الحالة: {formatStatusLabel(entry.status)}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyReference}
            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-[#EFECE4] transition-colors whitespace-nowrap shrink-0 cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-300 dark:hover:bg-[#262320]"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                <span>تم النسخ</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>نسخ المرجع</span>
              </>
            )}
          </button>

          {totalFiltered > 1 && (
            <div className="flex items-center gap-1 ps-2 border-s border-[#E5DFD3] dark:border-[#2E2B27]">
              <button
                type="button"
                onClick={onPrev}
                disabled={currentIndex <= 0}
                aria-label="المدخل السابق"
                className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] text-stone-700 hover:bg-[#EFECE4] disabled:opacity-40 cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-300"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="px-1.5 font-mono text-xs tabular-nums text-stone-500 dark:text-stone-400">
                {(currentIndex + 1).toLocaleString('en-US')} / {totalFiltered.toLocaleString('en-US')}
              </span>
              <button
                type="button"
                onClick={onNext}
                disabled={currentIndex >= totalFiltered - 1}
                aria-label="المدخل التالي"
                className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] text-stone-700 hover:bg-[#EFECE4] disabled:opacity-40 cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-300"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Headword Focal Anchor */}
      <div className="py-6 border-b border-[#E5DFD3] dark:border-[#2E2B27]">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h3 className="font-display text-3xl sm:text-4xl font-bold text-stone-900 dark:text-stone-100">
            {entry.word}
          </h3>
          <span
            dir="ltr"
            className="font-mono text-base font-medium text-stone-600 dark:text-stone-300"
          >
            {entry.latin || '—'}
          </span>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-y-5 sm:grid-cols-2 sm:gap-x-8 pt-5 border-t border-[#E5DFD3]/70 dark:border-[#2E2B27]">
          <div>
            <dt className="text-xs font-medium text-stone-500 dark:text-stone-400">
              المقابل بالعربية الفصحى
            </dt>
            <dd className="mt-1.5 text-sm font-medium leading-relaxed text-stone-900 dark:text-stone-100">
              {entry.meaning}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium text-stone-500 dark:text-stone-400">
              المقابل الفرنسي المسجل
            </dt>
            <dd
              dir="ltr"
              className="mt-1.5 text-sm font-medium leading-relaxed text-end sm:text-start text-stone-900 dark:text-stone-100"
            >
              {entry.french}
            </dd>
          </div>

          {entry.reviewNotes && (
            <div className="sm:col-span-2 pt-3 border-t border-[#E5DFD3]/60 dark:border-[#2E2B27]">
              <dt className="text-xs font-medium text-stone-500 dark:text-stone-400">
                ملاحظة السجل التحريري
              </dt>
              <dd className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-stone-300">
                {entry.reviewNotes}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Linked Contextual Examples */}
      <div className="py-6 border-b border-[#E5DFD3] dark:border-[#2E2B27]">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-display text-sm font-bold text-stone-900 dark:text-stone-100">
            الشواهد السياقية المرتبطة ({entry.examples.length.toLocaleString('en-US')})
          </h4>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#0F5C4E] dark:text-[#4FD1C5]">
            <a
              target="_blank"
              rel="noopener noreferrer"
              href={`https://www.google.com/search?q=${encodeURIComponent(`"${entry.word}" الدارجة المغربية`)}`}
              className="inline-flex items-center gap-1 hover:underline whitespace-nowrap"
            >
              <span>بحث Google</span>
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
            <span className="text-stone-300 dark:text-stone-700" aria-hidden="true">·</span>
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
        </div>

        {entry.examples.length > 0 ? (
          <div className="mt-4 divide-y divide-[#E5DFD3] dark:divide-[#2E2B27]">
            {entry.examples.map((ex) => (
              <div key={ex.id} className="py-3.5 first:pt-0 last:pb-0">
                <p className="text-sm font-semibold leading-relaxed text-stone-900 dark:text-stone-100">
                  «{ex.darijaAr}»
                </p>
                {ex.darijaLatin && (
                  <p dir="ltr" className="mt-1 font-mono text-xs text-stone-500 text-end sm:text-start dark:text-stone-400">
                    {ex.darijaLatin}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-stone-600 dark:text-stone-400">
                  {ex.meaningAr && <span>الفصحى: {ex.meaningAr}</span>}
                  {ex.meaningFr && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span dir="ltr">{ex.meaningFr}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>{formatRegisterLabel(ex.register)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
            لا يوجد شاهد سياقي مربوط بهذا المدخل في ملف الأمثلة الحالي. يمكنك المساهمة بإضافة جملة طبيعية موثقة في النموذج أدناه.
          </p>
        )}

        {/* Provenance Disclosure */}
        <div className="mt-4 pt-3 border-t border-[#E5DFD3]/70 dark:border-[#2E2B27]">
          <button
            type="button"
            onClick={() => setShowProvenance((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 cursor-pointer dark:text-stone-400 dark:hover:text-stone-200"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-150 ${showProvenance ? 'rotate-180' : ''}`}
            />
            <span>بيانات المصدر والترخيص ({entry.provenance.license})</span>
          </button>

          {showProvenance && (
            <dl className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-stone-600 dark:text-stone-400">
              <div>
                <dt className="text-stone-400 dark:text-stone-500">المصدر</dt>
                <dd className="mt-0.5 font-medium text-stone-800 dark:text-stone-200">
                  {entry.provenance.sourceName}
                </dd>
              </div>
              <div>
                <dt className="text-stone-400 dark:text-stone-500">صاحب الحقوق</dt>
                <dd className="mt-0.5 font-medium text-stone-800 dark:text-stone-200">
                  {entry.provenance.rightsHolder}
                </dd>
              </div>
              <div>
                <dt className="text-stone-400 dark:text-stone-500">الاستخدام التجاري</dt>
                <dd className="mt-0.5 font-medium text-stone-800 dark:text-stone-200">
                  {entry.provenance.commercialPermission === 'allowed' ? 'مسموح' : 'غير مسموح (CC BY-NC)'}
                </dd>
              </div>
              {entry.provenance.notes && (
                <div className="sm:col-span-3">
                  <dd className="leading-relaxed">{entry.provenance.notes}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </div>

      {/* Structured Contribution & Evidence Form */}
      <div className="pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h4 className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
              اقتراح تصحيح أو إثراء معجمي
            </h4>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
              املأ فقط الحقول التي تقترح تعديلها أو استكمالها، وأرفق شاهداً مستقلاً يثبت الاستعمال.
            </p>
          </div>
          {filledFieldsCount > 0 && (
            <span className="font-mono text-xs font-medium text-[#0F5C4E] tabular-nums dark:text-[#4FD1C5]">
              تم تحرير {filledFieldsCount} حقول
            </span>
          )}
        </div>

        <div className="mt-6 space-y-7">
          {EDITABLE_FIELD_GROUPS.map((group) => (
            <fieldset key={group.groupTitle} className="space-y-3.5">
              <legend className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                {group.groupTitle}
              </legend>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {group.fields.map((field) => (
                  <label key={field.key} className="block">
                    <span className="block text-xs text-stone-600 dark:text-stone-400">
                      {field.label}
                    </span>
                    <input
                      type="text"
                      dir={field.dir}
                      value={(form[field.key] as string | undefined) ?? ''}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className={`mt-1.5 w-full min-h-[40px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3.5 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-[#0F5C4E] focus:bg-white focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100 dark:focus:border-[#4FD1C5] ${
                        field.dir === 'ltr' ? 'text-left font-mono' : ''
                      }`}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          {/* Multi-Evidence Builder */}
          <div className="pt-5 border-t border-[#E5DFD3] dark:border-[#2E2B27]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h5 className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                  ٤. الشواهد ومصادر التحقق المستقلة
                </h5>
                <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                  أرفق رابطاً صحيحاً يبدأ بـ https:// يوضح ورود الكلمة في سياق مغربي أصيل.
                </p>
              </div>
              <button
                type="button"
                onClick={addEvidenceRow}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-[#EFECE4] whitespace-nowrap shrink-0 cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-200 dark:hover:bg-[#262320]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>إضافة شاهد آخر</span>
              </button>
            </div>

            <div className="mt-4 space-y-3">
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
                      aria-label={`رابط الشاهد ${index + 1}`}
                      className="w-full min-h-[40px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-2 font-mono text-xs text-left text-stone-900 placeholder:text-stone-400 focus:border-[#0F5C4E] focus:bg-white focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                    />
                  </div>
                  <div className={evidenceList.length > 1 ? 'sm:col-span-6' : 'sm:col-span-7'}>
                    <input
                      type="text"
                      placeholder="وصف موضع الشاهد (الدقيقة، السياق، أو المنطقة)..."
                      value={ev.note}
                      onChange={(e) => updateEvidence(index, 'note', e.target.value)}
                      aria-label={`توضيح الشاهد ${index + 1}`}
                      className="w-full min-h-[40px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-[#0F5C4E] focus:bg-white focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                    />
                  </div>
                  {evidenceList.length > 1 && (
                    <div className="sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeEvidenceRow(index)}
                        aria-label="حذف هذا الشاهد"
                        className="flex h-[40px] w-[40px] items-center justify-center rounded-lg border border-[#D6CEBE] text-stone-500 hover:text-red-700 hover:border-red-300 cursor-pointer dark:border-[#3A3530] dark:text-stone-400 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <label className="mt-4 block">
              <span className="block text-xs text-stone-600 dark:text-stone-400">
                مذكرة المراجع العامة للمحررين
              </span>
              <textarea
                rows={3}
                value={reviewerNote}
                onChange={(e) => setReviewerNote(e.target.value)}
                placeholder="اشرح مبرر التعديل، درجة شيوع المفردة، أو سبب تعذر إرفاق رابط خارجي..."
                className="mt-1.5 w-full rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] p-3 text-xs leading-relaxed text-stone-900 placeholder:text-stone-400 focus:border-[#0F5C4E] focus:bg-white focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
              />
            </label>

            <div className="mt-4 space-y-3 pt-4 border-t border-[#E5DFD3] dark:border-[#2E2B27]">
              <label className="block max-w-xl">
                <span className="block text-xs text-stone-600 dark:text-stone-400">
                  إذن استخدام الشاهد أو الصياغة المضافة في تدريب نماذج الذكاء الاصطناعي
                </span>
                <select
                  value={trainingPermission}
                  onChange={(e) => setTrainingPermission(e.target.value as DataPermission)}
                  className="mt-1.5 w-full min-h-[40px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-2 text-xs text-stone-900 focus:border-[#0F5C4E] focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                >
                  <option value="not_allowed">غير مسموح</option>
                  <option value="allowed">مسموح</option>
                  <option value="not_applicable">لا ينطبق</option>
                </select>
              </label>

              <label className="flex items-start gap-2.5 rounded-lg border border-[#E5DFD3] bg-[#FBF9F5] p-3 cursor-pointer dark:border-[#2E2B27] dark:bg-[#141312]">
                <input
                  type="checkbox"
                  checked={rightsConfirmed}
                  onChange={(e) => setRightsConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#0F5C4E] shrink-0"
                />
                <span className="text-xs leading-relaxed text-stone-700 dark:text-stone-300">
                  أقرّ بأن التعديل أو الشاهد المضاف من صياغتي الأصلية أو من استعمال لغوي عام غير منقول حرفياً من مصدر محمي، وأملك حق إتاحته ضمن CC BY-NC 4.0 (إن تُرك دون تأكيد تبقى بيانات الحقوق <span className="font-mono">unknown</span> لحين المراجعة البشرية).
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-5 border-t border-[#E5DFD3] dark:border-[#2E2B27]">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#0F5C4E] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#0B463B] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer dark:bg-[#147A67] dark:hover:bg-[#0F5C4E]"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{busy ? 'جارٍ الإرسال...' : 'إرسال للمراجعة'}</span>
            </button>

            <button
              type="button"
              onClick={handleSendToSandbox}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-[#0F5C4E]/40 bg-[#FBF9F5] px-4 py-2.5 text-xs font-semibold text-[#0F5C4E] hover:bg-[#EFECE4] transition-colors whitespace-nowrap shrink-0 cursor-pointer dark:border-[#4FD1C5]/40 dark:bg-[#141312] dark:text-[#4FD1C5]"
            >
              <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
              <span>تجربة في المحاكاة</span>
            </button>

            <button
              type="button"
              onClick={handleSaveLocalDraft}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-4 py-2.5 text-xs font-semibold text-stone-800 hover:bg-[#EFECE4] transition-colors whitespace-nowrap shrink-0 cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-200 dark:hover:bg-[#262320]"
            >
              <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
              <span>حفظ مسودة محلية</span>
            </button>

            {(filledFieldsCount > 0 || reviewerNote || existingDraft) && (
              <button
                type="button"
                onClick={handleResetForm}
                className="min-h-[42px] px-3 py-2 text-xs font-medium text-stone-500 hover:text-stone-900 whitespace-nowrap shrink-0 cursor-pointer dark:text-stone-400 dark:hover:text-stone-100"
              >
                مسح الحقول
              </button>
            )}
          </div>
        </div>

        {feedback && (
          <div
            role="status"
            className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3.5 text-xs leading-relaxed ${
              feedback.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200'
                : feedback.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : 'border-[#D6CEBE] bg-[#F3EFE6] text-stone-800 dark:border-[#3A3530] dark:bg-[#262320] dark:text-stone-200'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {feedback.type === 'error' ? (
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <span>{feedback.text}</span>
            </div>
            {feedback.showSandboxJump && (
              <button
                type="button"
                onClick={onOpenModerationSandbox}
                className="inline-flex items-center gap-1 font-semibold text-[#0F5C4E] hover:underline whitespace-nowrap cursor-pointer dark:text-[#4FD1C5]"
              >
                <span>افتح لوحة المحررين</span>
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
