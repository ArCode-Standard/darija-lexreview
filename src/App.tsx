import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Database, RefreshCw } from 'lucide-react'
import { supabase } from './lib/supabase'
import type {
  DataMode,
  ExampleFilter,
  LexicalEntry,
  LocalDraft,
  RawOfficialCorpus,
  ReviewerProfile,
  SubmissionRecord,
  WorkbenchTab,
} from './types/lexicon'
import {
  DEMO_ENTRIES,
  DEMO_RAW_CORPUS,
  loadCorpusWithOfflineFallback,
} from './services/dataset'
import { isNewEntrySubmission } from './services/exporter'
import { isPriorityEnrichmentEntry, matchesDarijaQuery } from './utils/phoneticSearch'
import { extractCorpusVersion } from './utils/corpusPinning'
import { buildWorkbenchUrlSearch, parseWorkbenchUrlState } from './utils/urlState'
import { useLocalDrafts } from './hooks/useLocalDrafts'
import { useSandboxModeration } from './hooks/useSandboxModeration'
import { useRoleGovernance } from './hooks/useRoleGovernance'
import { useCommunityAttestations } from './hooks/useCommunityAttestations'
import { Navbar } from './components/Navbar'
import { HeroSection } from './components/HeroSection'
import { LocalDraftSyncBanner } from './components/LocalDraftSyncBanner'
const RapidReviewPanel = lazy(() => import('./components/Workbench/RapidReviewPanel').then((module) => ({ default: module.RapidReviewPanel })))
import { LexiconSidebar } from './components/Workbench/LexiconSidebar'
const EntryDetailSheet = lazy(() => import('./components/Workbench/EntryDetailSheet').then((module) => ({ default: module.EntryDetailSheet })))
const NewEntryProposalPanel = lazy(() => import('./components/Workbench/NewEntryProposalPanel').then((module) => ({ default: module.NewEntryProposalPanel })))
const CorpusOverview = lazy(() => import('./components/Workbench/CorpusOverview').then((module) => ({ default: module.CorpusOverview })))
const SubmissionsPanel = lazy(() => import('./components/Workbench/SubmissionsPanel').then((module) => ({ default: module.SubmissionsPanel })))
const EditorModerationPanel = lazy(() => import('./components/Workbench/EditorModerationPanel').then((module) => ({ default: module.EditorModerationPanel })))
const DatasetExporterPanel = lazy(() => import('./components/Workbench/DatasetExporterPanel').then((module) => ({ default: module.DatasetExporterPanel })))
const MethodologySection = lazy(() => import('./components/MethodologySection').then((module) => ({ default: module.MethodologySection })))
const AuthDialog = lazy(() => import('./components/AuthDialog').then((module) => ({ default: module.AuthDialog })))
import { Footer } from './components/Footer'

