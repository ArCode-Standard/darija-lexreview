import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Download,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  FilterX,
  Archive,
  ExternalLink,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type {
  LexicalEntry,
  RawOfficialCorpus,
  ReleaseManifestRecord,
  ReviewerProfile,
  SubmissionRecord,
} from '../../types/lexicon'
import {
  buildOfficialExportBundle,
  bumpPatchVersion,
  findBlockingSubmissionIds,
  isNewEntrySubmission,
} from '../../services/exporter'
import {
  validateExportBundleWithOfficialSchemas,
  type SchemaValidationReport,
} from '../../services/schemaValidator'
import { formatAccessionCode } from '../../services/dataset'
import { humanizeSystemError } from '../../utils/humanizeError'

const RELEASE_LEDGER_STORAGE_KEY = 'arcode_exported_release_ledger_v1'
const LOCAL_RELEASE_MANIFESTS_KEY = 'arcode_release_manifests_v1'

function loadReleaseLedger(): Record<string, string> {
  try {
    const raw = localStorage.getItem(RELEASE_LEDGER_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function loadLocalReleaseManifests(): ReleaseManifestRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_RELEASE_MANIFESTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ReleaseManifestRecord[]) : []
  } catch {
    return []
  }
}

interface DatasetExporterPanelProps {
  entries: LexicalEntry[]
  rawCorpus: RawOfficialCorpus
  userEmail: string | null
  profile: ReviewerProfile | null
  sandboxItems: SubmissionRecord[]
  preferredSource: 'live' | 'sandbox'
  onMarkSandboxMerged: (params: {
    ids: string[]
    releaseVersion: string
    editorId?: string
    editorDisplayName?: string
  }) => void
}

