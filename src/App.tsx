import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
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
import { DEMO_ENTRIES, DEMO_RAW_CORPUS, fetchOfficialCorpus } from './services/dataset'
import { isNewEntrySubmission } from './services/exporter'
import { isPriorityEnrichmentEntry, matchesDarijaQuery } from './utils/phoneticSearch'
import { useLocalDrafts } from './hooks/useLocalDrafts'
import { useSandboxModeration } from './hooks/useSandboxModeration'
import { useRoleGovernance } from './hooks/useRoleGovernance'
import { Navbar } from './components/Navbar'
import { HeroSection } from './components/HeroSection'
import { LocalDraftSyncBanner } from './components/LocalDraftSyncBanner'
import { LexiconSidebar } from './components/Workbench/LexiconSidebar'
const EntryDetailSheet = lazy(() =>
  import('./components/Workbench/EntryDetailSheet').then((module) => ({ default: module.EntryDetailSheet })),
)
const NewEntryProposalPanel = lazy(() =>
  import('./components/Workbench/NewEntryProposalPanel').then((module) => ({ default: module.NewEntryProposalPanel })),
)
const CorpusOverview = lazy(() =>
  import('./components/Workbench/CorpusOverview').then((module) => ({ default: module.CorpusOverview })),
)
const SubmissionsPanel = lazy(() =>
  import('./components/Workbench/SubmissionsPanel').then((module) => ({ default: module.SubmissionsPanel })),
)
const EditorModerationPanel = lazy(() =>
  import('./components/Workbench/EditorModerationPanel').then((module) => ({ default: module.EditorModerationPanel })),
)
const DatasetExporterPanel = lazy(() =>
  import('./components/Workbench/DatasetExporterPanel').then((module) => ({ default: module.DatasetExporterPanel })),
)
const MethodologySection = lazy(() =>
  import('./components/MethodologySection').then((module) => ({ default: module.MethodologySection })),
)
const AuthDialog = lazy(() =>
  import('./components/AuthDialog').then((module) => ({ default: module.AuthDialog })),
)
import { Footer } from './components/Footer'

