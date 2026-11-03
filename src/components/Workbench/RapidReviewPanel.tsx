import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  X,
  SkipForward,
  RotateCcw,
  Wand2,
  Send,
  ArrowUpLeft,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  Minimize2,
  Volume2,
  AlertTriangle,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type {
  AttestationVerdict,
  CommunityAttestationRecord,
  EntryAttestationSummary,
  ExampleAttestationSummary,
  LexicalEntry,
  LocalDraft,
  ProposedFields,
  RapidMicroTask,
} from '../../types/lexicon'
import type {
  CalibrationStats,
  RapidSessionPrefs,
} from '../../hooks/useCommunityAttestations'
import { formatAccessionCode, formatStatusLabel } from '../../services/dataset'
import { MOROCCAN_REGIONS, isValidArabizi } from '../../utils/validation'
import {
  buildCorpusArabiziLookup,
  suggestMoroccanArabizi,
} from '../../utils/arabiziTransliterator'
import { computeEntryFingerprint } from '../../utils/corpusPinning'
import { analyzeDarijaPhoneticsAndHomographs } from '../../utils/phoneticGuide'
import { humanizeSystemError } from '../../utils/humanizeError'

type QuickFixTarget = 'word' | 'arabizi' | 'meaning' | 'example'

interface CalibrationCardState {
  stepNumber: number
  kind: 'mismatched_decoy' | 'verified_control'
  syntheticEntry: LexicalEntry
  trueMeaningAr: string
}

interface RapidReviewPanelProps {
  entries: LexicalEntry[]
  categories: string[]
  corpusVersion: string
  canAccessEditorialTools: boolean
  isFocusMode: boolean
  onToggleFocusMode: () => void
  userEmail: string | null
  userVerdictsByEntryId: Record<string, CommunityAttestationRecord>
  userVerdictsByExampleId: Record<string, CommunityAttestationRecord>
  summariesByEntryId: Record<string, EntryAttestationSummary>
  summariesByExampleId: Record<string, ExampleAttestationSummary>
  skippedIds: Set<string>
  skippedExampleIds: Set<string>
  canUndo: boolean
  completedTodayCount: number
  calibrationStats: CalibrationStats
  onRecordCalibrationOutcome: (passed: boolean) => void
  sessionPrefs: RapidSessionPrefs
  onUpdateSessionPrefs: (patch: Partial<RapidSessionPrefs>) => void
  onRecordAttestation: (params: {
    entryId: string
    exampleId?: string | null
    verdict: AttestationVerdict
    dialectRegion?: string | null
    note?: string | null
    responseMs?: number | null
    baselineFingerprint?: string | null
  }) => Promise<{ storedLive: boolean }>
  onSkipEntry: (entryId: string, exampleId?: string) => void
  onUndoLastStep: () => Promise<string | null>
  onResetSessionSkips: () => void
  onSaveDraft: (draft: LocalDraft) => void
  onOpenDetailedEntry: (entry: LexicalEntry) => void
  onRequireLogin: () => void
  onSubmissionSuccess: () => void
}