export function DatasetExporterPanel({
  entries,
  rawCorpus,
  userEmail,
  profile,
  sandboxItems,
  preferredSource,
  onMarkSandboxMerged,
}: DatasetExporterPanelProps) {
  const isAuthorizedLiveEditor =
    Boolean(userEmail) && (profile?.role === 'editor' || profile?.role === 'admin')

  const [exportSource, setExportSource] = useState<'live' | 'sandbox'>(() =>
    preferredSource === 'live' && isAuthorizedLiveEditor ? 'live' : 'sandbox',
  )
  const [archivedReleaseMap, setArchivedReleaseMap] = useState<Record<string, string>>(
    loadReleaseLedger,
  )
  const [localManifests, setLocalManifests] = useState<ReleaseManifestRecord[]>(
    loadLocalReleaseManifests,
  )
  const [liveManifests, setLiveManifests] = useState<ReleaseManifestRecord[]>([])
  const [githubPrUrl, setGithubPrUrl] = useState('')
  const [releaseNotes, setReleaseNotes] = useState('')
  const [copiedChecksumKey, setCopiedChecksumKey] = useState<string | null>(null)
  const [archivingRelease, setArchivingRelease] = useState(false)
  const [hasDownloadedCurrentBatch, setHasDownloadedCurrentBatch] = useState(false)
  const [archiveFeedback, setArchiveFeedback] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  useEffect(() => {
    if (preferredSource === 'live' && isAuthorizedLiveEditor) {
      setExportSource('live')
    } else if (preferredSource === 'sandbox') {
      setExportSource('sandbox')
    }
  }, [preferredSource, isAuthorizedLiveEditor])

  const [liveAccepted, setLiveAccepted] = useState<SubmissionRecord[]>([])
  const [loadingLive, setLoadingLive] = useState(false)
  const [targetVersion, setTargetVersion] = useState(() =>
    bumpPatchVersion(String(rawCorpus.lexiconMeta.version ?? '1.5.0')),
  )

  useEffect(() => {
    setTargetVersion(bumpPatchVersion(String(rawCorpus.lexiconMeta.version ?? '1.5.0')))
  }, [rawCorpus.lexiconMeta.version])

  const fetchLiveReleaseManifests = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('release_manifests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(25)
    if (!error && Array.isArray(data)) {
      setLiveManifests(data as ReleaseManifestRecord[])
    }
  }, [])

  const fetchLiveAccepted = useCallback(async () => {
    if (!supabase || !userEmail) {
      setLiveAccepted([])
      return
    }
    setLoadingLive(true)
    const { data } = await supabase
      .from('review_submissions')
      .select('*')
      .eq('status', 'accepted')
      .order('updated_at', { ascending: true })

    setLoadingLive(false)
    setLiveAccepted((data ?? []) as SubmissionRecord[])
    fetchLiveReleaseManifests()
  }, [userEmail, fetchLiveReleaseManifests])

  useEffect(() => {
    fetchLiveReleaseManifests()
    if (exportSource === 'live') {
      fetchLiveAccepted()
    }
  }, [exportSource, fetchLiveAccepted, fetchLiveReleaseManifests])

  const candidateAccepted = useMemo(() => {
    const sourceList =
      exportSource === 'live'
        ? liveAccepted
        : sandboxItems.filter((item) => item.status === 'accepted')
    return sourceList.filter(
      (item) =>
        item.status === 'accepted' &&
        !item.exported_in_version &&
        !archivedReleaseMap[item.id],
    )
  }, [exportSource, liveAccepted, sandboxItems, archivedReleaseMap])

  const mergedSandboxCount = useMemo(
    () => sandboxItems.filter((item) => item.status === 'merged').length,
    [sandboxItems],
  )

  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set())
  const [previewTab, setPreviewTab] = useState<'patch' | 'pr'>('patch')
  const [copiedPr, setCopiedPr] = useState(false)

  const selectedSubmissions = useMemo(
    () => candidateAccepted.filter((s) => !excludedIds.has(s.id)),
    [candidateAccepted, excludedIds],
  )

  const blockingIdsInSelected = useMemo(
    () => findBlockingSubmissionIds(rawCorpus, selectedSubmissions),
    [rawCorpus, selectedSubmissions],
  )

  const bundle = useMemo(
    () => buildOfficialExportBundle(rawCorpus, selectedSubmissions, targetVersion),
    [rawCorpus, selectedSubmissions, targetVersion],
  )

  const [schemaReport, setSchemaReport] = useState<SchemaValidationReport | null>(null)
  const [validatingSchema, setValidatingSchema] = useState(false)

  useEffect(() => {
    if (selectedSubmissions.length === 0) {
      setSchemaReport(null)
      setValidatingSchema(false)
      return
    }
    let cancelled = false
    setValidatingSchema(true)
    validateExportBundleWithOfficialSchemas(bundle.lexiconJson, bundle.examplesJson)
      .then((res) => {
        if (!cancelled) {
          setSchemaReport(res)
          setValidatingSchema(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setValidatingSchema(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [bundle, selectedSubmissions.length])

  const errorIssues = bundle.issues.filter((i) => i.severity === 'error')
  const warningIssues = bundle.issues.filter((i) => i.severity === 'warning')
  const schemaPassed = schemaReport ? schemaReport.valid : false
  const canDownload =
    errorIssues.length === 0 &&
    !validatingSchema &&
    schemaPassed &&
    selectedSubmissions.length > 0

  const entryById = useMemo(() => {
    const m = new Map<string, LexicalEntry>()
    for (const e of entries) m.set(e.id, e)
    return m
  }, [entries])

  function toggleInclude(id: string) {
    setExcludedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleAutoExcludeBlocking() {
    if (blockingIdsInSelected.length === 0) return
    setExcludedIds((prev) => {
      const next = new Set(prev)
      for (const id of blockingIdsInSelected) next.add(id)
      return next
    })
  }

  function downloadJsonFile(filename: string, dataObj: unknown) {
    const content = `${JSON.stringify(dataObj, null, 2)}\n`
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    setHasDownloadedCurrentBatch(true)
    setArchiveFeedback(null)
  }

  function persistArchivedIds(ids: string[], versionLabel: string) {
    setArchivedReleaseMap((prev) => {
      const next = { ...prev }
      for (const id of ids) {
        next[id] = versionLabel
      }
      try {
        localStorage.setItem(RELEASE_LEDGER_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Ignore storage quota errors
      }
      return next
    })
  }

  function persistLocalManifest(record: ReleaseManifestRecord) {
    setLocalManifests((prev) => {
      const filtered = prev.filter((m) => m.version !== record.version)
      const next = [record, ...filtered].slice(0, 30)
      try {
        localStorage.setItem(LOCAL_RELEASE_MANIFESTS_KEY, JSON.stringify(next))
      } catch {
        // Ignore storage quota errors
      }
      return next
    })
  }

  function handleCopyChecksum(key: string, value: string) {
    navigator.clipboard?.writeText(value).then(() => {
      setCopiedChecksumKey(key)
      setTimeout(() => setCopiedChecksumKey(null), 1800)
    })
  }

  async function handleArchiveExportedBatch() {
    const appliedIds = bundle.patchSummary.applied_submission_ids
    const cleanVersion = targetVersion.trim() || 'next'
    if (appliedIds.length === 0 || !canDownload) return

    const cleanPrUrl = githubPrUrl.trim() || null
    if (cleanPrUrl && !/^https:\/\/github\.com\/[^\s]+$/i.test(cleanPrUrl)) {
      setArchiveFeedback({
        type: 'error',
        text: 'يرجى إدخال رابط طلب دمج GitHub صالح يبدأ بـ https://github.com/ أو ترك الحقل فارغاً.',
      })
      return
    }

    const cleanNotes = releaseNotes.trim() || null
    const editorName =
      profile?.display_name?.trim() ||
      userEmail ||
      (exportSource === 'sandbox' ? 'المحرر الحالي (جلسة محاكاة)' : 'محرر معتمد')

    const manifestDraft: ReleaseManifestRecord = {
      id: `rel-${cleanVersion}-${Date.now()}`,
      version: cleanVersion,
      lexicon_sha256: bundle.checksums.lexiconSha256,
      examples_sha256: bundle.checksums.examplesSha256,
      total_entries: bundle.lexiconJson.entries.length,
      total_examples: bundle.examplesJson.examples.length,
      modified_entries_count: bundle.stats.modifiedEntriesCount,
      added_entries_count: bundle.stats.addedEntriesCount,
      added_examples_count: bundle.stats.addedExamplesCount,
      submission_ids: appliedIds,
      github_pr_url: cleanPrUrl,
      notes: cleanNotes,
      exported_by: profile?.id ?? null,
      exported_by_name: editorName,
      created_at: new Date().toISOString(),
      is_sandbox: exportSource === 'sandbox',
    }

    setArchiveFeedback(null)

    if (exportSource === 'sandbox') {
      onMarkSandboxMerged({
        ids: appliedIds,
        releaseVersion: cleanVersion,
        editorId: profile?.id ?? 'ed-session',
        editorDisplayName: editorName,
      })
      persistArchivedIds(appliedIds, cleanVersion)
      persistLocalManifest(manifestDraft)
      setGithubPrUrl('')
      setReleaseNotes('')
      setHasDownloadedCurrentBatch(false)
      setArchiveFeedback({
        type: 'success',
        text: `تم تثبيت وأرشفة ${appliedIds.length} مقترحات بحالة «مدمج في الإصدار v${cleanVersion}» وتسجيل بصمة SHA-256 في سجل الإصدارات.`,
      })
      return
    }

    if (!supabase || !isAuthorizedLiveEditor) {
      setArchiveFeedback({
        type: 'error',
        text: 'يلزم تسجيل الدخول بحساب محرر معتمد لأرشفة الدفعات في السجل الحي.',
      })
      return
    }

    setArchivingRelease(true)

    const { error: manifestRpcError } = await supabase.rpc('record_release_manifest', {
      p_version: cleanVersion,
      p_lexicon_sha256: bundle.checksums.lexiconSha256,
      p_examples_sha256: bundle.checksums.examplesSha256,
      p_total_entries: bundle.lexiconJson.entries.length,
      p_total_examples: bundle.examplesJson.examples.length,
      p_modified_entries_count: bundle.stats.modifiedEntriesCount,
      p_added_entries_count: bundle.stats.addedEntriesCount,
      p_added_examples_count: bundle.stats.addedExamplesCount,
      p_submission_ids: appliedIds,
      p_github_pr_url: cleanPrUrl,
      p_notes: cleanNotes,
    })

    if (manifestRpcError) {
      const { error: rpcError } = await supabase.rpc('mark_submissions_exported', {
        p_submission_ids: appliedIds,
        p_release_version: cleanVersion,
      })

      if (rpcError) {
        const { error: fallbackErr } = await supabase
          .from('review_submissions')
          .update({
            status: 'merged',
            exported_in_version: cleanVersion,
            exported_at: new Date().toISOString(),
          })
          .in('id', appliedIds)

        if (fallbackErr) {
          persistArchivedIds(appliedIds, cleanVersion)
          persistLocalManifest({ ...manifestDraft, is_sandbox: false })
          setArchivingRelease(false)
          setHasDownloadedCurrentBatch(false)
          setArchiveFeedback({
            type: 'success',
            text: `تمت أرشفة الدفعة (${appliedIds.length} مقترحات) للإصدار v${cleanVersion} وتسجيل بصمة SHA-256 محلياً (${humanizeSystemError(fallbackErr, 'حُفظت الأرشفة محلياً')}).`,
          })
          return
        }
      }
      persistLocalManifest({ ...manifestDraft, is_sandbox: false })
    }

    persistArchivedIds(appliedIds, cleanVersion)
    setGithubPrUrl('')
    setReleaseNotes('')
    setArchivingRelease(false)
    setHasDownloadedCurrentBatch(false)
    await fetchLiveAccepted()
    setArchiveFeedback({
      type: 'success',
      text: `تم تثبيت وأرشفة ${appliedIds.length} مقترحات رسمياً في الإصدار v${cleanVersion} وتوثيق بصمات SHA-256 في سجل الإصدارات.`,
    })
  }

  function handleCopyPrMarkdown() {
    navigator.clipboard?.writeText(bundle.prMarkdown).then(() => {
      setCopiedPr(true)
      setTimeout(() => setCopiedPr(false), 2000)
    })
  }

  const displayedManifests = useMemo(() => {
    if (exportSource === 'sandbox') {
      return localManifests
    }
    const byVersion = new Map<string, ReleaseManifestRecord>()
    for (const m of liveManifests) byVersion.set(m.version, m)
    for (const m of localManifests) {
      if (!m.is_sandbox && !byVersion.has(m.version)) {
        byVersion.set(m.version, m)
      }
    }
    return Array.from(byVersion.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
  }, [exportSource, liveManifests, localManifests])

  return (
    <div className="space-y-6">
      {/* Header & Source Controls */}
      <div className="rounded-xl border border-[#E5DFD3] bg-white p-5 sm:p-8 dark:border-[#2E2B27] dark:bg-[#1C1A18]">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-[#E5DFD3] dark:border-[#2E2B27]">
          <div>
            <p className="text-xs font-semibold text-[#0F5C4E] dark:text-[#4FD1C5]">
              جسر التصدير إلى المعجم الرسمي · مدقق JSON Schema الفعلي (Ajv) وحقوق المصدر
            </p>
            <h3 className="mt-1.5 font-display text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100">
              مُصدِّر التعديلات المعتمدة إلى المعجم الرسمي
            </h3>
            <p className="mt-1.5 max-w-[68ch] text-xs sm:text-sm leading-relaxed text-stone-600 dark:text-stone-400">
              يدمج المقترحات المعتمدة فوق نسخة المعجم الرسمية، ويعيد حساب الفهارس والمعرفات، ويشغّل مدقق JSON Schema الرسمي (<code className="font-mono">schema.json</code> و<code className="font-mono">context-schema.json</code>) مع فحص توثيق حقوق إعادة الاستخدام قبل السماح بالتنزيل.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              role="group"
              aria-label="مصدر المقترحات المعتمدة"
              className="inline-flex items-center gap-1 rounded-lg border border-[#E5DFD3] bg-[#F3EFE6] p-1 dark:border-[#2E2B27] dark:bg-[#141312]"
            >
              <button
                type="button"
                onClick={() => setExportSource('live')}
                className={`min-h-[34px] rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  exportSource === 'live'
                    ? 'bg-white text-stone-900 shadow-2xs dark:bg-[#2A2622] dark:text-stone-100'
                    : 'text-stone-600 hover:text-stone-900 dark:text-stone-400'
                }`}
              >
                السجل الحي ({exportSource === 'live' ? candidateAccepted.length : liveAccepted.length})
              </button>
              <button
                type="button"
                onClick={() => setExportSource('sandbox')}
                className={`min-h-[34px] rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  exportSource === 'sandbox'
                    ? 'bg-white text-stone-900 shadow-2xs dark:bg-[#2A2622] dark:text-stone-100'
                    : 'text-stone-600 hover:text-stone-900 dark:text-stone-400'
                }`}
              >
                بيئة المحاكاة ({sandboxItems.filter((i) => i.status === 'accepted' && !archivedReleaseMap[i.id]).length})
              </button>
            </div>

            {exportSource === 'live' && (
              <button
                type="button"
                onClick={fetchLiveAccepted}
                disabled={loadingLive}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-[#EFECE4] cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-300"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingLive ? 'animate-spin' : ''}`} />
                <span>تحديث</span>
              </button>
            )}
          </div>
        </div>

        {/* Version + Stats Strip */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12 items-center">
          <div className="lg:col-span-4">
            <label className="block">
              <span className="block text-xs font-medium text-stone-600 dark:text-stone-400">
                رقم الإصدار الجديد المستهدف (meta.version)
              </span>
              <input
                type="text"
                dir="ltr"
                value={targetVersion}
                onChange={(e) => setTargetVersion(e.target.value)}
                className="mt-1.5 w-full max-w-[220px] min-h-[40px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3.5 py-2 font-mono text-xs text-left text-stone-900 focus:border-[#0F5C4E] focus:bg-white focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
              />
            </label>
          </div>

          <dl className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t lg:border-t-0 lg:border-s border-[#E5DFD3] pt-4 lg:pt-0 lg:ps-6 dark:border-[#2E2B27]">
            <div>
              <dt className="text-xs text-stone-500 dark:text-stone-400">مداخل محدّثة</dt>
              <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-stone-900 dark:text-stone-100">
                {bundle.stats.modifiedEntriesCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500 dark:text-stone-400">مفردات جديدة</dt>
              <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-stone-900 dark:text-stone-100">
                {bundle.stats.addedEntriesCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500 dark:text-stone-400">شواهد سياقية مضافة</dt>
              <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-stone-900 dark:text-stone-100">
                {bundle.stats.addedExamplesCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500 dark:text-stone-400">إجمالي المتن الناتج</dt>
              <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-stone-900 dark:text-stone-100">
                {bundle.lexiconJson.entries.length.toLocaleString('en-US')}
              </dd>
            </div>
          </dl>
        </div>

        {/* Structural + Provenance + Official Ajv JSON Schema Status */}
        <div className="mt-6 space-y-3">
          {errorIssues.length > 0 ? (
            <div className="rounded-lg border border-red-300 bg-red-50 p-4 space-y-3 dark:border-red-900/60 dark:bg-red-950/40">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-red-900 dark:text-red-200">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    أوقف نظام التحقق عملية التصدير لوجود {errorIssues.length} خطأ تعارض أو نقص في توثيق الحقوق:
                  </span>
                </div>

                {blockingIdsInSelected.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAutoExcludeBlocking}
                    className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-red-400 bg-white px-3 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-100/60 whitespace-nowrap shrink-0 cursor-pointer dark:border-red-700 dark:bg-[#1C1A18] dark:text-red-200"
                  >
                    <FilterX className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      استثناء المقترحات المتعارضة أو غير الموثقة تلقائياً ({blockingIdsInSelected.length})
                    </span>
                  </button>
                )}
              </div>

              <ul className="space-y-1 ps-6 list-disc text-xs text-red-900 dark:text-red-200">
                {errorIssues.map((iss, i) => (
                  <li key={i}>
                    <code className="font-mono">{iss.itemRef}</code>: {iss.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : selectedSubmissions.length > 0 ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 space-y-2 dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-950 dark:text-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
                <span>
                  اجتازت الدفعة فحص عدم التعارض واكتملت حقول الملكية الفكرية ورخص إعادة الاستخدام لجميع السجلات المشمولة.
                </span>
              </div>
              {warningIssues.length > 0 && (
                <ul className="pt-2 border-t border-emerald-200/70 space-y-1 text-xs text-amber-900 dark:border-emerald-800/50 dark:text-amber-300">
                  {warningIssues.map((w, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>
                        <code className="font-mono">{w.itemRef}</code>: {w.message}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] p-4 text-xs text-stone-600 dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-400">
              لا توجد مقترحات مشمولة في الدفعة حالياً. اعتمد مقترحاً من «لوحة تحكيم المحررين» أو أعد تضمين المقترحات المستثناة أدناه.
            </div>
          )}

          {/* Official Ajv JSON Schema Validation Status */}
          {selectedSubmissions.length > 0 && (
            <div
              className={`rounded-lg border p-3.5 text-xs ${
                validatingSchema
                  ? 'border-[#D6CEBE] bg-[#FBF9F5] text-stone-700 dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-300'
                  : schemaReport?.valid
                    ? 'border-[#D6CEBE] bg-[#FBF9F5] text-stone-800 dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-200'
                    : 'border-red-300 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200'
              }`}
            >
              {validatingSchema ? (
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#0F5C4E] dark:text-[#4FD1C5]" />
                  <span>جارٍ مطابقة الحزمة الناتجة مع مخططي JSON Schema الرسميين عبر محرك Ajv...</span>
                </div>
              ) : schemaReport?.valid ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-[#0F5C4E] dark:text-[#4FD1C5]" />
                    <span>
                      مدقق JSON Schema الرسمي (Ajv): مطابق 100% لمخططي{' '}
                      <code className="font-mono">schema.json</code> و
                      <code className="font-mono">context-schema.json</code>
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-stone-500 dark:text-stone-400">
                    المصدر:{' '}
                    {schemaReport.schemaSource === 'official_github'
                      ? 'مستودع ArCode-Standard الحي'
                      : 'تعذر الوصول إلى المخطط الرسمي — التنزيل معطّل'}
                  </span>
                </div>
              ) : schemaReport?.schemaSource === 'unavailable' ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>تعذر الوصول إلى المخطط الرسمي — التنزيل معطّل تلقائياً (إغلاق آمن):</span>
                  </div>
                  <p className="ps-6 leading-relaxed">
                    {schemaReport.lexiconErrors[0] ??
                      'يلزم الاتصال بالمخططين الرسميين (schema.json وcontext-schema.json) للتحقق من الحزمة قبل السماح بالتنزيل.'}
                  </p>
                </div>
              ) : schemaReport ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>رفض مدقق JSON Schema الرسمي (Ajv) الحزمة للأسباب التالية:</span>
                  </div>
                  <ul className="space-y-1 ps-5 list-disc font-mono text-[11px]" dir="ltr">
                    {schemaReport.lexiconErrors.map((e, i) => (
                      <li key={`lex-${i}`}>moroccan-darija.json {e}</li>
                    ))}
                    {schemaReport.examplesErrors.map((e, i) => (
                      <li key={`ctx-${i}`}>context-examples.json {e}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Deterministic SHA-256 Checksums + Download & Release Archival Actions */}
        <div className="mt-6 pt-5 border-t border-[#E5DFD3] space-y-5 dark:border-[#2E2B27]">
          {/* Deterministic SHA-256 Digest Strip */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-[#E5DFD3] bg-[#FBF9F5] px-3.5 py-2.5 dark:border-[#2E2B27] dark:bg-[#141312]">
              <div className="min-w-0">
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  بصمة SHA-256 لملف <code className="font-mono">moroccan-darija.json</code>
                </p>
                <p
                  dir="ltr"
                  className="mt-0.5 truncate font-mono text-xs tabular-nums text-stone-900 dark:text-stone-100"
                  title={bundle.checksums.lexiconSha256}
                >
                  {bundle.checksums.lexiconSha256}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopyChecksum('lexicon', bundle.checksums.lexiconSha256)}
                className="inline-flex min-h-[32px] items-center gap-1 rounded-md border border-[#D6CEBE] bg-white px-2.5 py-1 text-[11px] font-medium text-stone-700 hover:bg-[#EFECE4] whitespace-nowrap shrink-0 cursor-pointer dark:border-[#3A3530] dark:bg-[#1C1A18] dark:text-stone-300"
              >
                {copiedChecksumKey === 'lexicon' ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-700" />
                    <span>نُسخ</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>نسخ</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-[#E5DFD3] bg-[#FBF9F5] px-3.5 py-2.5 dark:border-[#2E2B27] dark:bg-[#141312]">
              <div className="min-w-0">
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  بصمة SHA-256 لملف <code className="font-mono">context-examples.json</code>
                </p>
                <p
                  dir="ltr"
                  className="mt-0.5 truncate font-mono text-xs tabular-nums text-stone-900 dark:text-stone-100"
                  title={bundle.checksums.examplesSha256}
                >
                  {bundle.checksums.examplesSha256}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopyChecksum('examples', bundle.checksums.examplesSha256)}
                className="inline-flex min-h-[32px] items-center gap-1 rounded-md border border-[#D6CEBE] bg-white px-2.5 py-1 text-[11px] font-medium text-stone-700 hover:bg-[#EFECE4] whitespace-nowrap shrink-0 cursor-pointer dark:border-[#3A3530] dark:bg-[#1C1A18] dark:text-stone-300"
              >
                {copiedChecksumKey === 'examples' ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-700" />
                    <span>نُسخ</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>نسخ</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {canDownload && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-stone-600 dark:text-stone-400">
                  رابط طلب الدمج في GitHub لتوثيقه في سجل الإصدارات (اختياري)
                </span>
                <input
                  type="url"
                  dir="ltr"
                  value={githubPrUrl}
                  onChange={(e) => setGithubPrUrl(e.target.value)}
                  placeholder="https://github.com/ArCode-Standard/moroccan-darija-lexicon/pull/..."
                  className="w-full min-h-[38px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-1.5 font-mono text-xs text-left text-stone-900 focus:border-[#0F5C4E] focus:bg-white focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-stone-600 dark:text-stone-400">
                  مذكرة توثيقية لهذا الإصدار (اختياري)
                </span>
                <input
                  type="text"
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                  placeholder="مثال: دفعة تصحيحات الدار البيضاء والشمال..."
                  className="w-full min-h-[38px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-1.5 text-xs text-stone-900 focus:border-[#0F5C4E] focus:bg-white focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100"
                />
              </label>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!canDownload}
                onClick={() => downloadJsonFile('moroccan-darija.json', bundle.lexiconJson)}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#0F5C4E] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#0B463B] disabled:opacity-45 whitespace-nowrap shrink-0 cursor-pointer dark:bg-[#147A67]"
              >
                <Download className="h-4 w-4" />
                <span>تنزيل moroccan-darija.json</span>
              </button>

              <button
                type="button"
                disabled={!canDownload}
                onClick={() => downloadJsonFile('context-examples.json', bundle.examplesJson)}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-4 py-2.5 text-xs font-semibold text-stone-800 hover:bg-[#EFECE4] disabled:opacity-45 whitespace-nowrap shrink-0 cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-200"
              >
                <Download className="h-4 w-4" />
                <span>تنزيل context-examples.json</span>
              </button>

              <button
                type="button"
                disabled={!canDownload}
                onClick={() =>
                  downloadJsonFile(
                    `lexreview-patch-v${targetVersion || 'next'}.json`,
                    bundle.patchSummary,
                  )
                }
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-4 py-2.5 text-xs font-semibold text-stone-800 hover:bg-[#EFECE4] disabled:opacity-45 whitespace-nowrap shrink-0 cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-200"
              >
                <Download className="h-4 w-4" />
                <span>تنزيل ملف الفروقات فقط (Patch)</span>
              </button>
            </div>

            {canDownload && (
              <button
                type="button"
                disabled={archivingRelease}
                onClick={handleArchiveExportedBatch}
                className={`inline-flex min-h-[42px] items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  hasDownloadedCurrentBatch
                    ? 'border-[#0F5C4E] bg-[#0F5C4E] text-white hover:bg-[#0B463B] dark:border-[#147A67] dark:bg-[#147A67]'
                    : 'border-[#D6CEBE] bg-white text-stone-800 hover:bg-[#F3EFE6] dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-200'
                }`}
              >
                <Archive className="h-4 w-4" />
                <span>
                  {archivingRelease
                    ? 'جارٍ الأرشفة...'
                    : `تثبيت وأرشفة الدفعة كمدمجة (v${targetVersion || 'next'})`}
                </span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400">
            <span>
              بعد تنزيل ملفات الإصدار ورفع طلب الدمج في GitHub، استخدم «تثبيت وأرشفة الدفعة كمدمجة» لتوثيق بصمة SHA-256 في سجل الإصدارات ومنع تكرار تصديرها.
            </span>
            {(Object.keys(archivedReleaseMap).length > 0 || mergedSandboxCount > 0) && (
              <span className="font-mono tabular-nums text-[#0F5C4E] dark:text-[#4FD1C5]">
                سجلات مؤرشفة في إصدارات سابقة:{' '}
                {exportSource === 'sandbox'
                  ? Math.max(mergedSandboxCount, Object.keys(archivedReleaseMap).length)
                  : Object.keys(archivedReleaseMap).length}
              </span>
            )}
          </div>

          {archiveFeedback && (
            <div
              role="status"
              className={`rounded-lg border p-3.5 text-xs leading-relaxed ${
                archiveFeedback.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200'
              }`}
            >
              {archiveFeedback.text}
            </div>
          )}
        </div>
      </div>

      {/* Checklist + Preview Grid */}
      {candidateAccepted.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* Accepted Submissions Selection */}
          <div className="lg:col-span-5 rounded-xl border border-[#E5DFD3] bg-white p-5 dark:border-[#2E2B27] dark:bg-[#1C1A18]">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#E5DFD3] dark:border-[#2E2B27]">
              <h4 className="font-display text-sm font-bold text-stone-900 dark:text-stone-100">
                المقترحات المعتمدة المشمولة في الدفعة ({selectedSubmissions.length} /{' '}
                {candidateAccepted.length})
              </h4>
              {excludedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setExcludedIds(new Set())}
                  className="text-xs font-medium text-[#0F5C4E] hover:underline whitespace-nowrap cursor-pointer dark:text-[#4FD1C5]"
                >
                  إعادة تضمين الكل
                </button>
              )}
            </div>
            <div className="mt-3 divide-y divide-[#E5DFD3] max-h-[420px] overflow-y-auto dark:divide-[#2E2B27]">
              {candidateAccepted.map((sub) => {
                const included = !excludedIds.has(sub.id)
                const isNew = isNewEntrySubmission(sub)
                const target = entryById.get(sub.entry_id)
                const label = isNew
                  ? `${sub.proposed_data?.word_ar ?? 'مفردة جديدة'} (إضافة جديدة)`
                  : `${target?.word ?? sub.entry_id} (${formatAccessionCode(sub.entry_id, target?.numericId ?? null)})`

                return (
                  <label
                    key={sub.id}
                    className="py-3 flex items-start gap-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={included}
                      onChange={() => toggleInclude(sub.id)}
                      className="mt-1 h-4 w-4 accent-[#0F5C4E] shrink-0"
                    />
                    <div className="text-xs">
                      <p className="font-semibold text-stone-900 dark:text-stone-100">{label}</p>
                      <p className="mt-0.5 text-stone-500 font-mono tabular-nums dark:text-stone-400">
                        اعتماد: {new Date(sub.updated_at).toLocaleString('ar-MA')}
                      </p>
                      {sub.editor_note && (
                        <p className="mt-1 text-stone-600 dark:text-stone-400">
                          مذكرة المحرر: {sub.editor_note}
                        </p>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          {/* JSON Delta & PR Markdown Preview */}
          <div className="lg:col-span-7 rounded-xl border border-[#E5DFD3] bg-white p-5 dark:border-[#2E2B27] dark:bg-[#1C1A18]">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E5DFD3] dark:border-[#2E2B27]">
              <div className="inline-flex items-center gap-1 rounded-lg bg-[#F3EFE6] p-1 dark:bg-[#141312]">
                <button
                  type="button"
                  onClick={() => setPreviewTab('patch')}
                  className={`min-h-[32px] rounded-md px-3 py-1 text-xs font-semibold cursor-pointer ${
                    previewTab === 'patch'
                      ? 'bg-white text-stone-900 shadow-2xs dark:bg-[#2A2622] dark:text-stone-100'
                      : 'text-stone-600 dark:text-stone-400'
                  }`}
                >
                  معاينة سجلات JSON الناتجة
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('pr')}
                  className={`min-h-[32px] rounded-md px-3 py-1 text-xs font-semibold cursor-pointer ${
                    previewTab === 'pr'
                      ? 'bg-white text-stone-900 shadow-2xs dark:bg-[#2A2622] dark:text-stone-100'
                      : 'text-stone-600 dark:text-stone-400'
                  }`}
                >
                  وصف طلب الدمج (GitHub PR)
                </button>
              </div>

              {previewTab === 'pr' && (
                <button
                  type="button"
                  onClick={handleCopyPrMarkdown}
                  className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-1 text-xs font-medium text-stone-800 hover:bg-[#EFECE4] cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-200"
                >
                  {copiedPr ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-700" />
                      <span>تم النسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>نسخ وصف PR</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {previewTab === 'patch' ? (
              <pre
                dir="ltr"
                className="mt-4 max-h-[380px] overflow-auto rounded-lg border border-[#E5DFD3] bg-[#FBF9F5] p-4 font-mono text-xs leading-relaxed text-left text-stone-800 dark:border-[#2E2B27] dark:bg-[#141312] dark:text-stone-200"
              >
                {JSON.stringify(bundle.patchSummary, null, 2)}
              </pre>
            ) : (
              <pre className="mt-4 max-h-[380px] overflow-auto whitespace-pre-wrap rounded-lg border border-[#E5DFD3] bg-[#FBF9F5] p-4 font-sans text-xs leading-relaxed text-stone-800 dark:border-[#2E2B27] dark:bg-[#141312] dark:text-stone-200">
                {bundle.prMarkdown}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Official Release Manifests Ledger (SHA-256 Reproducibility History) */}
      <div className="rounded-xl border border-[#E5DFD3] bg-white p-5 sm:p-6 dark:border-[#2E2B27] dark:bg-[#1C1A18]">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#E5DFD3] dark:border-[#2E2B27]">
          <div>
            <h4 className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
              سجل الإصدارات الرسمية المؤرشفة وبصمات SHA-256
            </h4>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
              يوثق كل دفعة مدمجة برقم إصدارها وعدد المداخل وبصمتي التكامل الرقمي للملفين المصدّرين للتحقق المرجعي في GitHub.
            </p>
          </div>
          <span className="font-mono text-xs tabular-nums text-stone-500 dark:text-stone-400">
            الإصدارات المسجلة: {displayedManifests.length}
          </span>
        </div>

        {displayedManifests.length === 0 ? (
          <p className="pt-4 text-xs text-stone-500 dark:text-stone-400">
            لم تُؤرشف أي دفعة تصدير بعد في هذا المصدر. بمجرد تنزيل حزمة معتمدة وتثبيتها ستظهر بصمتها المرجعية هنا.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-[#E5DFD3] dark:divide-[#2E2B27]">
            {displayedManifests.map((rel) => (
              <div key={rel.id} className="py-3.5 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-stone-700 dark:text-stone-300">
                    <strong className="font-mono text-sm font-bold text-stone-900 dark:text-stone-100">
                      v{rel.version}
                    </strong>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {rel.submission_ids.length} مقترح مدمج
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      +{rel.added_entries_count} جديد / ~{rel.modified_entries_count} محدّث / +
                      {rel.added_examples_count} شاهد
                    </span>
                    {rel.exported_by_name && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>بواسطة: {rel.exported_by_name}</span>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-stone-500 dark:text-stone-400">
                    <span className="font-mono tabular-nums">
                      {new Date(rel.created_at).toLocaleString('ar-MA')}
                    </span>
                    {rel.github_pr_url && (
                      <a
                        href={rel.github_pr_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-[#0F5C4E] hover:underline whitespace-nowrap dark:text-[#4FD1C5]"
                      >
                        <span>طلب الدمج PR</span>
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </div>

                {rel.notes && (
                  <p className="text-stone-600 dark:text-stone-400">مذكرة الإصدار: {rel.notes}</p>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums text-stone-500 dark:text-stone-400" dir="ltr">
                  <button
                    type="button"
                    onClick={() => handleCopyChecksum(`rel-lex-${rel.id}`, rel.lexicon_sha256)}
                    className="inline-flex items-center gap-1.5 hover:text-stone-900 cursor-pointer dark:hover:text-stone-200"
                    title="نسخ بصمة moroccan-darija.json"
                  >
                    <span>moroccan-darija.json: {rel.lexicon_sha256.slice(0, 16)}…</span>
                    {copiedChecksumKey === `rel-lex-${rel.id}` ? (
                      <Check className="h-3 w-3 text-emerald-700" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => handleCopyChecksum(`rel-ex-${rel.id}`, rel.examples_sha256)}
                    className="inline-flex items-center gap-1.5 hover:text-stone-900 cursor-pointer dark:hover:text-stone-200"
                    title="نسخ بصمة context-examples.json"
                  >
                    <span>context-examples.json: {rel.examples_sha256.slice(0, 16)}…</span>
                    {copiedChecksumKey === `rel-ex-${rel.id}` ? (
                      <Check className="h-3 w-3 text-emerald-700" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
