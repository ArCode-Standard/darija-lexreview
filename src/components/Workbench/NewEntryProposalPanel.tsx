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
  Wand2,
  X,
  ChevronDown,
  SlidersHorizontal,
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
import type { RapidSessionPrefs } from '../../hooks/useCommunityAttestations'
import {
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
import {
  buildCorpusArabiziLookup,
  suggestMoroccanArabizi,
} from '../../utils/arabiziTransliterator'
import { humanizeSystemError } from '../../utils/humanizeError'

interface NewEntryProposalPanelProps {
  entries: LexicalEntry[]
  categories: string[]
  corpusVersion: string
  canAccessEditorialTools: boolean
  prefillWord?: string | null
  onClearPrefillWord?: () => void
  sessionPrefs: RapidSessionPrefs
  onUpdateSessionPrefs: (patch: Partial<RapidSessionPrefs>) => void
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
  corpusVersion,
  canAccessEditorialTools,
  prefillWord,
  onClearPrefillWord,
  sessionPrefs,
  onUpdateSessionPrefs,
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
  const [arabiziManuallyEdited, setArabiziManuallyEdited] = useState(false)

  const [category, setCategory] = useState(categories[0] ?? 'التواصل')
  const [msaTranslation, setMsaTranslation] = useState('')
  const [frenchTranslation, setFrenchTranslation] = useState('')
  const [entryType, setEntryType] = useState<EntryType>('word')
  const [register, setRegister] = useState<RegisterType>('neutral')
  const [selectedRegions, setSelectedRegions] = useState<string[]>([
    sessionPrefs.dialectRegion || 'مشترك عام',
  ])
  const [usageNote, setUsageNote] = useState('')

  const [exampleDarija, setExampleDarija] = useState('')
  const [exampleArabizi, setExampleArabizi] = useState('')
  const [exampleArabiziManuallyEdited, setExampleArabiziManuallyEdited] = useState(false)
  const [exampleTranslation, setExampleTranslation] = useState('')
  const [exampleFrench, setExampleFrench] = useState('')

  const [sourceType, setSourceType] = useState<SourceType>('contributor')
  const [sourceName, setSourceName] = useState('')

  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([{ url: '', note: '' }])
  const [reviewerNote, setReviewerNote] = useState('')

  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false)
  const [showPrefsEditor, setShowPrefsEditor] = useState(false)

  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: 'error' | 'success' | 'info'
    text: string
    showSandboxJump?: boolean
  } | null>(null)

  const corpusArabiziLookup = useMemo(() => buildCorpusArabiziLookup(entries), [entries])

  // Keep primary selected region synced with session preference when untouched
  useEffect(() => {
    if (
      sessionPrefs.dialectRegion &&
      selectedRegions.length === 1 &&
      selectedRegions[0] !== sessionPrefs.dialectRegion
    ) {
      setSelectedRegions([sessionPrefs.dialectRegion])
    }
  }, [sessionPrefs.dialectRegion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Silent auto-Arabizi for wordAr
  useEffect(() => {
    if (!arabiziManuallyEdited) {
      setArabizi(
        wordAr.trim() ? suggestMoroccanArabizi(wordAr, corpusArabiziLookup) : '',
      )
    }
  }, [wordAr, arabiziManuallyEdited, corpusArabiziLookup])

  // Silent auto-Arabizi for exampleDarija
  useEffect(() => {
    if (!exampleArabiziManuallyEdited) {
      setExampleArabizi(
        exampleDarija.trim()
          ? suggestMoroccanArabizi(exampleDarija, corpusArabiziLookup)
          : '',
      )
    }
  }, [exampleDarija, exampleArabiziManuallyEdited, corpusArabiziLookup])

  // Handle 1-click prefill from Instant Search or Sidebar
  useEffect(() => {
    if (!prefillWord) return
    const clean = prefillWord.trim()
    if (clean) {
      if (containsArabicScript(clean)) {
        setWordAr(clean)
        setArabiziManuallyEdited(false)
      } else {
        setArabizi(clean)
        setArabiziManuallyEdited(true)
        setShowAdvancedDetails(true)
      }
      setFeedback(null)
    }
    onClearPrefillWord?.()
  }, [prefillWord, onClearPrefillWord])

  useEffect(() => {
    if (!activeDraft) return
    const p = activeDraft.proposedData ?? {}
    setWordAr(p.word_ar ?? '')
    setArabizi(p.arabizi ?? '')
    setArabiziManuallyEdited(Boolean(p.arabizi))
    if (p.category) setCategory(p.category)
    setMsaTranslation(p.msa_translation ?? p.meaning ?? '')
    setFrenchTranslation(p.french_translation ?? '')
    if (p.entry_type) setEntryType(p.entry_type)
    if (p.register) setRegister(p.register)
    if (Array.isArray(p.regions) && p.regions.length > 0) setSelectedRegions(p.regions)
    setUsageNote(p.usage_note ?? '')
    setExampleDarija(p.example_darija ?? '')
    setExampleArabizi(p.example_arabizi ?? '')
    setExampleArabiziManuallyEdited(Boolean(p.example_arabizi))
    setExampleTranslation(p.example_translation ?? '')
    setExampleFrench(p.example_french ?? '')
    if (p.source_type) setSourceType(p.source_type)
    setSourceName(p.source_name ?? '')
    setEvidenceList(
      activeDraft.evidence.length > 0 ? activeDraft.evidence : [{ url: '', note: '' }],
    )
    setReviewerNote(activeDraft.reviewerNote ?? '')
    if (
      p.french_translation ||
      p.usage_note ||
      p.example_translation ||
      p.example_french ||
      activeDraft.evidence.length > 0
    ) {
      setShowAdvancedDetails(true)
    }
    onClearActiveDraft?.()
  }, [activeDraft, onClearActiveDraft])

  useEffect(() => {
    if (!revisionTarget) return
    const p = revisionTarget.proposed_data ?? {}
    setWordAr(p.word_ar ?? '')
    setArabizi(p.arabizi ?? '')
    setArabiziManuallyEdited(Boolean(p.arabizi))
    if (p.category) setCategory(p.category)
    setMsaTranslation(p.msa_translation ?? p.meaning ?? '')
    setFrenchTranslation(p.french_translation ?? '')
    if (p.entry_type) setEntryType(p.entry_type)
    if (p.register) setRegister(p.register)
    if (Array.isArray(p.regions) && p.regions.length > 0) setSelectedRegions(p.regions)
    setUsageNote(p.usage_note ?? '')
    setExampleDarija(p.example_darija ?? '')
    setExampleArabizi(p.example_arabizi ?? '')
    setExampleArabiziManuallyEdited(Boolean(p.example_arabizi))
    setExampleTranslation(p.example_translation ?? '')
    setExampleFrench(p.example_french ?? '')
    if (p.source_type) setSourceType(p.source_type)
    setSourceName(p.source_name ?? '')
    setEvidenceList(
      Array.isArray(revisionTarget.evidence) && revisionTarget.evidence.length > 0
        ? revisionTarget.evidence
        : [{ url: '', note: '' }],
    )
    setReviewerNote(revisionTarget.reviewer_note ?? '')
    setShowAdvancedDetails(true)
    setFeedback(null)
  }, [revisionTarget])

  const similarEntries = useMemo(
    () => findSimilarCorpusEntries(entries, wordAr, arabizi),
    [entries, wordAr, arabizi],
  )

  function toggleRegion(regionName: string) {
    setSelectedRegions((prev) =>
      prev.includes(regionName)
        ? prev.length > 1
          ? prev.filter((r) => r !== regionName)
          : prev
        : [...prev, regionName],
    )
  }

  function updateEvidence(idx: number, key: keyof EvidenceItem, val: string) {
    setEvidenceList((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [key]: val } : item)),
    )
  }

  function buildProposedData(): ProposedFields {
    const resolvedArabizi =
      arabizi.trim() || suggestMoroccanArabizi(wordAr.trim(), corpusArabiziLookup)
    const resolvedExArabizi =
      exampleArabizi.trim() ||
      suggestMoroccanArabizi(exampleDarija.trim(), corpusArabiziLookup)
    const confirmed = sessionPrefs.rightsConfirmedOnce

    return {
      submission_kind: 'new_entry',
      word_ar: wordAr.trim(),
      arabizi: resolvedArabizi.trim() || undefined,
      category: category.trim() || categories[0] || 'التواصل',
      msa_translation: msaTranslation.trim(),
      meaning: msaTranslation.trim(),
      french_translation: frenchTranslation.trim() || undefined,
      entry_type: entryType,
      register,
      regions:
        selectedRegions.length > 0
          ? selectedRegions
          : [sessionPrefs.dialectRegion || 'مشترك عام'],
      usage_note: usageNote.trim() || undefined,
      example_darija: exampleDarija.trim(),
      example_arabizi: resolvedExArabizi.trim() || undefined,
      example_translation: exampleTranslation.trim() || undefined,
      example_french: exampleFrench.trim() || undefined,
      source_type: sourceType,
      source_name:
        sourceName.trim() ||
        `مساهمة مجتمعية (${sessionPrefs.dialectRegion || 'مشترك عام'})`,
      rights_confirmed: confirmed,
      rights_holder: confirmed ? 'contributor' : 'unknown',
      license: confirmed ? 'CC BY-NC 4.0' : 'unknown',
      redistribution_permission: confirmed ? 'allowed' : 'unknown',
      training_permission: confirmed ? sessionPrefs.trainingPermission : 'unknown',
      commercial_permission: confirmed ? 'not_allowed' : 'unknown',
      corpus_version: corpusVersion,
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
        error: 'أدخل المفردة أو العبارة بالدارجة مكتوبةً بالحروف العربية.',
        cleanedEvidence: [],
      }
    }
    if (!msaTranslation.trim() || !containsArabicScript(msaTranslation)) {
      return {
        valid: false,
        error: 'أدخل معنى المفردة بالعربية الفصحى أو شرحها المبسط.',
        cleanedEvidence: [],
      }
    }
    if (!exampleDarija.trim() || !containsArabicScript(exampleDarija)) {
      return {
        valid: false,
        error: 'أضف جملة مثال قصيرة من الحياة اليومية توضح استعمال الكلمة.',
        cleanedEvidence: [],
      }
    }

    if (arabiziManuallyEdited && arabizi.trim() && !isValidArabizi(arabizi.trim())) {
      return {
        valid: false,
        error: 'النطق اللاتيني للكلمة يجب أن يقتصر على الحروف اللاتينية والأرقام الصوتية.',
        cleanedEvidence: [],
      }
    }
    if (
      exampleArabiziManuallyEdited &&
      exampleArabizi.trim() &&
      !isValidArabizi(exampleArabizi.trim())
    ) {
      return {
        valid: false,
        error: 'النطق اللاتيني للجملة يجب أن يقتصر على الحروف اللاتينية والأرقام الصوتية.',
        cleanedEvidence: [],
      }
    }

    if (!sessionPrefs.rightsConfirmedOnce) {
      return {
        valid: false,
        error: 'يرجى تفعيل الإقرار بالرخصة المفتوحة قبل إرسال المساهمة.',
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

    if (similarEntries.length > 0 && !reviewerNote.trim()) {
      return {
        valid: false,
        error:
          'توجد مفردة مشابهة في المعجم؛ إذا كنت تقصد معنىً مختلفاً، اكتب الفرق باختصار في الحقل المخصص أعلاه.',
        cleanedEvidence: [],
      }
    }

    return { valid: true, cleanedEvidence: cleaned }
  }

  function clearForm() {
    setWordAr('')
    setArabizi('')
    setArabiziManuallyEdited(false)
    setMsaTranslation('')
    setFrenchTranslation('')
    setUsageNote('')
    setExampleDarija('')
    setExampleArabizi('')
    setExampleArabiziManuallyEdited(false)
    setExampleTranslation('')
    setExampleFrench('')
    setSourceName('')
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
      text: 'حُفظت المفردة كمسودة على جهازك؛ يمكنك إكمالها أو إرسالها في أي وقت.',
    })
  }

  function handleSendToSandbox() {
    const check = validateAllFields()
    if (!check.valid) {
      setFeedback({ type: 'error', text: check.error ?? 'تحقق من الحقول الأساسية.' })
      return
    }

    onAddSandboxSubmission({
      entryId: 'NEW',
      proposedData: buildProposedData(),
      evidence: check.cleanedEvidence,
      reviewerNote:
        reviewerNote.trim() ||
        `إضافة مفردة جديدة (${sessionPrefs.dialectRegion || 'مشترك عام'})`,
      supersedesId: revisionTarget ? revisionTarget.id : null,
    })

    if (revisionTarget) onClearRevisionTarget?.()
    clearForm()
    setFeedback({
      type: 'success',
      text: 'أُضيفت المفردة الجديدة إلى طابور الاختبار للمحررين.',
      showSandboxJump: true,
    })
  }

  async function handleSubmitToSupabase() {
    const check = validateAllFields()
    if (!check.valid) {
      setFeedback({ type: 'error', text: check.error ?? 'تحقق من الحقول الأساسية.' })
      return
    }

    if (!supabase) {
      handleSaveLocalDraft()
      setFeedback({
        type: 'info',
        text: 'حُفظت المفردة في مسوداتك المحلية بأمان لعدم توفر اتصال بالخادم حالياً.',
      })
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      const draftId = `NEW:${wordAr.trim()}`
      onSaveDraft({
        entryId: draftId,
        headword: `${wordAr.trim()} (مفردة جديدة)`,
        category,
        proposedData: buildProposedData(),
        evidence: check.cleanedEvidence,
        reviewerNote: reviewerNote.trim(),
        updatedAt: new Date().toISOString(),
      })
      setFeedback({
        type: 'info',
        text: 'حفظنا مفردتك كمسودة على جهازك؛ سجّل الدخول الآن ليتم إرسالها وتوثيقها باسمك.',
      })
      onRequireLogin()
      return
    }

    setBusy(true)
    setFeedback(null)
    const proposedPayload = buildProposedData()
    const autoNote =
      reviewerNote.trim() ||
      `مساهمة مفردة جديدة (${sessionPrefs.dialectRegion || 'مشترك عام'})`

    const baseInsert: Record<string, unknown> = {
      entry_id: 'NEW',
      proposed_data: proposedPayload,
      evidence: check.cleanedEvidence,
      reviewer_note: autoNote,
      status: 'pending',
    }
    if (revisionTarget && !revisionTarget.is_sandbox) {
      baseInsert.supersedes_id = revisionTarget.id
    }

    let insertRes = await supabase.from('review_submissions').insert({
      ...baseInsert,
      corpus_version: corpusVersion,
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
          'تعذر إرسال المفردة حالياً. يرجى المحاولة لاحقاً.',
        ),
      })
      return
    }

    const wasRevision = Boolean(revisionTarget)
    if (revisionTarget) onClearRevisionTarget?.()
    clearForm()
    setFeedback({
      type: 'success',
      text: wasRevision
        ? 'تم إرسال النسخة المنقحة للمفردة الجديدة بنجاح.'
        : 'شكراً لإثرائك المعجم! أُرسلت المفردة الجديدة وهي الآن قيد مراجعة المحررين اللغويين.',
    })
    onSubmissionSuccess()
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-8 dark:border-white/10 dark:bg-[#0C0C10]">
      <div className="pb-6 border-b border-zinc-200 dark:border-white/10">
        <p className="font-mono text-xs font-semibold tracking-wider uppercase text-emerald-700 dark:text-[#D9FF43]">
          01 / إضافة سريعة في ٣ خطوات بسيطة
        </p>
        <h3 className="mt-1.5 font-display text-xl sm:text-2xl font-bold text-zinc-950 dark:text-[#F5F5F7]">
          أضف مفردة أو عبارة مغربية جديدة
        </h3>
        <p className="mt-1.5 max-w-[68ch] text-xs sm:text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          اكتب الكلمة ومعناها وجملة مثال من كلامك اليومي فقط. سيتكفل النظام بتوليد النطق اللاتيني تلقائياً، ويستكمل المحررون اللغويون بقية التفاصيل عند المراجعة.
        </p>
      </div>

      {revisionTarget && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <GitBranch className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
              <div>
                <p className="font-semibold">
                  تعديل وإعادة إرسال مفردتك المقترحة («{revisionTarget.proposed_data?.word_ar || 'مفردة جديدة'}»)
                </p>
                {revisionTarget.editor_note && (
                  <p className="mt-1 leading-relaxed">
                    <strong>ملاحظة المحرر:</strong> {revisionTarget.editor_note}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onClearRevisionTarget?.()}
              className="inline-flex items-center gap-1 rounded-full border border-amber-400/70 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-950 hover:bg-amber-100/50 cursor-pointer dark:border-amber-500/40 dark:bg-[#07070A] dark:text-amber-200"
            >
              <X className="h-3 w-3" />
              <span>إلغاء</span>
            </button>
          </div>
        </div>
      )}

      {/* Live Duplicate Collision Guard with Inline Disambiguation Input */}
      {similarEntries.length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50/80 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-xs font-semibold text-amber-950 dark:text-amber-200">
                  وجدنا {similarEntries.length} مفردة مشابهة مسجلة في المعجم:
                </p>
                <div className="mt-2 divide-y divide-amber-200/80 dark:divide-amber-500/20">
                  {similarEntries.slice(0, 3).map((match) => (
                    <div
                      key={match.id}
                      className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-amber-950 dark:text-amber-100">
                        {canAccessEditorialTools && (
                          <>
                            <span className="font-mono font-semibold tabular-nums">
                              {formatAccessionCode(match.id, match.numericId)}
                            </span>
                            <span aria-hidden="true">·</span>
                          </>
                        )}
                        <strong className="font-display">{match.word}</strong>
                        {match.latin && (
                          <span dir="ltr" className="font-mono">
                            ({match.latin})
                          </span>
                        )}
                        <span aria-hidden="true">·</span>
                        <span>{match.meaning}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onInspectExistingEntry(match)}
                        className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline whitespace-nowrap cursor-pointer dark:text-[#D9FF43]"
                      >
                        <span>افتح هذه البطاقة بدلاً من التكرار</span>
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <label className="block pt-2 border-t border-amber-200/80 dark:border-amber-500/20">
                <span className="block text-xs font-medium text-amber-950 dark:text-amber-200">
                  هل تقصد معنىً آخر مختلفاً لنفس الكلمة؟ اكتب الفرق باختصار للمتابعة:
                </span>
                <input
                  type="text"
                  value={reviewerNote}
                  onChange={(e) => setReviewerNote(e.target.value)}
                  placeholder="مثال: أقصد بها هنا معنى مختلفاً تماماً يُستعمل في..."
                  className="mt-1.5 w-full min-h-[38px] rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-amber-500/40 dark:bg-[#07070A] dark:text-[#F5F5F7] dark:focus:border-[#D9FF43]"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {/* Step 1-3: Core 3 Essential Fields */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label
              htmlFor="new-entry-word-ar"
              className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200"
            >
              ١. الكلمة أو العبارة بالدارجة *
            </label>
            <input
              id="new-entry-word-ar"
              type="text"
              value={wordAr}
              onChange={(e) => setWordAr(e.target.value)}
              placeholder="مثال: دغيا"
              className="w-full min-h-[44px] rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-[#F5F5F7] dark:placeholder:text-zinc-500 dark:focus:border-[#D9FF43]"
            />
            {arabizi && (
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                النطق اللاتيني التلقائي:{' '}
                <span
                  dir="ltr"
                  className="font-mono font-semibold text-emerald-700 dark:text-[#D9FF43]"
                >
                  {arabizi}
                </span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="new-entry-meaning-ar"
              className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200"
            >
              ٢. معناها بالعربية الفصحى (أو شرحها المبسط) *
            </label>
            <input
              id="new-entry-meaning-ar"
              type="text"
              value={msaTranslation}
              onChange={(e) => setMsaTranslation(e.target.value)}
              placeholder="مثال: بسرعة؛ على الفور"
              className="w-full min-h-[44px] rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-[#F5F5F7] dark:placeholder:text-zinc-500 dark:focus:border-[#D9FF43]"
            />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <label
              htmlFor="new-entry-example-ar"
              className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200"
            >
              ٣. جملة مثال طبيعية من الحياة اليومية *
            </label>
            <input
              id="new-entry-example-ar"
              type="text"
              value={exampleDarija}
              onChange={(e) => setExampleDarija(e.target.value)}
              placeholder="مثال: ساليت الخدمة دغيا وجيت."
              className="w-full min-h-[44px] rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-[#F5F5F7] dark:placeholder:text-zinc-500 dark:focus:border-[#D9FF43]"
            />
            {exampleArabizi && (
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                نطق الجملة التلقائي:{' '}
                <span
                  dir="ltr"
                  className="font-mono text-emerald-700 dark:text-[#D9FF43]"
                >
                  {exampleArabizi}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Collapsible Optional Details (Completed by Editors if skipped) */}
        <div className="pt-4 border-t border-zinc-200 dark:border-white/10">
          <button
            type="button"
            onClick={() => setShowAdvancedDetails((v) => !v)}
            className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700 hover:text-zinc-950 cursor-pointer dark:text-zinc-300 dark:hover:text-white"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-150 ${
                showAdvancedDetails ? 'rotate-180' : ''
              }`}
            />
            <span>
              تفاصيل إضافية اختيارية (الفئة، الفرنسية، ضبط النطق، أو رابط مصدر — يستكملها المحررون عند الحاجة)
            </span>
          </button>

          {showAdvancedDetails && (
            <div className="mt-5 space-y-6 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 sm:p-5 dark:border-white/10 dark:bg-[#07070A]">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="block text-xs text-zinc-600 dark:text-zinc-400">
                    الفئة الدلالية
                  </span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1.5 w-full min-h-[40px] rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-white/15 dark:bg-[#0C0C10] dark:text-[#F5F5F7] dark:focus:border-[#D9FF43]"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-xs text-zinc-600 dark:text-zinc-400">
                    المقابل بالفرنسية (اختياري)
                  </span>
                  <input
                    type="text"
                    dir="ltr"
                    value={frenchTranslation}
                    onChange={(e) => setFrenchTranslation(e.target.value)}
                    placeholder="Ex: Vite, rapidement"
                    className="mt-1.5 w-full min-h-[40px] rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs text-left text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-white/15 dark:bg-[#0C0C10] dark:text-[#F5F5F7] dark:focus:border-[#D9FF43]"
                  />
                </label>

                <div className="block">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="new-entry-arabizi"
                      className="block text-xs text-zinc-600 dark:text-zinc-400"
                    >
                      تعديل النطق اللاتيني للكلمة
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setArabiziManuallyEdited(false)
                        if (wordAr.trim()) {
                          setArabizi(suggestMoroccanArabizi(wordAr, corpusArabiziLookup))
                        }
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline whitespace-nowrap cursor-pointer dark:text-[#D9FF43]"
                    >
                      <Wand2 className="h-3 w-3" />
                      <span>تلقائي</span>
                    </button>
                  </div>
                  <input
                    id="new-entry-arabizi"
                    type="text"
                    dir="ltr"
                    value={arabizi}
                    onChange={(e) => {
                      setArabiziManuallyEdited(true)
                      setArabizi(e.target.value)
                    }}
                    placeholder="dghya"
                    className="mt-1.5 w-full min-h-[40px] rounded-xl border border-zinc-300 bg-white px-3.5 py-2 font-mono text-xs text-left text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-white/15 dark:bg-[#0C0C10] dark:text-[#F5F5F7] dark:focus:border-[#D9FF43]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="block">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="new-example-arabizi"
                      className="block text-xs text-zinc-600 dark:text-zinc-400"
                    >
                      تعديل نطق الجملة اللاتيني
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setExampleArabiziManuallyEdited(false)
                        if (exampleDarija.trim()) {
                          setExampleArabizi(
                            suggestMoroccanArabizi(exampleDarija, corpusArabiziLookup),
                          )
                        }
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline whitespace-nowrap cursor-pointer dark:text-[#D9FF43]"
                    >
                      <Wand2 className="h-3 w-3" />
                      <span>تلقائي</span>
                    </button>
                  </div>
                  <input
                    id="new-example-arabizi"
                    type="text"
                    dir="ltr"
                    value={exampleArabizi}
                    onChange={(e) => {
                      setExampleArabiziManuallyEdited(true)
                      setExampleArabizi(e.target.value)
                    }}
                    placeholder="salit lkhdma dghya w jit."
                    className="mt-1.5 w-full min-h-[40px] rounded-xl border border-zinc-300 bg-white px-3.5 py-2 font-mono text-xs text-left text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-white/15 dark:bg-[#0C0C10] dark:text-[#F5F5F7] dark:focus:border-[#D9FF43]"
                  />
                </div>

                <label className="block">
                  <span className="block text-xs text-zinc-600 dark:text-zinc-400">
                    معنى الجملة بالعربية الفصحى
                  </span>
                  <input
                    type="text"
                    value={exampleTranslation}
                    onChange={(e) => setExampleTranslation(e.target.value)}
                    placeholder="أنهيت العمل بسرعة وجئت."
                    className="mt-1.5 w-full min-h-[40px] rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-white/15 dark:bg-[#0C0C10] dark:text-[#F5F5F7] dark:focus:border-[#D9FF43]"
                  />
                </label>

                <label className="block">
                  <span className="block text-xs text-zinc-600 dark:text-zinc-400">
                    ترجمة الجملة بالفرنسية
                  </span>
                  <input
                    type="text"
                    dir="ltr"
                    value={exampleFrench}
                    onChange={(e) => setExampleFrench(e.target.value)}
                    placeholder="J'ai vite terminé le travail..."
                    className="mt-1.5 w-full min-h-[40px] rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs text-left text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-white/15 dark:bg-[#0C0C10] dark:text-[#F5F5F7] dark:focus:border-[#D9FF43]"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="block text-xs text-zinc-600 dark:text-zinc-400">
                    نوع المدخل
                  </span>
                  <select
                    value={entryType}
                    onChange={(e) => setEntryType(e.target.value as EntryType)}
                    className="mt-1.5 w-full min-h-[40px] rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-white/15 dark:bg-[#0C0C10] dark:text-[#F5F5F7] dark:focus:border-[#D9FF43]"
                  >
                    {ENTRY_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-xs text-zinc-600 dark:text-zinc-400">
                    سياق الاستعمال
                  </span>
                  <select
                    value={register}
                    onChange={(e) => setRegister(e.target.value as RegisterType)}
                    className="mt-1.5 w-full min-h-[40px] rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-white/15 dark:bg-[#0C0C10] dark:text-[#F5F5F7] dark:focus:border-[#D9FF43]"
                  >
                    {REGISTER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="block text-xs text-zinc-600 dark:text-zinc-400">
                    ملاحظة إضافية حول الاستعمال
                  </span>
                  <input
                    type="text"
                    value={usageNote}
                    onChange={(e) => setUsageNote(e.target.value)}
                    placeholder="ملاحظة اختيارية حول التصريف أو السياق..."
                    className="mt-1.5 w-full min-h-[40px] rounded-xl border border-zinc-300 bg-white px-3.5 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none dark:border-white/15 dark:bg-[#0C0C10] dark:text-[#F5F5F7] dark:focus:border-[#D9FF43]"
                  />
                </label>
              </div>

              <div>
                <span className="block text-xs text-zinc-600 dark:text-zinc-400">
                  المناطق التي تُستعمل فيها هذه المفردة
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
                        className={`min-h-[34px] rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'border-zinc-950 bg-zinc-950 text-white dark:border-[#D9FF43] dark:bg-[#D9FF43] dark:text-[#050507]'
                            : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-white/15 dark:bg-[#0C0C10] dark:text-zinc-300 dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        {reg}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-zinc-200 dark:border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    مصادر وروابط داعمة إن وجدت (اختياري)
                  </span>
                  <button
                    type="button"
                    disabled={evidenceList.length >= MAX_EVIDENCE_ITEMS}
                    onClick={() =>
                      setEvidenceList((prev) =>
                        prev.length < MAX_EVIDENCE_ITEMS
                          ? [...prev, { url: '', note: '' }]
                          : prev,
                      )
                    }
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-45 cursor-pointer dark:text-[#D9FF43]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>إضافة رابط آخر</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="block text-xs text-zinc-600 dark:text-zinc-400">
                      طبيعة المصدر
                    </span>
                    <select
                      value={sourceType}
                      onChange={(e) => setSourceType(e.target.value as SourceType)}
                      className="mt-1 w-full min-h-[38px] rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 dark:border-white/15 dark:bg-[#0C0C10] dark:text-[#F5F5F7]"
                    >
                      {SOURCE_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="block text-xs text-zinc-600 dark:text-zinc-400">
                      سياق الرصد (اختياري)
                    </span>
                    <input
                      type="text"
                      value={sourceName}
                      onChange={(e) => setSourceName(e.target.value)}
                      placeholder="مثال: حديث يومي متداول"
                      className="mt-1 w-full min-h-[38px] rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 dark:border-white/15 dark:bg-[#0C0C10] dark:text-[#F5F5F7]"
                    />
                  </label>
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
                        className="w-full min-h-[38px] rounded-xl border border-zinc-300 bg-white px-3 py-1.5 font-mono text-xs text-left text-zinc-900 dark:border-white/15 dark:bg-[#0C0C10] dark:text-[#F5F5F7]"
                      />
                    </div>
                    <div className={evidenceList.length > 1 ? 'sm:col-span-6' : 'sm:col-span-7'}>
                      <input
                        type="text"
                        placeholder="وصف مختصر للرابط..."
                        value={ev.note}
                        onChange={(e) => updateEvidence(index, 'note', e.target.value)}
                        aria-label={`توضيح الرابط ${index + 1}`}
                        className="w-full min-h-[38px] rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 dark:border-white/15 dark:bg-[#0C0C10] dark:text-[#F5F5F7]"
                      />
                    </div>
                    {evidenceList.length > 1 && (
                      <div className="sm:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            setEvidenceList((prev) => prev.filter((_, i) => i !== index))
                          }
                          aria-label="حذف الرابط"
                          className="flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-zinc-300 text-zinc-500 hover:text-red-700 cursor-pointer dark:border-white/15 dark:text-zinc-400 dark:hover:text-[#FF3B2F]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                <label className="block">
                  <span className="block text-xs text-zinc-600 dark:text-zinc-400">
                    ملاحظة للمحررين اللغويين (اختياري)
                  </span>
                  <textarea
                    rows={2}
                    value={reviewerNote}
                    onChange={(e) => setReviewerNote(e.target.value)}
                    placeholder="أي توضيح إضافي حول درجة شيوع الكلمة أو سياقها..."
                    className="mt-1 w-full rounded-xl border border-zinc-300 bg-white p-3 text-xs leading-relaxed text-zinc-900 dark:border-white/15 dark:bg-[#0C0C10] dark:text-[#F5F5F7]"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* One-Time Persistent Preferences Bar */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 space-y-3 dark:border-white/10 dark:bg-[#07070A]">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                <span>منطقتي:</span>
                <select
                  value={sessionPrefs.dialectRegion}
                  onChange={(e) => {
                    const nextReg = e.target.value
                    onUpdateSessionPrefs({ dialectRegion: nextReg })
                    setSelectedRegions([nextReg])
                  }}
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

        {/* Actions */}
        <div className="pt-5 border-t border-zinc-200 flex flex-wrap items-center justify-between gap-4 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSubmitToSupabase}
              disabled={busy}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-zinc-950 px-6 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              <span>{busy ? 'جارٍ الإرسال...' : 'إرسال المفردة للمعجم'}</span>
            </button>

            {canAccessEditorialTools && (
              <button
                type="button"
                onClick={handleSendToSandbox}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-emerald-700/40 bg-zinc-50 px-4 py-2.5 text-xs font-semibold text-emerald-800 hover:bg-zinc-100 whitespace-nowrap shrink-0 cursor-pointer dark:border-[#D9FF43]/40 dark:bg-[#07070A] dark:text-[#D9FF43] dark:hover:bg-white/5"
              >
                <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
                <span>إرسال لطابور الاختبار</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveLocalDraft}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 whitespace-nowrap shrink-0 cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:bg-white/5"
            >
              <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
              <span>حفظ مسودة</span>
            </button>
          </div>
        </div>

        {feedback && (
          <div
            role="status"
            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 text-xs leading-relaxed ${
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
    </div>
  )
}
