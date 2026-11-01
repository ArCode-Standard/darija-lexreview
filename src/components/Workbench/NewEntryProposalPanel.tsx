import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Trash2,
  Send,
  Bookmark,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  FlaskConical,
  GitBranch,
  X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type {
  DataPermission,
  EntryType,
  EvidenceItem,
  LexicalEntry,
  LocalDraft,
  ProposedFields,
  RegisterType,
  SourceType,
  SubmissionRecord,
} from '../../types/lexicon'
import {
  ARABIZI_CONVENTIONS,
  ENTRY_TYPE_OPTIONS,
  MAX_EVIDENCE_ITEMS,
  MOROCCAN_REGIONS,
  REGISTER_OPTIONS,
  SOURCE_TYPE_OPTIONS,
  containsArabicScript,
  findSimilarCorpusEntries,
  isValidArabizi,
  validateEvidenceItems,
} from '../../utils/validation'
import { formatAccessionCode } from '../../services/dataset'

interface NewEntryProposalPanelProps {
  entries: LexicalEntry[]
  categories: string[]
  activeDraft?: LocalDraft | null
  onClearActiveDraft?: () => void
  revisionTarget?: SubmissionRecord | null
  onClearRevisionTarget?: () => void
  onInspectExistingEntry: (entry: LexicalEntry) => void
  onSaveDraft: (draft: LocalDraft) => void
  onAddSandboxSubmission: (params: {
    entryId: string
    proposedData: ProposedFields
    evidence: EvidenceItem[]
    reviewerNote: string | null
    supersedesId?: string | null
  }) => void
  onRequireLogin: () => void
  onSubmissionSuccess: () => void
  onOpenModerationSandbox: () => void
}

