import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Database,
  Edit3,
  Eye,
  Lock,
  LogIn,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from 'lucide-react'
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
import {
  type AppPage,
  buildAppRouteUrl,
  parseAppRoute,
  workbenchTabToPage,
} from './utils/urlState'
import { syncPageSeo } from './utils/seo'
import { useLocalDrafts } from './hooks/useLocalDrafts'
import { useSandboxModeration } from './hooks/useSandboxModeration'
import { useRoleGovernance } from './hooks/useRoleGovernance'
import { useCommunityAttestations } from './hooks/useCommunityAttestations'
import { useCommunityGovernanceAndMessages } from './hooks/useCommunityGovernanceAndMessages'
import { Navbar } from './components/Navbar'
import { HeroSection } from './components/HeroSection'
import { WorkspaceShell } from './components/WorkspaceShell'
import { CommandPalette } from './components/CommandPalette'
import { LocalDraftSyncBanner } from './components/LocalDraftSyncBanner'
import { OfflineConnectivityBanner } from './components/OfflineConnectivityBanner'
import {
  AccountStandingBanner,
  GlobalAnnouncementBanner,
  MandatoryWarningModal,
} from './components/GovernanceOverlays'
import { LexiconSidebar } from './components/Workbench/LexiconSidebar'
import { Footer } from './components/Footer'

const RapidReviewPanel = lazy(() =>
  import('./components/Workbench/RapidReviewPanel').then((module) => ({
    default: module.RapidReviewPanel,
  })),
)
const DictionaryReferenceCard = lazy(() =>
  import('./components/Workbench/DictionaryReferenceCard').then((module) => ({
    default: module.DictionaryReferenceCard,
  })),
)
const EntryDetailSheet = lazy(() =>
  import('./components/Workbench/EntryDetailSheet').then((module) => ({
    default: module.EntryDetailSheet,
  })),
)
const CorpusInsightsPage = lazy(() =>
  import('./components/Workbench/CorpusInsightsPage').then((module) => ({
    default: module.CorpusInsightsPage,
  })),
)
const PublicContributorsPage = lazy(() =>
  import('./components/Workbench/PublicContributorsPage').then((module) => ({
    default: module.PublicContributorsPage,
  })),
)
const NewEntryProposalPanel = lazy(() =>
  import('./components/Workbench/NewEntryProposalPanel').then((module) => ({
    default: module.NewEntryProposalPanel,
  })),
)
const CorpusOverview = lazy(() =>
  import('./components/Workbench/CorpusOverview').then((module) => ({
    default: module.CorpusOverview,
  })),
)
const SubmissionsPanel = lazy(() =>
  import('./components/Workbench/SubmissionsPanel').then((module) => ({
    default: module.SubmissionsPanel,
  })),
)
const MemberMessagesPage = lazy(() =>
  import('./components/Workbench/MemberMessagesPage').then((module) => ({
    default: module.MemberMessagesPage,
  })),
)
const EditorModerationPanel = lazy(() =>
  import('./components/Workbench/EditorModerationPanel').then((module) => ({
    default: module.EditorModerationPanel,
  })),
)
const AdminMembersPanel = lazy(() =>
  import('./components/Workbench/AdminMembersPanel').then((module) => ({
    default: module.AdminMembersPanel,
  })),
)
const DatasetExporterPanel = lazy(() =>
  import('./components/Workbench/DatasetExporterPanel').then((module) => ({
    default: module.DatasetExporterPanel,
  })),
)
const ContributorProfilePanel = lazy(() =>
  import('./components/Workbench/ContributorProfilePanel').then((module) => ({
    default: module.ContributorProfilePanel,
  })),
)
const MethodologySection = lazy(() =>
  import('./components/MethodologySection').then((module) => ({
    default: module.MethodologySection,
  })),
)
const AuthDialog = lazy(() =>
  import('./components/AuthDialog').then((module) => ({ default: module.AuthDialog })),
)

interface PageHeadingMeta {
  eyebrow: string
  title: string
  subtitle: string
}

const WORKSPACE_PAGE_HEADINGS: Record<Exclude<AppPage, 'home' | 'auth'>, PageHeadingMeta> = {
  review: {
    eyebrow: '01 / RAPID ATTESTATION',
    title: 'المراجعة السريعة للمفردات والشواهد',
    subtitle: 'دقّق البطاقات المعجمية المتتالية، تحقّق من الانتشار اللهجي، أو فعّل وضع التركيز الكامل.',
  },
  lexicon: {
    eyebrow: '02 / LEXICON EXPLORER',
    title: 'تصفح المعجم المغربي والفئات الدلالية',
    subtitle: 'استعرض البطاقات القاموسية المعتمدة، اقتبس المفردات أكاديمياً، أو انتقل لورشة الإثراء والتدقيق.',
  },
  insights: {
    eyebrow: '03 / CORPUS COVERAGE & GAPS',
    title: 'خارطة تغطية المعجم وفجوات الإثراء',
    subtitle: 'مؤشرات التوثيق السياقي والتوزيع اللهجي الجهوي وقائمة المفردات ذات الأولوية للإثراء المباشر.',
  },
  contributors: {
    eyebrow: '04 / CONTRIBUTORS HONOR ROLL',
    title: 'لوحة شرف المساهمين والهيئة العلمية',
    subtitle: 'نحتفي بالمساهمين الموثّقين والمحررين المشاركين في بناء وتدقيق المعجم المغربي المفتوح.',
  },
  contribute: {
    eyebrow: '05 / NEW LEXICAL PROPOSAL',
    title: 'إضافة مفردة أو شاهد سياقي جديد',
    subtitle: 'اقترح مفردة دارجة متداولة مع رسمها العربي واللاتيني وشواهد استعمالها الفعلي.',
  },
  submissions: {
    eyebrow: '06 / CONTRIBUTIONS & DRAFTS',
    title: 'مساهماتي ومسوداتي المحفوظة',
    subtitle: 'تابع حالة مقترحاتك قيد التحكيم واستكمل مسوداتك المحفوظة محلياً في متصفحك.',
  },
  messages: {
    eyebrow: '07 / MEMBER INBOX & ALERTS',
    title: 'صندوق الرسائل والتنبيهات الرسمية',
    subtitle: 'رسائل الترحيب، تحديثات الرتب والصلاحيات، الملاحظات التحريرية، وإعلانات المنصة العامة.',
  },
  profile: {
    eyebrow: '08 / CONTRIBUTOR IDENTITY',
    title: 'الملف الشخصي وأوسمة الجدارة وربط الحسابات',
    subtitle: 'أدر هويتك المعجمية وخصوصية ظهورك العام واربط حسابك بـ GitHub وGoogle.',
  },
  editorial: {
    eyebrow: '09 / EDITORIAL GOVERNANCE',
    title: 'تحكيم المحررين للمقترحات المعجمية',
    subtitle: 'راجع مساهمات المجتمع، دقّق الفروقات المعجمية، واعتمد التعديلات الموثّقة.',
  },
  members: {
    eyebrow: '10 / MEMBER & ROLE GOVERNANCE',
    title: 'إدارة الأعضاء والترقية والإنذارات والطرد',
    subtitle: 'لوحة المسؤولين والمشرفين لترقية الرتب، توجيه الرسائل والإنذارات، وضبط نزاهة الحسابات.',
  },
  export: {
    eyebrow: '11 / CORPUS RELEASE EXPORTER',
    title: 'تصدير حزم المعجم الرسمية',
    subtitle: 'ولّد حزم التحديث المعيارية الموقعة ببصمات SHA-256 لمستودع البيانات المفتوح.',
  },
}

