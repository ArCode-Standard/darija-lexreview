import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  Database,
  Edit3,
  Lock,
  LogIn,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import type {
  LexicalEntry,
  LocalDraft,
  ReviewerProfile,
  SubmissionRecord,
  WorkbenchTab,
} from './types/lexicon'
import { isNewEntrySubmission } from './services/exporter'
import { extractCorpusVersion } from './utils/corpusPinning'
import {
  type AppPage,
  buildAppRouteUrl,
  parseAppRoute,
  workbenchTabToPage,
} from './utils/urlState'
import { syncPageSeo } from './utils/seo'
import {
  THEME_STORAGE_KEY,
  getStoredThemePreference,
  getSystemThemePreference,
  persistManualThemePreference,
  resolveInitialTheme,
} from './utils/themePreference'
import type { OpenSubmissionFromMessageParams } from './components/Workbench/MemberMessagesPage'
import { useLocalDrafts } from './hooks/useLocalDrafts'
import { useCommunityAttestations } from './hooks/useCommunityAttestations'
import { useCommunityGovernanceAndMessages } from './hooks/useCommunityGovernanceAndMessages'
import { useMemberBookmarks } from './hooks/useMemberBookmarks'
import { useLexiconCorpusAndFilters } from './hooks/useLexiconCorpusAndFilters'
import {
  type ComputedSprintProgress,
  useDocumentationSprints,
} from './hooks/useDocumentationSprints'
import { formatEtymologyLabel } from './utils/etymology'
import {
  buildThematicCollections,
  findThematicCollectionBySlug,
} from './utils/thematicCollections'
import { Navbar } from './components/Navbar'
import { HeroSection } from './components/HeroSection'
import { DailySpotlightAndRegionalTasks } from './components/DailySpotlightAndRegionalTasks'
import { DocumentationSprintBanner } from './components/DocumentationSprintBanner'
import { HomeThematicCollectionsGateway } from './components/Workbench/ThematicCollectionsPage'
import type { AdminTab } from './components/Workbench/AdminMembersPanel'
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
const ThematicCollectionsPage = lazy(() =>
  import('./components/Workbench/ThematicCollectionsPage').then((module) => ({
    default: module.ThematicCollectionsPage,
  })),
)
const EmbeddedWordWidgetView = lazy(() =>
  import('./components/EmbeddedWordWidgetView').then((module) => ({
    default: module.EmbeddedWordWidgetView,
  })),
)
const EditorPromotionModal = lazy(() =>
  import('./components/EditorPromotionModal').then((module) => ({
    default: module.EditorPromotionModal,
  })),
)

interface PageHeadingMeta {
  eyebrow: string
  title: string
  subtitle: string
}