export function NewEntryProposalPanel({
  entries,
  categories,
  activeDraft,
  onClearActiveDraft,
  revisionTarget,
  onClearRevisionTarget,
  onInspectExistingEntry,
  onSaveDraft,
  onAddSandboxSubmission,
  onRequireLogin,
  onSubmissionSuccess,
  onOpenModerationSandbox,
}: NewEntryProposalPanelProps) {
  const [wordAr, setWordAr] = useState('')
  const [arabizi, setArabizi] = useState('')
  const [category, setCategory] = useState(categories[0] ?? 'التواصل')
  const [msaTranslation, setMsaTranslation] = useState('')
  const [frenchTranslation, setFrenchTranslation] = useState('')
  const [entryType, setEntryType] = useState<EntryType>('word')
  const [register, setRegister] = useState<RegisterType>('neutral')
  const [selectedRegions, setSelectedRegions] = useState<string[]>(['مشترك عام'])
  const [usageNote, setUsageNote] = useState('')

  const [exampleDarija, setExampleDarija] = useState('')
  const [exampleArabizi, setExampleArabizi] = useState('')
  const [exampleTranslation, setExampleTranslation] = useState('')
  const [exampleFrench, setExampleFrench] = useState('')

  const [sourceType, setSourceType] = useState<SourceType>('contributor')
  const [sourceName, setSourceName] = useState('')
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [trainingPermission, setTrainingPermission] = useState<DataPermission>('not_allowed')

  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([{ url: '', note: '' }])
  const [reviewerNote, setReviewerNote] = useState('')

  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: 'error' | 'success' | 'info'
    text: string
    showSandboxJump?: boolean
  } | null>(null)

  useEffect(() => {
    if (!activeDraft) return
    const p = activeDraft.proposedData ?? {}
    setWordAr(p.word_ar ?? '')
    setArabizi(p.arabizi ?? '')
    if (p.category) setCategory(p.category)
    setMsaTranslation(p.msa_translation ?? p.meaning ?? '')
    setFrenchTranslation(p.french_translation ?? '')
    if (p.entry_type) setEntryType(p.entry_type)
    if (p.register) setRegister(p.register)
    if (Array.isArray(p.regions) && p.regions.length > 0) setSelectedRegions(p.regions)
    setUsageNote(p.usage_note ?? '')
    setExampleDarija(p.example_darija ?? '')
    setExampleArabizi(p.example_arabizi ?? '')
    setExampleTranslation(p.example_translation ?? '')
    setExampleFrench(p.example_french ?? '')
    if (p.source_type) setSourceType(p.source_type)
    setSourceName(p.source_name ?? '')
    setRightsConfirmed(Boolean(p.rights_confirmed))
    setTrainingPermission(p.training_permission ?? 'not_allowed')
    setEvidenceList(
      activeDraft.evidence.length > 0 ? activeDraft.evidence : [{ url: '', note: '' }],
    )
    setReviewerNote(activeDraft.reviewerNote ?? '')
    onClearActiveDraft?.()
  }, [activeDraft, onClearActiveDraft])

  useEffect(() => {
    if (!revisionTarget) return
    const p = revisionTarget.proposed_data ?? {}
    setWordAr(p.word_ar ?? '')
    setArabizi(p.arabizi ?? '')
    if (p.category) setCategory(p.category)
    setMsaTranslation(p.msa_translation ?? p.meaning ?? '')
    setFrenchTranslation(p.french_translation ?? '')
    if (p.entry_type) setEntryType(p.entry_type)
    if (p.register) setRegister(p.register)
    if (Array.isArray(p.regions) && p.regions.length > 0) setSelectedRegions(p.regions)
    setUsageNote(p.usage_note ?? '')
    setExampleDarija(p.example_darija ?? '')
    setExampleArabizi(p.example_arabizi ?? '')
    setExampleTranslation(p.example_translation ?? '')
    setExampleFrench(p.example_french ?? '')
    if (p.source_type) setSourceType(p.source_type)
    setSourceName(p.source_name ?? '')
    setRightsConfirmed(Boolean(p.rights_confirmed))
    setTrainingPermission(p.training_permission ?? 'not_allowed')
    setEvidenceList(
      Array.isArray(revisionTarget.evidence) && revisionTarget.evidence.length > 0
        ? revisionTarget.evidence
        : [{ url: '', note: '' }],
    )
    setReviewerNote(revisionTarget.reviewer_note ?? '')
    setFeedback(null)
  }, [revisionTarget])

  const similarEntries = useMemo(
    () => findSimilarCorpusEntries(entries, wordAr, arabizi),
    [entries, wordAr, arabizi],
  )

  function toggleRegion(regionName: string) {
    setSelectedRegions((prev) =>
      prev.includes(regionName)
        ? prev.filter((r) => r !== regionName)
        : [...prev, regionName],
    )
  }

  function updateEvidence(idx: number, key: keyof EvidenceItem, val: string) {
    setEvidenceList((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [key]: val } : item)),
    )
  }

  function buildProposedData(): ProposedFields {
    return {
      submission_kind: 'new_entry',
      word_ar: wordAr.trim(),
      arabizi: arabizi.trim(),
      category: category.trim(),
      msa_translation: msaTranslation.trim(),
      meaning: msaTranslation.trim(),
      french_translation: frenchTranslation.trim(),
      entry_type: entryType,
      register,
      regions: selectedRegions,
      usage_note: usageNote.trim() || undefined,
      example_darija: exampleDarija.trim(),
      example_arabizi: exampleArabizi.trim(),
      example_translation: exampleTranslation.trim() || undefined,
      example_french: exampleFrench.trim() || undefined,
      source_type: sourceType,
      source_name: sourceName.trim() || 'مساهمة ميدانية عبر Darija LexReview',
      rights_confirmed: rightsConfirmed,
      rights_holder: rightsConfirmed ? 'contributor' : 'unknown',
      license: rightsConfirmed ? 'CC BY-NC 4.0' : 'unknown',
      redistribution_permission: rightsConfirmed ? 'allowed' : 'unknown',
      training_permission: rightsConfirmed ? trainingPermission : 'unknown',
      commercial_permission: rightsConfirmed ? 'not_allowed' : 'unknown',
    }
  }

  function validateAllFields(): {
    valid: boolean
    error?: string
    cleanedEvidence: EvidenceItem[]
  } {
    if (!wordAr.trim() || !containsArabicScript(wordAr)) {
      return {
        valid: false,
        error: 'أدخل المفردة أو العبارة بالدارجة مكتوبةً بالحرف العربي.',
        cleanedEvidence: [],
      }
    }
    if (!isValidArabizi(arabizi)) {
      return {
        valid: false,
        error: 'أدخل الكتابة اللاتينية (Arabizi) بحروف لاتينية وأرقام صوتية صحيحة دون خلطها بحروف عربية.',
        cleanedEvidence: [],
      }
    }
    if (!category.trim()) {
      return {
        valid: false,
        error: 'اختر الفئة المعجمية المناسبة للمفردة.',
        cleanedEvidence: [],
      }
    }
    if (!msaTranslation.trim() || !containsArabicScript(msaTranslation)) {
      return {
        valid: false,
        error: 'أدخل المقابل الدلالي بالعربية الفصحى.',
        cleanedEvidence: [],
      }
    }
    if (!frenchTranslation.trim()) {
      return {
        valid: false,
        error: 'أدخل المقابل باللغة الفرنسية (مطلوب في مخطط المعجم الرسمي schema.json).',
        cleanedEvidence: [],
      }
    }
    if (!exampleDarija.trim() || !containsArabicScript(exampleDarija)) {
      return {
        valid: false,
        error: 'كل مفردة جديدة تتطلب جملة شاهد سياقي طبيعية بالدارجة المغربية.',
        cleanedEvidence: [],
      }
    }
    if (!isValidArabizi(exampleArabizi)) {
      return {
        valid: false,
        error: 'أدخل الكتابة اللاتينية (Arabizi) لجملة الشاهد حتى يتوافق مع مخطط context-schema.json.',
        cleanedEvidence: [],
      }
    }
    if (!rightsConfirmed) {
      return {
        valid: false,
        error: 'يرجى تأكيد إقرار الملكية الفكرية والتوافق مع رخصة CC BY-NC 4.0 قبل الإرسال.',
        cleanedEvidence: [],
      }
    }

    const { cleaned, invalidUrls, tooMany } = validateEvidenceItems(evidenceList)
    if (tooMany) {
      return {
        valid: false,
        error: `لا يمكن إرفاق أكثر من ${MAX_EVIDENCE_ITEMS} شواهد في المقترح الواحد.`,
        cleanedEvidence: [],
      }
    }
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
        error: 'أرفق رابط شاهد واحداً على الأقل أو اشرح سياق الرصد الميداني في مذكرة المراجع.',
        cleanedEvidence: [],
      }
    }

    if (similarEntries.length > 0 && !reviewerNote.trim()) {
      return {
        valid: false,
        error:
          'توجد مفردة مطابقة في المعجم الحالي؛ إذا كانت هذه المفردة تحمل معنىً مختلفاً، اشرح الفرق بوضوح في مذكرة المراجع.',
        cleanedEvidence: [],
      }
    }

    return { valid: true, cleanedEvidence: cleaned }
  }

  function clearForm() {
    setWordAr('')
    setArabizi('')
    setMsaTranslation('')
    setFrenchTranslation('')
    setUsageNote('')
    setExampleDarija('')
    setExampleArabizi('')
    setExampleTranslation('')
    setExampleFrench('')
    setSourceName('')
    setRightsConfirmed(false)
    setTrainingPermission('not_allowed')
    setEvidenceList([{ url: '', note: '' }])
    setReviewerNote('')
  }

  function handleSaveLocalDraft() {
    if (!wordAr.trim()) {
      setFeedback({ type: 'error', text: 'أدخل الكلمة المقترحة أولاً لحفظها كمسودة.' })
      return
    }
    const { cleaned } = validateEvidenceItems(evidenceList)
    const draftId = `NEW:${wordAr.trim()}`
    onSaveDraft({
      entryId: draftId,
      headword: `${wordAr.trim()} (مفردة جديدة)`,
      category,
      proposedData: buildProposedData(),
      evidence: cleaned,
      reviewerNote: reviewerNote.trim(),
      updatedAt: new Date().toISOString(),
    })
    setFeedback({
      type: 'info',
      text: 'تم حفظ المفردة الجديدة كمسودة محلية في متصفحك.',
    })
  }

  function handleSendToSandbox() {
    const check = validateAllFields()
    if (!check.valid) {
      setFeedback({ type: 'error', text: check.error ?? 'تحقق من الحقول المطلوبة.' })
      return
    }

    onAddSandboxSubmission({
      entryId: 'NEW',
      proposedData: buildProposedData(),
      evidence: check.cleanedEvidence,
      reviewerNote: reviewerNote.trim() || null,
      supersedesId: revisionTarget ? revisionTarget.id : null,
    })

    const wasRevision = Boolean(revisionTarget)
    if (revisionTarget) onClearRevisionTarget?.()
    clearForm()
    setFeedback({
      type: 'success',
      text: wasRevision
        ? 'أُرسلت النسخة المنقحة للمفردة الجديدة إلى طابور المحاكاة مع ربطها بالمقترح السابق.'
        : 'أُضيفت المفردة الجديدة إلى طابور المحاكاة التحريرية المحلية. يمكنك الآن فحصها واعتمادها وتصديرها من لوحة المحررين.',
      showSandboxJump: true,
    })
  }

  async function handleSubmitToSupabase() {
    const check = validateAllFields()
    if (!check.valid) {
      setFeedback({ type: 'error', text: check.error ?? 'تحقق من الحقول المطلوبة.' })
      return
    }

    if (!supabase) {
      setFeedback({
        type: 'error',
        text: 'اتصال Supabase غير مهيأ. يمكنك إرسال المفردة إلى «طابور المحاكاة المحلي» لتجربة دورة التحكيم والتصدير كاملة.',
      })
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setFeedback({
        type: 'error',
        text: 'يلزم تسجيل الدخول بحساب مراجع لإرسال المفردة إلى قاعدة بيانات التحكيم، أو استخدم زر المحاكاة المحلية للتجربة.',
      })
      onRequireLogin()
      return
    }

    setBusy(true)
    setFeedback(null)
    const insertPayload: Record<string, unknown> = {
      entry_id: 'NEW',
      proposed_data: buildProposedData(),
      evidence: check.cleanedEvidence,
      reviewer_note: reviewerNote.trim() || null,
      status: 'pending',
    }
    if (revisionTarget && !revisionTarget.is_sandbox) {
      insertPayload.supersedes_id = revisionTarget.id
    }

    const { error } = await supabase.from('review_submissions').insert(insertPayload)
    setBusy(false)

    if (error) {
      setFeedback({ type: 'error', text: `تعذر إرسال المقترح: ${error.message}` })
      return
    }

    const wasRevision = Boolean(revisionTarget)
    if (revisionTarget) onClearRevisionTarget?.()
    clearForm()
    setFeedback({
      type: 'success',
      text: wasRevision
        ? 'تم إرسال النسخة المنقحة للمفردة الجديدة وربطها بالمقترح السابق عبر supersedes_id.'
        : 'تم إرسال المفردة الجديدة إلى سجل التحكيم بحالة قيد المراجعة (pending) تمهيداً لفحصها من قِبل المحررين.',
    })
    onSubmissionSuccess()
  }

  return (
    <div className="rounded-xl border border-[#E5DFD3] bg-white p-5 sm:p-8 dark:border-[#2E2B27] dark:bg-[#1C1A18]">
      <div className="pb-6 border-b border-[#E5DFD3] dark:border-[#2E2B27]">
        <p className="text-xs font-semibold text-[#0F5C4E] dark:text-[#4FD1C5]">
          إثراء المتن المعجمي · متوافق مع مخطط schema.json الرسمي
        </p>
        <h3 className="mt-1.5 font-display text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100">
          اقتراح مفردة أو عبارة مغربية جديدة
        </h3>
        <p className="mt-1.5 max-w-[68ch] text-xs sm:text-sm leading-relaxed text-stone-600 dark:text-stone-400">
          أضف مفردة أو تعبيراً اصطلاحياً غير مدرج في المتن الحالي، مع التحقق التلقائي من عدم التكرار واستيفاء الحقول الإلزامية والشاهد السياقي وإقرار حقوق المصدر.
        </p>

        {/* Quiet Arabizi Reference Bar */}
        <div className="mt-4 pt-3.5 border-t border-[#E5DFD3]/70 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-stone-600 dark:border-[#2E2B27] dark:text-stone-400">
          <span className="font-semibold text-stone-800 dark:text-stone-200">
            مرجع رموز Arabizi القياسي:
          </span>
          {ARABIZI_CONVENTIONS.map((item, idx) => (
            <span key={item.symbol} className="inline-flex items-center gap-1.5">
              {idx > 0 && (
                <span className="text-stone-300 dark:text-stone-700" aria-hidden="true">
                  ·
                </span>
              )}
              <code className="font-mono font-semibold text-[#0F5C4E] dark:text-[#4FD1C5]">
                {item.symbol}
              </code>
              <span>= {item.letter}</span>
            </span>
          ))}
        </div>
      </div>

      {revisionTarget && (
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50/80 p-4 text-xs text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <GitBranch className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
              <div>
                <p className="font-semibold">
                  إعداد نسخة منقحة للمفردة الجديدة (تحل محل #{revisionTarget.id.slice(0, 8)})
                </p>
                {revisionTarget.editor_note && (
                  <p className="mt-1 leading-relaxed">
                    <strong>ملاحظة المحرر المطلوب استيفاؤها:</strong> {revisionTarget.editor_note}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onClearRevisionTarget?.()}
              className="inline-flex items-center gap-1 rounded-md border border-amber-400/70 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-950 hover:bg-amber-100/50 cursor-pointer dark:border-amber-700 dark:bg-[#141312] dark:text-amber-200"
            >
              <X className="h-3 w-3" />
              <span>إلغاء التنقيح</span>
            </button>
          </div>
        </div>
      )}

      {/* Live Duplicate Collision Guard */}
      {similarEntries.length > 0 && (
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50/80 p-4 dark:border-amber-800/60 dark:bg-amber-950/30">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-amber-950 dark:text-amber-200">
                تنبيه تطابق معجمي: عثرنا على {similarEntries.length} مدخل مطابق في المعجم الرسمي!
              </p>
              <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-300/90">
                لتفادي تكرار المدخلات، راجع المداخل الموجودة أدناه. إذا كنت تقصد معنىً مختلفاً تماماً (مشترك لفظي)، فاذكر ذلك صراحةً في مذكرة المراجع.
              </p>
              <div className="mt-3 divide-y divide-amber-200/80 dark:divide-amber-800/40">
                {similarEntries.slice(0, 3).map((match) => (
                  <div
                    key={match.id}
                    className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-amber-950 dark:text-amber-100">
                      <span className="font-mono font-semibold tabular-nums">
                        {formatAccessionCode(match.id, match.numericId)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <strong className="font-display">{match.word}</strong>
                      <span dir="ltr" className="font-mono">
                        ({match.latin})
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{match.meaning}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onInspectExistingEntry(match)}
                      className="inline-flex items-center gap-1 font-semibold text-[#0F5C4E] hover:underline whitespace-nowrap cursor-pointer dark:text-[#4FD1C5]"
                    >
                      <span>فحص وتعديل هذا المدخل</span>
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-8">
        {/* Group 1: Core Headword & Classification */}
        <fieldset className="space-y-4">
          <legend className="text-xs font-semibold text-stone-900 dark:text-stone-100">
            ١. البيانات الأساسية الإلزامية للمدخل
          </legend>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="block text-xs text-stone-600 dark:text-stone-400">
                المفردة أو العبارة بالدارجة (عربي) *
              </span>
              <input
                type="text"
                value={wordAr}
                onChange={(e) => setWordAr(e.target.value)}
                placeholder="مثال: دغيا"
                className="mt-1.5 w-full min-h-[40px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3.5 py-2 text-xs text-stone-900 focus:border-[#0F5C4E] focus:bg-white focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
              />
            </label>

            <label className="block">
              <span className="block text-xs text-stone-600 dark:text-stone-400">
                الكتابة اللاتينية (Arabizi) *
              </span>
              <input
                type="text"
                dir="ltr"
                value={arabizi}
                onChange={(e) => setArabizi(e.target.value)}
                placeholder="dghya"
                className="mt-1.5 w-full min-h-[40px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3.5 py-2 font-mono text-xs text-left text-stone-900 focus:border-[#0F5C4E] focus:bg-white focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
              />
            </label>

            <label className="block">
              <span className="block text-xs text-stone-600 dark:text-stone-400">
                الفئة المعجمية *
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1.5 w-full min-h-[40px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-2 text-xs text-stone-900 focus:border-[#0F5C4E] focus:bg-white focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="block text-xs text-stone-600 dark:text-stone-400">
                المقابل بالعربية الفصحى *
              </span>
              <input
                type="text"
                value={msaTranslation}
                onChange={(e) => setMsaTranslation(e.target.value)}
                placeholder="مثال: بسرعة؛ على الفور"
                className="mt-1.5 w-full min-h-[40px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3.5 py-2 text-xs text-stone-900 focus:border-[#0F5C4E] focus:bg-white focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
              />
            </label>

            <label className="block">
              <span className="block text-xs text-stone-600 dark:text-stone-400">
                المقابل بالفرنسية *
              </span>
              <input
                type="text"
                dir="ltr"
                value={frenchTranslation}
                onChange={(e) => setFrenchTranslation(e.target.value)}
                placeholder="Ex: Vite, rapidement"
                className="mt-1.5 w-full min-h-[40px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3.5 py-2 text-xs text-left text-stone-900 focus:border-[#0F5C4E] focus:bg-white focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="block text-xs text-stone-600 dark:text-stone-400">
                بنية المدخل (entry_type)
              </span>
              <select
                value={entryType}
                onChange={(e) => setEntryType(e.target.value as EntryType)}
                className="mt-1.5 w-full min-h-[40px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-2 text-xs text-stone-900 focus:border-[#0F5C4E] focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
              >
                {ENTRY_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-xs text-stone-600 dark:text-stone-400">
                مستوى التخاطب (register)
              </span>
              <select
                value={register}
                onChange={(e) => setRegister(e.target.value as RegisterType)}
                className="mt-1.5 w-full min-h-[40px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-2 text-xs text-stone-900 focus:border-[#0F5C4E] focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
              >
                {REGISTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-xs text-stone-600 dark:text-stone-400">
                ملاحظة دلالية أو صرفية
              </span>
              <input
                type="text"
                value={usageNote}
                onChange={(e) => setUsageNote(e.target.value)}
                placeholder="ملاحظة اختيارية حول التصريف أو الاستعمال..."
                className="mt-1.5 w-full min-h-[40px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3.5 py-2 text-xs text-stone-900 focus:border-[#0F5C4E] focus:bg-white focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
              />
            </label>
          </div>

          <div>
            <span className="block text-xs text-stone-600 dark:text-stone-400">
              النطاق الجغرافي للتداول (اختر منطقة أو أكثر)
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {MOROCCAN_REGIONS.map((reg) => {
                const active = selectedRegions.includes(reg)
                return (
                  <button
                    key={reg}
                    type="button"
                    onClick={() => toggleRegion(reg)}
                    aria-pressed={active}
                    className={`min-h-[34px] rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'border-[#0F5C4E] bg-[#0F5C4E] text-white dark:border-[#147A67] dark:bg-[#147A67]'
                        : 'border-[#D6CEBE] bg-[#FBF9F5] text-stone-700 hover:bg-[#EFECE4] dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-300'
                    }`}
                  >
                    {reg}
                  </button>
                )
              })}
            </div>
          </div>
        </fieldset>

        {/* Group 2: Mandatory Contextual Example */}
        <fieldset className="pt-6 border-t border-[#E5DFD3] space-y-4 dark:border-[#2E2B27]">
          <legend className="text-xs font-semibold text-stone-900 dark:text-stone-100">
            ٢. الشاهد السياقي الإلزامي (يُربط تلقائياً بملف context-examples.json)
          </legend>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="block text-xs text-stone-600 dark:text-stone-400">
                الجملة بالدارجة المغربية (عربي) *
              </span>
              <input
                type="text"
                value={exampleDarija}
                onChange={(e) => setExampleDarija(e.target.value)}
                placeholder="مثال: ساليت الخدمة دغيا وجيت."
                className="mt-1.5 w-full min-h-[40px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3.5 py-2 text-xs text-stone-900 focus:border-[#0F5C4E] focus:bg-white focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
              />
            </label>

            <label className="block">
              <span className="block text-xs text-stone-600 dark:text-stone-400">
                الكتابة اللاتينية للجملة (Arabizi) *
              </span>
              <input
                type="text"
                dir="ltr"
                value={exampleArabizi}
                onChange={(e) => setExampleArabizi(e.target.value)}
                placeholder="salit lkhdma dghya w jit."
                className="mt-1.5 w-full min-h-[40px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3.5 py-2 font-mono text-xs text-left text-stone-900 focus:border-[#0F5C4E] focus:bg-white focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
              />
            </label>

            <label className="block">
              <span className="block text-xs text-stone-600 dark:text-stone-400">
                ترجمة الجملة إلى الفصحى
              </span>
              <input
                type="text"
                value={exampleTranslation}
                onChange={(e) => setExampleTranslation(e.target.value)}
                placeholder="أنهيت العمل بسرعة وجئت."
                className="mt-1.5 w-full min-h-[40px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3.5 py-2 text-xs text-stone-900 focus:border-[#0F5C4E] focus:bg-white focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
              />
            </label>

            <label className="block">
              <span className="block text-xs text-stone-600 dark:text-stone-400">
                ترجمة الجملة إلى الفرنسية
              </span>
              <input
                type="text"
                dir="ltr"
                value={exampleFrench}
                onChange={(e) => setExampleFrench(e.target.value)}
                placeholder="J'ai vite terminé le travail et je suis venu."
                className="mt-1.5 w-full min-h-[40px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3.5 py-2 text-xs text-left text-stone-900 focus:border-[#0F5C4E] focus:bg-white focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
              />
            </label>
          </div>
        </fieldset>

        {/* Group 3: Provenance, Evidence & Rights Confirmation */}
        <fieldset className="pt-6 border-t border-[#E5DFD3] space-y-4 dark:border-[#2E2B27]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <legend className="text-xs font-semibold text-stone-900 dark:text-stone-100">
              ٣. توثيق المصدر والشواهد وحقوق البيانات ({evidenceList.length} / {MAX_EVIDENCE_ITEMS})
            </legend>
            <button
              type="button"
              disabled={evidenceList.length >= MAX_EVIDENCE_ITEMS}
              onClick={() =>
                setEvidenceList((prev) =>
                  prev.length < MAX_EVIDENCE_ITEMS ? [...prev, { url: '', note: '' }] : prev,
                )
              }
              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-[#EFECE4] disabled:opacity-45 whitespace-nowrap cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-200"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>إضافة رابط شاهد</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="block text-xs text-stone-600 dark:text-stone-400">
                طبيعة المصدر (source_type)
              </span>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as SourceType)}
                className="mt-1.5 w-full min-h-[40px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-2 text-xs text-stone-900 focus:border-[#0F5C4E] focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
              >
                {SOURCE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-xs text-stone-600 dark:text-stone-400">
                اسم الجهة أو السياق المرجعي
              </span>
              <input
                type="text"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="مثال: رصد ميداني — الدار البيضاء"
                className="mt-1.5 w-full min-h-[40px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3.5 py-2 text-xs text-stone-900 focus:border-[#0F5C4E] focus:bg-white focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
              />
            </label>
          </div>

          <label className="block max-w-xl">
            <span className="block text-xs text-stone-600 dark:text-stone-400">
              إذن استخدام المساهمة في تدريب نماذج الذكاء الاصطناعي
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
            <span className="mt-1 block text-[11px] leading-relaxed text-stone-500 dark:text-stone-400">
              يُسجل هذا الإذن بشكل مستقل عن رخصة إعادة التوزيع. الخيار الافتراضي يمنع استخدام المساهمة في التدريب.
            </span>
          </label>

          <div className="space-y-2.5">
            {evidenceList.map((ev, index) => (
              <div key={index} className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 items-start">
                <div className="sm:col-span-5">
                  <input
                    type="url"
                    dir="ltr"
                    placeholder="https://..."
                    value={ev.url}
                    onChange={(e) => updateEvidence(index, 'url', e.target.value)}
                    aria-label={`رابط الشاهد ${index + 1}`}
                    className="w-full min-h-[40px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-2 font-mono text-xs text-left text-stone-900 focus:border-[#0F5C4E] focus:bg-white focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                  />
                </div>
                <div className={evidenceList.length > 1 ? 'sm:col-span-6' : 'sm:col-span-7'}>
                  <input
                    type="text"
                    placeholder="وصف موضع الشاهد في الرابط..."
                    value={ev.note}
                    onChange={(e) => updateEvidence(index, 'note', e.target.value)}
                    aria-label={`ملاحظة الشاهد ${index + 1}`}
                    className="w-full min-h-[40px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-2 text-xs text-stone-900 focus:border-[#0F5C4E] focus:bg-white focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                  />
                </div>
                {evidenceList.length > 1 && (
                  <div className="sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        setEvidenceList((prev) => prev.filter((_, i) => i !== index))
                      }
                      aria-label="حذف الشاهد"
                      className="flex h-[40px] w-[40px] items-center justify-center rounded-lg border border-[#D6CEBE] text-stone-500 hover:text-red-700 cursor-pointer dark:border-[#3A3530]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <label className="block">
            <span className="block text-xs text-stone-600 dark:text-stone-400">
              مذكرة المراجع للمحررين
            </span>
            <textarea
              rows={2}
              value={reviewerNote}
              onChange={(e) => setReviewerNote(e.target.value)}
              placeholder="سياق الرصد، درجة الشيوع، أو ما يميز هذه المفردة..."
              className="mt-1.5 w-full rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] p-3 text-xs leading-relaxed text-stone-900 focus:border-[#0F5C4E] focus:bg-white focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
            />
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-[#E5DFD3] bg-[#FBF9F5] p-3.5 cursor-pointer dark:border-[#2E2B27] dark:bg-[#141312]">
            <input
              type="checkbox"
              checked={rightsConfirmed}
              onChange={(e) => setRightsConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#0F5C4E] shrink-0"
            />
            <span className="text-xs leading-relaxed text-stone-700 dark:text-stone-300">
              أقرّ بأن المفردة والتعريف وجملة الشاهد من صياغتي الأصلية أو من استعمال لغوي عام غير منقول حرفياً من مصدر محمي، وأملك حق إتاحتها ضمن CC BY-NC 4.0. أسمح بإعادة التوزيع وفق شروط الرخصة، ولا أمنح إذناً بالاستخدام التجاري.
            </span>
          </label>
        </fieldset>

        {/* Actions */}
        <div className="pt-5 border-t border-[#E5DFD3] flex flex-wrap items-center justify-between gap-4 dark:border-[#2E2B27]">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSubmitToSupabase}
              disabled={busy}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#0F5C4E] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#0B463B] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer dark:bg-[#147A67]"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{busy ? 'جارٍ الإرسال...' : 'إرسال إلى سجل التحكيم'}</span>
            </button>

            <button
              type="button"
              onClick={handleSendToSandbox}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-[#0F5C4E]/40 bg-[#FBF9F5] px-4 py-2.5 text-xs font-semibold text-[#0F5C4E] hover:bg-[#EFECE4] whitespace-nowrap shrink-0 cursor-pointer dark:border-[#4FD1C5]/40 dark:bg-[#141312] dark:text-[#4FD1C5]"
            >
              <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
              <span>تجربة في طابور المحاكاة المحلي</span>
            </button>

            <button
              type="button"
              onClick={handleSaveLocalDraft}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-4 py-2.5 text-xs font-semibold text-stone-800 hover:bg-[#EFECE4] whitespace-nowrap shrink-0 cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-200"
            >
              <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
              <span>حفظ مسودة</span>
            </button>
          </div>
        </div>

        {feedback && (
          <div
            role="status"
            className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3.5 text-xs leading-relaxed ${
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
                <span>افتح لوحة تحكيم المحررين</span>
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