export function RapidReviewPanel({
  entries,
  categories,
  corpusVersion,
  canAccessEditorialTools,
  isFocusMode,
  onToggleFocusMode,
  userEmail,
  userVerdictsByEntryId,
  userVerdictsByExampleId,
  summariesByEntryId,
  summariesByExampleId,
  skippedIds,
  skippedExampleIds,
  canUndo,
  completedTodayCount,
  calibrationStats,
  onRecordCalibrationOutcome,
  sessionPrefs,
  onUpdateSessionPrefs,
  onRecordAttestation,
  onSkipEntry,
  onUndoLastStep,
  onResetSessionSkips,
  onSaveDraft,
  onOpenDetailedEntry,
  onRequireLogin,
  onSubmissionSuccess,
}: RapidReviewPanelProps) {
  const [microTask, setMicroTask] = useState<RapidMicroTask>('verify_words')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showAlreadyReviewed, setShowAlreadyReviewed] = useState(false)
  const [forcedEntryId, setForcedEntryId] = useState<string | null>(null)

  // Session step counter for unlabeled Gold-Standard Calibration Cards
  const [sessionStepCount, setSessionStepCount] = useState(0)
  const [resolvedCalibrationSteps, setResolvedCalibrationSteps] = useState<Set<number>>(
    () => new Set(),
  )

  // Anti-rush dwell timer tracking
  const cardDisplayedAtRef = useRef<number>(performance.now())
  const consecutiveFastClicksRef = useRef<number>(0)

  // Correction / Quick-Fix state
  const [correctionOpen, setCorrectionOpen] = useState(false)
  const [selectedTargets, setSelectedTargets] = useState<Set<QuickFixTarget>>(
    () => new Set(['word', 'meaning']),
  )

  const [fixWordAr, setFixWordAr] = useState('')
  const [fixArabizi, setFixArabizi] = useState('')
  const [arabiziManuallyEdited, setArabiziManuallyEdited] = useState(false)

  const [fixMeaningAr, setFixMeaningAr] = useState('')
  const [fixMeaningFr, setFixMeaningFr] = useState('')

  const [fixExampleAr, setFixExampleAr] = useState('')
  const [fixExampleArabizi, setFixExampleArabizi] = useState('')
  const [exampleArabiziManuallyEdited, setExampleArabiziManuallyEdited] = useState(false)
  const [fixExampleMeaningAr, setFixExampleMeaningAr] = useState('')

  // Regional alternative state (for regional_usage micro-task)
  const [regionalAltOpen, setRegionalAltOpen] = useState(false)
  const [regionalAltWordAr, setRegionalAltWordAr] = useState('')
  const [regionalAltArabizi, setRegionalAltArabizi] = useState('')
  const [regionalAltExample, setRegionalAltExample] = useState('')

  const [quickNote, setQuickNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{
    type: 'success' | 'info' | 'error'
    text: string
  } | null>(null)

  const corpusArabiziLookup = useMemo(() => buildCorpusArabiziLookup(entries), [entries])

  // Build prioritized queue of entries for the selected micro-task
  const queue = useMemo(() => {
    const filtered = entries.filter((entry) => {
      if (categoryFilter !== 'all' && entry.category !== categoryFilter) {
        return false
      }
      if (microTask === 'enrich_examples' && entry.examples.length > 0) {
        return false
      }
      if (microTask === 'verify_examples') {
        const primaryEx = entry.examples[0]
        if (!primaryEx) return false
        if (!showAlreadyReviewed) {
          if (userVerdictsByExampleId[primaryEx.id]) return false
          if (skippedExampleIds.has(primaryEx.id)) return false
        }
        return true
      }
      if (!showAlreadyReviewed) {
        if (userVerdictsByEntryId[entry.id]) return false
        if (skippedIds.has(entry.id)) return false
      }
      return true
    })

    // Prioritize entries flagged by other humans or not yet reviewed in official corpus
    return [...filtered].sort((a, b) => {
      if (microTask === 'verify_examples') {
        const exA = a.examples[0]?.id ? summariesByExampleId[a.examples[0].id] : undefined
        const exB = b.examples[0]?.id ? summariesByExampleId[b.examples[0].id] : undefined
        const exFlagDiff = (exB?.flaggedCount ?? 0) - (exA?.flaggedCount ?? 0)
        if (exFlagDiff !== 0) return exFlagDiff
      }
      const sumA = summariesByEntryId[a.id]
      const sumB = summariesByEntryId[b.id]
      const flagDiff = (sumB?.flaggedCount ?? 0) - (sumA?.flaggedCount ?? 0)
      if (flagDiff !== 0) return flagDiff
      const revA = a.status === 'reviewed' ? 1 : 0
      const revB = b.status === 'reviewed' ? 1 : 0
      if (revA !== revB) return revA - revB
      return a.examples.length - b.examples.length
    })
  }, [
    entries,
    categoryFilter,
    microTask,
    showAlreadyReviewed,
    userVerdictsByEntryId,
    userVerdictsByExampleId,
    skippedIds,
    skippedExampleIds,
    summariesByEntryId,
    summariesByExampleId,
  ])

  // Unlabeled Gold-Standard Calibration Card generator every 6th verification card
  const activeCalibrationCard = useMemo<CalibrationCardState | null>(() => {
    if (
      microTask !== 'verify_words' ||
      forcedEntryId !== null ||
      entries.length < 4 ||
      sessionStepCount === 0 ||
      sessionStepCount % 6 !== 0 ||
      resolvedCalibrationSteps.has(sessionStepCount)
    ) {
      return null
    }

    const roundNumber = Math.floor(sessionStepCount / 6)
    const isDecoyRound = roundNumber % 2 === 1
    const baseIdx = (roundNumber * 5) % entries.length
    const baseEntry = entries[baseIdx]
    if (!baseEntry) return null

    if (isDecoyRound) {
      // Pick a donor entry with a clearly distinct meaning/category
      let donorEntry: LexicalEntry | null = null
      for (let offset = 1; offset < entries.length; offset++) {
        const candidate = entries[(baseIdx + offset * 7) % entries.length]
        if (
          candidate &&
          candidate.word.trim() !== baseEntry.word.trim() &&
          candidate.meaning.trim() !== baseEntry.meaning.trim() &&
          candidate.category !== baseEntry.category
        ) {
          donorEntry = candidate
          break
        }
      }
      if (!donorEntry) {
        for (let offset = 1; offset < entries.length; offset++) {
          const candidate = entries[(baseIdx + offset) % entries.length]
          if (
            candidate &&
            candidate.word.trim() !== baseEntry.word.trim() &&
            candidate.meaning.trim() !== baseEntry.meaning.trim()
          ) {
            donorEntry = candidate
            break
          }
        }
      }
      if (!donorEntry) return null

      return {
        stepNumber: sessionStepCount,
        kind: 'mismatched_decoy',
        trueMeaningAr: baseEntry.meaning,
        syntheticEntry: {
          ...baseEntry,
          id: `cal-decoy-${sessionStepCount}`,
          meaning: donorEntry.meaning,
          french: donorEntry.french,
          examples: [],
        },
      }
    }

    const reviewedPool = entries.filter((e) => e.status === 'reviewed')
    const controlSource =
      reviewedPool.length > 0
        ? reviewedPool[roundNumber % reviewedPool.length]
        : baseEntry

    return {
      stepNumber: sessionStepCount,
      kind: 'verified_control',
      trueMeaningAr: controlSource.meaning,
      syntheticEntry: {
        ...controlSource,
        id: `cal-ctrl-${sessionStepCount}`,
      },
    }
  }, [microTask, forcedEntryId, entries, sessionStepCount, resolvedCalibrationSteps])

  const realQueueEntry = useMemo(() => {
    if (forcedEntryId) {
      const found = entries.find((e) => e.id === forcedEntryId)
      if (found) return found
    }
    return queue[0] ?? null
  }, [entries, forcedEntryId, queue])

  const currentEntry = activeCalibrationCard
    ? activeCalibrationCard.syntheticEntry
    : realQueueEntry

  //Phonetics & Homograph Disambiguation for the displayed card
  const phoneticAnalysis = useMemo(() => {
    if (!currentEntry) return null
    return analyzeDarijaPhoneticsAndHomographs(currentEntry, entries)
  }, [currentEntry, entries])

  // Reset inline inputs and dwell timer whenever card or micro-task changes
  useEffect(() => {
    cardDisplayedAtRef.current = performance.now()
    setCorrectionOpen(false)
    setRegionalAltOpen(false)
    setSelectedTargets(new Set(['word']))
    setFixWordAr('')
    setFixArabizi('')
    setArabiziManuallyEdited(false)
    setFixMeaningAr('')
    setFixMeaningFr('')
    setFixExampleAr('')
    setFixExampleArabizi('')
    setExampleArabiziManuallyEdited(false)
    setFixExampleMeaningAr('')
    setRegionalAltWordAr('')
    setRegionalAltArabizi('')
    setRegionalAltExample('')
    setQuickNote('')
  }, [currentEntry?.id, microTask])

  // Auto-generate word Arabizi when typing Arabic unless manually overridden
  useEffect(() => {
    if (!arabiziManuallyEdited) {
      setFixArabizi(suggestMoroccanArabizi(fixWordAr, corpusArabiziLookup))
    }
  }, [fixWordAr, arabiziManuallyEdited, corpusArabiziLookup])

  // Auto-generate example Arabizi when typing Arabic example unless manually overridden
  useEffect(() => {
    if (!exampleArabiziManuallyEdited) {
      setFixExampleArabizi(suggestMoroccanArabizi(fixExampleAr, corpusArabiziLookup))
    }
  }, [fixExampleAr, exampleArabiziManuallyEdited, corpusArabiziLookup])

  // Auto-generate regional alternative Arabizi
  useEffect(() => {
    setRegionalAltArabizi(suggestMoroccanArabizi(regionalAltWordAr, corpusArabiziLookup))
  }, [regionalAltWordAr, corpusArabiziLookup])

  function toggleFixTarget(target: QuickFixTarget) {
    setSelectedTargets((prev) => {
      const next = new Set(prev)
      if (next.has(target)) {
        if (next.size > 1) next.delete(target)
      } else {
        next.add(target)
      }
      return next
    })
  }

  const markCalibrationStepResolved = useCallback((stepNum: number) => {
    setResolvedCalibrationSteps((prev) => {
      const next = new Set(prev)
      next.add(stepNum)
      return next
    })
  }, [])

  const handleConfirmAccurate = useCallback(async () => {
    if (!currentEntry || submitting) return

    const dwellMs = Math.round(performance.now() - cardDisplayedAtRef.current)

    // Anti-Rush Speed Guard: prevent mechanical rapid clicking under 850ms
    if (dwellMs < 650 || (dwellMs < 950 && consecutiveFastClicksRef.current >= 1)) {
      consecutiveFastClicksRef.current += 1
      cardDisplayedAtRef.current = performance.now()
      setToast({
        type: 'info',
        text: 'تمهّل لحظة لقراءة الكلمة والمعنى بتأنٍّ حفاظاً على دقة المعجم قبل التأكيد.',
      })
      return
    }
    if (dwellMs < 950) {
      consecutiveFastClicksRef.current += 1
    } else {
      consecutiveFastClicksRef.current = 0
    }

    // Intercept unlabeled calibration card without polluting real dataset
    if (activeCalibrationCard) {
      markCalibrationStepResolved(activeCalibrationCard.stepNumber)
      if (activeCalibrationCard.kind === 'mismatched_decoy') {
        onRecordCalibrationOutcome(false)
        setToast({
          type: 'info',
          text: `ملاحظة مفيدة: المعنى المتداول لكلمة «${activeCalibrationCard.syntheticEntry.word}» هو «${activeCalibrationCard.trueMeaningAr}». انتقلنا للمفردة التالية.`,
        })
      } else {
        onRecordCalibrationOutcome(true)
        setToast({
          type: 'success',
          text: `تم تسجيل تأكيدك لصحة «${activeCalibrationCard.syntheticEntry.word}» والانتقال للتالية.`,
        })
      }
      return
    }

    setForcedEntryId(null)
    const labelWord = currentEntry.word
    const fingerprint = computeEntryFingerprint(currentEntry)
    const targetExampleId =
      microTask === 'verify_examples' ? currentEntry.examples[0]?.id ?? null : null
    const res = await onRecordAttestation({
      entryId: currentEntry.id,
      exampleId: targetExampleId,
      verdict: microTask === 'regional_usage' ? 'regional_variant' : 'accurate',
      dialectRegion: sessionPrefs.dialectRegion,
      responseMs: dwellMs,
      baselineFingerprint: fingerprint,
    })
    setSessionStepCount((c) => c + 1)
    setToast({
      type: 'success',
      text:
        microTask === 'regional_usage'
          ? `تم توثيق تداول «${labelWord}» في (${sessionPrefs.dialectRegion}) والانتقال للتالية.`
          : microTask === 'verify_examples'
            ? `تم تأكيد سلامة جملة المثال لمفردة «${labelWord}» والانتقال للتالية.`
            : res.storedLive
              ? `تم تسجيل تأكيدك لصحة «${labelWord}» والانتقال للتالية.`
              : `تم حفظ تأكيدك لصحة «${labelWord}» والانتقال للتالية.`,
    })
  }, [
    currentEntry,
    submitting,
    activeCalibrationCard,
    markCalibrationStepResolved,
    onRecordCalibrationOutcome,
    onRecordAttestation,
    microTask,
    sessionPrefs.dialectRegion,
  ])

  const handleNegativeAction = useCallback(() => {
    if (!currentEntry || submitting) return

    if (activeCalibrationCard) {
      markCalibrationStepResolved(activeCalibrationCard.stepNumber)
      if (activeCalibrationCard.kind === 'mismatched_decoy') {
        onRecordCalibrationOutcome(true)
        setToast({
          type: 'success',
          text: `ملاحظة دقيقة! المعنى المتداول لكلمة «${activeCalibrationCard.syntheticEntry.word}» هو «${activeCalibrationCard.trueMeaningAr}». انتقلنا للتالية.`,
        })
      } else {
        setToast({
          type: 'info',
          text: 'تم الانتقال إلى المفردة التالية.',
        })
      }
      return
    }

    if (microTask === 'verify_examples' && !correctionOpen && currentEntry.examples[0]) {
      const ex = currentEntry.examples[0]
      setSelectedTargets(new Set(['example']))
      setFixExampleAr(ex.darijaAr)
      setFixExampleArabizi(ex.darijaLatin)
      setExampleArabiziManuallyEdited(true)
      setFixExampleMeaningAr(ex.meaningAr)
    }

    setRegionalAltOpen(false)
    setCorrectionOpen((prev) => !prev)
  }, [
    currentEntry,
    submitting,
    activeCalibrationCard,
    markCalibrationStepResolved,
    onRecordCalibrationOutcome,
    microTask,
    correctionOpen,
  ])

  const handleSkipCard = useCallback(() => {
    if (!currentEntry || submitting) return
    if (activeCalibrationCard) {
      markCalibrationStepResolved(activeCalibrationCard.stepNumber)
      setToast(null)
      return
    }
    setForcedEntryId(null)
    const targetExampleId =
      microTask === 'verify_examples' ? currentEntry.examples[0]?.id : undefined
    onSkipEntry(currentEntry.id, targetExampleId)
    setToast(null)
  }, [
    currentEntry,
    submitting,
    activeCalibrationCard,
    markCalibrationStepResolved,
    microTask,
    onSkipEntry,
  ])

  const handleUndo = useCallback(async () => {
    const restoredId = await onUndoLastStep()
    if (restoredId) {
      setForcedEntryId(restoredId)
      setToast({
        type: 'info',
        text: 'تم التراجع والعودة إلى المفردة السابقة.',
      })
    }
  }, [onUndoLastStep])

  // Safe keyboard shortcuts when focus is NOT inside text inputs
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!currentEntry || submitting) return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        if (e.key === 'Escape') {
          setCorrectionOpen(false)
          setRegionalAltOpen(false)
        }
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (
        (microTask === 'verify_words' || microTask === 'verify_examples') &&
        !correctionOpen &&
        !regionalAltOpen
      ) {
        if (e.key === '1' || e.key.toLowerCase() === 'y') {
          e.preventDefault()
          handleConfirmAccurate()
        } else if (e.key === '2' || e.key.toLowerCase() === 'n') {
          e.preventDefault()
          handleNegativeAction()
        } else if (
          (e.key === '3' || e.key.toLowerCase() === 'r') &&
          microTask === 'verify_words' &&
          !activeCalibrationCard
        ) {
          e.preventDefault()
          setCorrectionOpen(false)
          setRegionalAltOpen(true)
        } else if (e.key === ' ' || e.key.toLowerCase() === 's') {
          e.preventDefault()
          handleSkipCard()
        } else if (e.key.toLowerCase() === 'z' && canUndo && !activeCalibrationCard) {
          e.preventDefault()
          handleUndo()
        }
      } else if (microTask === 'regional_usage' && !regionalAltOpen) {
        if (e.key === '1' || e.key.toLowerCase() === 'y') {
          e.preventDefault()
          handleConfirmAccurate()
        } else if (e.key === '2' || e.key.toLowerCase() === 'n') {
          e.preventDefault()
          setRegionalAltOpen(true)
        } else if (e.key === ' ' || e.key.toLowerCase() === 's') {
          e.preventDefault()
          handleSkipCard()
        } else if (e.key.toLowerCase() === 'z' && canUndo && !activeCalibrationCard) {
          e.preventDefault()
          handleUndo()
        }
      } else if (e.key === 'Escape') {
        setCorrectionOpen(false)
        setRegionalAltOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    currentEntry,
    submitting,
    microTask,
    correctionOpen,
    regionalAltOpen,
    activeCalibrationCard,
    canUndo,
    handleConfirmAccurate,
    handleNegativeAction,
    handleSkipCard,
    handleUndo,
  ])

  async function dispatchStructuredProposal(
    entry: LexicalEntry,
    proposedData: ProposedFields,
    autoNote: string,
    verdictToLog: AttestationVerdict,
  ) {
    if (!sessionPrefs.rightsConfirmedOnce) {
      setToast({
        type: 'error',
        text: 'يرجى تفعيل خيار «الإقرار بالرخصة المفتوحة للجلسة» مرة واحدة قبل إرسال التصحيحات.',
      })
      return
    }

    const fingerprint = computeEntryFingerprint(entry)
    const dwellMs = Math.round(performance.now() - cardDisplayedAtRef.current)

    const finalProposal: ProposedFields = {
      submission_kind: 'edit_entry',
      ...proposedData,
      corpus_version: corpusVersion,
      baseline_fingerprint: fingerprint,
      source_type: 'contributor',
      rights_confirmed: true,
      rights_holder: 'contributor',
      license: 'CC BY-NC 4.0',
      redistribution_permission: 'allowed',
      training_permission: sessionPrefs.trainingPermission,
      commercial_permission: 'not_allowed',
    }
    if (sessionPrefs.dialectRegion && !finalProposal.regions) {
      finalProposal.regions = [sessionPrefs.dialectRegion]
    }

    const noteText = quickNote.trim() || autoNote

    setSubmitting(true)
    setToast(null)

    let sentToLiveBackend = false
    let liveInsertError: unknown = null

    if (supabase && userEmail) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        let insertRes = await supabase.from('review_submissions').insert({
          entry_id: entry.id,
          corpus_version: corpusVersion,
          baseline_fingerprint: fingerprint,
          proposed_data: finalProposal,
          evidence: [],
          reviewer_note: noteText,
          status: 'pending',
        })

        // Fallback if remote DB has not yet applied version-pinning top-level columns
        if (insertRes.error) {
          insertRes = await supabase.from('review_submissions').insert({
            entry_id: entry.id,
            proposed_data: finalProposal,
            evidence: [],
            reviewer_note: noteText,
            status: 'pending',
          })
        }

        if (!insertRes.error) {
          sentToLiveBackend = true
          onSubmissionSuccess()
        } else {
          liveInsertError = insertRes.error
        }
      }
    }

    if (liveInsertError && userEmail) {
      setSubmitting(false)
      setToast({
        type: 'error',
        text: humanizeSystemError(liveInsertError, 'تعذر إرسال التصحيح في الوقت الحالي.'),
      })
      return
    }

    if (!sentToLiveBackend) {
      if (!userEmail) {
        onSaveDraft({
          entryId: entry.id,
          headword: entry.word,
          category: entry.category,
          proposedData: finalProposal,
          evidence: [],
          reviewerNote: noteText,
          updatedAt: new Date().toISOString(),
        })
      }
    }

    await onRecordAttestation({
      entryId: entry.id,
      exampleId: microTask === 'verify_examples' ? entry.examples[0]?.id ?? null : null,
      verdict: verdictToLog,
      dialectRegion: sessionPrefs.dialectRegion,
      note: noteText,
      responseMs: dwellMs,
      baselineFingerprint: fingerprint,
    })

    setSessionStepCount((c) => c + 1)
    setForcedEntryId(null)
    setSubmitting(false)

    setToast({
      type: 'success',
      text: sentToLiveBackend
        ? `أُرسل تصحيح «${entry.word}» إلى فريق التحكيم المعجمي وتم الانتقال للمفردة التالية.`
        : !userEmail
          ? `حُفظ تصحيح «${entry.word}» في مسوداتك المحلية؛ يمكنك تسجيل الدخول في أي وقت لإرساله باسمك.`
          : `تم تسجيل تصحيح «${entry.word}» والانتقال للمفردة التالية.`,
    })
  }

  async function handleSubmitQuickCorrection(e: React.FormEvent) {
    e.preventDefault()
    if (!currentEntry || submitting) return

    const proposed: ProposedFields = {}
    const summaryParts: string[] = []

    if (selectedTargets.has('word')) {
      if (fixWordAr.trim()) {
        proposed.word_ar = fixWordAr.trim()
        summaryParts.push(`تصحيح الكلمة إلى «${fixWordAr.trim()}»`)
      }
      if (fixArabizi.trim()) {
        if (!isValidArabizi(fixArabizi)) {
          setToast({
            type: 'error',
            text: 'الكتابة اللاتينية يجب أن تقتصر على الحروف اللاتينية والأرقام الصوتية المعتمدة.',
          })
          return
        }
        proposed.arabizi = fixArabizi.trim()
      }
    }

    if (selectedTargets.has('arabizi') && !selectedTargets.has('word')) {
      if (fixArabizi.trim()) {
        if (!isValidArabizi(fixArabizi)) {
          setToast({
            type: 'error',
            text: 'الكتابة اللاتينية يجب أن تقتصر على الحروف اللاتينية والأرقام الصوتية المعتمدة.',
          })
          return
        }
        proposed.arabizi = fixArabizi.trim()
        summaryParts.push(`تصحيح الكتابة اللاتينية إلى «${fixArabizi.trim()}»`)
      }
    }

    if (selectedTargets.has('meaning')) {
      if (fixMeaningAr.trim()) {
        proposed.msa_translation = fixMeaningAr.trim()
        summaryParts.push('تصويب المعنى العربي')
      }
      if (fixMeaningFr.trim()) {
        proposed.french_translation = fixMeaningFr.trim()
        summaryParts.push('تصويب المقابل الفرنسي')
      }
    }

    if (selectedTargets.has('example')) {
      if (fixExampleAr.trim()) {
        const lat =
          fixExampleArabizi.trim() ||
          suggestMoroccanArabizi(fixExampleAr.trim(), corpusArabiziLookup)
        if (!lat || !isValidArabizi(lat)) {
          setToast({
            type: 'error',
            text: 'يرجى التثبت من الكتابة اللاتينية للمثال السياقي قبل الإرسال.',
          })
          return
        }
        proposed.example_darija = fixExampleAr.trim()
        proposed.example_arabizi = lat
        if (fixExampleMeaningAr.trim()) {
          proposed.example_translation = fixExampleMeaningAr.trim()
        }
        summaryParts.push('إضافة أو تصحيح شاهد سياقي')
      }
    }

    if (Object.keys(proposed).length === 0) {
      setToast({
        type: 'error',
        text: 'اكتب الكلمة الصحيحة أو المعنى أو المثال في الحقل المحدد قبل الإرسال.',
      })
      return
    }

    const autoSummary = `مراجعة بشرية سريعة (${sessionPrefs.dialectRegion}): ${summaryParts.join(' + ')}`
    await dispatchStructuredProposal(currentEntry, proposed, autoSummary, 'needs_correction')
  }

  async function handleSubmitExampleEnrichment(e: React.FormEvent) {
    e.preventDefault()
    if (!currentEntry || submitting) return

    if (!fixExampleAr.trim()) {
      setToast({
        type: 'error',
        text: 'اكتب جملة طبيعية بالدارجة تحتوي على الكلمة أولاً.',
      })
      return
    }

    const lat =
      fixExampleArabizi.trim() || suggestMoroccanArabizi(fixExampleAr.trim(), corpusArabiziLookup)
    if (!lat || !isValidArabizi(lat)) {
      setToast({
        type: 'error',
        text: 'يرجى التثبت من الكتابة اللاتينية للجملة.',
      })
      return
    }

    const proposed: ProposedFields = {
      example_darija: fixExampleAr.trim(),
      example_arabizi: lat,
    }
    if (fixExampleMeaningAr.trim()) {
      proposed.example_translation = fixExampleMeaningAr.trim()
    }

    await dispatchStructuredProposal(
      currentEntry,
      proposed,
      `إثراء شاهد سياقي يومي (${sessionPrefs.dialectRegion})`,
      'accurate',
    )
  }

  async function handleSubmitRegionalAlternative(e: React.FormEvent) {
    e.preventDefault()
    if (!currentEntry || submitting) return

    if (!regionalAltWordAr.trim()) {
      setToast({
        type: 'error',
        text: 'اكتب المفردة أو العبارة المستعملة في منطقتك أولاً.',
      })
      return
    }

    const altLat = regionalAltArabizi.trim()
    const noteSentence = `في منطقة (${sessionPrefs.dialectRegion}) يُستعمل المرادف المحلي: «${regionalAltWordAr.trim()}»${altLat ? ` (${altLat})` : ''} للدلالة نفسها.`

    const proposed: ProposedFields = {
      usage_note: noteSentence,
      regions: [sessionPrefs.dialectRegion],
    }

    if (regionalAltExample.trim()) {
      const exLat = suggestMoroccanArabizi(regionalAltExample.trim(), corpusArabiziLookup)
      if (exLat && isValidArabizi(exLat)) {
        proposed.example_darija = regionalAltExample.trim()
        proposed.example_arabizi = exLat
      }
    }

    await dispatchStructuredProposal(
      currentEntry,
      proposed,
      noteSentence,
      'regional_variant',
    )
  }

  const progressRatio = Math.min(
    100,
    Math.round((completedTodayCount / sessionPrefs.dailyGoal) * 100),
  )
  const hasUserAlreadyVotedOnCurrent = Boolean(
    currentEntry && !activeCalibrationCard && userVerdictsByEntryId[currentEntry.id],
  )
  const currentSummary =
    currentEntry && !activeCalibrationCard ? summariesByEntryId[currentEntry.id] : undefined

  return (
    <div className="space-y-5">
      {/* Top Session & Micro-Task Orchestration Bar (Compact in Focus Mode) */}
      {isFocusMode ? (
        <div className="mx-auto max-w-3xl flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-xs dark:border-white/10 dark:bg-[#0C0C10]">
          <div className="flex flex-wrap items-center gap-3 text-zinc-700 dark:text-zinc-300">
            <span className="font-semibold text-zinc-950 dark:text-white">وضع التركيز</span>
            <span aria-hidden="true">·</span>
            <span>
              اليوم:{' '}
              <strong className="font-mono tabular-nums text-emerald-700 dark:text-[#D9FF43]">
                {completedTodayCount}/{sessionPrefs.dailyGoal}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              متبقٍ:{' '}
              <strong className="font-mono tabular-nums">{queue.length.toLocaleString('en-US')}</strong>
            </span>
            {canAccessEditorialTools && calibrationStats.total > 0 && (
              <>
                <span aria-hidden="true" className="hidden sm:inline">·</span>
                <span className="hidden sm:inline text-zinc-500 dark:text-zinc-400">
                  معايرة الدقة:{' '}
                  <strong className="font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                    {Math.round((calibrationStats.passed / calibrationStats.total) * 100)}%
                  </strong>
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canUndo && !activeCalibrationCard && (
              <button
                type="button"
                onClick={handleUndo}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-100 cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:bg-white/10"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                <span>تراجع</span>
              </button>
            )}
            <button
              type="button"
              onClick={onToggleFocusMode}
              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-50 px-3.5 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 cursor-pointer dark:border-[#D9FF43]/40 dark:bg-[#07070A] dark:text-[#D9FF43] dark:hover:bg-[#D9FF43]/10"
            >
              <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>إنهاء التركيز</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 space-y-5 dark:border-white/10 dark:bg-[#0C0C10]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="font-display text-lg sm:text-xl font-bold text-zinc-950 dark:text-white">
                المراجعة البشرية السريعة (بطاقة تلو الأخرى)
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
                أجب بـ «نعم» لتوثيق صحة الكلمة فوراً، أو «لا» لتصحيح الكلمة أو المعنى أو المثال مباشرة دون تعقيد.
              </p>
            </div>

            {/* Focus Mode + Undo + Daily Session Counter */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onToggleFocusMode}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-zinc-900/25 bg-zinc-100 px-4 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-200 whitespace-nowrap shrink-0 cursor-pointer dark:border-[#D9FF43]/45 dark:bg-[#D9FF43]/10 dark:text-[#D9FF43] dark:hover:bg-[#D9FF43]/20"
              >
                <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>وضع التركيز</span>
              </button>

              {canUndo && !activeCalibrationCard && (
                <button
                  type="button"
                  onClick={handleUndo}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-50 px-3.5 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 whitespace-nowrap shrink-0 cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:bg-white/10"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>تراجع</span>
                </button>
              )}

              <div className="flex items-center gap-3 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-white/10 dark:bg-[#07070A]">
                <div className="text-xs text-zinc-700 dark:text-zinc-300">
                  <span>إنجاز اليوم: </span>
                  <strong className="font-mono tabular-nums text-zinc-950 dark:text-white">
                    {completedTodayCount} / {sessionPrefs.dailyGoal}
                  </strong>
                </div>
                <div
                  aria-hidden="true"
                  className="h-1.5 w-16 sm:w-20 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10"
                >
                  <div
                    className="h-full bg-zinc-950 transition-transform duration-200 origin-right dark:bg-[#D9FF43]"
                    style={{ transform: `scaleX(${progressRatio / 100})` }}
                  />
                </div>
                <select
                  aria-label="هدف المراجعة اليومي"
                  value={sessionPrefs.dailyGoal}
                  onChange={(e) => onUpdateSessionPrefs({ dailyGoal: Number(e.target.value) })}
                  className="bg-transparent text-[11px] font-mono tabular-nums text-zinc-600 focus:outline-none cursor-pointer dark:text-zinc-400"
                >
                  <option value={5}>هدف 5</option>
                  <option value={10}>هدف 10</option>
                  <option value={20}>هدف 20</option>
                  <option value={50}>هدف 50</option>
                </select>
              </div>
            </div>
          </div>

          {/* Micro-Task Selector + Session Region & Category */}
          <div className="pt-4 border-t border-zinc-200 flex flex-wrap items-center justify-between gap-4 dark:border-white/10">
            <div
              role="tablist"
              aria-label="نوع المهمة السريعة"
              className="inline-flex flex-wrap items-center gap-1 rounded-full border border-zinc-200 bg-zinc-100 p-1 dark:border-white/10 dark:bg-[#07070A]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={microTask === 'verify_words'}
                onClick={() => {
                  setForcedEntryId(null)
                  setMicroTask('verify_words')
                }}
                className={`min-h-[34px] rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  microTask === 'verify_words'
                    ? 'bg-zinc-950 text-white shadow-2xs dark:bg-[#D9FF43] dark:text-[#050507]'
                    : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                تدقيق الكلمات (نعم / لا)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={microTask === 'verify_examples'}
                onClick={() => {
                  setForcedEntryId(null)
                  setMicroTask('verify_examples')
                }}
                className={`min-h-[34px] rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  microTask === 'verify_examples'
                    ? 'bg-zinc-950 text-white shadow-2xs dark:bg-[#D9FF43] dark:text-[#050507]'
                    : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                تدقيق الشواهد السياقية
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={microTask === 'enrich_examples'}
                onClick={() => {
                  setForcedEntryId(null)
                  setMicroTask('enrich_examples')
                }}
                className={`min-h-[34px] rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  microTask === 'enrich_examples'
                    ? 'bg-zinc-950 text-white shadow-2xs dark:bg-[#D9FF43] dark:text-[#050507]'
                    : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                إثراء الأمثلة السريع
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={microTask === 'regional_usage'}
                onClick={() => {
                  setForcedEntryId(null)
                  setMicroTask('regional_usage')
                }}
                className={`min-h-[34px] rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  microTask === 'regional_usage'
                    ? 'bg-zinc-950 text-white shadow-2xs dark:bg-[#D9FF43] dark:text-[#050507]'
                    : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                التداول حسب المنطقة
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <span className="whitespace-nowrap">منطقتي اللهجية:</span>
                <select
                  value={sessionPrefs.dialectRegion}
                  onChange={(e) => onUpdateSessionPrefs({ dialectRegion: e.target.value })}
                  className="min-h-[36px] rounded-lg border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-950 focus:border-zinc-950 focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
                >
                  {MOROCCAN_REGIONS.map((reg) => (
                    <option key={reg} value={reg}>
                      {reg}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <span className="whitespace-nowrap">الفئة:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setForcedEntryId(null)
                    setCategoryFilter(e.target.value)
                  }}
                  className="min-h-[36px] rounded-lg border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-950 focus:border-zinc-950 focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
                >
                  <option value="all">جميع الفئات ({entries.length})</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* One-Time Session Open License Consent */}
          <div className="pt-3 border-t border-zinc-200 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-600 dark:border-white/10 dark:text-zinc-400">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sessionPrefs.rightsConfirmedOnce}
                onChange={(e) =>
                  onUpdateSessionPrefs({ rightsConfirmedOnce: e.target.checked })
                }
                className="h-4 w-4 accent-zinc-950 dark:accent-[#D9FF43]"
              />
              <span>
                إقرار لمرة واحدة في الجلسة: التصحيحات والأمثلة التي أكتبها من صياغتي وأتيحها للمتن العام برخصة{' '}
                <span className="font-mono">CC BY-NC 4.0</span>
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span>
                متبقٍ في هذه القائمة:{' '}
                <strong className="font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                  {queue.length.toLocaleString('en-US')}
                </strong>
              </span>
              {canAccessEditorialTools && calibrationStats.total > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    دقة المعايرة:{' '}
                    <strong className="font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                      {calibrationStats.passed}/{calibrationStats.total}
                    </strong>
                  </span>
                </>
              )}
              {!userEmail && (
                <>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={onRequireLogin}
                    className="font-semibold text-emerald-700 hover:underline whitespace-nowrap cursor-pointer dark:text-[#D9FF43]"
                  >
                    سجّل دخولك لحفظ مساهماتك باسمك
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Feedback Banner */}
      {toast && (
        <div
          role="status"
          className={`mx-auto ${isFocusMode ? 'max-w-3xl' : ''} flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs ${
            toast.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-950 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200'
              : toast.type === 'info'
                ? 'border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-white/15 dark:bg-[#0C0C10] dark:text-zinc-200'
                : 'border-emerald-200 bg-emerald-50/80 text-emerald-950 dark:border-[#D9FF43]/30 dark:bg-[#D9FF43]/10 dark:text-[#F5F5F7]'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-700 dark:text-red-400" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700 dark:text-[#D9FF43]" />
            )}
            <span>{toast.text}</span>
          </div>

        </div>
      )}

      {/* Main Centered Human Review Card */}
      {!currentEntry ? (
        <div className="mx-auto max-w-3xl rounded-2xl border border-zinc-200 bg-white p-8 sm:p-12 text-center space-y-4 dark:border-white/10 dark:bg-[#0C0C10]">
          <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-700 dark:text-[#D9FF43]" />
          <h4 className="font-display text-xl font-bold text-zinc-950 dark:text-white">
            أكملت جميع المفردات المتاحة في هذا المسار
          </h4>
          <p className="mx-auto max-w-md text-sm text-zinc-600 dark:text-zinc-400">
            لم تتبقَّ مفردات غير مراجعة ضمن الفلتر الحالي. يمكنك استعادة المفردات التي تخطيتها أو اختيار فئة دلالية أخرى.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            {(skippedIds.size > 0 || skippedExampleIds.size > 0) && (
              <button
                type="button"
                onClick={onResetSessionSkips}
                className="min-h-[42px] rounded-full bg-zinc-950 px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 whitespace-nowrap cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
              >
                إعادة عرض العناصر المتخطاة ({skippedIds.size + skippedExampleIds.size})
              </button>
            )}
            {categoryFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className="min-h-[42px] rounded-full border border-zinc-300 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 whitespace-nowrap cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200"
              >
                عرض جميع الفئات
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowAlreadyReviewed((v) => !v)}
              className="min-h-[42px] rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 whitespace-nowrap cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-300"
            >
              {showAlreadyReviewed ? 'إخفاء ما راجعته سابقاً' : 'إظهار المفردات المراجعة سابقاً'}
            </button>
          </div>
        </div>
      ) : (
        <article
          className={`mx-auto max-w-3xl rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-white/12 dark:bg-[#0C0C10] ${
            isFocusMode ? 'p-5 sm:p-8 space-y-5' : 'p-6 sm:p-10 space-y-7'
          }`}
        >
          {/* Quiet Unboxed Metadata Header — Zero Pre-Vote Herd Bias */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <div className="flex flex-wrap items-center gap-2">
              {canAccessEditorialTools && !activeCalibrationCard && (
                <>
                  <span className="font-mono font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
                    {formatAccessionCode(currentEntry.id, currentEntry.numericId)}
                  </span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <span>{currentEntry.category}</span>
              {canAccessEditorialTools && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{formatStatusLabel(currentEntry.status)}</span>
                </>
              )}
              {/* Show crowd tally ONLY if reviewer has already cast their own independent vote */}
              {hasUserAlreadyVotedOnCurrent &&
                currentSummary &&
                (currentSummary.accurateCount > 0 || currentSummary.flaggedCount > 0) && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-emerald-700 dark:text-[#D9FF43]">
                      بعد تصويتك: {currentSummary.accurateCount} تأكيد
                      {currentSummary.flaggedCount > 0
                        ? ` / ${currentSummary.flaggedCount} ملاحظة`
                        : ''}
                    </span>
                  </>
                )}
            </div>

            {!activeCalibrationCard && (
              <button
                type="button"
                onClick={() => onOpenDetailedEntry(currentEntry)}
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-950 whitespace-nowrap cursor-pointer dark:text-zinc-400 dark:hover:text-[#D9FF43]"
              >
                <span>عرض البطاقة الكاملة</span>
                <ArrowUpLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Focal Word Display + Phonetic & Homograph Disambiguation */}
          <div className="py-1 space-y-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <h4 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-zinc-950 dark:text-white">
                  {currentEntry.word}
                </h4>
                <span
                  dir="ltr"
                  className="font-mono text-lg sm:text-2xl font-medium text-emerald-700 dark:text-[#D9FF43]"
                >
                  {currentEntry.latin || '—'}
                </span>
              </div>

              {/* Phonetic Pronunciation Key for Unvocalized Arabic */}
              {phoneticAnalysis && phoneticAnalysis.phoneticCues.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <Volume2 className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-[#D9FF43]" aria-hidden="true" />
                  <span>دليل النطق الصوتي:</span>
                  {phoneticAnalysis.phoneticCues.map((cue, idx) => (
                    <span key={cue.symbol} className="inline-flex items-center gap-1">
                      {idx > 0 && <span aria-hidden="true">·</span>}
                      <strong className="font-mono text-zinc-800 dark:text-zinc-200" dir="ltr">
                        {cue.symbol}
                      </strong>
                      <span>= {cue.exampleNote}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Homograph Disambiguation Notice (e.g., قرعة: 9r3a vs gr3a) */}
              {phoneticAnalysis?.homographNotice && (
                <div className="rounded-xl border border-amber-300/80 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
                    <p className="leading-relaxed">
                      <strong className="font-semibold">تنبيه تشابه رسم إملائي بدون تشكيل:</strong>{' '}
                      يُقرأ هذا المدخل نطقاً{' '}
                      <span className="font-mono font-semibold" dir="ltr">
                        {currentEntry.latin}
                      </span>
                      ، ولا يُقصد به المشترك اللفظي الآخر:{' '}
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

            <div className="grid grid-cols-1 gap-4 pt-4 border-t border-zinc-200 sm:grid-cols-2 dark:border-white/10">
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  المعنى بالعربية الفصحى
                </p>
                <p className="mt-1 text-base sm:text-lg font-medium text-zinc-950 dark:text-white">
                  {currentEntry.meaning || 'غير محدد'}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">المقابل بالفرنسية</p>
                <p
                  dir="ltr"
                  className="mt-1 text-base sm:text-lg font-medium text-zinc-800 text-end sm:text-start dark:text-zinc-200"
                >
                  {currentEntry.french || '—'}
                </p>
              </div>
            </div>

            {/* Existing Contextual Example if available */}
            {!activeCalibrationCard && (
              <div className="pt-4 border-t border-zinc-200 dark:border-white/10">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  الشاهد السياقي المسجل حالياً
                </p>
                {currentEntry.examples.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm sm:text-base font-medium text-zinc-950 dark:text-white">
                      «{currentEntry.examples[0].darijaAr}»
                    </p>
                    <p
                      dir="ltr"
                      className="font-mono text-xs text-zinc-600 text-end sm:text-start dark:text-zinc-400"
                    >
                      {currentEntry.examples[0].darijaLatin}
                    </p>
                    {currentEntry.examples[0].meaningAr && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        المعنى: {currentEntry.examples[0].meaningAr}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-1.5 text-xs text-amber-800 dark:text-amber-300">
                    لا يوجد مثال سياقي مسجل لهذه المفردة بعد في المعجم الرسمي.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* MICRO-TASK 1 & 1B: VERIFY WORDS OR VERIFY CONTEXTUAL EXAMPLES (YES / NO / REGIONAL / SKIP) */}
          {(microTask === 'verify_words' || microTask === 'verify_examples') && (
            <div className="pt-5 border-t border-zinc-200 space-y-5 dark:border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-sm sm:text-base font-bold text-zinc-950 dark:text-white">
                  {microTask === 'verify_examples'
                    ? `هل جملة المثال المعروضة سليمة وتعبّر بدقة عن معنى «${currentEntry.word}»؟`
                    : 'هل هذه المفردة بنطقها ومعناها المعروض صحيحة ومستعملة في الدارجة؟'}
                </p>
                <span className="hidden sm:inline text-[11px] text-zinc-500 dark:text-zinc-400">
                  اختصارات: 1 نعم · 2 تصويب{microTask === 'verify_words' ? ' · 3 مرادف بمنطقتي' : ''} · مسافة تخطي
                </span>
              </div>

              <div
                className={`hidden sm:grid gap-3 ${
                  microTask === 'verify_words' && !activeCalibrationCard
                    ? 'sm:grid-cols-4'
                    : 'sm:grid-cols-3'
                }`}
              >
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmAccurate}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 whitespace-nowrap cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
                >
                  <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {microTask === 'verify_examples' ? 'نعم، المثال سليم' : 'نعم، صحيحة'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleNegativeAction}
                  aria-expanded={correctionOpen}
                  className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    correctionOpen
                      ? 'border-[#FF3B2F] bg-[#FF3B2F]/10 text-[#FF3B2F] dark:border-[#FF3B2F] dark:bg-[#FF3B2F]/15 dark:text-white'
                      : 'border-zinc-300 bg-zinc-50 text-zinc-950 hover:bg-zinc-100 dark:border-white/15 dark:bg-[#07070A] dark:text-white dark:hover:border-white/30 dark:hover:bg-white/5'
                  }`}
                >
                  <X className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {microTask === 'verify_examples' ? 'يحتاج تصويباً' : 'تحتاج تصويباً'}
                  </span>
                </button>

                {microTask === 'verify_words' && !activeCalibrationCard && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setCorrectionOpen(false)
                      setRegionalAltOpen((v) => !v)
                    }}
                    aria-expanded={regionalAltOpen}
                    className={`inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-full border px-3.5 py-3 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      regionalAltOpen
                        ? 'border-zinc-950 bg-zinc-950/10 text-zinc-950 dark:border-[#D9FF43] dark:bg-[#D9FF43]/15 dark:text-[#D9FF43]'
                        : 'border-zinc-300 bg-zinc-50 text-zinc-800 hover:bg-zinc-100 dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:border-white/30 dark:hover:bg-white/5'
                    }`}
                  >
                    <span>مرادف بمنطقتي</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSkipCard}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 whitespace-nowrap cursor-pointer dark:border-white/10 dark:bg-transparent dark:text-zinc-400 dark:hover:border-white/25 dark:hover:text-white"
                >
                  <SkipForward className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>تخطي</span>
                </button>
              </div>

              {/* Focused Inline Quick-Fix Drawer when user clicks "No" on a real entry */}
              {correctionOpen && !activeCalibrationCard && (
                <form
                  onSubmit={handleSubmitQuickCorrection}
                  className="pt-6 border-t border-zinc-200 space-y-5 dark:border-white/10"
                >
                  <div className="space-y-2.5">
                    <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      ما الذي تريد تصحيحه؟ (اختر حقلاً واحداً أو أكثر ليظهر لك فوراً)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ['word', 'الكلمة الصحيحة بالدارجة'],
                          ['arabizi', 'الكتابة اللاتينية فقط'],
                          ['meaning', 'المعنى والترجمة'],
                          ['example', 'إضافة أو تصحيح مثال'],
                        ] as const
                      ).map(([key, label]) => {
                        const active = selectedTargets.has(key)
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggleFixTarget(key)}
                            className={`min-h-[38px] rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                              active
                                ? 'border-zinc-950 bg-zinc-950 text-white dark:border-[#D9FF43] dark:bg-[#D9FF43] dark:text-[#050507]'
                                : 'border-zinc-300 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-300 dark:hover:border-white/30'
                            }`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Target: Word + Auto Arabizi */}
                  {selectedTargets.has('word') && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <label className="block space-y-1.5">
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          الكلمة الصحيحة بالدارجة (بدل «{currentEntry.word}»)
                        </span>
                        <input
                          type="text"
                          value={fixWordAr}
                          onChange={(e) => setFixWordAr(e.target.value)}
                          placeholder="اكتب الصواب هنا..."
                          autoFocus
                          className="w-full min-h-[42px] rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
                        />
                      </label>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            الكتابة اللاتينية المقترحة تلقائياً
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setArabiziManuallyEdited(false)
                              setFixArabizi(
                                suggestMoroccanArabizi(
                                  fixWordAr || currentEntry.word,
                                  corpusArabiziLookup,
                                ),
                              )
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline whitespace-nowrap cursor-pointer dark:text-[#D9FF43]"
                          >
                            <Wand2 className="h-3 w-3" />
                            <span>توليد تلقائي</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          dir="ltr"
                          value={fixArabizi}
                          onChange={(e) => {
                            setArabiziManuallyEdited(true)
                            setFixArabizi(e.target.value)
                          }}
                          placeholder={currentEntry.latin || 'Ex: bzzaf'}
                          className="w-full min-h-[42px] rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 font-mono text-sm text-left text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
                        />
                      </div>
                    </div>
                  )}

                  {/* Target: Arabizi Only */}
                  {selectedTargets.has('arabizi') && !selectedTargets.has('word') && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          الكتابة اللاتينية الصحيحة (بدل {currentEntry.latin || '—'})
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setFixArabizi(
                              suggestMoroccanArabizi(currentEntry.word, corpusArabiziLookup),
                            )
                          }
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline whitespace-nowrap cursor-pointer dark:text-[#D9FF43]"
                        >
                          <Wand2 className="h-3 w-3" />
                          <span>اقتراح من «{currentEntry.word}»</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        dir="ltr"
                        value={fixArabizi}
                        onChange={(e) => setFixArabizi(e.target.value)}
                        placeholder={currentEntry.latin || 'Ex: ch7al'}
                        className="w-full min-h-[42px] rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 font-mono text-sm text-left text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
                      />
                    </div>
                  )}

                  {/* Target: Meaning & Translation */}
                  {selectedTargets.has('meaning') && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <label className="block space-y-1.5">
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          المعنى الصحيح بالعربية الفصحى
                        </span>
                        <input
                          type="text"
                          value={fixMeaningAr}
                          onChange={(e) => setFixMeaningAr(e.target.value)}
                          placeholder={`الحالي: ${currentEntry.meaning}`}
                          className="w-full min-h-[42px] rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
                        />
                      </label>

                      <label className="block space-y-1.5">
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          المقابل الفرنسي الصحيح (اختياري)
                        </span>
                        <input
                          type="text"
                          dir="ltr"
                          value={fixMeaningFr}
                          onChange={(e) => setFixMeaningFr(e.target.value)}
                          placeholder={currentEntry.french || 'Traduction française...'}
                          className="w-full min-h-[42px] rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-sm text-left text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
                        />
                      </label>
                    </div>
                  )}

                  {/* Target: Contextual Example */}
                  {selectedTargets.has('example') && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label className="block space-y-1.5">
                          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            جملة مثال طبيعية بالدارجة
                          </span>
                          <input
                            type="text"
                            value={fixExampleAr}
                            onChange={(e) => setFixExampleAr(e.target.value)}
                            placeholder="مثال يستعمل المفردة في سياق يومي..."
                            className="w-full min-h-[42px] rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
                          />
                        </label>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                              الكتابة اللاتينية للمثال (تتولد تلقائياً)
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setExampleArabiziManuallyEdited(false)
                                setFixExampleArabizi(
                                  suggestMoroccanArabizi(fixExampleAr, corpusArabiziLookup),
                                )
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline whitespace-nowrap cursor-pointer dark:text-[#D9FF43]"
                            >
                              <Wand2 className="h-3 w-3" />
                              <span>تحديث تلقائي</span>
                            </button>
                          </div>
                          <input
                            type="text"
                            dir="ltr"
                            value={fixExampleArabizi}
                            onChange={(e) => {
                              setExampleArabiziManuallyEdited(true)
                              setFixExampleArabizi(e.target.value)
                            }}
                            placeholder="Ex: ch7al hadi ma chftk..."
                            className="w-full min-h-[42px] rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 font-mono text-sm text-left text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
                          />
                        </div>
                      </div>

                      <label className="block space-y-1.5">
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          معنى المثال بالعربية الفصحى (اختياري)
                        </span>
                        <input
                          type="text"
                          value={fixExampleMeaningAr}
                          onChange={(e) => setFixExampleMeaningAr(e.target.value)}
                          placeholder="ترجمة الجملة بإيجاز..."
                          className="w-full min-h-[40px] rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
                        />
                      </label>
                    </div>
                  )}

                  <label className="block space-y-1.5">
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">
                      ملاحظة إضافية للمراجع اللغوي (اختياري)
                    </span>
                    <input
                      type="text"
                      value={quickNote}
                      onChange={(e) => setQuickNote(e.target.value)}
                      placeholder="مثال: هذه الصيغة هي الأصح نطقاً في الاستعمال اليومي..."
                      className="w-full min-h-[40px] rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-xs text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
                    />
                  </label>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 whitespace-nowrap cursor-pointer disabled:opacity-50 dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
                    >
                      <Send className="h-4 w-4" aria-hidden="true" />
                      <span>
                        {submitting ? 'جارٍ الإرسال...' : 'إرسال التصحيح والانتقال للتالية'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCorrectionOpen(false)}
                      className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-950 whitespace-nowrap cursor-pointer dark:text-zinc-400 dark:hover:text-white"
                    >
                      إلغاء التصحيح
                    </button>
                  </div>
                </form>
              )}

              {/* Inline Regional Synonym Drawer inside Verify Words */}
              {regionalAltOpen && microTask === 'verify_words' && !activeCalibrationCard && (
                <form
                  onSubmit={handleSubmitRegionalAlternative}
                  className="pt-5 border-t border-zinc-200 space-y-4 dark:border-white/10"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        ما الكلمة المستعملة في ({sessionPrefs.dialectRegion}) لمعنى «{currentEntry.meaning}»؟
                      </span>
                      <input
                        type="text"
                        value={regionalAltWordAr}
                        onChange={(e) => setRegionalAltWordAr(e.target.value)}
                        placeholder="اكتب المرادف المحلي في منطقتك..."
                        autoFocus
                        className="w-full min-h-[42px] rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
                      />
                    </label>

                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        النطق اللاتيني للمرادف (تلقائي)
                      </span>
                      <input
                        type="text"
                        dir="ltr"
                        value={regionalAltArabizi}
                        onChange={(e) => setRegionalAltArabizi(e.target.value)}
                        placeholder="يتولد تلقائياً..."
                        className="w-full min-h-[42px] rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 font-mono text-sm text-left text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-zinc-950 px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 whitespace-nowrap cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>حفظ المرادف والانتقال للتالية</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegionalAltOpen(false)}
                      className="min-h-[40px] px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-950 whitespace-nowrap cursor-pointer dark:text-zinc-400 dark:hover:text-white"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* MICRO-TASK 2: ENRICH EXAMPLES */}
          {microTask === 'enrich_examples' && (
            <form
              onSubmit={handleSubmitExampleEnrichment}
              className="pt-6 border-t border-zinc-200 space-y-4 dark:border-white/10"
            >
              <p className="font-display text-sm sm:text-base font-bold text-zinc-950 dark:text-white">
                أضف جملة قصيرة من كلامك اليومي تستعمل فيها كلمة «{currentEntry.word}»:
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    الجملة بالدارجة (بالحروف العربية)
                  </span>
                  <input
                    type="text"
                    value={fixExampleAr}
                    onChange={(e) => setFixExampleAr(e.target.value)}
                    placeholder={`مثال يحتوي على «${currentEntry.word}»...`}
                    className="w-full min-h-[44px] rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
                  />
                </label>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      الكتابة اللاتينية (مولّدة تلقائياً)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setExampleArabiziManuallyEdited(false)
                        setFixExampleArabizi(
                          suggestMoroccanArabizi(fixExampleAr, corpusArabiziLookup),
                        )
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline whitespace-nowrap cursor-pointer dark:text-[#D9FF43]"
                    >
                      <Wand2 className="h-3 w-3" />
                      <span>تحديث تلقائي</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    dir="ltr"
                    value={fixExampleArabizi}
                    onChange={(e) => {
                      setExampleArabiziManuallyEdited(true)
                      setFixExampleArabizi(e.target.value)
                    }}
                    placeholder="تظهر تلقائياً بمجرد الكتابة بالعربية..."
                    className="w-full min-h-[44px] rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 font-mono text-sm text-left text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
                  />
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  معنى الجملة بالعربية الفصحى (باختصار)
                </span>
                <input
                  type="text"
                  value={fixExampleMeaningAr}
                  onChange={(e) => setFixExampleMeaningAr(e.target.value)}
                  placeholder="اشرح معنى الجملة..."
                  className="w-full min-h-[42px] rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 whitespace-nowrap cursor-pointer disabled:opacity-50 dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    <span>حفظ المثال والانتقال للتالية</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMicroTask('verify_words')
                      setCorrectionOpen(true)
                    }}
                    className="min-h-[44px] rounded-full border border-zinc-300 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 whitespace-nowrap cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200"
                  >
                    الكلمة نفسها تحتاج تصحيحاً
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSkipCard}
                  className="inline-flex min-h-[42px] items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-950 whitespace-nowrap cursor-pointer dark:text-zinc-400 dark:hover:text-white"
                >
                  <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>تخطي الكلمة</span>
                </button>
              </div>
            </form>
          )}

          {/* MICRO-TASK 3: REGIONAL USAGE */}
          {microTask === 'regional_usage' && (
            <div className="pt-6 border-t border-zinc-200 space-y-5 dark:border-white/10">
              <p className="font-display text-sm sm:text-base font-bold text-zinc-950 dark:text-white">
                هل تُستعمل كلمة «{currentEntry.word}» بهذا المعنى في منطقة ({sessionPrefs.dialectRegion})؟
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmAccurate}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 whitespace-nowrap cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
                >
                  <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>نعم، شائعة في منطقتي</span>
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setRegionalAltOpen((v) => !v)}
                  className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    regionalAltOpen
                      ? 'border-[#FF3B2F] bg-[#FF3B2F]/10 text-[#FF3B2F] dark:border-[#FF3B2F] dark:bg-[#FF3B2F]/15 dark:text-white'
                      : 'border-zinc-300 bg-zinc-50 text-zinc-950 hover:bg-zinc-100 dark:border-white/15 dark:bg-[#07070A] dark:text-white'
                  }`}
                >
                  <X className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>لا، نقول كلمة أخرى</span>
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSkipCard}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-5 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100 whitespace-nowrap cursor-pointer dark:border-white/10 dark:bg-transparent dark:text-zinc-400 dark:hover:text-white"
                >
                  <SkipForward className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>تخطي</span>
                </button>
              </div>

              {regionalAltOpen && (
                <form
                  onSubmit={handleSubmitRegionalAlternative}
                  className="pt-5 border-t border-zinc-200 space-y-4 dark:border-white/10"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        ما الكلمة المستعملة في ({sessionPrefs.dialectRegion}) لنفس المعنى؟
                      </span>
                      <input
                        type="text"
                        value={regionalAltWordAr}
                        onChange={(e) => setRegionalAltWordAr(e.target.value)}
                        placeholder="اكتب المرادف المحلي في منطقتك..."
                        autoFocus
                        className="w-full min-h-[42px] rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
                      />
                    </label>

                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        الكتابة اللاتينية للمرادف (تلقائي)
                      </span>
                      <input
                        type="text"
                        dir="ltr"
                        value={regionalAltArabizi}
                        onChange={(e) => setRegionalAltArabizi(e.target.value)}
                        placeholder="Arabizi..."
                        className="w-full min-h-[42px] rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 font-mono text-sm text-left text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
                      />
                    </label>
                  </div>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      مثال سريع من منطقتك (اختياري)
                    </span>
                    <input
                      type="text"
                      value={regionalAltExample}
                      onChange={(e) => setRegionalAltExample(e.target.value)}
                      placeholder="جملة قصيرة توضح الاستعمال المحلي..."
                      className="w-full min-h-[40px] rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-950 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
                    />
                  </label>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-zinc-950 px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 whitespace-nowrap cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>حفظ المرادف الجهوي والتالي</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegionalAltOpen(false)}
                      className="min-h-[40px] px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-950 whitespace-nowrap cursor-pointer dark:text-zinc-400 dark:hover:text-white"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </article>
      )}

      {/* One-Handed Mobile Sticky Bottom Action Bar */}
      {currentEntry &&
        (microTask === 'verify_words' || microTask === 'verify_examples') &&
        !correctionOpen &&
        !regionalAltOpen && (
          <div className="sm:hidden sticky bottom-3 z-20 mx-auto max-w-3xl rounded-2xl border border-zinc-300 bg-white/95 p-2 shadow-xl backdrop-blur-md dark:border-white/15 dark:bg-[#0C0C10]/95">
            <div
              className={`grid gap-1.5 ${
                microTask === 'verify_words' && !activeCalibrationCard
                  ? 'grid-cols-4'
                  : 'grid-cols-3'
              }`}
            >
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmAccurate}
                className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-full bg-zinc-950 px-2 py-2 text-xs font-semibold text-white active:bg-zinc-800 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507]"
              >
                <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>نعم</span>
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={handleNegativeAction}
                className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-full border border-zinc-300 bg-zinc-50 px-2 py-2 text-xs font-semibold text-zinc-950 cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-white"
              >
                <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>تصويب</span>
              </button>

              {microTask === 'verify_words' && !activeCalibrationCard && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setCorrectionOpen(false)
                    setRegionalAltOpen(true)
                  }}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-zinc-300 bg-zinc-50 px-2 py-2 text-[11px] font-semibold text-zinc-800 cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200"
                >
                  <span>بمنطقتي</span>
                </button>
              )}

              <button
                type="button"
                disabled={submitting}
                onClick={handleSkipCard}
                className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-full border border-zinc-200 bg-white px-2 py-2 text-xs font-medium text-zinc-600 cursor-pointer dark:border-white/10 dark:bg-transparent dark:text-zinc-400"
              >
                <SkipForward className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>تخطي</span>
              </button>
            </div>
          </div>
        )}
    </div>
  )
}