export default function App() {
  const initialRoute = useMemo(
    () =>
      parseAppRoute(
        typeof window !== 'undefined' ? window.location.pathname : '/',
        typeof window !== 'undefined' ? window.location.search : '',
      ),
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

  const [activePage, setActivePage] = useState<AppPage>(initialRoute.page)
  const [explorerSubView, setExplorerSubView] = useState<'entries' | 'categories'>(
    initialRoute.explorerSubView,
  )
  const [explicitEntryId, setExplicitEntryId] = useState<string | null>(initialRoute.entryId)
  const [standaloneReferenceView, setStandaloneReferenceView] = useState<boolean>(
    Boolean(initialRoute.entryId),
  )
  const [lexiconDetailMode, setLexiconDetailMode] = useState<'reference' | 'workshop'>('reference')
  const [workshopFocusExample, setWorkshopFocusExample] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [editorialPreviewMode, setEditorialPreviewMode] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  const [query, setQuery] = useState(initialRoute.query)
  const [selectedCategory, setSelectedCategory] = useState(initialRoute.category)
  const [exampleFilter, setExampleFilter] = useState<ExampleFilter>(initialRoute.exampleFilter)
  const [selectedEntryType, setSelectedEntryType] = useState('all')
  const [selectedRegister, setSelectedRegister] = useState('all')
  const [selectedRegion, setSelectedRegion] = useState('all')
  const [activeId, setActiveId] = useState<string>(initialRoute.entryId ?? DEMO_ENTRIES[0].id)

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
      const saved = localStorage.getItem('arcode_lexreview_theme')
      return saved ? saved === 'dark' : true
    } catch {
      return true
    }
  })

  const corpusVersion = useMemo(() => extractCorpusVersion(rawCorpus), [rawCorpus])
  const isStaffRole =
    reviewerProfile?.role === 'editor' || reviewerProfile?.role === 'admin'
  const canAccessEditorialTools = isStaffRole || editorialPreviewMode
  const isRapidFocusActive = activePage === 'review' && focusMode

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

  const {
    publicContributors,
    loadingDirectory,
    liveAdminMembers,
    sandboxMembers,
    loadingMembers,
    liveModEvents,
    sandboxModEvents,
    liveModReports,
    sandboxModReports,
    inboxMessages,
    unreadMessagesCount,
    unacknowledgedWarnings,
    activeAnnouncements,
    markMessageRead,
    markAllMessagesRead,
    acknowledgeWarning,
    dismissAnnouncement,
    applyMemberGovernanceAction,
    sendDirectOrBroadcastMessage,
    submitModerationReport,
    resolveModerationReport,
    resetSandboxCommunityState,
    refreshPublicDirectory,
  } = useCommunityGovernanceAndMessages({
    currentProfile: reviewerProfile,
    userEmail,
    editorialPreviewMode,
    totalAttestationsCount,
  })

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

  // Global Command Palette shortcut (Ctrl+K / Cmd+K)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandPaletteOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const syncUserSession = useCallback(async () => {
    if (!supabase) {
      return
    }
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
        .select('id, display_name, dialect_region, specialty, github_handle, avatar_source, avatar_path, avatar_seed, role')
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
    void syncUserSession()
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
        setActivePage('auth')
      }
      if (event === 'SIGNED_OUT') {
        setEditorialPreviewMode(false)
      }
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
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
      if (exampleFilter === 'priority_enrichment' && !isPriorityEnrichmentEntry(entry)) return false
      if (selectedEntryType !== 'all' && (entry.entryType ?? 'unknown') !== selectedEntryType) return false
      if (selectedRegister !== 'all' && (entry.register ?? 'unknown') !== selectedRegister) return false
      if (selectedRegion !== 'all' && !(entry.region ?? []).includes(selectedRegion)) return false
      return matchesDarijaQuery(entry, query)
    })
  }, [entries, query, selectedCategory, exampleFilter, selectedEntryType, selectedRegister, selectedRegion])

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

  // Navigate cleanly between independent pages with history pushState + instant scroll reset
  const navigatePage = useCallback(
    (
      nextPage: AppPage,
      options?: {
        subView?: 'entries' | 'categories'
        entryId?: string | null
        preserveScroll?: boolean
      },
    ) => {
      setFocusMode(false)
      if (nextPage !== 'editorial') {
        setForceSandboxModeration(false)
      }

      const resolvedSubView =
        nextPage === 'lexicon' ? (options?.subView ?? explorerSubView) : explorerSubView
      const resolvedEntryId =
        nextPage === 'lexicon'
          ? resolvedSubView === 'categories'
            ? null
            : options?.entryId !== undefined
              ? options.entryId
              : explicitEntryId
          : null

      if (options?.subView) {
        setExplorerSubView(options.subView)
      }
      if (nextPage === 'lexicon') {
        setExplicitEntryId(resolvedEntryId)
        if (options?.entryId === null || resolvedSubView === 'categories') {
          setStandaloneReferenceView(false)
        }
        if (resolvedEntryId) {
          setActiveId(resolvedEntryId)
        }
      }

      setActivePage(nextPage)

      if (typeof window !== 'undefined') {
        const nextUrl = buildAppRouteUrl({
          page: nextPage,
          explorerSubView: resolvedSubView,
          entryId: resolvedEntryId,
          category: selectedCategory,
          exampleFilter,
          query,
        })
        const currentFull = `${window.location.pathname}${window.location.search}`
        if (nextUrl !== currentFull) {
          window.history.pushState(null, '', nextUrl)
        }
        if (!options?.preserveScroll) {
          window.scrollTo(0, 0)
        }
      }
    },
    [explorerSubView, explicitEntryId, selectedCategory, exampleFilter, query],
  )

  const handleLegacyWorkbenchTabSelect = useCallback(
    (tab: WorkbenchTab) => {
      if (tab === 'corpus') {
        navigatePage('lexicon', { subView: 'categories' })
        return
      }
      if (tab === 'explorer') {
        navigatePage('lexicon', { subView: 'entries' })
        return
      }
      navigatePage(workbenchTabToPage(tab))
    },
    [navigatePage],
  )

  // Keep clean URL synced with active filters & automatically upgrade legacy `/?tab=...` deep-links
  useEffect(() => {
    if (typeof window === 'undefined') return
    const nextUrl = buildAppRouteUrl({
      page: activePage,
      explorerSubView,
      entryId: activePage === 'lexicon' && explorerSubView === 'entries' ? explicitEntryId : null,
      category: selectedCategory,
      exampleFilter,
      query,
    })
    const currentFull = `${window.location.pathname}${window.location.search}`
    const shouldStripWorkspaceHash = activePage !== 'home' && window.location.hash === '#workspace'
    if (nextUrl !== currentFull || shouldStripWorkspaceHash) {
      const preservedHash =
        activePage === 'home' && window.location.hash !== '#workspace' ? window.location.hash : ''
      window.history.replaceState(null, '', `${nextUrl}${preservedHash}`)
    }
  }, [activePage, explorerSubView, explicitEntryId, selectedCategory, exampleFilter, query])

  // Restore independent page state on browser Back / Forward navigation
  useEffect(() => {
    if (typeof window === 'undefined') return
    function onPopState() {
      const parsed = parseAppRoute(window.location.pathname, window.location.search)
      setFocusMode(false)
      setActivePage(parsed.page)
      setExplorerSubView(parsed.explorerSubView)
      setSelectedCategory(parsed.category)
      setExampleFilter(parsed.exampleFilter)
      setQuery(parsed.query)
      setSelectedRegion(parsed.category ? 'all' : 'all')
      setExplicitEntryId(parsed.entryId)
      setStandaloneReferenceView(Boolean(parsed.entryId))
      if (parsed.entryId) {
        setActiveId(parsed.entryId)
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // Sync dynamic document title, description, canonical, OpenGraph, and DefinedTerm JSON-LD per page & entry
  useEffect(() => {
    syncPageSeo({
      page: activePage,
      explorerSubView,
      activeEntry,
      hasExplicitEntryInPath: Boolean(explicitEntryId),
    })
  }, [activePage, explorerSubView, activeEntry, explicitEntryId])

  function handleResetFilters() {
    setQuery('')
    setSelectedCategory('all')
    setExampleFilter('all')
    setSelectedEntryType('all')
    setSelectedRegister('all')
    setSelectedRegion('all')
  }

  function handleSelectEntryAndOpenPage(entry: LexicalEntry, pushHistory = true) {
    setFocusMode(false)
    setActiveId(entry.id)
    setExplicitEntryId(entry.id)
    setStandaloneReferenceView(true)
    setLexiconDetailMode('reference')
    setWorkshopFocusExample(false)
    setExplorerSubView('entries')
    if (pushHistory || activePage !== 'lexicon') {
      navigatePage('lexicon', {
        subView: 'entries',
        entryId: entry.id,
        preserveScroll: activePage === 'lexicon',
      })
    }
  }

  function handleQuickAddWord(word: string) {
    setFocusMode(false)
    const defaultCat = categories[0] ?? 'عام'
    setResumedNewDraft({
      entryId: `NEW:${Date.now()}`,
      headword: word,
      category: defaultCat,
      proposedData: {
        submission_kind: 'new_entry',
        word_ar: word,
        arabizi: '',
        meaning: '',
        french_translation: '',
        category: defaultCat,
      },
      evidence: [],
      reviewerNote: '',
      updatedAt: new Date().toISOString(),
    })
    navigatePage('contribute')
  }

  function handleSelectCategoryFromOverview(category: string) {
    setSelectedCategory(category)
    setQuery('')
    setExampleFilter('all')
    setExplicitEntryId(null)
    setStandaloneReferenceView(false)
    setLexiconDetailMode('reference')
    setWorkshopFocusExample(false)
    setExplorerSubView('entries')
    const match = entries.find((e) => e.category === category)
    if (match) setActiveId(match.id)
    navigatePage('lexicon', { subView: 'entries', entryId: null })
  }

  function handleInspectExistingFromNewForm(entry: LexicalEntry) {
    handleSelectEntryAndOpenPage(entry, true)
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
      navigatePage('contribute')
      return
    }
    setActiveId(entryId)
    setExplicitEntryId(entryId)
    setStandaloneReferenceView(false)
    setLexiconDetailMode('workshop')
    setWorkshopFocusExample(false)
    navigatePage('lexicon', { subView: 'entries', entryId })
  }

  function handleStartRevision(submission: SubmissionRecord) {
    setFocusMode(false)
    setRevisionTarget(submission)
    if (isNewEntrySubmission(submission)) {
      navigatePage('contribute')
    } else {
      setActiveId(submission.entry_id)
      setExplicitEntryId(submission.entry_id)
      setStandaloneReferenceView(false)
      setLexiconDetailMode('workshop')
      setWorkshopFocusExample(false)
      navigatePage('lexicon', { subView: 'entries', entryId: submission.entry_id })
    }
  }

  function handleOpenModerationSandbox() {
    setFocusMode(false)
    if (!isStaffRole) setEditorialPreviewMode(true)
    setForceSandboxModeration(true)
    navigatePage('editorial')
  }

  function handleJumpToAdminGovernance(source: 'live' | 'sandbox') {
    setFocusMode(false)
    if (!isStaffRole) setEditorialPreviewMode(true)
    setForceSandboxModeration(source === 'sandbox')
    setForceGovernanceSection(true)
    setAuthDialogOpen(false)
    navigatePage('editorial')
  }

  function handleGoToExporter(source: 'live' | 'sandbox') {
    setFocusMode(false)
    if (!isStaffRole) setEditorialPreviewMode(true)
    setPreferredExportSource(source)
    navigatePage('export')
  }

  if (dataMode === 'loading') {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-[#FAFAFC] px-5 text-zinc-900 dark:bg-[#050507] dark:text-zinc-100"
        dir="rtl"
      >
        <div className="text-center" role="status" aria-live="polite">
          <Database className="mx-auto mb-4 h-8 w-8 text-emerald-700 dark:text-[#D9FF43]" />
          <h1 className="text-lg font-bold">جارٍ تحميل المتن المعجمي الرسمي</h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            يتم التحقق من المستودع والنسخة المحلية المحفوظة.
          </p>
        </div>
      </main>
    )
  }

  if (dataMode === 'error') {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-[#FAFAFC] px-5 py-12 text-zinc-900 dark:bg-[#050507] dark:text-zinc-100"
        dir="rtl"
      >
        <section
          className="w-full max-w-xl rounded-2xl border border-amber-300/70 bg-white p-7 dark:border-amber-800/60 dark:bg-[#0C0C10]"
          aria-labelledby="corpus-error-title"
        >
          <AlertTriangle className="mb-4 h-8 w-8 text-amber-600 dark:text-amber-400" />
          <h1 id="corpus-error-title" className="text-xl font-bold">
            المتن الرسمي غير متاح حالياً
          </h1>
          <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
            لم نتمكن من تحميل المتن الرسمي أو العثور على نسخة محلية محفوظة صالحة. لن نعرض بيانات تجريبية على أنها بيانات معجمية رسمية، كما أوقفنا واجهة المراجعة إلى حين توفر مصدر موثوق.
          </p>
          {corpusError && (
            <p className="mt-3 rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-600 dark:bg-[#07070A] dark:text-zinc-400">
              {corpusError}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={loadCorpus}
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
            >
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
              className="min-h-10 rounded-full border border-zinc-300 px-5 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/[0.04]"
            >
              معاينة عينة توضيحية فقط
            </button>
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            المعاينة التوضيحية منفصلة عن المتن الرسمي ولا تتيح الإرسال أو التحكيم أو التصدير.
          </p>
        </section>
      </main>
    )
  }

  if (dataMode === 'demo') {
    return (
      <main
        className="min-h-screen bg-[#FAFAFC] px-5 py-12 text-zinc-900 dark:bg-[#050507] dark:text-zinc-100"
        dir="rtl"
      >
        <section className="mx-auto max-w-3xl">
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/20">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
              وضع معاينة توضيحي — بيانات غير رسمية
            </p>
            <h1 className="mt-2 text-xl font-bold">عينة واجهة Darija LexReview</h1>
            <p className="mt-2 text-sm leading-7 text-amber-950 dark:text-amber-100">
              هذه المداخل أمثلة اصطناعية لشرح شكل البيانات فقط. لا تمثل corpus معتمداً ولا يجوز استخدامها في المراجعة أو النشر.
            </p>
          </div>
          <div className="mt-5 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#0C0C10]">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="border-b border-zinc-100 p-4 last:border-0 dark:border-white/10"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <strong className="text-lg">{entry.word}</strong>
                  <span className="text-xs font-mono text-zinc-500">{entry.latin}</span>
                </div>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{entry.meaning}</p>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={loadCorpus}
            className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
          >
            <RefreshCw className="h-4 w-4" /> العودة لمحاولة تحميل المتن الرسمي
          </button>
        </section>
      </main>
    )
  }

  const pageHeading =
    activePage !== 'home' && activePage !== 'auth'
      ? WORKSPACE_PAGE_HEADINGS[activePage]
      : null

  const renderMemberOnlyRestrictedCard = (
    targetTitle: string,
    targetDescription: string,
  ) => (
    <div className="rounded-2xl border border-zinc-200 bg-white p-7 sm:p-9 dark:border-white/12 dark:bg-[#0B0B10]">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-emerald-700 dark:border-white/12 dark:bg-[#07070A] dark:text-[#D9FF43]">
        <UserPlus className="h-5 w-5" />
      </div>
      <p className="mt-4 font-mono text-[11px] tracking-[0.14em] uppercase text-emerald-700 dark:text-[#D9FF43]">
        REGISTERED MEMBERS ONLY · خاص بالأعضاء المسجلين
      </p>
      <h2 className="mt-1.5 font-display text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white">
        {targetTitle} مخصصة للمستخدمين المسجلين
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-400">
        {targetDescription}
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => navigatePage('auth')}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-zinc-950 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition-colors cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
        >
          <LogIn className="h-4 w-4" />
          <span>تسجيل الدخول / إنشاء حساب مجاني</span>
        </button>

        <button
          type="button"
          onClick={() => navigatePage('lexicon', { subView: 'entries', entryId: null })}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-zinc-300 bg-white px-5 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 transition-colors cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:border-white/35"
        >
          <BookOpen className="h-4 w-4" />
          <span>متابعة تصفح المعجم كزائر</span>
        </button>
      </div>
    </div>
  )

  const renderEditorialRestrictedCard = (targetTitle: string) => (
    <div className="rounded-2xl border border-zinc-200 bg-white p-7 sm:p-9 dark:border-white/12 dark:bg-[#0B0B10]">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-emerald-700 dark:border-white/12 dark:bg-[#07070A] dark:text-[#D9FF43]">
        <Lock className="h-5 w-5" />
      </div>
      <p className="mt-4 font-mono text-[11px] tracking-[0.14em] uppercase text-emerald-700 dark:text-[#D9FF43]">
        STAFF & MODERATORS ONLY · مقيد بصلاحية الإشراف
      </p>
      <h2 className="mt-1.5 font-display text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white">
        {targetTitle} مخصصة للمشرفين والمحررين المعتمدين فقط
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-400">
        {!userEmail
          ? 'أنت تتصفح حالياً كزائر غير مسجّل. لا تُعرض أدوات الإدارة والتحكيم إلا لحسابات المشرفين والمحررين المعتمدين حفاظاً على أمن البيانات وسياسات الصلاحيات (RLS).'
          : 'حسابك الحالي مسجّل بصفة «مراجع مساهم». تقتصر هذه اللوحة على المحررين والمشرفين المعتمدين، ويمكنك التقدم بطلب ترقية من ملفك الشخصي.'}
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {!userEmail ? (
          <button
            type="button"
            onClick={() => navigatePage('auth')}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-zinc-950 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition-colors cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>تسجيل الدخول بحساب مشرف أو محرر</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setAuthDialogOpen(true)}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-zinc-950 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition-colors cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>تقديم طلب ترقية إلى محرر معتمد</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setEditorialPreviewMode(true)}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-zinc-300 bg-white px-5 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 transition-colors cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60"
        >
          <Eye className="h-4 w-4 text-emerald-700 dark:text-[#D9FF43]" />
          <span>معاينة تجريبية معزولة (للفحص التقني)</span>
        </button>

        <button
          type="button"
          onClick={() => navigatePage('lexicon', { subView: 'entries', entryId: null })}
          className="inline-flex min-h-[42px] items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-900 cursor-pointer dark:text-zinc-400 dark:hover:text-white"
        >
          <span>العودة لتصفح المعجم</span>
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )

  const resolvedUserDisplayName =
    reviewerProfile?.display_name || (userEmail ? userEmail.split('@')[0] : null)

  return (
    <>
      <GlobalAnnouncementBanner
        announcements={activeAnnouncements}
        canOpenInbox={Boolean(userEmail) || editorialPreviewMode}
        onDismiss={dismissAnnouncement}
        onOpenMessages={() => navigatePage('messages')}
      />

      {activePage === 'home' ? (
        <div className="min-h-screen flex flex-col bg-[#FAFAFC] text-zinc-950 dark:bg-[#050507] dark:text-zinc-100">
          <Navbar
            isAuthenticated={Boolean(userEmail)}
            userDisplayName={resolvedUserDisplayName}
            userAvatarSource={reviewerProfile?.avatar_source}
            userAvatarPath={reviewerProfile?.avatar_path}
            userAvatarSeed={reviewerProfile?.avatar_seed}
            userGithubHandle={reviewerProfile?.github_handle}
            userRole={reviewerProfile?.role ?? null}
            canAccessEditorialTools={canAccessEditorialTools}
            unreadMessagesCount={unreadMessagesCount}
            onOpenAuth={() => navigatePage('auth')}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            onSelectWorkbenchTab={handleLegacyWorkbenchTabSelect}
            onNavigatePage={navigatePage}
          />

          <Suspense
            fallback={
              <div
                className="mx-auto max-w-[1280px] px-5 py-12 text-center text-sm text-zinc-500"
                role="status"
              >
                جارٍ تحميل الصفحة…
              </div>
            }
          >
            <main className="flex-1">
              <HeroSection
                entries={entries}
                entriesCount={entries.length}
                categoriesCount={categories.length}
                examplesCount={totalExamplesCount}
                dataMode={dataMode}
                isAuthenticated={Boolean(userEmail)}
                onStartRapidReview={() => navigatePage('review')}
                onStartDetailedReview={() =>
                  navigatePage('lexicon', { subView: 'entries', entryId: null })
                }
                onSelectEntry={(entry) => handleSelectEntryAndOpenPage(entry, true)}
                onQuickAddWord={handleQuickAddWord}
                onOpenContributors={() => navigatePage('contributors')}
                onSelectWorkbenchTab={handleLegacyWorkbenchTabSelect}
              />

              <MethodologySection
                isAuthenticated={Boolean(userEmail)}
                onOpenContributors={() => navigatePage('contributors')}
                onSelectWorkbenchTab={handleLegacyWorkbenchTabSelect}
              />
            </main>
          </Suspense>

          <Footer
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode((prev) => !prev)}
            isStaffRole={isStaffRole}
            editorialPreviewMode={editorialPreviewMode}
            onToggleEditorialPreview={() => setEditorialPreviewMode(false)}
            onOpenContributors={() => navigatePage('contributors')}
          />
        </div>
      ) : (
        <WorkspaceShell
          activePage={activePage}
          explorerSubView={explorerSubView}
          isFocusMode={isRapidFocusActive}
          onExitFocusMode={() => setFocusMode(false)}
          isAuthenticated={Boolean(userEmail)}
          userDisplayName={resolvedUserDisplayName}
          userRole={reviewerProfile?.role ?? null}
          canAccessEditorialTools={canAccessEditorialTools}
          isStaffRole={isStaffRole}
          editorialPreviewMode={editorialPreviewMode}
          onToggleEditorialPreview={() => setEditorialPreviewMode((prev) => !prev)}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((prev) => !prev)}
          dataMode={dataMode}
          entriesCount={entries.length}
          corpusVersion={corpusVersion}
          cachedCorpusAt={cachedCorpusAt}
          completedTodayCount={completedTodayCount}
          draftsCount={draftsList.length}
          unreadMessagesCount={unreadMessagesCount}
          pendingSandboxCount={pendingSandboxCount}
          onReloadCorpus={loadCorpus}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onNavigatePage={navigatePage}
        >
          <Suspense
            fallback={
              <div
                className="py-16 text-center text-sm text-zinc-500 dark:text-zinc-400"
                role="status"
              >
                جارٍ تجهيز مساحة العمل المستقلة…
              </div>
            }
          >
            {/* Independent Page Header (Hidden in Rapid Focus Mode and Standalone Auth Page) */}
            {!isRapidFocusActive && pageHeading && (
              <header className="mb-6 border-b border-zinc-200 pb-5 dark:border-white/10">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="font-mono text-[11px] tracking-[0.14em] uppercase text-emerald-700 dark:text-[#D9FF43]">
                      {pageHeading.eyebrow}
                    </p>
                    <h1 className="mt-1.5 font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
                      {activePage === 'lexicon' && explorerSubView === 'categories'
                        ? 'توزيع الفئات الدلالية للمعجم المغربي'
                        : activePage === 'submissions' && !userEmail
                          ? 'مسودات المتصفح المحفوظة محلياً'
                          : activePage === 'members' && reviewerProfile?.role === 'editor' && isStaffRole
                            ? 'بلاغات الإشراف والتنسيق مع الإدارة'
                            : pageHeading.title}
                    </h1>
                    <p className="mt-1 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
                      {activePage === 'submissions' && !userEmail
                        ? 'استكمل مسوداتك المحفوظة في هذا المتصفح أو سجّل الدخول لمزامنتها وإرسالها رسمياً باسمك.'
                        : pageHeading.subtitle}
                    </p>
                  </div>

                  {/* Contextual Header Status / Mode Switcher */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {!isStaffRole && editorialPreviewMode && (
                      <div className="flex items-center gap-2 rounded-xl border border-amber-300/80 bg-amber-50/80 px-3.5 py-1.5 text-xs text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
                        <span>وضع معاينة المحررين مفعّل</span>
                        <span aria-hidden="true">·</span>
                        <button
                          type="button"
                          onClick={() => setEditorialPreviewMode(false)}
                          className="font-semibold underline cursor-pointer"
                        >
                          إيقاف
                        </button>
                      </div>
                    )}

                    {dataMode === 'cached' && (
                      <button
                        type="button"
                        onClick={loadCorpus}
                        className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3.5 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 cursor-pointer dark:border-white/15 dark:bg-[#0C0C10] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60"
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>
                          نسخة محلية محفوظة
                          {cachedCorpusAt
                            ? ` (${new Date(cachedCorpusAt).toLocaleDateString('ar-MA')})`
                            : ''}{' '}
                          · مزامنة
                        </span>
                      </button>
                    )}

                    {dataMode === 'live' && activePage === 'lexicon' && (
                      <div className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[11px] text-zinc-700 dark:border-white/10 dark:bg-[#0C0C10] dark:text-zinc-300">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-[#D9FF43]" />
                        <span>
                          <span className="font-mono font-semibold text-zinc-950 dark:text-white">
                            {entries.length.toLocaleString('en-US')}
                          </span>{' '}
                          مفردة ·{' '}
                          <span className="font-mono font-semibold text-zinc-950 dark:text-white">
                            {totalExamplesCount.toLocaleString('en-US')}
                          </span>{' '}
                          شاهد
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </header>
            )}

            {/* Account Standing Notice (Strictly for Authenticated Members) */}
            {!isRapidFocusActive && Boolean(userEmail) && reviewerProfile?.account_status && (
              <AccountStandingBanner
                status={reviewerProfile.account_status}
                reason={reviewerProfile.status_reason}
                suspendedUntil={reviewerProfile.suspended_until}
              />
            )}

            {/* Post-Login Local Drafts Sync Alert on Contribution/Review Pages */}
            {!isRapidFocusActive &&
              (activePage === 'review' ||
                activePage === 'lexicon' ||
                activePage === 'contribute') && (
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

            {/* 1. Independent Rapid Review Page (/review) */}
            {activePage === 'review' && (
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
                onOpenDetailedEntry={(entry) => handleSelectEntryAndOpenPage(entry, true)}
                onOpenModerationSandbox={handleOpenModerationSandbox}
                onRequireLogin={() => setAuthDialogOpen(true)}
                onSubmissionSuccess={() => setSubmissionsRefreshCounter((c) => c + 1)}
              />
            )}

            {/* 2. Independent Lexicon & Categories Page (/lexicon & /lexicon/:entryId) */}
            {activePage === 'lexicon' && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div
                    role="group"
                    aria-label="طريقة استعراض المعجم"
                    className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-white/10 dark:bg-[#0C0C10]"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setStandaloneReferenceView(false)
                        navigatePage('lexicon', {
                          subView: 'entries',
                          entryId: null,
                          preserveScroll: true,
                        })
                      }}
                      className={`min-h-[34px] rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                        explorerSubView === 'entries'
                          ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                          : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                      }`}
                    >
                      فحص بطاقات المفردات ({entries.length.toLocaleString('en-US')})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStandaloneReferenceView(false)
                        navigatePage('lexicon', {
                          subView: 'categories',
                          entryId: null,
                          preserveScroll: true,
                        })
                      }}
                      className={`min-h-[34px] rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                        explorerSubView === 'categories'
                          ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                          : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                      }`}
                    >
                      توزيع الفئات الدلالية ({categories.length.toLocaleString('en-US')})
                    </button>
                  </div>

                  {explorerSubView === 'entries' && (
                    <div className="flex flex-wrap items-center gap-2.5">
                      {selectedCategory !== 'all' && (
                        <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                          <span>
                            الفئة النشطة:{' '}
                            <strong className="text-zinc-950 dark:text-white">
                              {selectedCategory}
                            </strong>
                          </span>
                          <span aria-hidden="true">·</span>
                          <button
                            type="button"
                            onClick={() => setSelectedCategory('all')}
                            className="font-semibold text-emerald-700 hover:underline cursor-pointer dark:text-[#D9FF43]"
                          >
                            عرض كل الفئات
                          </button>
                        </div>
                      )}

                      <div
                        role="group"
                        aria-label="نمط عرض المفردة"
                        className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-white/10 dark:bg-[#0C0C10]"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setLexiconDetailMode('reference')
                            setWorkshopFocusExample(false)
                          }}
                          className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                            lexiconDetailMode === 'reference'
                              ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                              : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                          }`}
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          <span>البطاقة القاموسية</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLexiconDetailMode('workshop')
                            setWorkshopFocusExample(false)
                          }}
                          className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                            lexiconDetailMode === 'workshop'
                              ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                              : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                          }`}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>ورشة التدقيق والتعديل</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {explorerSubView === 'categories' ? (
                  <CorpusOverview
                    entries={entries}
                    onSelectCategory={handleSelectCategoryFromOverview}
                  />
                ) : standaloneReferenceView && lexiconDetailMode === 'reference' ? (
                  <div className="mx-auto max-w-4xl">
                    <DictionaryReferenceCard
                      entry={activeEntry}
                      allEntries={entries}
                      corpusVersion={corpusVersion}
                      attestationSummary={summariesByEntryId[activeEntry.id]}
                      currentIndex={activeIndexInFiltered}
                      totalFiltered={filteredEntries.length}
                      hasLocalDraft={Boolean(drafts[activeEntry.id])}
                      onPrev={() => {
                        if (activeIndexInFiltered > 0) {
                          const prevEntry = filteredEntries[activeIndexInFiltered - 1]
                          setActiveId(prevEntry.id)
                          setExplicitEntryId(prevEntry.id)
                        }
                      }}
                      onNext={() => {
                        if (
                          activeIndexInFiltered >= 0 &&
                          activeIndexInFiltered < filteredEntries.length - 1
                        ) {
                          const nextEntry = filteredEntries[activeIndexInFiltered + 1]
                          setActiveId(nextEntry.id)
                          setExplicitEntryId(nextEntry.id)
                        }
                      }}
                      onSwitchToWorkshop={(focusAddExample = false) => {
                        setLexiconDetailMode('workshop')
                        setWorkshopFocusExample(focusAddExample)
                      }}
                      onSelectEntry={(entry) => handleSelectEntryAndOpenPage(entry, true)}
                      onSelectCategory={handleSelectCategoryFromOverview}
                      onBackToLexiconIndex={() => {
                        setStandaloneReferenceView(false)
                        setExplicitEntryId(null)
                        navigatePage('lexicon', {
                          subView: 'entries',
                          entryId: null,
                          preserveScroll: true,
                        })
                      }}
                    />
                  </div>
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
                        selectedEntryType={selectedEntryType}
                        selectedRegister={selectedRegister}
                        selectedRegion={selectedRegion}
                        regions={Array.from(
                          new Set(entries.flatMap((entry) => entry.region ?? [])),
                        ).sort()}
                        dataMode={dataMode}
                        drafts={drafts}
                        onQueryChange={setQuery}
                        onCategoryChange={setSelectedCategory}
                        onExampleFilterChange={setExampleFilter}
                        onEntryTypeChange={setSelectedEntryType}
                        onRegisterChange={setSelectedRegister}
                        onRegionChange={setSelectedRegion}
                        onSelectEntry={(entry) => {
                          setActiveId(entry.id)
                          setExplicitEntryId(entry.id)
                          setStandaloneReferenceView(false)
                        }}
                        onResetFilters={handleResetFilters}
                      />
                    </div>

                    <div className="lg:col-span-8">
                      {lexiconDetailMode === 'reference' ? (
                        <DictionaryReferenceCard
                          entry={activeEntry}
                          allEntries={entries}
                          corpusVersion={corpusVersion}
                          attestationSummary={summariesByEntryId[activeEntry.id]}
                          currentIndex={activeIndexInFiltered}
                          totalFiltered={filteredEntries.length}
                          hasLocalDraft={Boolean(drafts[activeEntry.id])}
                          onPrev={() => {
                            if (activeIndexInFiltered > 0) {
                              const prevEntry = filteredEntries[activeIndexInFiltered - 1]
                              setActiveId(prevEntry.id)
                              setExplicitEntryId(prevEntry.id)
                            }
                          }}
                          onNext={() => {
                            if (
                              activeIndexInFiltered >= 0 &&
                              activeIndexInFiltered < filteredEntries.length - 1
                            ) {
                              const nextEntry = filteredEntries[activeIndexInFiltered + 1]
                              setActiveId(nextEntry.id)
                              setExplicitEntryId(nextEntry.id)
                            }
                          }}
                          onSwitchToWorkshop={(focusAddExample = false) => {
                            setLexiconDetailMode('workshop')
                            setWorkshopFocusExample(focusAddExample)
                          }}
                          onSelectEntry={(entry) => {
                            setActiveId(entry.id)
                            setExplicitEntryId(entry.id)
                          }}
                          onSelectCategory={handleSelectCategoryFromOverview}
                        />
                      ) : (
                        <EntryDetailSheet
                          entry={activeEntry}
                          allEntries={entries}
                          corpusVersion={corpusVersion}
                          isAuthenticated={Boolean(userEmail)}
                          canAccessEditorialTools={canAccessEditorialTools}
                          currentIndex={activeIndexInFiltered}
                          totalFiltered={filteredEntries.length}
                          existingDraft={drafts[activeEntry.id]}
                          revisionTarget={revisionTarget}
                          sessionPrefs={sessionPrefs}
                          onUpdateSessionPrefs={updateSessionPrefs}
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
                              const prevEntry = filteredEntries[activeIndexInFiltered - 1]
                              setActiveId(prevEntry.id)
                              setExplicitEntryId(prevEntry.id)
                            }
                          }}
                          onNext={() => {
                            if (
                              activeIndexInFiltered >= 0 &&
                              activeIndexInFiltered < filteredEntries.length - 1
                            ) {
                              const nextEntry = filteredEntries[activeIndexInFiltered + 1]
                              setActiveId(nextEntry.id)
                              setExplicitEntryId(nextEntry.id)
                            }
                          }}
                          onSaveDraft={saveDraft}
                          onRemoveDraft={removeDraft}
                          onAddSandboxSubmission={addSandboxSubmission}
                          onOpenModerationSandbox={handleOpenModerationSandbox}
                          onRequireLogin={() => setAuthDialogOpen(true)}
                          onSubmissionSuccess={() => setSubmissionsRefreshCounter((c) => c + 1)}
                          initialOpenEdit
                          focusExampleOnOpen={workshopFocusExample}
                          onSwitchToReference={() => {
                            setLexiconDetailMode('reference')
                            setWorkshopFocusExample(false)
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2b. Independent Corpus Coverage & Enrichment Gaps Page (/insights) */}
            {activePage === 'insights' && (
              <CorpusInsightsPage
                entries={entries}
                totalExamplesCount={totalExamplesCount}
                corpusVersion={corpusVersion}
                onEnrichEntry={(entry) => {
                  setActiveId(entry.id)
                  setExplicitEntryId(entry.id)
                  setStandaloneReferenceView(false)
                  setExplorerSubView('entries')
                  setLexiconDetailMode('workshop')
                  setWorkshopFocusExample(entry.examples.length === 0)
                  navigatePage('lexicon', { subView: 'entries', entryId: entry.id })
                }}
                onSelectCategoryInLexicon={handleSelectCategoryFromOverview}
                onSelectRegionInLexicon={(region) => {
                  setSelectedRegion(region)
                  setSelectedCategory('all')
                  setQuery('')
                  setExplicitEntryId(null)
                  setStandaloneReferenceView(false)
                  setLexiconDetailMode('reference')
                  setExplorerSubView('entries')
                  navigatePage('lexicon', { subView: 'entries', entryId: null })
                }}
                onStartRapidReview={() => navigatePage('review')}
              />
            )}

            {/* 2c. Independent Public Contributors Honor Roll Page (/contributors) */}
            {activePage === 'contributors' && (
              <PublicContributorsPage
                contributors={publicContributors}
                loading={loadingDirectory}
                isAuthenticated={Boolean(userEmail)}
                entriesCount={entries.length}
                corpusVersion={corpusVersion}
                onOpenProfileOrAuth={() => navigatePage(userEmail ? 'profile' : 'auth')}
                onStartContributing={() => navigatePage('review')}
              />
            )}

            {/* 3. Independent New Entry Proposal Page (/contribute) */}
            {activePage === 'contribute' && (
              <NewEntryProposalPanel
                entries={entries}
                categories={categories}
                corpusVersion={corpusVersion}
                isAuthenticated={Boolean(userEmail)}
                canAccessEditorialTools={canAccessEditorialTools}
                sessionPrefs={sessionPrefs}
                onUpdateSessionPrefs={updateSessionPrefs}
                activeDraft={resumedNewDraft}
                onClearActiveDraft={() => setResumedNewDraft(null)}
                revisionTarget={
                  revisionTarget && isNewEntrySubmission(revisionTarget) ? revisionTarget : null
                }
                onClearRevisionTarget={() => setRevisionTarget(null)}
                onInspectExistingEntry={handleInspectExistingFromNewForm}
                onSaveDraft={saveDraft}
                onAddSandboxSubmission={addSandboxSubmission}
                onRequireLogin={() => setAuthDialogOpen(true)}
                onSubmissionSuccess={() => setSubmissionsRefreshCounter((c) => c + 1)}
                onOpenModerationSandbox={handleOpenModerationSandbox}
              />
            )}

            {/* 4. Independent Submissions & Local Drafts Page (/submissions) */}
            {activePage === 'submissions' &&
              (userEmail || draftsList.length > 0 || editorialPreviewMode ? (
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
                  onOpenAuth={() => navigatePage('auth')}
                />
              ) : (
                renderMemberOnlyRestrictedCard(
                  'صفحة المساهمات وسجل المقترحات',
                  'لإرسال مقترحاتك المعجمية ومتابعة حالة اعتمادها من قِبل المحررين، يرجى تسجيل الدخول أو إنشاء حساب مساهم مجاني (عبر GitHub أو Google أو البريد الإلكتروني).',
                )
              ))}

            {/* 4b. Independent Member Messages & Alerts Inbox (/messages) — Strictly Members Only */}
            {activePage === 'messages' &&
              (userEmail || editorialPreviewMode ? (
                <MemberMessagesPage
                  messages={inboxMessages}
                  unreadCount={unreadMessagesCount}
                  canAccessEditorialTools={canAccessEditorialTools}
                  onMarkRead={(id) => void markMessageRead(id)}
                  onMarkAllRead={() => void markAllMessagesRead()}
                  onAcknowledgeWarning={(id) => void acknowledgeWarning(id)}
                  onOpenAdminMembers={() => navigatePage('members')}
                  onStartRapidReview={() => navigatePage('review')}
                />
              ) : (
                renderMemberOnlyRestrictedCard(
                  'صندوق الرسائل والتنبيهات',
                  'صندوق الرسائل مخصص للأعضاء المسجلين لاستقبال رسائل الترحيب، الشكر والتقدير، الملاحظات التحريرية، وإشعارات الرتب والصلاحيات.',
                )
              ))}

            {/* 5. Independent Contributor Profile & OAuth Identity Linking Page (/profile) */}
            {activePage === 'profile' &&
              (userEmail ? (
                <ContributorProfilePanel
                  profile={reviewerProfile}
                  userEmail={userEmail}
                  onProfileSaved={() => {
                    void syncUserSession()
                    void refreshPublicDirectory()
                  }}
                  onOpenContributorsDirectory={() => navigatePage('contributors')}
                />
              ) : (
                <AuthDialog
                  open
                  mode="page"
                  onClose={() => navigatePage('home')}
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
              ))}

            {/* 6. Independent Editorial Moderation & Role Governance Page (/editorial) */}
            {activePage === 'editorial' &&
              (canAccessEditorialTools ? (
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
              ) : (
                renderEditorialRestrictedCard('صفحة تحكيم المحررين وحوكمة الأدوار')
              ))}

            {/* 6b. Independent Admin & Moderator Member Governance Page (/members) */}
            {activePage === 'members' &&
              (canAccessEditorialTools ? (
                <AdminMembersPanel
                  currentProfile={reviewerProfile}
                  userEmail={userEmail}
                  isAdmin={reviewerProfile?.role === 'admin'}
                  isEditor={reviewerProfile?.role === 'editor'}
                  editorialPreviewMode={editorialPreviewMode}
                  liveMembers={liveAdminMembers}
                  sandboxMembers={sandboxMembers}
                  loadingMembers={loadingMembers}
                  liveModEvents={liveModEvents}
                  sandboxModEvents={sandboxModEvents}
                  liveModReports={liveModReports}
                  sandboxModReports={sandboxModReports}
                  sandboxPromotionRequests={sandboxPromotionRequests}
                  onApplyGovernanceAction={applyMemberGovernanceAction}
                  onSendMessage={sendDirectOrBroadcastMessage}
                  onSubmitReport={submitModerationReport}
                  onResolveReport={resolveModerationReport}
                  onResetSandbox={resetSandboxCommunityState}
                  onOpenPublicDirectory={() => navigatePage('contributors')}
                />
              ) : (
                renderEditorialRestrictedCard('صفحة إدارة الأعضاء والترقية والطرد')
              ))}

            {/* 7. Independent Dataset Release Exporter Page (/export) */}
            {activePage === 'export' &&
              (canAccessEditorialTools ? (
                <DatasetExporterPanel
                  entries={entries}
                  rawCorpus={rawCorpus}
                  userEmail={userEmail}
                  profile={reviewerProfile}
                  sandboxItems={sandboxItems}
                  preferredSource={preferredExportSource}
                  onMarkSandboxMerged={markSandboxSubmissionsMerged}
                />
              ) : (
                renderEditorialRestrictedCard('صفحة تصدير حزم المعجم الرسمية')
              ))}

            {/* 8. Independent Login / Sign Up Page (/auth) */}
            {activePage === 'auth' && (
              <AuthDialog
                open
                mode="page"
                onClose={() => navigatePage(userEmail ? 'review' : 'home')}
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
            )}
          </Suspense>
        </WorkspaceShell>
      )}

      {/* Inline Contextual Auth Modal (when triggered mid-form via onRequireLogin without losing state) */}
      <Suspense fallback={null}>
        <AuthDialog
          open={authDialogOpen}
          mode="modal"
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

      {/* Global Command Palette (Ctrl+K / Cmd+K) for Instant Cross-Page & Word Navigation */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        entries={entries}
        isAuthenticated={Boolean(userEmail)}
        canAccessEditorialTools={canAccessEditorialTools}
        draftsCount={draftsList.length}
        onNavigatePage={navigatePage}
        onSelectEntry={(entry) => handleSelectEntryAndOpenPage(entry, true)}
        onQuickAddWord={handleQuickAddWord}
      />

      {/* Mandatory Official Warning Acknowledgment Modal — Strictly Authenticated Members (or Active Sandbox) */}
      {(Boolean(userEmail) || editorialPreviewMode) && (
        <MandatoryWarningModal
          warning={unacknowledgedWarnings[0] ?? null}
          onAcknowledge={(id) => void acknowledgeWarning(id)}
        />
      )}

      {/* Non-Intrusive Field Offline Connectivity Banner */}
      <OfflineConnectivityBanner draftsCount={draftsList.length} />
    </>
  )
}