export default function App() {
  const initialUrlState = useMemo(
    () => parseWorkbenchUrlState(typeof window !== 'undefined' ? window.location.search : ''),
    [],
  )

  const [entries, setEntries] = useState<LexicalEntry[]>(DEMO_ENTRIES)
  const [rawCorpus, setRawCorpus] = useState<RawOfficialCorpus>(DEMO_RAW_CORPUS)
  const [categories, setCategories] = useState<string[]>(
    Array.from(new Set(DEMO_ENTRIES.map((e) => e.category))),
  )
  const [totalExamplesCount, setTotalExamplesCount] = useState<number>(4)
  const [dataMode, setDataMode] = useState<DataMode>('loading')
  const [cachedCorpusAt, setCachedCorpusAt] = useState<string | null>(null)
  const [corpusError, setCorpusError] = useState<string | null>(null)

  const [workbenchTab, setWorkbenchTab] = useState<WorkbenchTab>(initialUrlState.tab)
  const [explorerSubView, setExplorerSubView] = useState<'entries' | 'categories'>(
    initialUrlState.explorerSubView,
  )
  const [focusMode, setFocusMode] = useState(false)
  const [editorialPreviewMode, setEditorialPreviewMode] = useState(false)

  const [query, setQuery] = useState(initialUrlState.query)
  const [selectedCategory, setSelectedCategory] = useState(initialUrlState.category)
  const [exampleFilter, setExampleFilter] = useState<ExampleFilter>(initialUrlState.exampleFilter)
  const [activeId, setActiveId] = useState<string>(initialUrlState.entryId ?? DEMO_ENTRIES[0].id)

  const [resumedNewDraft, setResumedNewDraft] = useState<LocalDraft | null>(null)
  const [revisionTarget, setRevisionTarget] = useState<SubmissionRecord | null>(null)
  const [forceSandboxModeration, setForceSandboxModeration] = useState(false)
  const [forceGovernanceSection, setForceGovernanceSection] = useState(false)
  const [preferredExportSource, setPreferredExportSource] = useState<'live' | 'sandbox'>('sandbox')

  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [authInitialized, setAuthInitialized] = useState(!supabase)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [authProvider, setAuthProvider] = useState<string | null>(null)
  const [reviewerProfile, setReviewerProfile] = useState<ReviewerProfile | null>(null)
  const [submissionsRefreshCounter, setSubmissionsRefreshCounter] = useState(0)

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('arcode_lexreview_theme') === 'dark'
    } catch {
      return false
    }
  })

  const corpusVersion = useMemo(() => extractCorpusVersion(rawCorpus), [rawCorpus])
  const isStaffRole =
    reviewerProfile?.role === 'editor' || reviewerProfile?.role === 'admin'
  const canAccessEditorialTools = isStaffRole || editorialPreviewMode
  const isRapidFocusActive = workbenchTab === 'rapid_review' && focusMode

  const { drafts, draftsList, saveDraft, removeDraft, removeMultipleDrafts } = useLocalDrafts()
  const {
    sandboxItems,
    sandboxEvents,
    addSandboxSubmission,
    withdrawSandboxSubmission,
    moderateSandboxSubmission,
    bulkApproveSandboxSubmissions,
    markSandboxSubmissionsMerged,
    resetSandboxQueue,
  } = useSandboxModeration()
  const {
    sandboxProfiles,
    sandboxPromotionRequests,
    submitSandboxPromotionRequest,
    reviewSandboxPromotionRequest,
    updateSandboxMemberRole,
    resetSandboxGovernance,
  } = useRoleGovernance()
  const {
    userVerdictsByEntryId,
    userVerdictsByExampleId,
    summariesByEntryId,
    summariesByExampleId,
    skippedIds,
    skippedExampleIds,
    canUndo,
    completedTodayCount,
    totalAttestationsCount,
    calibrationStats,
    sessionPrefs,
    updateSessionPrefs,
    recordAttestation,
    recordCalibrationOutcome,
    skipEntry,
    undoLastStep,
    resetSessionSkips,
  } = useCommunityAttestations(userEmail, corpusVersion)

  useEffect(() => {
    const root = document.documentElement
    if (darkMode) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    try {
      localStorage.setItem('arcode_lexreview_theme', darkMode ? 'dark' : 'light')
    } catch {
      // Ignore storage error
    }
  }, [darkMode])

  const syncUserSession = useCallback(async () => {
    if (!supabase) {
      setAuthInitialized(true)
      return
    }
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUserEmail(user?.email ?? null)
      setAuthProvider(
        typeof user?.app_metadata?.provider === 'string' ? user.app_metadata.provider : null,
      )
      if (user) {
        let prof: ReviewerProfile | null = null
        const fullRes = await supabase
          .from('reviewer_profiles')
          .select('id, display_name, dialect_region, specialty, github_handle, role')
          .eq('id', user.id)
          .maybeSingle()

        if (fullRes.error) {
          const minRes = await supabase
            .from('reviewer_profiles')
            .select('id, display_name, role')
            .eq('id', user.id)
            .maybeSingle()
          prof = (minRes.data as ReviewerProfile | null) ?? null
        } else {
          prof = (fullRes.data as ReviewerProfile | null) ?? null
        }

        // Safe fallback bootstrap if trigger did not create reviewer_profiles row yet
        if (!prof) {
          const meta = user.user_metadata ?? {}
          const fallbackName =
            (typeof meta.name === 'string' && meta.name.trim()) ||
            (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
            (typeof meta.user_name === 'string' && meta.user_name.trim()) ||
            null
          await supabase.from('reviewer_profiles').insert({
            id: user.id,
            display_name: fallbackName,
            role: 'reviewer',
          })
          prof = {
            id: user.id,
            display_name: fallbackName,
            role: 'reviewer',
          }
        }

        setReviewerProfile(prof)
        if (prof.role === 'editor' || prof.role === 'admin') {
          setPreferredExportSource('live')
        }
      } else {
        setReviewerProfile(null)
      }
    } finally {
      setAuthInitialized(true)
    }
  }, [])

  useEffect(() => {
    syncUserSession()
    if (!supabase) return
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUserEmail(session?.user?.email ?? null)
      setAuthProvider(
        typeof session?.user?.app_metadata?.provider === 'string'
          ? session.user.app_metadata.provider
          : null,
      )
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true)
        setAuthDialogOpen(true)
      }
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // Leave the Supabase auth callback before making further auth/API calls.
        queueMicrotask(() => {
          void syncUserSession()
        })
      }
    })
    return () => subscription.unsubscribe()
  }, [syncUserSession])

  const loadCorpus = useCallback(() => {
    setDataMode('loading')
    setCorpusError(null)
    loadCorpusWithOfflineFallback()
      .then((res) => {
        setEntries(res.corpus.entries)
        setRawCorpus(res.corpus.rawCorpus)
        setCategories(res.corpus.categories)
        setTotalExamplesCount(res.corpus.totalExamplesCount)
        setCachedCorpusAt(res.cachedAt)
        setActiveId((prev) =>
          res.corpus.entries.some((e) => e.id === prev)
            ? prev
            : (res.corpus.entries[0]?.id ?? ''),
        )
        setDataMode(res.mode)
      })
      .catch((error: unknown) => {
        setEntries([])
        setCategories([])
        setTotalExamplesCount(0)
        setCachedCorpusAt(null)
        setCorpusError(
          error instanceof Error
            ? error.message
            : 'تعذر تحميل المتن الرسمي والنسخة المحلية المحفوظة.',
        )
        setDataMode('error')
      })
  }, [])

  useEffect(() => {
    loadCorpus()
  }, [loadCorpus])

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (selectedCategory !== 'all' && entry.category !== selectedCategory) {
        return false
      }
      if (exampleFilter === 'with_examples' && entry.examples.length === 0) {
        return false
      }
      if (exampleFilter === 'needs_examples' && entry.examples.length > 0) {
        return false
      }
      if (exampleFilter === 'priority_enrichment' && !isPriorityEnrichmentEntry(entry)) {
        return false
      }
      return matchesDarijaQuery(entry, query)
    })
  }, [entries, query, selectedCategory, exampleFilter])

  const activeEntry = useMemo(() => {
    return (
      entries.find((e) => e.id === activeId) ??
      filteredEntries[0] ??
      entries[0] ??
      DEMO_ENTRIES[0]
    )
  }, [entries, filteredEntries, activeId])

  const activeIndexInFiltered = useMemo(
    () => filteredEntries.findIndex((e) => e.id === activeEntry.id),
    [filteredEntries, activeEntry.id],
  )

  const pendingSandboxCount = useMemo(
    () => sandboxItems.filter((i) => i.status === 'pending').length,
    [sandboxItems],
  )

  useEffect(() => {
    if (
      authInitialized &&
      !canAccessEditorialTools &&
      (workbenchTab === 'moderation' || workbenchTab === 'exporter')
    ) {
      setWorkbenchTab('rapid_review')
    }
  }, [authInitialized, canAccessEditorialTools, workbenchTab])

  // Sync workbench state to URL query parameters for shareable deep-links
  useEffect(() => {
    if (typeof window === 'undefined') return
    const nextSearch = buildWorkbenchUrlSearch({
      tab: workbenchTab,
      explorerSubView,
      entryId: activeEntry?.id ?? activeId,
      category: selectedCategory,
      exampleFilter,
      query,
    })
    const currentSearch = window.location.search
    if (nextSearch !== currentSearch) {
      const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash}`
      window.history.replaceState(null, '', nextUrl)
    }
  }, [workbenchTab, explorerSubView, activeEntry?.id, activeId, selectedCategory, exampleFilter, query])

  // Restore workbench state on browser Back / Forward navigation
  useEffect(() => {
    if (typeof window === 'undefined') return
    function onPopState() {
      const parsed = parseWorkbenchUrlState(window.location.search)
      setWorkbenchTab(parsed.tab)
      setExplorerSubView(parsed.explorerSubView)
      setSelectedCategory(parsed.category)
      setExampleFilter(parsed.exampleFilter)
      setQuery(parsed.query)
      if (parsed.entryId) {
        setActiveId(parsed.entryId)
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function handleResetFilters() {
    setQuery('')
    setSelectedCategory('all')
    setExampleFilter('all')
  }

  function handleStartRapidReview() {
    setWorkbenchTab('rapid_review')
    const el = document.getElementById('workspace')
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  function handleStartDetailedReview() {
    setFocusMode(false)
    setExplorerSubView('entries')
    setWorkbenchTab('explorer')
    const el = document.getElementById('workspace')
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  function handleSelectCategoryFromOverview(category: string) {
    setSelectedCategory(category)
    setQuery('')
    setExampleFilter('all')
    setExplorerSubView('entries')
    setWorkbenchTab('explorer')
    const match = entries.find((e) => e.category === category)
    if (match) setActiveId(match.id)
  }

  function handleInspectExistingFromNewForm(entry: LexicalEntry) {
    setFocusMode(false)
    setActiveId(entry.id)
    setExplorerSubView('entries')
    setWorkbenchTab('explorer')
  }

  function handleResumeDraft(entryId: string) {
    setFocusMode(false)
    setRevisionTarget(null)
    const draft = drafts[entryId]
    if (
      draft &&
      (entryId === 'NEW' ||
        entryId.startsWith('NEW:') ||
        draft.proposedData?.submission_kind === 'new_entry')
    ) {
      setResumedNewDraft(draft)
      setWorkbenchTab('new_entry')
      return
    }
    setActiveId(entryId)
    setExplorerSubView('entries')
    setWorkbenchTab('explorer')
  }

  function handleStartRevision(submission: SubmissionRecord) {
    setFocusMode(false)
    setRevisionTarget(submission)
    if (isNewEntrySubmission(submission)) {
      setWorkbenchTab('new_entry')
    } else {
      setActiveId(submission.entry_id)
      setExplorerSubView('entries')
      setWorkbenchTab('explorer')
    }
    const el = document.getElementById('workspace')
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  function handleOpenModerationSandbox() {
    setFocusMode(false)
    if (!isStaffRole) setEditorialPreviewMode(true)
    setForceSandboxModeration(true)
    setWorkbenchTab('moderation')
  }

  function handleJumpToAdminGovernance(source: 'live' | 'sandbox') {
    setFocusMode(false)
    if (!isStaffRole) setEditorialPreviewMode(true)
    setForceSandboxModeration(source === 'sandbox')
    setForceGovernanceSection(true)
    setWorkbenchTab('moderation')
    const el = document.getElementById('workspace')
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  function handleGoToExporter(source: 'live' | 'sandbox') {
    setFocusMode(false)
    if (!isStaffRole) setEditorialPreviewMode(true)
    setPreferredExportSource(source)
    setWorkbenchTab('exporter')
  }

  const WORKBENCH_TABS: Array<{ id: WorkbenchTab; label: string }> = [
    {
      id: 'rapid_review',
      label: `المراجعة السريعة${completedTodayCount > 0 ? ` · ${completedTodayCount}` : ''}`,
    },
    { id: 'explorer', label: 'تصفح المعجم' },
    { id: 'new_entry', label: 'إضافة مفردة' },
    {
      id: 'submissions',
      label: `مساهماتي${draftsList.length > 0 ? ` (${draftsList.length})` : ''}`,
    },
    ...(canAccessEditorialTools
      ? ([
          {
            id: 'moderation',
            label: `تحكيم المحررين${
              !isStaffRole && pendingSandboxCount > 0 ? ` (${pendingSandboxCount})` : ''
            }`,
          },
          { id: 'exporter', label: 'تصدير المعجم' },
        ] as Array<{ id: WorkbenchTab; label: string }>)
      : []),
  ]

  if (dataMode === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F6F1] px-5 text-stone-800 dark:bg-[#141312] dark:text-stone-100" dir="rtl">
        <div className="text-center" role="status" aria-live="polite">
          <Database className="mx-auto mb-4 h-8 w-8 text-[#0F5C4E] dark:text-[#4FD1C5]" />
          <h1 className="text-lg font-bold">جارٍ تحميل المتن المعجمي الرسمي</h1>
          <p className="mt-2 text-sm text-stone-500">يتم التحقق من المستودع والنسخة المحلية المحفوظة.</p>
        </div>
      </main>
    )
  }

  if (dataMode === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F6F1] px-5 py-12 text-stone-800 dark:bg-[#141312] dark:text-stone-100" dir="rtl">
        <section className="w-full max-w-xl rounded-2xl border border-amber-300/70 bg-white p-7 shadow-sm dark:border-amber-900/60 dark:bg-[#1C1A18]" aria-labelledby="corpus-error-title">
          <AlertTriangle className="mb-4 h-8 w-8 text-amber-600 dark:text-amber-400" />
          <h1 id="corpus-error-title" className="text-xl font-bold">المتن الرسمي غير متاح حالياً</h1>
          <p className="mt-3 text-sm leading-7 text-stone-600 dark:text-stone-300">
            لم نتمكن من تحميل المتن الرسمي أو العثور على نسخة محلية محفوظة صالحة. لن نعرض بيانات تجريبية على أنها بيانات معجمية رسمية، كما أوقفنا واجهة المراجعة إلى حين توفر مصدر موثوق.
          </p>
          {corpusError && <p className="mt-3 rounded-lg bg-stone-100 px-3 py-2 text-xs text-stone-600 dark:bg-[#141312] dark:text-stone-400">{corpusError}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={loadCorpus} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0F5C4E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B493E]">
              <RefreshCw className="h-4 w-4" /> إعادة المحاولة
            </button>
            <button
              type="button"
              onClick={() => {
                setEntries(DEMO_ENTRIES)
                setRawCorpus(DEMO_RAW_CORPUS)
                setCategories(Array.from(new Set(DEMO_ENTRIES.map((entry) => entry.category))))
                setTotalExamplesCount(4)
                setActiveId(DEMO_ENTRIES[0]?.id ?? '')
                setDataMode('demo')
              }}
              className="min-h-10 rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
            >
              معاينة عينة توضيحية فقط
            </button>
          </div>
          <p className="mt-4 text-xs text-stone-500">المعاينة التوضيحية منفصلة عن المتن الرسمي ولا تتيح الإرسال أو التحكيم أو التصدير.</p>
        </section>
      </main>
    )
  }

  if (dataMode === 'demo') {
    return (
      <main className="min-h-screen bg-[#F8F6F1] px-5 py-12 text-stone-800 dark:bg-[#141312] dark:text-stone-100" dir="rtl">
        <section className="mx-auto max-w-3xl">
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/20">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300">وضع معاينة توضيحي — بيانات غير رسمية</p>
            <h1 className="mt-2 text-xl font-bold">عينة واجهة Darija LexReview</h1>
            <p className="mt-2 text-sm leading-7 text-amber-950 dark:text-amber-100">هذه المداخل أمثلة اصطناعية لشرح شكل البيانات فقط. لا تمثل corpus معتمداً ولا يجوز استخدامها في المراجعة أو النشر.</p>
          </div>
          <div className="mt-5 overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-[#1C1A18]">
            {entries.map((entry) => (
              <div key={entry.id} className="border-b border-stone-100 p-4 last:border-0 dark:border-stone-800">
                <div className="flex items-baseline justify-between gap-3">
                  <strong className="text-lg">{entry.word}</strong>
                  <span className="text-xs text-stone-500">{entry.latin}</span>
                </div>
                <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{entry.meaning}</p>
              </div>
            ))}
          </div>
          <button type="button" onClick={loadCorpus} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0F5C4E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B493E]">
            <RefreshCw className="h-4 w-4" /> العودة لمحاولة تحميل المتن الرسمي
          </button>
        </section>
      </main>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        isAuthenticated={Boolean(userEmail)}
        canAccessEditorialTools={canAccessEditorialTools}
        isFocusMode={isRapidFocusActive}
        onExitFocusMode={() => setFocusMode(false)}
        onOpenAuth={() => setAuthDialogOpen(true)}
        onSelectWorkbenchTab={(tab) => {
          setFocusMode(false)
          if (tab === 'corpus') {
            setExplorerSubView('categories')
            setWorkbenchTab('explorer')
            return
          }
          if (tab === 'explorer') {
            setExplorerSubView('entries')
          }
          setForceSandboxModeration(false)
          setWorkbenchTab(tab)
        }}
      />

      <Suspense fallback={<div className="mx-auto max-w-[1280px] px-5 py-8 text-center text-sm text-stone-500" role="status">جارٍ تحميل القسم…</div>}>
      <main className="flex-1">
        {!isRapidFocusActive && (
          <HeroSection
            entriesCount={entries.length}
            categoriesCount={categories.length}
            examplesCount={totalExamplesCount}
            dataMode={dataMode}
            onStartRapidReview={handleStartRapidReview}
            onStartDetailedReview={handleStartDetailedReview}
          />
        )}

        {/* Lexicographical Workbench */}
        <section
          id="workspace"
          className={`mx-auto max-w-[1280px] px-4 sm:px-8 ${
            isRapidFocusActive ? 'py-4 sm:py-6' : 'py-8 lg:py-12'
          }`}
        >
          {/* Section Header + Mode Tabs (Collapsed in Focus Mode) */}
          {!isRapidFocusActive && (
            <>
              <div className="space-y-5 pb-6 border-b border-[#E5DFD3] dark:border-[#2E2B27]">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-[#0F5C4E] dark:text-[#4FD1C5]">
                      {canAccessEditorialTools
                        ? 'بيئة التوثيق والتحكيم والتصدير المعياري'
                        : 'مساحة المساهمة والتدقيق المعجمي المفتوح'}
                    </p>
                    <h2 className="mt-1.5 font-display text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
                      {canAccessEditorialTools
                        ? 'مساحة المراجعة والحوكمة المعجمية'
                        : 'ساهم في تدقيق وإثراء معجم الدارجة المغربية'}
                    </h2>
                    <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-400">
                      {canAccessEditorialTools
                        ? 'افحص المفردات القائمة، اقترح مداخل جديدة، حكّم المساهمات، وصدّر حزم التحديث الرسمية.'
                        : 'وثّق المفردات المتداولة ببطاقات سريعة، تصفّح المعجم وفئاته الدلالية، أو اقترح مفردات وشواهد جديدة.'}
                    </p>
                  </div>

                  {!isStaffRole && editorialPreviewMode && (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-300/80 bg-amber-50/80 px-3 py-1.5 text-xs text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
                      <span>وضع معاينة أدوات المحررين مفعّل</span>
                      <span aria-hidden="true">·</span>
                      <button
                        type="button"
                        onClick={() => setEditorialPreviewMode(false)}
                        className="font-semibold underline cursor-pointer"
                      >
                        إخفاء
                      </button>
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto pb-1">
                  <div
                    role="tablist"
                    aria-label="أقسام مساحة العمل"
                    className="inline-flex items-center gap-1 rounded-lg border border-[#E5DFD3] bg-[#F3EFE6] p-1 dark:border-[#2E2B27] dark:bg-[#1C1A18]"
                  >
                    {WORKBENCH_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={workbenchTab === tab.id}
                        onClick={() => {
                          if (tab.id !== 'moderation') setForceSandboxModeration(false)
                          setWorkbenchTab(tab.id)
                        }}
                        className={`min-h-[38px] rounded-md px-4 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          workbenchTab === tab.id
                            ? 'bg-white text-stone-900 shadow-2xs dark:bg-[#2A2622] dark:text-stone-100'
                            : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Dataset Operational Banner */}
              <div className="mt-5 mb-6">
                {dataMode === 'live' ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200/80 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
                      <span>
                        <strong className="font-semibold">المعجم الرسمي متصل:</strong>{' '}
                        <span className="font-mono tabular-nums">
                          {entries.length.toLocaleString('en-US')}
                        </span>{' '}
                        مدخل معجمي و
                        <span className="font-mono tabular-nums">
                          {totalExamplesCount.toLocaleString('en-US')}
                        </span>{' '}
                        شاهد سياقي (الإصدار{' '}
                        <span className="font-mono">v{corpusVersion}</span>).
                      </span>
                    </div>
                  </div>
                ) : dataMode === 'cached' ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-4 py-3 text-xs text-stone-800 dark:border-[#3A3530] dark:bg-[#1C1A18] dark:text-stone-200">
                    <div className="flex items-center gap-2.5">
                      <Database className="h-4 w-4 shrink-0 text-[#0F5C4E] dark:text-[#4FD1C5]" />
                      <span>
                        <strong className="font-semibold">نسخة المعجم الرسمية المحفوظة محلياً (دون اتصال):</strong>{' '}
                        <span className="font-mono tabular-nums">
                          {entries.length.toLocaleString('en-US')}
                        </span>{' '}
                        مدخل معجمي و
                        <span className="font-mono tabular-nums">
                          {totalExamplesCount.toLocaleString('en-US')}
                        </span>{' '}
                        شاهد سياقي (الإصدار{' '}
                        <span className="font-mono">v{corpusVersion}</span>
                        {cachedCorpusAt
                          ? ` · آخر مزامنة: ${new Date(cachedCorpusAt).toLocaleString('ar-MA')}`
                          : ''}
                        ).
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={loadCorpus}
                      className="inline-flex min-h-[32px] items-center gap-1.5 rounded-md border border-[#D6CEBE] bg-white px-3 py-1 text-xs font-semibold text-stone-800 hover:bg-[#EFECE4] whitespace-nowrap cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-200"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>مزامنة حية</span>
                    </button>
                  </div>
                ) : dataMode === 'demo' ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300/80 bg-amber-50/80 px-4 py-3 text-xs text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
                      <span>
                        <strong className="font-semibold">وضع البيانات التوضيحية:</strong> تعذر الاتصال بمستودع البيانات حالياً؛ المداخل المعروضة عينة محلية للتجربة.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={loadCorpus}
                      className="inline-flex min-h-[32px] items-center gap-1.5 rounded-md border border-amber-400/60 bg-white px-3 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-100/50 cursor-pointer dark:border-amber-700 dark:bg-[#1C1A18] dark:text-amber-200"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>إعادة المحاولة</span>
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          )}

          {/* Smart Post-Login / Post-Signup Local Drafts Sync Alert */}
          {!isRapidFocusActive && (
            <LocalDraftSyncBanner
              isAuthenticated={Boolean(userEmail)}
              userEmail={userEmail}
              draftsList={draftsList}
              entries={entries}
              corpusVersion={corpusVersion}
              onRemoveSyncedDrafts={removeMultipleDrafts}
              onResumeDraft={handleResumeDraft}
              onSyncedSuccess={() => setSubmissionsRefreshCounter((c) => c + 1)}
            />
          )}

          {/* Active Workbench View */}
          {workbenchTab === 'rapid_review' && (
            <RapidReviewPanel
              entries={entries}
              categories={categories}
              corpusVersion={corpusVersion}
              canAccessEditorialTools={canAccessEditorialTools}
              isFocusMode={isRapidFocusActive}
              onToggleFocusMode={() => setFocusMode((prev) => !prev)}
              calibrationStats={calibrationStats}
              onRecordCalibrationOutcome={recordCalibrationOutcome}
              userEmail={userEmail}
              userVerdictsByEntryId={userVerdictsByEntryId}
              userVerdictsByExampleId={userVerdictsByExampleId}
              summariesByEntryId={summariesByEntryId}
              summariesByExampleId={summariesByExampleId}
              skippedIds={skippedIds}
              skippedExampleIds={skippedExampleIds}
              canUndo={canUndo}
              completedTodayCount={completedTodayCount}
              sessionPrefs={sessionPrefs}
              onUpdateSessionPrefs={updateSessionPrefs}
              onRecordAttestation={recordAttestation}
              onSkipEntry={skipEntry}
              onUndoLastStep={undoLastStep}
              onResetSessionSkips={resetSessionSkips}
              onAddSandboxSubmission={addSandboxSubmission}
              onSaveDraft={saveDraft}
              onOpenDetailedEntry={(entry) => {
                setFocusMode(false)
                setActiveId(entry.id)
                setExplorerSubView('entries')
                setWorkbenchTab('explorer')
              }}
              onOpenModerationSandbox={handleOpenModerationSandbox}
              onRequireLogin={() => setAuthDialogOpen(true)}
              onSubmissionSuccess={() => setSubmissionsRefreshCounter((c) => c + 1)}
            />
          )}

          {(workbenchTab === 'explorer' || workbenchTab === 'corpus') && (
            <div className="space-y-5">
              {/* Integrated Sub-View Switcher: Entries Inspector vs Semantic Categories */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div
                  role="group"
                  aria-label="طريقة استعراض المعجم"
                  className="inline-flex items-center gap-1 rounded-lg border border-[#E5DFD3] bg-[#F3EFE6] p-1 dark:border-[#2E2B27] dark:bg-[#1C1A18]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setExplorerSubView('entries')
                      if (workbenchTab === 'corpus') setWorkbenchTab('explorer')
                    }}
                    className={`min-h-[34px] rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      explorerSubView === 'entries' && workbenchTab !== 'corpus'
                        ? 'bg-white text-stone-900 shadow-2xs dark:bg-[#2A2622] dark:text-stone-100'
                        : 'text-stone-600 hover:text-stone-900 dark:text-stone-400'
                    }`}
                  >
                    فحص بطاقات المفردات ({entries.length.toLocaleString('en-US')})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExplorerSubView('categories')
                      if (workbenchTab === 'corpus') setWorkbenchTab('explorer')
                    }}
                    className={`min-h-[34px] rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      explorerSubView === 'categories' || workbenchTab === 'corpus'
                        ? 'bg-white text-stone-900 shadow-2xs dark:bg-[#2A2622] dark:text-stone-100'
                        : 'text-stone-600 hover:text-stone-900 dark:text-stone-400'
                    }`}
                  >
                    توزيع الفئات الدلالية ({categories.length.toLocaleString('en-US')})
                  </button>
                </div>

                {selectedCategory !== 'all' && explorerSubView === 'entries' && (
                  <div className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-400">
                    <span>
                      الفئة النشطة: <strong className="text-stone-900 dark:text-stone-100">{selectedCategory}</strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('all')}
                      className="font-semibold text-[#0F5C4E] hover:underline cursor-pointer dark:text-[#4FD1C5]"
                    >
                      عرض كل الفئات
                    </button>
                  </div>
                )}
              </div>

              {explorerSubView === 'categories' || workbenchTab === 'corpus' ? (
                <CorpusOverview
                  entries={entries}
                  onSelectCategory={handleSelectCategoryFromOverview}
                />
              ) : (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
                  <div className="lg:col-span-4">
                    <LexiconSidebar
                      entries={entries}
                      filteredEntries={filteredEntries}
                      activeEntry={activeEntry}
                      categories={categories}
                      query={query}
                      selectedCategory={selectedCategory}
                      exampleFilter={exampleFilter}
                      dataMode={dataMode}
                      drafts={drafts}
                      onQueryChange={setQuery}
                      onCategoryChange={setSelectedCategory}
                      onExampleFilterChange={setExampleFilter}
                      onSelectEntry={(entry) => setActiveId(entry.id)}
                      onResetFilters={handleResetFilters}
                    />
                  </div>

                  <div className="lg:col-span-8">
                    <EntryDetailSheet
                      entry={activeEntry}
                      allEntries={entries}
                      corpusVersion={corpusVersion}
                      canAccessEditorialTools={canAccessEditorialTools}
                      currentIndex={activeIndexInFiltered}
                      totalFiltered={filteredEntries.length}
                      existingDraft={drafts[activeEntry.id]}
                      revisionTarget={revisionTarget}
                      userVerdictsByExampleId={userVerdictsByExampleId}
                      summariesByExampleId={summariesByExampleId}
                      onRecordExampleAttestation={({ entryId, exampleId, verdict, note }) =>
                        recordAttestation({
                          entryId,
                          exampleId,
                          verdict,
                          dialectRegion: sessionPrefs.dialectRegion,
                          note,
                        })
                      }
                      onClearRevisionTarget={() => setRevisionTarget(null)}
                      onPrev={() => {
                        if (activeIndexInFiltered > 0) {
                          setActiveId(filteredEntries[activeIndexInFiltered - 1].id)
                        }
                      }}
                      onNext={() => {
                        if (
                          activeIndexInFiltered >= 0 &&
                          activeIndexInFiltered < filteredEntries.length - 1
                        ) {
                          setActiveId(filteredEntries[activeIndexInFiltered + 1].id)
                        }
                      }}
                      onSaveDraft={saveDraft}
                      onRemoveDraft={removeDraft}
                      onAddSandboxSubmission={addSandboxSubmission}
                      onOpenModerationSandbox={handleOpenModerationSandbox}
                      onRequireLogin={() => setAuthDialogOpen(true)}
                      onSubmissionSuccess={() => setSubmissionsRefreshCounter((c) => c + 1)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {workbenchTab === 'new_entry' && (
            <NewEntryProposalPanel
              entries={entries}
              categories={categories}
              corpusVersion={corpusVersion}
              canAccessEditorialTools={canAccessEditorialTools}
              activeDraft={resumedNewDraft}
              onClearActiveDraft={() => setResumedNewDraft(null)}
              revisionTarget={revisionTarget && isNewEntrySubmission(revisionTarget) ? revisionTarget : null}
              onClearRevisionTarget={() => setRevisionTarget(null)}
              onInspectExistingEntry={handleInspectExistingFromNewForm}
              onSaveDraft={saveDraft}
              onAddSandboxSubmission={addSandboxSubmission}
              onRequireLogin={() => setAuthDialogOpen(true)}
              onSubmissionSuccess={() => setSubmissionsRefreshCounter((c) => c + 1)}
              onOpenModerationSandbox={handleOpenModerationSandbox}
            />
          )}

          {workbenchTab === 'submissions' && (
            <SubmissionsPanel
              draftsList={draftsList}
              entries={entries}
              corpusVersion={corpusVersion}
              canAccessEditorialTools={canAccessEditorialTools}
              totalAttestationsCount={totalAttestationsCount}
              sandboxItems={sandboxItems}
              userEmail={userEmail}
              refreshTrigger={submissionsRefreshCounter}
              onResumeDraft={handleResumeDraft}
              onStartRevision={handleStartRevision}
              onWithdrawSandboxSubmission={withdrawSandboxSubmission}
              onDeleteDraft={removeDraft}
              onRemoveMultipleDrafts={removeMultipleDrafts}
              onOpenAuth={() => setAuthDialogOpen(true)}
            />
          )}

          {workbenchTab === 'moderation' && canAccessEditorialTools && (
            <EditorModerationPanel
              entries={entries}
              categories={categories}
              corpusVersion={corpusVersion}
              userEmail={userEmail}
              profile={reviewerProfile}
              sandboxItems={sandboxItems}
              sandboxEvents={sandboxEvents}
              sandboxProfiles={sandboxProfiles}
              sandboxPromotionRequests={sandboxPromotionRequests}
              attestationSummaries={summariesByEntryId}
              forceSandboxMode={forceSandboxModeration}
              forceGovernanceSection={forceGovernanceSection}
              onClearForceGovernanceSection={() => setForceGovernanceSection(false)}
              onModerateSandbox={moderateSandboxSubmission}
              onBulkApproveSandbox={bulkApproveSandboxSubmissions}
              onResetSandbox={resetSandboxQueue}
              onReviewSandboxPromotion={reviewSandboxPromotionRequest}
              onUpdateSandboxMemberRole={updateSandboxMemberRole}
              onResetSandboxGovernance={resetSandboxGovernance}
              onOpenAuth={() => setAuthDialogOpen(true)}
              onGoToExporter={handleGoToExporter}
            />
          )}

          {workbenchTab === 'exporter' && canAccessEditorialTools && (
            <DatasetExporterPanel
              entries={entries}
              rawCorpus={rawCorpus}
              userEmail={userEmail}
              profile={reviewerProfile}
              sandboxItems={sandboxItems}
              preferredSource={preferredExportSource}
              onMarkSandboxMerged={markSandboxSubmissionsMerged}
            />
          )}
        </section>

        {!isRapidFocusActive && <MethodologySection />}
      </main>
      </Suspense>

      {!isRapidFocusActive && (
        <Footer
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((prev) => !prev)}
          isStaffRole={isStaffRole}
          editorialPreviewMode={editorialPreviewMode}
          onToggleEditorialPreview={() => setEditorialPreviewMode((prev) => !prev)}
        />
      )}

      <Suspense fallback={null}>
      <AuthDialog
        open={authDialogOpen}
        onClose={() => setAuthDialogOpen(false)}
        userEmail={userEmail}
        authProvider={authProvider}
        profile={reviewerProfile}
        recoveryMode={recoveryMode}
        draftsList={draftsList}
        entries={entries}
        corpusVersion={corpusVersion}
        canAccessEditorialTools={canAccessEditorialTools}
        totalAttestationsCount={totalAttestationsCount}
        sandboxPromotionRequests={sandboxPromotionRequests}
        onClearRecovery={() => setRecoveryMode(false)}
        onAuthChanged={syncUserSession}
        onRemoveSyncedDrafts={removeMultipleDrafts}
        onDraftsSyncedSuccess={() => setSubmissionsRefreshCounter((c) => c + 1)}
        onSubmitSandboxPromotion={submitSandboxPromotionRequest}
        onJumpToAdminGovernance={handleJumpToAdminGovernance}
      />
      </Suspense>
    </div>
  )
}