export default function App() {
  const [entries, setEntries] = useState<LexicalEntry[]>(DEMO_ENTRIES)
  const [rawCorpus, setRawCorpus] = useState<RawOfficialCorpus>(DEMO_RAW_CORPUS)
  const [categories, setCategories] = useState<string[]>(
    Array.from(new Set(DEMO_ENTRIES.map((e) => e.category))),
  )
  const [totalExamplesCount, setTotalExamplesCount] = useState<number>(4)
  const [dataMode, setDataMode] = useState<DataMode>('loading')

  const [workbenchTab, setWorkbenchTab] = useState<WorkbenchTab>('explorer')
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [exampleFilter, setExampleFilter] = useState<ExampleFilter>('all')
  const [activeId, setActiveId] = useState<string>(DEMO_ENTRIES[0].id)

  const [resumedNewDraft, setResumedNewDraft] = useState<LocalDraft | null>(null)
  const [revisionTarget, setRevisionTarget] = useState<SubmissionRecord | null>(null)
  const [forceSandboxModeration, setForceSandboxModeration] = useState(false)
  const [forceGovernanceSection, setForceGovernanceSection] = useState(false)
  const [preferredExportSource, setPreferredExportSource] = useState<'live' | 'sandbox'>('sandbox')

  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [recoveryMode, setRecoveryMode] = useState(false)
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

  const { drafts, draftsList, saveDraft, removeDraft, removeMultipleDrafts } = useLocalDrafts()
  const {
    sandboxItems,
    sandboxEvents,
    addSandboxSubmission,
    moderateSandboxSubmission,
    bulkApproveSandboxSubmissions,
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
    if (!supabase) return
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
        syncUserSession()
      }
    })
    return () => subscription.unsubscribe()
  }, [syncUserSession])

  const loadCorpus = useCallback(() => {
    setDataMode('loading')
    fetchOfficialCorpus()
      .then((corpus) => {
        setEntries(corpus.entries)
        setRawCorpus(corpus.rawCorpus)
        setCategories(corpus.categories)
        setTotalExamplesCount(corpus.totalExamplesCount)
        setActiveId(corpus.entries[0]?.id ?? '')
        setDataMode('live')
      })
      .catch(() => {
        setEntries(DEMO_ENTRIES)
        setRawCorpus(DEMO_RAW_CORPUS)
        setCategories(Array.from(new Set(DEMO_ENTRIES.map((e) => e.category))))
        setTotalExamplesCount(4)
        setActiveId(DEMO_ENTRIES[0].id)
        setDataMode('demo')
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

  function handleResetFilters() {
    setQuery('')
    setSelectedCategory('all')
    setExampleFilter('all')
  }

  function handleStartReview() {
    setWorkbenchTab('explorer')
    const el = document.getElementById('workspace')
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  function handleSelectCategoryFromOverview(category: string) {
    setSelectedCategory(category)
    setQuery('')
    setExampleFilter('all')
    setWorkbenchTab('explorer')
    const match = entries.find((e) => e.category === category)
    if (match) setActiveId(match.id)
  }

  function handleInspectExistingFromNewForm(entry: LexicalEntry) {
    setActiveId(entry.id)
    setWorkbenchTab('explorer')
  }

  function handleResumeDraft(entryId: string) {
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
    setWorkbenchTab('explorer')
  }

  function handleStartRevision(submission: SubmissionRecord) {
    setRevisionTarget(submission)
    if (isNewEntrySubmission(submission)) {
      setWorkbenchTab('new_entry')
    } else {
      setActiveId(submission.entry_id)
      setWorkbenchTab('explorer')
    }
    const el = document.getElementById('workspace')
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  function handleOpenModerationSandbox() {
    setForceSandboxModeration(true)
    setWorkbenchTab('moderation')
  }

  function handleJumpToAdminGovernance(source: 'live' | 'sandbox') {
    setForceSandboxModeration(source === 'sandbox')
    setForceGovernanceSection(true)
    setWorkbenchTab('moderation')
    const el = document.getElementById('workspace')
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  function handleGoToExporter(source: 'live' | 'sandbox') {
    setPreferredExportSource(source)
    setWorkbenchTab('exporter')
  }

  const WORKBENCH_TABS: Array<{ id: WorkbenchTab; label: string }> = [
    { id: 'explorer', label: 'فحص المفردات' },
    { id: 'new_entry', label: 'اقتراح مفردة جديدة' },
    { id: 'corpus', label: `فهرس الفئات (${categories.length})` },
    {
      id: 'submissions',
      label: `مسوداتي وسجلي${draftsList.length > 0 ? ` (${draftsList.length})` : ''}`,
    },
    {
      id: 'moderation',
      label: `تحكيم المحررين${pendingSandboxCount > 0 ? ` (${pendingSandboxCount})` : ''}`,
    },
    { id: 'exporter', label: 'تصدير المعجم الرسمي' },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        isAuthenticated={Boolean(userEmail)}
        onOpenAuth={() => setAuthDialogOpen(true)}
        onSelectWorkbenchTab={(tab) => {
          setForceSandboxModeration(false)
          setWorkbenchTab(tab)
        }}
      />

      <Suspense fallback={<div className="mx-auto max-w-[1280px] px-5 py-8 text-center text-sm text-stone-500" role="status">جارٍ تحميل القسم…</div>}>
      <main className="flex-1">
        <HeroSection
          entriesCount={entries.length}
          categoriesCount={categories.length}
          examplesCount={totalExamplesCount}
          dataMode={dataMode}
          onStartReview={handleStartReview}
        />

        {/* Lexicographical Workbench */}
        <section
          id="workspace"
          className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8 lg:py-12"
        >
          {/* Section Header + Mode Tabs */}
          <div className="space-y-5 pb-6 border-b border-[#E5DFD3] dark:border-[#2E2B27]">
            <div>
              <p className="text-xs font-semibold text-[#0F5C4E] dark:text-[#4FD1C5]">
                بيئة التحرير والتحكيم والتصدير المعياري
              </p>
              <h2 className="mt-1.5 font-display text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
                مساحة المراجعة والحوكمة المعجمية
              </h2>
              <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-400">
                افحص المفردات القائمة، اقترح مداخل جديدة، حكّم المساهمات جنباً إلى جنب، وصدّر حزم التحديث المتوافقة مع مخطط المستودع الرسمي.
              </p>
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
                    className={`min-h-[36px] rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
                    <strong className="font-semibold">المعجم الرسمي متصل:</strong> تم تحميل{' '}
                    <span className="font-mono tabular-nums">
                      {entries.length.toLocaleString('en-US')}
                    </span>{' '}
                    مدخل معجمي و
                    <span className="font-mono tabular-nums">
                      {totalExamplesCount.toLocaleString('en-US')}
                    </span>{' '}
                    شاهد سياقي من مستودع ArCode Standard (الإصدار{' '}
                    <span className="font-mono">
                      {String(rawCorpus.lexiconMeta.version ?? '1.5.0')}
                    </span>
                    ).
                  </span>
                </div>
              </div>
            ) : dataMode === 'demo' ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300/80 bg-amber-50/80 px-4 py-3 text-xs text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
                  <span>
                    <strong className="font-semibold">وضع البيانات التوضيحية:</strong> تعذر الاتصال بمستودع GitHub حالياً؛ المداخل المعروضة عينة محلية للتجربة.
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

          {/* Smart Post-Login / Post-Signup Local Drafts Sync Alert */}
          <LocalDraftSyncBanner
            isAuthenticated={Boolean(userEmail)}
            userEmail={userEmail}
            draftsList={draftsList}
            entries={entries}
            onRemoveSyncedDrafts={removeMultipleDrafts}
            onResumeDraft={handleResumeDraft}
            onSyncedSuccess={() => setSubmissionsRefreshCounter((c) => c + 1)}
          />

          {/* Active Workbench View */}
          {workbenchTab === 'explorer' && (
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
                  currentIndex={activeIndexInFiltered}
                  totalFiltered={filteredEntries.length}
                  existingDraft={drafts[activeEntry.id]}
                  revisionTarget={revisionTarget}
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

          {workbenchTab === 'new_entry' && (
            <NewEntryProposalPanel
              entries={entries}
              categories={categories}
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

          {workbenchTab === 'corpus' && (
            <CorpusOverview
              entries={entries}
              onSelectCategory={handleSelectCategoryFromOverview}
            />
          )}

          {workbenchTab === 'submissions' && (
            <SubmissionsPanel
              draftsList={draftsList}
              entries={entries}
              sandboxItems={sandboxItems}
              userEmail={userEmail}
              refreshTrigger={submissionsRefreshCounter}
              onResumeDraft={handleResumeDraft}
              onStartRevision={handleStartRevision}
              onDeleteDraft={removeDraft}
              onRemoveMultipleDrafts={removeMultipleDrafts}
              onOpenAuth={() => setAuthDialogOpen(true)}
            />
          )}

          {workbenchTab === 'moderation' && (
            <EditorModerationPanel
              entries={entries}
              categories={categories}
              userEmail={userEmail}
              profile={reviewerProfile}
              sandboxItems={sandboxItems}
              sandboxEvents={sandboxEvents}
              sandboxProfiles={sandboxProfiles}
              sandboxPromotionRequests={sandboxPromotionRequests}
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

          {workbenchTab === 'exporter' && (
            <DatasetExporterPanel
              entries={entries}
              rawCorpus={rawCorpus}
              userEmail={userEmail}
              profile={reviewerProfile}
              sandboxItems={sandboxItems}
              preferredSource={preferredExportSource}
            />
          )}
        </section>

        <MethodologySection />
      </main>
      </Suspense>

      <Footer
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
      />

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