const WORKSPACE_PAGE_HEADINGS: Record<Exclude<AppPage, 'home' | 'auth' | 'embed'>, PageHeadingMeta> = {
  review: {
    eyebrow: '01 / RAPID ATTESTATION',
    title: 'المراجعة السريعة للمفردات والشواهد',
    subtitle: 'دقّق البطاقات المعجمية المتتالية، تحقّق من الانتشار اللهجي، أو فعّل وضع التركيز الكامل.',
  },
  lexicon: {
    eyebrow: '02 / LEXICON EXPLORER',
    title: 'تصفح المعجم المغربي والفئات الدلالية',
    subtitle: 'استعرض البطاقات القاموسية المعتمدة، التأصيل اللغوي، أو انتقل لورشة الإثراء والتدقيق.',
  },
  collections: {
    eyebrow: '02B / THEMATIC COLLECTIONS',
    title: 'المجموعات الموضوعاتية والمعاجم المصغّرة',
    subtitle: 'بوابات استكشافية منسّقة للزوار والباحثين: الأمثال الشعبية، المطبخ وأتاي، المعمار، والروافد التاريخية.',
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

  const {
    entries,
    rawCorpus,
    categories,
    totalExamplesCount,
    liveOverlayCount,
    dataMode,
    cachedCorpusAt,
    corpusError,
    loadCorpus,
    refreshLiveApprovedOverlay,
    query,
    setQuery,
    selectedCategory,
    setSelectedCategory,
    exampleFilter,
    setExampleFilter,
    selectedEntryType,
    setSelectedEntryType,
    selectedRegister,
    setSelectedRegister,
    selectedRegion,
    setSelectedRegion,
    selectedEtymology,
    setSelectedEtymology,
    setActiveId,
    filteredEntries: baseFilteredEntries,
    activeEntry: baseActiveEntry,
    availableRegions,
    handleResetFilters: resetBaseFilters,
  } = useLexiconCorpusAndFilters(initialRoute)

  const [onlyBookmarked, setOnlyBookmarked] = useState(false)
  const lexiconSidebarPaneRef = useRef<HTMLDivElement>(null)
  const lexiconDetailPaneRef = useRef<HTMLDivElement>(null)

  const [activePage, setActivePage] = useState<AppPage>(initialRoute.page)
  const [explorerSubView, setExplorerSubView] = useState<'entries' | 'categories'>(
    initialRoute.explorerSubView,
  )
  const [explicitEntryId, setExplicitEntryId] = useState<string | null>(initialRoute.entryId)
  const [explicitContributorSlug, setExplicitContributorSlug] = useState<string | null>(
    initialRoute.contributorSlug ?? null,
  )
  const [explicitCollectionSlug, setExplicitCollectionSlug] = useState<string | null>(
    initialRoute.collectionSlug ?? null,
  )
  const [embedTheme, setEmbedTheme] = useState<'light' | 'dark' | 'auto'>(
    initialRoute.embedTheme ?? 'auto',
  )
  const [embedCompact, setEmbedCompact] = useState<boolean>(Boolean(initialRoute.embedCompact))
  const [standaloneReferenceView, setStandaloneReferenceView] = useState<boolean>(
    Boolean(initialRoute.entryId) && initialRoute.page === 'lexicon',
  )
  const [lexiconDetailMode, setLexiconDetailMode] = useState<'reference' | 'workshop'>('reference')
  const [workshopFocusExample, setWorkshopFocusExample] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [promotionModalOpen, setPromotionModalOpen] = useState(false)
  const [adminInitialTab, setAdminInitialTab] = useState<AdminTab | undefined>(undefined)

  const [resumedNewDraft, setResumedNewDraft] = useState<LocalDraft | null>(null)
  const [revisionTarget, setRevisionTarget] = useState<SubmissionRecord | null>(null)
  const [forceGovernanceSection, setForceGovernanceSection] = useState(false)

  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [authProvider, setAuthProvider] = useState<string | null>(null)
  const [reviewerProfile, setReviewerProfile] = useState<ReviewerProfile | null>(null)
  const [submissionsRefreshCounter, setSubmissionsRefreshCounter] = useState(0)
  const [highlightedSubmissionId, setHighlightedSubmissionId] = useState<string | null>(null)

  const [darkMode, setDarkMode] = useState<boolean>(
    () => resolveInitialTheme() === 'dark',
  )

  const handleToggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev
      persistManualThemePreference(next ? 'dark' : 'light')
      return next
    })
  }, [])

  const corpusVersion = useMemo(() => extractCorpusVersion(rawCorpus), [rawCorpus])
  const isStaffRole =
    reviewerProfile?.role === 'editor' || reviewerProfile?.role === 'admin'
  const canAccessEditorialTools = isStaffRole
  const isRapidFocusActive = activePage === 'review' && focusMode

  const { drafts, draftsList, saveDraft, removeDraft, removeMultipleDrafts } = useLocalDrafts()
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
    loadingMembers,
    liveModEvents,
    liveModReports,
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
    refreshPublicDirectory,
    refreshMessages,
  } = useCommunityGovernanceAndMessages({
    currentProfile: reviewerProfile,
    userEmail,
    totalAttestationsCount,
  })

  const {
    bookmarkedIds,
    isBookmarked,
    toggleBookmark,
    removeBookmark,
  } = useMemberBookmarks({
    userId: reviewerProfile?.id,
    userEmail,
  })

  const {
    sprints,
    activeSprintProgress,
    totalMySprintContributions,
    recordSprintParticipation,
    createSprint,
    updateSprintStatus,
  } = useDocumentationSprints({
    entries,
    summariesByEntryId,
    userId: reviewerProfile?.id,
    userEmail,
  })

  const handleRecordAttestationWithSprint = useCallback(
    (params: Parameters<typeof recordAttestation>[0]) => {
      const matchedEntry = entries.find((e) => e.id === params.entryId)
      if (matchedEntry) {
        void recordSprintParticipation(matchedEntry)
      }
      return recordAttestation(params)
    },
    [recordAttestation, entries, recordSprintParticipation],
  )

  const thematicCollections = useMemo(() => buildThematicCollections(entries), [entries])
  const activeCollectionForSeo = useMemo(() => {
    if (activePage !== 'collections' || !explicitCollectionSlug) return null
    return findThematicCollectionBySlug(thematicCollections, explicitCollectionSlug)
  }, [activePage, explicitCollectionSlug, thematicCollections])

  const myPublicContributorSlug = useMemo(() => {
    if (!reviewerProfile) return null
    const match = publicContributors.find(
      (c) =>
        c.public_slug === `self-${reviewerProfile.id.slice(0, 8)}` ||
        (reviewerProfile.github_handle &&
          c.github_handle &&
          c.github_handle.toLowerCase() === reviewerProfile.github_handle.toLowerCase()) ||
        (reviewerProfile.display_name && c.display_name === reviewerProfile.display_name),
    )
    return match?.public_slug ?? `self-${reviewerProfile.id.slice(0, 8)}`
  }, [reviewerProfile, publicContributors])

  const activeContributorForSeo = useMemo(() => {
    if (activePage !== 'contributors' || !explicitContributorSlug) return null
    return publicContributors.find((c) => c.public_slug === explicitContributorSlug) ?? null
  }, [activePage, explicitContributorSlug, publicContributors])

  // Remove obsolete browser-only simulation caches. This never touches Supabase or official drafts.
  useEffect(() => {
    try {
      [
        'arcode_darija_lexreview_sandbox_queue_v3',
        'arcode_darija_lexreview_sandbox_events_v1',
        'arcode_darija_lexreview_sandbox_profiles_v1',
        'arcode_darija_lexreview_sandbox_promotions_v1',
        'arcode_lexreview_sandbox_gov_members_v1',
        'arcode_lexreview_sandbox_messages_v1',
        'arcode_lexreview_sandbox_mod_events_v1',
        'arcode_lexreview_sandbox_mod_reports_v1',
      ].forEach((key) => localStorage.removeItem(key))
    } catch {
      // Browser storage may be unavailable; official server records are unaffected.
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (darkMode) {
      root.classList.add('dark')
      root.setAttribute('data-theme', 'dark')
    } else {
      root.classList.remove('dark')
      root.setAttribute('data-theme', 'light')
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]')
    if (metaTheme) {
      metaTheme.setAttribute('content', darkMode ? '#050507' : '#FAFAFC')
    }
  }, [darkMode])

  // Follow device prefers-color-scheme automatically until the visitor manually toggles the header switch
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystemThemeChange = () => {
      if (getStoredThemePreference() === null) {
        setDarkMode(getSystemThemePreference() === 'dark')
      }
    }
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', onSystemThemeChange)
      return () => mediaQuery.removeEventListener('change', onSystemThemeChange)
    }
    if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(onSystemThemeChange)
      return () => mediaQuery.removeListener(onSystemThemeChange)
    }
    return undefined
  }, [])

  // Sync theme if changed from institutional pages (/about/, /privacy/, etc.) in another tab
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        if (event.newValue === 'light' || event.newValue === 'dark') {
          setDarkMode(event.newValue === 'dark')
        } else {
          setDarkMode(getSystemThemePreference() === 'dark')
        }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Global Command Palette shortcut (Ctrl+K / Cmd+K) — Registered Members Only
  useEffect(() => {
    if (!userEmail) return
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandPaletteOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [userEmail])

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
        .select('id, display_name, dialect_region, specialty, github_handle, avatar_source, avatar_path, avatar_seed, public_listed, account_status, status_reason, suspended_until, role, created_at')
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
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        queueMicrotask(() => {
          void syncUserSession()
        })
      }
    })
    return () => subscription.unsubscribe()
  }, [syncUserSession])

  const filteredEntries = useMemo(() => {
    if (!onlyBookmarked) return baseFilteredEntries
    const savedSet = new Set(bookmarkedIds)
    return baseFilteredEntries.filter((entry) => savedSet.has(entry.id))
  }, [baseFilteredEntries, onlyBookmarked, bookmarkedIds])

  const activeEntry = useMemo(() => {
    if (onlyBookmarked && filteredEntries.length > 0 && !filteredEntries.some((e) => e.id === baseActiveEntry.id)) {
      return filteredEntries[0]
    }
    return baseActiveEntry
  }, [onlyBookmarked, filteredEntries, baseActiveEntry])

  const activeIndexInFiltered = useMemo(
    () => filteredEntries.findIndex((e) => e.id === activeEntry.id),
    [filteredEntries, activeEntry.id],
  )

  const scrollToLexiconDetailOnMobile = useCallback(() => {
    if (typeof window === 'undefined' || window.innerWidth >= 1280) return
    window.requestAnimationFrame(() => {
      lexiconDetailPaneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  const scrollToLexiconSidebarOnMobile = useCallback(() => {
    if (typeof window === 'undefined') return
    lexiconSidebarPaneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // Navigate cleanly between independent pages with history pushState + instant scroll reset
  const navigatePage = useCallback(
    (
      nextPage: AppPage,
      options?: {
        subView?: 'entries' | 'categories'
        entryId?: string | null
        contributorSlug?: string | null
        collectionSlug?: string | null
        etymology?: string
        region?: string
        preserveScroll?: boolean
      },
    ) => {
      setFocusMode(false)
      const resolvedSubView =
        nextPage === 'lexicon' ? (options?.subView ?? explorerSubView) : explorerSubView
      const resolvedEntryId =
        nextPage === 'lexicon'
          ? resolvedSubView === 'categories'
            ? null
            : options?.entryId !== undefined
              ? options.entryId
              : explicitEntryId
          : nextPage === 'embed'
            ? options?.entryId ?? explicitEntryId
            : null
      const resolvedContributorSlug =
        nextPage === 'contributors'
          ? options?.contributorSlug !== undefined
            ? options.contributorSlug
            : explicitContributorSlug
          : null
      const resolvedCollectionSlug =
        nextPage === 'collections'
          ? options?.collectionSlug !== undefined
            ? options.collectionSlug
            : explicitCollectionSlug
          : null
      const resolvedEtymology =
        options?.etymology !== undefined ? options.etymology : selectedEtymology
      const resolvedRegion =
        options?.region !== undefined ? options.region : selectedRegion

      if (options?.subView) {
        setExplorerSubView(options.subView)
      }
      if (options?.etymology !== undefined) {
        setSelectedEtymology(options.etymology)
      }
      if (options?.region !== undefined) {
        setSelectedRegion(options.region)
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
      if (nextPage === 'contributors') {
        setExplicitContributorSlug(resolvedContributorSlug)
      } else {
        setExplicitContributorSlug(null)
      }
      if (nextPage === 'collections') {
        setExplicitCollectionSlug(resolvedCollectionSlug)
      } else {
        setExplicitCollectionSlug(null)
      }

      setActivePage(nextPage)

      if (typeof window !== 'undefined') {
        const nextUrl = buildAppRouteUrl({
          page: nextPage,
          explorerSubView: resolvedSubView,
          entryId: resolvedEntryId,
          ...(resolvedContributorSlug ? { contributorSlug: resolvedContributorSlug } : {}),
          ...(resolvedCollectionSlug ? { collectionSlug: resolvedCollectionSlug } : {}),
          ...(resolvedEtymology && resolvedEtymology !== 'all'
            ? { etymology: resolvedEtymology }
            : {}),
          ...(resolvedRegion && resolvedRegion !== 'all'
            ? { region: resolvedRegion }
            : {}),
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
    [
      explorerSubView,
      explicitEntryId,
      explicitContributorSlug,
      explicitCollectionSlug,
      selectedEtymology,
      selectedRegion,
      selectedCategory,
      exampleFilter,
      query,
      setSelectedEtymology,
      setSelectedRegion,
      setActiveId,
    ],
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
      entryId:
        activePage === 'embed'
          ? explicitEntryId ?? activeEntry.id
          : activePage === 'lexicon' && explorerSubView === 'entries'
            ? explicitEntryId
            : null,
      ...(activePage === 'contributors' && explicitContributorSlug
        ? { contributorSlug: explicitContributorSlug }
        : {}),
      ...(activePage === 'collections' && explicitCollectionSlug
        ? { collectionSlug: explicitCollectionSlug }
        : {}),
      ...(activePage === 'lexicon' && selectedEtymology !== 'all'
        ? { etymology: selectedEtymology }
        : {}),
      ...(activePage === 'lexicon' && selectedRegion !== 'all'
        ? { region: selectedRegion }
        : {}),
      ...(activePage === 'embed'
        ? {
            embedTheme,
            embedCompact,
          }
        : {}),
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
  }, [
    activePage,
    explorerSubView,
    explicitEntryId,
    activeEntry.id,
    explicitContributorSlug,
    explicitCollectionSlug,
    selectedEtymology,
    selectedRegion,
    embedTheme,
    embedCompact,
    selectedCategory,
    exampleFilter,
    query,
  ])

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
      setSelectedEtymology(parsed.etymology ?? 'all')
      setSelectedRegion(parsed.region ?? 'all')
      setExplicitEntryId(parsed.entryId)
      setExplicitContributorSlug(parsed.contributorSlug ?? null)
      setExplicitCollectionSlug(parsed.collectionSlug ?? null)
      setEmbedTheme(parsed.embedTheme ?? 'auto')
      setEmbedCompact(Boolean(parsed.embedCompact))
      setStandaloneReferenceView(Boolean(parsed.entryId) && parsed.page === 'lexicon')
      if (parsed.entryId) {
        setActiveId(parsed.entryId)
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [
    setSelectedCategory,
    setExampleFilter,
    setQuery,
    setSelectedEtymology,
    setSelectedRegion,
    setActiveId,
  ])

  // Sync dynamic document title, description, canonical, OpenGraph, and DefinedTerm / CollectionPage / ProfilePage JSON-LD
  useEffect(() => {
    syncPageSeo({
      page: activePage,
      explorerSubView,
      activeEntry,
      hasExplicitEntryInPath: Boolean(explicitEntryId),
      entriesCount: entries.length,
      activeContributor: activeContributorForSeo,
      activeCollection: activeCollectionForSeo,
    })
  }, [
    activePage,
    explorerSubView,
    activeEntry,
    explicitEntryId,
    entries.length,
    activeContributorForSeo,
    activeCollectionForSeo,
  ])

  function handleResetFilters() {
    resetBaseFilters()
    setOnlyBookmarked(false)
  }

  function handleJoinSprint(sp: ComputedSprintProgress) {
    handleResetFilters()
    const { target_type, target_value } = sp.sprint
    if (target_type === 'missing_examples') {
      setExampleFilter('needs_examples')
      setExplicitEntryId(null)
      setStandaloneReferenceView(false)
      setExplorerSubView('entries')
      setLexiconDetailMode('workshop')
      setWorkshopFocusExample(true)
      navigatePage('lexicon', { subView: 'entries', entryId: null })
      return
    }
    if (target_type === 'region' && target_value) {
      updateSessionPrefs({ dialectRegion: target_value })
      navigatePage('review')
      return
    }
    if (target_type === 'category' && target_value) {
      setSelectedCategory(target_value)
      setExplicitEntryId(null)
      setStandaloneReferenceView(false)
      setExplorerSubView('entries')
      navigatePage('lexicon', { subView: 'entries', entryId: null })
      return
    }
    if (target_type === 'entry_type' && target_value) {
      setSelectedEntryType(target_value)
      setExplicitEntryId(null)
      setStandaloneReferenceView(false)
      setExplorerSubView('entries')
      navigatePage('lexicon', { subView: 'entries', entryId: null })
      return
    }
    if (target_type === 'etymology' && target_value) {
      setSelectedEtymology(target_value)
      setExplicitEntryId(null)
      setStandaloneReferenceView(false)
      setExplorerSubView('entries')
      navigatePage('lexicon', { subView: 'entries', entryId: null, etymology: target_value })
      return
    }
    navigatePage('review')
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

  function handleEnrichEntryInWorkshop(entry: LexicalEntry) {
    setFocusMode(false)
    setActiveId(entry.id)
    setExplicitEntryId(entry.id)
    setStandaloneReferenceView(false)
    setExplorerSubView('entries')
    setLexiconDetailMode('workshop')
    setWorkshopFocusExample(true)
    navigatePage('lexicon', { subView: 'entries', entryId: entry.id })
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

  async function handleOpenSubmissionFromMessage({
    submissionId,
    entryId,
    openEditorDirectly,
  }: OpenSubmissionFromMessageParams) {
    setFocusMode(false)
    if (submissionId) {
      setHighlightedSubmissionId(submissionId)
    }

    if (openEditorDirectly && submissionId && supabase) {
      const { data, error } = await supabase
        .from('review_submissions')
        .select('*')
        .eq('id', submissionId)
        .maybeSingle()

      if (!error && data) {
        const record = data as SubmissionRecord
        if (record.status === 'needs_changes' || record.status === 'rejected') {
          handleStartRevision(record)
          return
        }
      }
    }

    if (submissionId) {
      setSubmissionsRefreshCounter((c) => c + 1)
      navigatePage('submissions')
      return
    }

    if (entryId) {
      const targetEntry = entries.find((e) => e.id === entryId)
      if (targetEntry) {
        handleSelectEntryAndOpenPage(targetEntry, true)
        return
      }
    }

    navigatePage('submissions')
  }

  function handleJumpToAdminGovernance() {
    setFocusMode(false)
    setForceGovernanceSection(true)
    setAuthDialogOpen(false)
    navigatePage('editorial')
  }

  function handleGoToExporter() {
    setFocusMode(false)
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
          </div>
        </section>
      </main>
    )
  }

  if (activePage === 'embed') {
    const resolvedEmbedTheme: 'light' | 'dark' =
      embedTheme === 'light'
        ? 'light'
        : embedTheme === 'dark'
          ? 'dark'
          : darkMode
            ? 'dark'
            : 'light'
    return (
      <Suspense
        fallback={
          <main className="p-4 text-center text-xs text-zinc-500" dir="rtl">
            جارٍ تحميل البطاقة المعجمية المضمّنة…
          </main>
        }
      >
        <EmbeddedWordWidgetView
          entry={activeEntry}
          corpusVersion={corpusVersion}
          themeMode={resolvedEmbedTheme}
          compact={embedCompact}
        />
      </Suspense>
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
            onClick={() => setPromotionModalOpen(true)}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-zinc-950 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition-colors cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>تقديم طلب ترقية إلى محرر معتمد</span>
          </button>
        )}

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
        canOpenInbox={Boolean(userEmail)}
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
            darkMode={darkMode}
            onToggleDarkMode={handleToggleDarkMode}
            onOpenAuth={() => navigatePage('auth')}
            onOpenCommandPalette={userEmail ? () => setCommandPaletteOpen(true) : undefined}
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
                onOpenContributors={() => navigatePage('contributors', { contributorSlug: null })}
                onSelectWorkbenchTab={handleLegacyWorkbenchTabSelect}
              />

              <DocumentationSprintBanner
                sprintProgress={activeSprintProgress}
                isAuthenticated={Boolean(userEmail)}
                isStaffRole={isStaffRole}
                onJoinSprint={handleJoinSprint}
                onOpenManageSprints={() => {
                  setAdminInitialTab('sprints')
                  navigatePage('members')
                }}
              />

              <DailySpotlightAndRegionalTasks
                entries={entries}
                corpusVersion={corpusVersion}
                darkMode={darkMode}
                isAuthenticated={Boolean(userEmail)}
                memberDialectRegion={reviewerProfile?.dialect_region || sessionPrefs.dialectRegion}
                userVerdictsByEntryId={userVerdictsByEntryId}
                isBookmarked={isBookmarked}
                onToggleBookmark={(entryId) => void toggleBookmark(entryId)}
                onSelectEntry={(entry) => handleSelectEntryAndOpenPage(entry, true)}
                onEnrichEntry={handleEnrichEntryInWorkshop}
                onOpenProfileSettings={() => navigatePage('profile')}
              />

              <HomeThematicCollectionsGateway
                entries={entries}
                onOpenCollection={(slug) =>
                  navigatePage('collections', { collectionSlug: slug ?? null })
                }
              />

              <MethodologySection
                isAuthenticated={Boolean(userEmail)}
                onOpenContributors={() => navigatePage('contributors', { contributorSlug: null })}
                onSelectWorkbenchTab={handleLegacyWorkbenchTabSelect}
              />
            </main>
          </Suspense>

          <Footer onOpenContributors={() => navigatePage('contributors')} />
        </div>
      ) : (
        <WorkspaceShell
          activePage={activePage}
          explorerSubView={explorerSubView}
          isFocusMode={isRapidFocusActive}
          onExitFocusMode={() => setFocusMode(false)}
          isAuthenticated={Boolean(userEmail)}
          userDisplayName={resolvedUserDisplayName}
          userAvatarSource={reviewerProfile?.avatar_source}
          userAvatarPath={reviewerProfile?.avatar_path}
          userAvatarSeed={reviewerProfile?.avatar_seed}
          userGithubHandle={reviewerProfile?.github_handle}
          userRole={reviewerProfile?.role ?? null}
          canAccessEditorialTools={canAccessEditorialTools}
          isStaffRole={isStaffRole}
          darkMode={darkMode}
          onToggleDarkMode={handleToggleDarkMode}
          dataMode={dataMode}
          entriesCount={entries.length}
          corpusVersion={corpusVersion}
          cachedCorpusAt={cachedCorpusAt}
          completedTodayCount={completedTodayCount}
          draftsCount={draftsList.length}
          unreadMessagesCount={unreadMessagesCount}
          onReloadCorpus={loadCorpus}
          onOpenCommandPalette={userEmail ? () => setCommandPaletteOpen(true) : undefined}
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
                          {liveOverlayCount > 0 ? ` · +${liveOverlayCount} معتمدة حديثاً` : ''}
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
              <div className="space-y-5">
                {!isRapidFocusActive && (
                  <DocumentationSprintBanner
                    compact
                    sprintProgress={activeSprintProgress}
                    isAuthenticated={Boolean(userEmail)}
                    isStaffRole={isStaffRole}
                    onJoinSprint={handleJoinSprint}
                    onOpenManageSprints={() => {
                      setAdminInitialTab('sprints')
                      navigatePage('members')
                    }}
                  />
                )}
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
                  onRecordAttestation={handleRecordAttestationWithSprint}
                  onSkipEntry={skipEntry}
                  onUndoLastStep={undoLastStep}
                  onResetSessionSkips={resetSessionSkips}
                  onSaveDraft={saveDraft}
                  onOpenDetailedEntry={(entry) => handleSelectEntryAndOpenPage(entry, true)}
                  onRequireLogin={() => setAuthDialogOpen(true)}
                  onSubmissionSuccess={() => setSubmissionsRefreshCounter((c) => c + 1)}
                />
              </div>
            )}

            {/* 2. Independent Lexicon & Categories Page (/lexicon & /lexicon/:entryId) */}
            {activePage === 'lexicon' && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div
                    role="group"
                    aria-label="طريقة استعراض المعجم"
                    className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-white/10 dark:bg-[#0C0C10]"
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

                      {selectedEtymology !== 'all' && (
                        <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                          <span>
                            التأصيل النشط:{' '}
                            <strong className="text-zinc-950 dark:text-white">
                              {formatEtymologyLabel(selectedEtymology)}
                            </strong>
                          </span>
                          <span aria-hidden="true">·</span>
                          <button
                            type="button"
                            onClick={() => setSelectedEtymology('all')}
                            className="font-semibold text-emerald-700 hover:underline cursor-pointer dark:text-[#D9FF43]"
                          >
                            عرض كل الجذور
                          </button>
                        </div>
                      )}

                      {selectedRegion !== 'all' && (
                        <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                          <span>
                            المنطقة النشطة:{' '}
                            <strong className="text-zinc-950 dark:text-white">
                              {selectedRegion}
                            </strong>
                          </span>
                          <span aria-hidden="true">·</span>
                          <button
                            type="button"
                            onClick={() => setSelectedRegion('all')}
                            className="font-semibold text-emerald-700 hover:underline cursor-pointer dark:text-[#D9FF43]"
                          >
                            عرض كل المناطق
                          </button>
                        </div>
                      )}

                      <div
                        role="group"
                        aria-label="نمط عرض المفردة"
                        className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-white/10 dark:bg-[#0C0C10]"
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
                      darkMode={darkMode}
                      isAuthenticated={Boolean(userEmail)}
                      isBookmarked={isBookmarked(activeEntry.id)}
                      onToggleBookmark={() => void toggleBookmark(activeEntry.id)}
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
                      onSelectEtymology={(origin) => {
                        setSelectedEtymology(origin)
                        setStandaloneReferenceView(false)
                        setExplicitEntryId(null)
                        navigatePage('lexicon', {
                          subView: 'entries',
                          entryId: null,
                          etymology: origin,
                        })
                      }}
                      onOpenContributorProfile={(slug) =>
                        navigatePage('contributors', { contributorSlug: slug })
                      }
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
                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
                    <div ref={lexiconSidebarPaneRef} className="min-w-0 xl:col-span-4 scroll-mt-16">
                      <LexiconSidebar
                        categories={categories}
                        entries={entries}
                        filteredEntries={filteredEntries}
                        activeEntry={activeEntry}
                        query={query}
                        selectedCategory={selectedCategory}
                        exampleFilter={exampleFilter}
                        selectedEntryType={selectedEntryType}
                        selectedRegister={selectedRegister}
                        selectedRegion={selectedRegion}
                        selectedEtymology={selectedEtymology}
                        regions={availableRegions}
                        dataMode={dataMode}
                        drafts={drafts}
                        bookmarkedEntryIds={bookmarkedIds}
                        onlyBookmarked={onlyBookmarked}
                        onToggleOnlyBookmarked={() => setOnlyBookmarked((prev) => !prev)}
                        onQueryChange={setQuery}
                        onCategoryChange={setSelectedCategory}
                        onExampleFilterChange={setExampleFilter}
                        onEntryTypeChange={setSelectedEntryType}
                        onRegisterChange={setSelectedRegister}
                        onRegionChange={setSelectedRegion}
                        onEtymologyChange={setSelectedEtymology}
                        onSelectEntry={(entry) => {
                          setActiveId(entry.id)
                          setExplicitEntryId(entry.id)
                          setStandaloneReferenceView(false)
                        }}
                        onJumpToDetailCard={scrollToLexiconDetailOnMobile}
                        onResetFilters={handleResetFilters}
                      />
                    </div>

                    <div ref={lexiconDetailPaneRef} className="min-w-0 xl:col-span-8 space-y-3 scroll-mt-16">
                      <div className="flex items-center justify-between gap-2 xl:hidden">
                        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                          البطاقة المعروضة: <strong className="text-zinc-900 dark:text-white">«{activeEntry.word}»</strong>
                        </span>
                        <button
                          type="button"
                          onClick={scrollToLexiconSidebarOnMobile}
                          className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer dark:border-white/15 dark:bg-[#0C0C10] dark:text-zinc-200"
                        >
                          <ArrowUp className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
                          <span>فهرس البحث والتصفية</span>
                        </button>
                      </div>
                      {lexiconDetailMode === 'reference' ? (
                        <DictionaryReferenceCard
                          entry={activeEntry}
                          allEntries={entries}
                          corpusVersion={corpusVersion}
                          darkMode={darkMode}
                          isAuthenticated={Boolean(userEmail)}
                          isBookmarked={isBookmarked(activeEntry.id)}
                          onToggleBookmark={() => void toggleBookmark(activeEntry.id)}
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
                          onSelectEtymology={(origin) => setSelectedEtymology(origin)}
                          onOpenContributorProfile={(slug) =>
                            navigatePage('contributors', { contributorSlug: slug })
                          }
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
                            handleRecordAttestationWithSprint({
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
                          onRequireLogin={() => setAuthDialogOpen(true)}
                          onSubmissionSuccess={() => {
                            void recordSprintParticipation(activeEntry)
                            setSubmissionsRefreshCounter((c) => c + 1)
                          }}
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

            {/* 2a. Independent Thematic Mini-Dictionaries Page (/collections & /collections/:slug) */}
            {activePage === 'collections' && (
              <ThematicCollectionsPage
                entries={entries}
                selectedSlug={explicitCollectionSlug}
                onSelectCollectionSlug={(slug) =>
                  navigatePage('collections', { collectionSlug: slug, preserveScroll: false })
                }
                onOpenEntry={(entry) => handleSelectEntryAndOpenPage(entry, true)}
                onFilterByEtymologyInLexicon={(origin) => {
                  handleResetFilters()
                  setSelectedEtymology(origin)
                  setExplicitEntryId(null)
                  setStandaloneReferenceView(false)
                  setExplorerSubView('entries')
                  setLexiconDetailMode('reference')
                  navigatePage('lexicon', {
                    subView: 'entries',
                    entryId: null,
                    etymology: origin,
                  })
                }}
              />
            )}

            {/* 2b. Independent Corpus Coverage & Enrichment Gaps Page (/insights) */}
            {activePage === 'insights' && (
              <div className="space-y-6">
                <DocumentationSprintBanner
                  compact
                  sprintProgress={activeSprintProgress}
                  isAuthenticated={Boolean(userEmail)}
                  isStaffRole={isStaffRole}
                  onJoinSprint={handleJoinSprint}
                  onOpenManageSprints={() => {
                    setAdminInitialTab('sprints')
                    navigatePage('members')
                  }}
                />
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
                    navigatePage('lexicon', { subView: 'entries', entryId: null, region })
                  }}
                  onStartRapidReview={() => navigatePage('review')}
                />
              </div>
            )}

            {/* 2c. Independent Public Contributors Honor Roll Page (/contributors & /contributors/:slug) */}
            {activePage === 'contributors' && (
              <PublicContributorsPage
                contributors={publicContributors}
                loading={loadingDirectory}
                isAuthenticated={Boolean(userEmail)}
                darkMode={darkMode}
                entriesCount={entries.length}
                corpusVersion={corpusVersion}
                initialSelectedSlug={explicitContributorSlug}
                activeSprintBadgeLabel={activeSprintProgress?.sprint.badge_label ?? null}
                onSelectedSlugChange={(slug) => setExplicitContributorSlug(slug)}
                onOpenProfileOrAuth={() => navigatePage(userEmail ? 'profile' : 'auth')}
                onStartContributing={() => navigatePage('review')}
                onExploreRegionInLexicon={(region) => {
                  setSelectedRegion(region)
                  setSelectedCategory('all')
                  setQuery('')
                  setExplicitEntryId(null)
                  setStandaloneReferenceView(false)
                  setLexiconDetailMode('reference')
                  setExplorerSubView('entries')
                  navigatePage('lexicon', { subView: 'entries', entryId: null, region })
                }}
                onInspectWordInLexicon={(word) => {
                  const found = entries.find((e) => e.word === word)
                  if (found) {
                    handleSelectEntryAndOpenPage(found, true)
                  } else {
                    setQuery(word)
                    setSelectedCategory('all')
                    setExplicitEntryId(null)
                    setStandaloneReferenceView(false)
                    setExplorerSubView('entries')
                    navigatePage('lexicon', { subView: 'entries', entryId: null })
                  }
                }}
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
                onEnrichExistingEntry={handleEnrichEntryInWorkshop}
                onSaveDraft={saveDraft}
                onRequireLogin={() => setAuthDialogOpen(true)}
                onSubmissionSuccess={() => setSubmissionsRefreshCounter((c) => c + 1)}
              />
            )}

            {/* 4. Independent Submissions & Local Drafts Page (/submissions) */}
            {activePage === 'submissions' &&
              (userEmail || draftsList.length > 0 ? (
                <SubmissionsPanel
                  draftsList={draftsList}
                  entries={entries}
                  corpusVersion={corpusVersion}
                  canAccessEditorialTools={canAccessEditorialTools}
                  totalAttestationsCount={totalAttestationsCount}
                  userEmail={userEmail}
                  refreshTrigger={submissionsRefreshCounter}
                  highlightedSubmissionId={highlightedSubmissionId}
                  onClearHighlightedSubmission={() => setHighlightedSubmissionId(null)}
                  onInspectEntryInLexicon={(entryId) => {
                    const found = entries.find((e) => e.id === entryId)
                    if (found) handleSelectEntryAndOpenPage(found, true)
                  }}
                  onResumeDraft={handleResumeDraft}
                  onStartRevision={handleStartRevision}
                  onDeleteDraft={removeDraft}
                  onRemoveMultipleDrafts={removeMultipleDrafts}
                  onOpenAuth={() => navigatePage('auth')}
                />
              ) : (
                renderMemberOnlyRestrictedCard(
                  'صفحة المساهمات وسجل المقترحات',
                  'لإرسال مقترحاتك المعجمية ومتابعة حالة اعتمادها من قِبل المحررين، يرجى تسجيل الدخول أو إنشاء حساب مساهم مجاني (عبر GitHub أو البريد الإلكتروني).',
                )
              ))}

            {/* 4b. Independent Member Messages & Alerts Inbox (/messages) — Strictly Members Only */}
            {activePage === 'messages' &&
              (userEmail ? (
                <MemberMessagesPage
                  messages={inboxMessages}
                  unreadCount={unreadMessagesCount}
                  canAccessEditorialTools={canAccessEditorialTools}
                  onMarkRead={(id) => void markMessageRead(id)}
                  onMarkAllRead={() => void markAllMessagesRead()}
                  onAcknowledgeWarning={(id) => void acknowledgeWarning(id)}
                  onOpenAdminMembers={() => navigatePage('members')}
                  onStartRapidReview={() => navigatePage('review')}
                  onOpenSubmissionFromMessage={(params) =>
                    void handleOpenSubmissionFromMessage(params)
                  }
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
                  entries={entries}
                  bookmarkedEntryIds={bookmarkedIds}
                  publicContributorSlug={myPublicContributorSlug}
                  sprintParticipationsCount={totalMySprintContributions}
                  sprintBadgeLabel={activeSprintProgress?.sprint.badge_label ?? null}
                  onOpenBookmarkedEntry={(entry) => handleSelectEntryAndOpenPage(entry, true)}
                  onRemoveBookmark={(id) => void removeBookmark(id)}
                  onProfileSaved={() => {
                    void syncUserSession()
                    void refreshPublicDirectory()
                  }}
                  onOpenContributorsDirectory={(slug) =>
                    navigatePage('contributors', { contributorSlug: slug ?? null })
                  }
                  onOpenPromotionModal={() => setPromotionModalOpen(true)}
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
                  totalAttestationsCount={totalAttestationsCount}
                  onClearRecovery={() => setRecoveryMode(false)}
                  onAuthChanged={syncUserSession}
                  onRemoveSyncedDrafts={removeMultipleDrafts}
                  onDraftsSyncedSuccess={() => setSubmissionsRefreshCounter((c) => c + 1)}
                  onJumpToAdminGovernance={handleJumpToAdminGovernance}
                />
              ))}

            {/* 6. Independent Editorial Moderation & Role Governance Page (/editorial) */}
            {activePage === 'editorial' &&
              (canAccessEditorialTools ? (
                <EditorModerationPanel
                  entries={entries}
                  corpusVersion={corpusVersion}
                  userEmail={userEmail}
                  profile={reviewerProfile}
                  attestationSummaries={summariesByEntryId}
                  forceGovernanceSection={forceGovernanceSection}
                  onClearForceGovernanceSection={() => setForceGovernanceSection(false)}
                  onOpenAuth={() => setAuthDialogOpen(true)}
                  onGoToExporter={handleGoToExporter}
                  onDecisionSaved={() => {
                    void refreshLiveApprovedOverlay()
                    void refreshMessages()
                    void refreshPublicDirectory()
                    setSubmissionsRefreshCounter((c) => c + 1)
                  }}
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
                  liveMembers={liveAdminMembers}
                  loadingMembers={loadingMembers}
                  liveModEvents={liveModEvents}
                  liveModReports={liveModReports}
                  sprints={sprints}
                  categories={categories}
                  initialTab={adminInitialTab}
                  onClearInitialTab={() => setAdminInitialTab(undefined)}
                  onCreateSprint={createSprint}
                  onUpdateSprintStatus={updateSprintStatus}
                  onApplyGovernanceAction={applyMemberGovernanceAction}
                  onSendMessage={sendDirectOrBroadcastMessage}
                  onSubmitReport={submitModerationReport}
                  onResolveReport={resolveModerationReport}
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
                totalAttestationsCount={totalAttestationsCount}
                onClearRecovery={() => setRecoveryMode(false)}
                onAuthChanged={syncUserSession}
                onRemoveSyncedDrafts={removeMultipleDrafts}
                onDraftsSyncedSuccess={() => setSubmissionsRefreshCounter((c) => c + 1)}
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
          totalAttestationsCount={totalAttestationsCount}
          onClearRecovery={() => setRecoveryMode(false)}
          onAuthChanged={syncUserSession}
          onRemoveSyncedDrafts={removeMultipleDrafts}
          onDraftsSyncedSuccess={() => setSubmissionsRefreshCounter((c) => c + 1)}
          onJumpToAdminGovernance={handleJumpToAdminGovernance}
        />
        <EditorPromotionModal
          open={promotionModalOpen}
          onClose={() => setPromotionModalOpen(false)}
          profile={reviewerProfile}
          userEmail={userEmail}
          acceptedCount={reviewerProfile?.accepted_count ?? 0}
          attestationsCount={totalAttestationsCount}
          onSubmitted={() => {
            void syncUserSession()
            void refreshPublicDirectory()
          }}
        />
      </Suspense>

      {/* Global Command Palette (Ctrl+K / Cmd+K) — Registered Members Only */}
      {Boolean(userEmail) && (
        <CommandPalette
          open={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          entries={entries}
          isAuthenticated={true}
          canAccessEditorialTools={canAccessEditorialTools}
          draftsCount={draftsList.length}
          onNavigatePage={navigatePage}
          onSelectEntry={(entry) => handleSelectEntryAndOpenPage(entry, true)}
          onQuickAddWord={handleQuickAddWord}
        />
      )}

      {/* Mandatory Official Warning Acknowledgment Modal — Authenticated Members Only */}
      {Boolean(userEmail) && (
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
