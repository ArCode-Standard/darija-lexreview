import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Fingerprint,
  Github,
  Globe2,
  History,
  Link2,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import type { PublicContributorRecord, UserRole } from '../../types/lexicon'
import { Avatar } from '../Avatar'
import {
  MeritBadgeChip,
  MeritBadgeEmblemIcon,
  MeritBadgeMedallionCard,
  MeritSealMedallion,
} from '../MeritBadgeVisual'
import {
  buildContributorAcademicCitation,
  downloadContributorHonorCard,
} from '../../utils/contributorHonorCard'
import {
  MERIT_BADGE_CATALOG,
  type MeritBadge,
  type MeritBadgeId,
  type MeritBadgeMilestone,
  computeContributorBadges,
  computeContributorHonorStanding,
  computeNextBadgeMilestones,
  getTierPillClasses,
} from '../../utils/meritBadges'
import { buildContributorProfileUrl } from '../../utils/urlState'
import { MOROCCAN_REGIONS } from '../../utils/validation'

interface PublicContributorsPageProps {
  contributors: PublicContributorRecord[]
  loading: boolean
  isAuthenticated: boolean
  darkMode?: boolean
  entriesCount: number
  corpusVersion: string
  onOpenProfileOrAuth: () => void
  onStartContributing: () => void
  onExploreRegionInLexicon?: (region: string) => void
  onInspectWordInLexicon?: (word: string) => void
  initialSelectedSlug?: string | null
  activeSprintBadgeLabel?: string | null
  onSelectedSlugChange?: (slug: string | null) => void
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'مشرف عام',
  editor: 'محرر معتمد',
  reviewer: 'مراجع مساهم',
}

type RoleFilter = 'all' | 'staff' | 'reviewers'
type SortOption = 'impact' | 'attestations' | 'words' | 'newest'

const BADGE_FILTER_OPTIONS: Array<{ value: 'all' | MeritBadgeId; label: string }> = [
  { value: 'all', label: 'جميع الأختام والأوسمة العلمية' },
  { value: 'senior_lexicographer', label: 'تاج المتن المغربي · موثّق معجمي متقدم' },
  { value: 'certified_editor', label: 'وسام القلم المحكَّم · محرر معتمد' },
  { value: 'attestation_guardian', label: 'أسطرلاب الشواهد · مدقّق شواهد' },
  { value: 'category_expert', label: 'خاتم الزليج الدلالي · خبير الفئات' },
  { value: 'regional_specialist', label: 'بوصلة الأطلس اللهجي · خبير لهجي جهوي' },
  { value: 'active_corrector', label: 'عدسة الضبط والتصويب · مصحح نشط' },
  { value: 'pioneer_cohort', label: 'غرسة الرعيل المؤسس · عضو الرعيل المؤسس' },
  { value: 'sprint_champion', label: 'لواء النفير المعجمي · مشارك في الحملات' },
  { value: 'verified_contributor', label: 'طابع الاعتماد المعجمي · مساهم موثّق' },
  { value: 'github_verified', label: 'عقدة النَّسَب المفتوح · هوية GitHub' },
]

const CANONICAL_REGION_KEYWORDS: Array<{ label: string; keywords: string[] }> = [
  { label: 'الدار البيضاء والوسط', keywords: ['الدار البيضاء', 'سطات', 'الوسط'] },
  { label: 'الرباط وسلا', keywords: ['الرباط', 'سلا', 'القنيطرة'] },
  { label: 'فاس ومكناس', keywords: ['فاس', 'مكناس'] },
  { label: 'الشمال وجبالة', keywords: ['الشمال', 'طنجة', 'تطوان', 'الحسيمة', 'جبالة'] },
  { label: 'مراكش والحوز', keywords: ['مراكش', 'الحوز', 'آسفي'] },
  { label: 'سوس والجنوب', keywords: ['سوس', 'أكادير', 'الجنوب', 'درعة', 'تافيلالت'] },
  { label: 'الشرق والريف', keywords: ['الشرق', 'وجدة', 'الريف', 'الناظور'] },
  { label: 'الأقاليم الصحراوية', keywords: ['الصحراوية', 'العيون', 'الداخلة', 'وادي الذهب', 'كلميم'] },
]

function formatContributorIdentitySerial(person: PublicContributorRecord): string {
  const cleanCode = person.public_slug.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()
  return `ARC-${person.joined_year}-${cleanCode.padStart(6, '0')}`
}

export function PublicContributorsPage({
  contributors,
  loading,
  isAuthenticated,
  darkMode = false,
  entriesCount,
  corpusVersion,
  onOpenProfileOrAuth,
  onStartContributing,
  onExploreRegionInLexicon,
  onInspectWordInLexicon,
  initialSelectedSlug = null,
  activeSprintBadgeLabel = null,
  onSelectedSlugChange,
}: PublicContributorsPageProps) {
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>('all')
  const [selectedBadgeFilter, setSelectedBadgeFilter] = useState<'all' | MeritBadgeId>('all')
  const [sortBy, setSortBy] = useState<SortOption>('impact')
  const [showBadgeCatalog, setShowBadgeCatalog] = useState(false)
  const [selectedContributorSlug, setSelectedContributorSlug] = useState<string | null>(
    initialSelectedSlug,
  )
  const [copiedProfileLink, setCopiedProfileLink] = useState(false)
  const [downloadedHonorCard, setDownloadedHonorCard] = useState(false)
  const [citationLang, setCitationLang] = useState<'ar' | 'en'>('ar')
  const [copiedCitation, setCopiedCitation] = useState(false)

  useEffect(() => {
    setSelectedContributorSlug(initialSelectedSlug ?? null)
  }, [initialSelectedSlug])

  const selectContributor = useCallback(
    (slug: string | null) => {
      setSelectedContributorSlug(slug)
      setCopiedProfileLink(false)
      setDownloadedHonorCard(false)
      setCopiedCitation(false)
      onSelectedSlugChange?.(slug)
    },
    [onSelectedSlugChange],
  )

  const { badgesBySlug, milestonesBySlug } = useMemo(() => {
    const badgeMap = new Map<string, MeritBadge[]>()
    const milestoneMap = new Map<string, MeritBadgeMilestone[]>()
    for (const c of contributors) {
      const badgeInput = {
        role: c.role,
        acceptedCount: c.accepted_count,
        documentedWordsCount: c.documented_words_count ?? c.accepted_count,
        attestationsCount: c.attestations_count,
        dialectRegion: c.dialect_region,
        specialty: c.specialty,
        githubHandle: c.github_handle,
        sprintParticipationsCount: c.sprint_participations_count,
        sprintBadgeLabel: activeSprintBadgeLabel ?? undefined,
        joinedYear: c.joined_year,
      }
      badgeMap.set(c.public_slug, computeContributorBadges(badgeInput))
      milestoneMap.set(c.public_slug, computeNextBadgeMilestones(badgeInput))
    }
    return { badgesBySlug: badgeMap, milestonesBySlug: milestoneMap }
  }, [contributors, activeSprintBadgeLabel])

  const badgeEarnersCountMap = useMemo(() => {
    const counts = new Map<MeritBadgeId, number>()
    for (const list of badgesBySlug.values()) {
      for (const b of list) {
        counts.set(b.id, (counts.get(b.id) ?? 0) + 1)
      }
    }
    return counts
  }, [badgesBySlug])

  // Represented regions with counts + unrepresented Moroccan regions inviting first pioneers
  const regionalBreakdown = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of contributors) {
      const reg = c.dialect_region?.trim()
      if (reg && reg !== 'مشترك عام') {
        counts.set(reg, (counts.get(reg) ?? 0) + 1)
      }
    }
    const represented = Array.from(counts.entries())
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count || a.region.localeCompare(b.region, 'ar'))

    const allRepresentedStrings = represented.map((r) => r.region).join(' | ')
    const unrepresented = CANONICAL_REGION_KEYWORDS.filter(
      (item) =>
        MOROCCAN_REGIONS.includes(item.label as (typeof MOROCCAN_REGIONS)[number]) &&
        !item.keywords.some((kw) => allRepresentedStrings.includes(kw)),
    ).map((item) => item.label)

    return { represented, unrepresented }
  }, [contributors])

  const filteredAndSortedContributors = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    const filtered = contributors.filter((c) => {
      if (roleFilter === 'staff' && c.role === 'reviewer') return false
      if (roleFilter === 'reviewers' && c.role !== 'reviewer') return false
      if (selectedRegionFilter !== 'all' && (c.dialect_region?.trim() ?? '') !== selectedRegionFilter) {
        return false
      }
      if (selectedBadgeFilter !== 'all') {
        const personBadges = badgesBySlug.get(c.public_slug) ?? []
        if (!personBadges.some((b) => b.id === selectedBadgeFilter)) return false
      }

      if (!trimmed) return true
      const haystack = [
        c.display_name,
        c.dialect_region ?? '',
        c.specialty ?? '',
        c.github_handle ?? '',
        ROLE_LABELS[c.role],
        ...(c.recent_words ?? []),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(trimmed)
    })

    return [...filtered].sort((a, b) => {
      const wordsA = a.documented_words_count ?? a.accepted_count
      const wordsB = b.documented_words_count ?? b.accepted_count
      const exA = a.documented_examples_count ?? a.attestations_count
      const exB = b.documented_examples_count ?? b.attestations_count

      if (sortBy === 'words') {
        return wordsB - wordsA || exB - exA
      }
      if (sortBy === 'attestations') {
        return exB - exA || wordsB - wordsA
      }
      if (sortBy === 'newest') {
        return b.joined_year - a.joined_year || wordsB + exB - (wordsA + exA)
      }
      return wordsB + exB - (wordsA + exA)
    })
  }, [contributors, query, roleFilter, selectedRegionFilter, selectedBadgeFilter, sortBy, badgesBySlug])

  const shouldSplitBoardAndCommunity =
    roleFilter === 'all' &&
    selectedRegionFilter === 'all' &&
    selectedBadgeFilter === 'all' &&
    query.trim() === ''

  const editorialBoardMembers = useMemo(
    () =>
      shouldSplitBoardAndCommunity
        ? filteredAndSortedContributors.filter((c) => c.role === 'admin' || c.role === 'editor')
        : [],
    [shouldSplitBoardAndCommunity, filteredAndSortedContributors],
  )

  const communityContributors = useMemo(
    () =>
      shouldSplitBoardAndCommunity
        ? filteredAndSortedContributors.filter((c) => c.role === 'reviewer')
        : filteredAndSortedContributors,
    [shouldSplitBoardAndCommunity, filteredAndSortedContributors],
  )

  const selectedPerson = useMemo(
    () =>
      selectedContributorSlug
        ? contributors.find((c) => c.public_slug === selectedContributorSlug) ?? null
        : null,
    [contributors, selectedContributorSlug],
  )

  const selectedBadges = useMemo(() => {
    if (!selectedPerson) return []
    return badgesBySlug.get(selectedPerson.public_slug) ?? []
  }, [selectedPerson, badgesBySlug])

  const selectedMilestones = useMemo(() => {
    if (!selectedPerson) return []
    return milestonesBySlug.get(selectedPerson.public_slug) ?? []
  }, [selectedPerson, milestonesBySlug])

  const selectedHonorStanding = useMemo(
    () => computeContributorHonorStanding(selectedBadges),
    [selectedBadges],
  )

  const formatBadgeScarcity = useCallback(
    (badgeId: MeritBadgeId) => {
      const count = badgeEarnersCountMap.get(badgeId) ?? 0
      const total = Math.max(1, contributors.length)
      const pct = Math.round((count / total) * 100)
      if (count === 0) return 'لم يُمنح بعد'
      if (pct <= 25) return `وسام نادر (${pct}%)`
      return `يحمله ${count} مساهم`
    },
    [badgeEarnersCountMap, contributors.length],
  )

  const selectedCitations = useMemo(() => {
    if (!selectedPerson) return null
    return buildContributorAcademicCitation(
      selectedPerson,
      corpusVersion,
      undefined,
      selectedBadges,
    )
  }, [selectedPerson, corpusVersion, selectedBadges])

  useEffect(() => {
    if (!selectedPerson) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        selectContributor(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedPerson, selectContributor])

  async function handleCopyContributorPermalink(slug: string) {
    const shareHref = buildContributorProfileUrl(slug)
    try {
      await navigator.clipboard.writeText(shareHref)
      setCopiedProfileLink(true)
      window.setTimeout(() => setCopiedProfileLink(false), 2200)
    } catch {
      // Clipboard unavailable
    }
  }

  function handleDownloadHonorCard(person: PublicContributorRecord) {
    const badges = badgesBySlug.get(person.public_slug) ?? []
    const ok = downloadContributorHonorCard(person, badges, {
      corpusVersion,
      theme: darkMode ? 'dark' : 'light',
    })
    if (ok) {
      setDownloadedHonorCard(true)
      window.setTimeout(() => setDownloadedHonorCard(false), 2400)
    }
  }

  async function handleCopyAcademicCitation() {
    if (!selectedCitations) return
    const text = citationLang === 'ar' ? selectedCitations.arabic : selectedCitations.english
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCitation(true)
      window.setTimeout(() => setCopiedCitation(false), 2200)
    } catch {
      // Clipboard unavailable
    }
  }

  const summary = useMemo(() => {
    const staffCount = contributors.filter((c) => c.role !== 'reviewer').length
    const regions = new Set(
      contributors
        .map((c) => c.dialect_region?.trim())
        .filter((r): r is string => Boolean(r)),
    )
    const totalAccepted = contributors.reduce((acc, c) => acc + c.accepted_count, 0)
    const totalAttestations = contributors.reduce((acc, c) => acc + c.attestations_count, 0)
    const totalEarnedBadges = Array.from(badgesBySlug.values()).reduce(
      (acc, list) => acc + list.length,
      0,
    )
    return {
      total: contributors.length,
      staffCount,
      regionsCount: regions.size,
      totalAccepted,
      totalAttestations,
      totalEarnedBadges,
    }
  }, [contributors, badgesBySlug])

  const hasActiveFilters =
    query.trim() !== '' ||
    roleFilter !== 'all' ||
    selectedRegionFilter !== 'all' ||
    selectedBadgeFilter !== 'all'

  function renderContributorCard(person: PublicContributorRecord, isEditorialBoardCard = false) {
    const badges = badgesBySlug.get(person.public_slug) ?? []
    const nextMilestone = (milestonesBySlug.get(person.public_slug) ?? [])[0] ?? null
    const wordsCount = person.documented_words_count ?? person.accepted_count
    const examplesCount = person.documented_examples_count ?? person.attestations_count
    const recentWords = (person.recent_words ?? []).slice(0, 3)

    return (
      <article
        key={person.public_slug}
        role="button"
        tabIndex={0}
        aria-label={`عرض بطاقة الهوية المعجمية للمساهم ${person.display_name}`}
        onClick={() => selectContributor(person.public_slug)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            selectContributor(person.public_slug)
          }
        }}
        className={`group flex flex-col justify-between rounded-2xl border p-5 sm:p-6 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 cursor-pointer dark:focus-visible:outline-[#D9FF43] ${
          isEditorialBoardCard
            ? 'border-zinc-300/90 bg-white hover:border-zinc-950 dark:border-white/15 dark:bg-[#0B0B10] dark:hover:border-[#D9FF43]/65'
            : 'border-zinc-200 bg-white hover:border-zinc-400 dark:border-white/10 dark:bg-[#0B0B10] dark:hover:border-[#D9FF43]/50'
        }`}
      >
        <div className="space-y-3.5">
          {/* Top Identity Row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <Avatar
                source={person.avatar_source}
                path={person.avatar_path}
                seed={person.avatar_seed || person.public_slug}
                githubHandle={person.github_handle}
                displayName={person.display_name}
                size={isEditorialBoardCard ? 52 : 46}
                className="ring-1 ring-zinc-200 dark:ring-white/15"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-[#D9FF43]">
                  <span>{ROLE_LABELS[person.role]}</span>
                  <span aria-hidden="true" className="text-zinc-400">
                    ·
                  </span>
                  <span className="font-normal text-zinc-500 dark:text-zinc-400">
                    انضم {person.joined_year}
                  </span>
                </div>
                <h3 className="mt-0.5 truncate font-display text-base sm:text-lg font-bold text-zinc-950 group-hover:text-emerald-800 transition-colors dark:text-white dark:group-hover:text-[#D9FF43]">
                  {person.display_name}
                </h3>
              </div>
            </div>

            {person.github_handle && (
              <a
                href={`https://github.com/${encodeURIComponent(person.github_handle)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={`حساب GitHub: @${person.github_handle}`}
                className="inline-flex h-8 shrink-0 items-center gap-1 font-mono text-xs text-zinc-500 hover:text-zinc-950 hover:underline dark:text-zinc-400 dark:hover:text-[#D9FF43]"
              >
                <Github className="h-3.5 w-3.5 shrink-0" />
                <span dir="ltr" className="max-w-[96px] truncate">
                  @{person.github_handle}
                </span>
              </a>
            )}
          </div>

          {/* Region & Specialty */}
          <div className="space-y-1 text-xs">
            {person.dialect_region && (
              <p className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                <Globe2 className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-[#D9FF43]" />
                <span>{person.dialect_region}</span>
              </p>
            )}
            {person.specialty && (
              <p className="line-clamp-2 leading-relaxed text-zinc-600 dark:text-zinc-400">
                {person.specialty}
              </p>
            )}
          </div>

          {/* Visual Achievement Badges System */}
          {badges.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5" aria-label="أوسمة الإنجاز المعجمي">
              {badges.slice(0, 4).map((badge) => (
                <MeritBadgeChip key={badge.id} badge={badge} size="sm" />
              ))}
              {badges.length > 4 && (
                <span className="rounded-lg border border-zinc-200 px-2 py-0.5 font-mono text-[10px] font-semibold text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                  +{badges.length - 4}
                </span>
              )}
            </div>
          )}

          {/* Sample Documented Words directly on card */}
          {recentWords.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <span>من توثيقاته:</span>
              {recentWords.map((word, idx) => (
                <span key={word} className="inline-flex items-center gap-1">
                  {idx > 0 && <span aria-hidden="true">·</span>}
                  {onInspectWordInLexicon ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onInspectWordInLexicon(word)
                      }}
                      className="font-semibold text-zinc-900 hover:text-emerald-700 hover:underline cursor-pointer dark:text-zinc-200 dark:hover:text-[#D9FF43]"
                    >
                      «{word}»
                    </button>
                  ) : (
                    <strong className="font-semibold text-zinc-900 dark:text-zinc-200">
                      «{word}»
                    </strong>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Section: Visual Next-Badge Progress Bar + Tabular Metrics */}
        <div className="mt-4 space-y-3 border-t border-zinc-100 pt-3.5 dark:border-white/10">
          {nextMilestone ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="inline-flex min-w-0 items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                  <MeritBadgeEmblemIcon
                    icon={nextMilestone.badge.icon}
                    className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-[#D9FF43]"
                  />
                  <span className="truncate">
                    الوسام القادم:{' '}
                    <strong className="font-semibold text-zinc-950 dark:text-zinc-100">
                      {nextMilestone.badge.sealName}
                    </strong>{' '}
                    <span className="text-zinc-500 dark:text-zinc-400">
                      ({nextMilestone.badge.label})
                    </span>
                  </span>
                </span>

                <span className="shrink-0 font-mono text-[10.5px] font-semibold tabular-nums text-emerald-700 dark:text-[#D9FF43]">
                  {nextMilestone.remainingLabel} · {nextMilestone.current}/{nextMilestone.target}
                </span>
              </div>

              <div
                role="progressbar"
                aria-label={`التقدم نحو وسام ${nextMilestone.badge.label}: ${nextMilestone.remainingLabel}`}
                aria-valuenow={nextMilestone.current}
                aria-valuemin={0}
                aria-valuemax={nextMilestone.target}
                className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200/90 dark:bg-white/10"
              >
                <div
                  style={{ width: `${Math.max(8, nextMilestone.percent)}%` }}
                  className={`h-full rounded-full transition-all ${
                    nextMilestone.badge.tier === 'sovereign'
                      ? 'bg-amber-600 dark:bg-[#D9FF43]'
                      : 'bg-emerald-600 dark:bg-[#D9FF43]'
                  }`}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-semibold text-emerald-800 dark:text-[#D9FF43]">
                  أتمّ جميع أختام الاستحقاق المعجمية
                </span>
                <span className="font-mono text-[10.5px] font-semibold tabular-nums text-emerald-700 dark:text-[#D9FF43]">
                  100%
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="اكتمال جميع أختام الاستحقاق المعجمية"
                aria-valuenow={100}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200/90 dark:bg-white/10"
              >
                <div className="h-full w-full rounded-full bg-emerald-600 dark:bg-[#D9FF43]" />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-xs">
            <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <span>
                مفردات:{' '}
                <strong className="font-mono font-bold tabular-nums text-zinc-950 dark:text-white">
                  {wordsCount.toLocaleString('en-US')}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                شواهد:{' '}
                <strong className="font-mono font-bold tabular-nums text-emerald-700 dark:text-[#D9FF43]">
                  {examplesCount.toLocaleString('en-US')}
                </strong>
              </span>
            </div>

            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 group-hover:underline whitespace-nowrap shrink-0 dark:text-[#D9FF43]">
              <span>بطاقة الهوية</span>
              <ArrowLeft className="h-3 w-3" aria-hidden="true" />
            </span>
          </div>
        </div>
      </article>
    )
  }

  return (
    <section className="space-y-6" aria-labelledby="contributors-honor-title">
      {/* 1. Unified Institutional Monograph Summary Strip */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 dark:border-white/10 dark:bg-[#0B0B10]">
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4 lg:divide-x lg:divide-x-reverse lg:divide-zinc-200 dark:lg:divide-white/10">
          <div className="lg:ps-0 lg:pe-5">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              المساهمون المعلنون
            </p>
            <p className="mt-1 font-mono text-2xl sm:text-3xl font-bold tabular-nums text-zinc-950 dark:text-white">
              {summary.total.toLocaleString('en-US')}
            </p>
            <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
              مساهم ومحرر اختاروا الظهور العام
            </p>
          </div>

          <div className="lg:px-5">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              الهيئة التحريرية والإشراف
            </p>
            <p className="mt-1 font-mono text-2xl sm:text-3xl font-bold tabular-nums text-emerald-700 dark:text-[#D9FF43]">
              {summary.staffCount.toLocaleString('en-US')}
            </p>
            <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
              محررون معتمدون ومشرفون على المتن
            </p>
          </div>

          <div className="lg:px-5">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              التغطية الجهوية المغربية
            </p>
            <p className="mt-1 font-mono text-2xl sm:text-3xl font-bold tabular-nums text-zinc-950 dark:text-white">
              {summary.regionsCount.toLocaleString('en-US')}
            </p>
            <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
              منطقة لهجية ممثَّلة بموثّقين
            </p>
          </div>

          <div className="lg:ps-5 lg:pe-0">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              الأثر والأوسمة الممنوحة
            </p>
            <p className="mt-1 font-mono text-2xl sm:text-3xl font-bold tabular-nums text-zinc-950 dark:text-white">
              {(summary.totalAccepted + summary.totalAttestations).toLocaleString('en-US')}
            </p>
            <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
              مساهمة وتصديق · {summary.totalEarnedBadges.toLocaleString('en-US')} وسام مستحق
            </p>
          </div>
        </div>

        {/* 2. Interactive Moroccan Regional Representation & Pioneer Invitation Strip */}
        {(regionalBreakdown.represented.length > 0 ||
          regionalBreakdown.unrepresented.length > 0) && (
          <div className="mt-5 space-y-2.5 border-t border-zinc-200 pt-4 dark:border-white/10">
            {regionalBreakdown.represented.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-700 dark:text-zinc-300">
                  <Globe2 className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
                  <span>التوزيع الجهوي للموثّقين:</span>
                </span>

                <button
                  type="button"
                  onClick={() => setSelectedRegionFilter('all')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                    selectedRegionFilter === 'all'
                      ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                      : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                  }`}
                >
                  كل الجهات
                </button>

                {regionalBreakdown.represented.map((item) => (
                  <button
                    key={item.region}
                    type="button"
                    onClick={() =>
                      setSelectedRegionFilter((prev) =>
                        prev === item.region ? 'all' : item.region,
                      )
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                      selectedRegionFilter === item.region
                        ? 'border-zinc-950 bg-zinc-950 text-white dark:border-[#D9FF43] dark:bg-[#D9FF43] dark:text-[#050507]'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-400 dark:border-white/10 dark:bg-[#07070A] dark:text-zinc-300 dark:hover:border-[#D9FF43]/50'
                    }`}
                  >
                    <span>{item.region}</span>
                    <span className="font-mono text-[11px] opacity-75">({item.count})</span>
                  </button>
                ))}
              </div>
            )}

            {regionalBreakdown.unrepresented.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <p>
                  <span>جهات بانتظار أول موثّق معلَن في اللوحة: </span>
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {regionalBreakdown.unrepresented.slice(0, 4).join(' · ')}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={onOpenProfileOrAuth}
                  className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline cursor-pointer dark:text-[#D9FF43]"
                >
                  <span>كن أول موثّق معتمد لمنطقتك</span>
                  <ArrowLeft className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Search, Role, Visual Merit Badge Showcase & Sort Toolbar */}
      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#0B0B10]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 start-3.5 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-[#D9FF43]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث باسم المساهم، المنطقة اللهجية، التخصص، المفردة، أو GitHub..."
              className="min-h-[42px] w-full rounded-xl border border-zinc-200 bg-zinc-50/80 ps-10 pe-3.5 text-xs sm:text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="تصفية المساهمين حسب الدور"
              className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-white/10 dark:bg-[#07070A]"
            >
              {(
                [
                  { id: 'all', label: 'الجميع' },
                  { id: 'staff', label: 'الهيئة التحريرية' },
                  { id: 'reviewers', label: 'المساهمون' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRoleFilter(tab.id)}
                  className={`min-h-[32px] rounded-lg px-3 py-1 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    roleFilter === tab.id
                      ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                      : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onStartContributing}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800 whitespace-nowrap shrink-0 transition-colors cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>ساهم في الإثراء</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-zinc-100 pt-3 text-xs dark:border-white/8">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
              <span>الوسام:</span>
              <select
                aria-label="تصفية حسب الوسام العلمي"
                value={selectedBadgeFilter}
                onChange={(e) => setSelectedBadgeFilter(e.target.value as 'all' | MeritBadgeId)}
                className="min-h-[34px] rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-900 dark:border-white/12 dark:bg-[#07070A] dark:text-zinc-200"
              >
                {BADGE_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
              <span>الترتيب:</span>
              <select
                aria-label="ترتيب المساهمين"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="min-h-[34px] rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-900 dark:border-white/12 dark:bg-[#07070A] dark:text-zinc-200"
              >
                <option value="impact">الأوسع أثراً في التوثيق</option>
                <option value="attestations">الأكثر شواهد وتصديقاً ميدانياً</option>
                <option value="words">الأكثر مفردات موثقة</option>
                <option value="newest">الأحدث انضماماً</option>
              </select>
            </label>

            <button
              type="button"
              aria-expanded={showBadgeCatalog}
              onClick={() => setShowBadgeCatalog((prev) => !prev)}
              className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                showBadgeCatalog
                  ? 'border-zinc-950 bg-zinc-950 text-white dark:border-[#D9FF43] dark:bg-[#D9FF43] dark:text-[#050507]'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-400 dark:border-white/12 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60'
              }`}
            >
              <Award className="h-3.5 w-3.5" />
              <span>دليل الأوسمة ومعايير الاستحقاق ({MERIT_BADGE_CATALOG.length})</span>
            </button>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setRoleFilter('all')
                setSelectedRegionFilter('all')
                setSelectedBadgeFilter('all')
              }}
              className="font-semibold text-emerald-700 hover:underline cursor-pointer dark:text-[#D9FF43]"
            >
              إعادة ضبط الفلاتر ({filteredAndSortedContributors.length})
            </button>
          )}
        </div>

        {/* Exclusive Moroccan Lexicon Seals Charter & Filter Drawer */}
        {showBadgeCatalog && (
          <div className="mt-2 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 sm:p-5 dark:border-white/10 dark:bg-[#07070A]">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-zinc-200/80 pb-3 dark:border-white/10">
              <div>
                <p className="font-display text-sm font-bold text-zinc-950 dark:text-white">
                  ميثاق أختام وأوسمة المعجم المغربي المفتوح (3 مراتب استحقاق)
                </p>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  أختام هندسية مستوحاة من الزليج المغربي والأسطرلاب المراكشي والقلم المبسوط — انقر على أي ختم لتصفية حامليه:
                </p>
              </div>
              {selectedBadgeFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedBadgeFilter('all')}
                  className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer dark:text-[#D9FF43]"
                >
                  عرض جميع الأختام
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {MERIT_BADGE_CATALOG.map((badge) => {
                const active = selectedBadgeFilter === badge.id
                const earnersCount = badgeEarnersCountMap.get(badge.id) ?? 0
                const tierColor = getTierPillClasses(badge.tier)
                return (
                  <button
                    key={badge.id}
                    type="button"
                    onClick={() =>
                      setSelectedBadgeFilter((prev) => (prev === badge.id ? 'all' : badge.id))
                    }
                    className={`flex items-start gap-3 rounded-xl border p-3.5 text-start transition-colors cursor-pointer ${
                      active
                        ? 'border-zinc-950 bg-white dark:border-[#D9FF43] dark:bg-[#0B0B10]'
                        : badge.tier === 'sovereign'
                          ? 'border-amber-300/70 bg-white/95 hover:border-amber-500 dark:border-[#D9FF43]/25 dark:bg-[#0B0B10]/90 dark:hover:border-[#D9FF43]/60'
                          : 'border-zinc-200/85 bg-white/85 hover:border-zinc-400 dark:border-white/10 dark:bg-[#0B0B10]/75 dark:hover:border-white/25'
                    }`}
                  >
                    <MeritSealMedallion
                      icon={badge.icon}
                      tone={badge.tone}
                      tier={badge.tier}
                      size={42}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[10px]">
                        <span className={`font-bold ${tierColor}`}>{badge.tierLabel}</span>
                        <span className="font-mono text-zinc-500 dark:text-zinc-400">
                          {earnersCount} مساهم · {badge.code}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-zinc-950 dark:text-white">
                        {badge.sealName}{' '}
                        <span className="font-medium text-zinc-600 dark:text-zinc-300">
                          · {badge.label}
                        </span>
                      </p>
                      <p className="text-[11px] leading-5 text-zinc-600 dark:text-zinc-400">
                        {badge.criteria}
                      </p>
                      <p className="text-[10.5px] leading-4 text-emerald-800/90 dark:text-zinc-300">
                        {badge.valueStatement}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4. Contributors Honor Sections (Editorial Board + Community Lexicographers) */}
      {loading ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center text-sm text-zinc-500 dark:border-white/10 dark:bg-[#0B0B10] dark:text-zinc-400">
          جارٍ تحميل لوحة شرف المساهمين…
        </div>
      ) : filteredAndSortedContributors.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center dark:border-white/10 dark:bg-[#0B0B10]">
          <Users className="mx-auto h-8 w-8 text-zinc-400 dark:text-zinc-500" />
          <h3 className="mt-3 font-display text-base font-bold text-zinc-950 dark:text-white">
            لا توجد نتائج مطابقة للبحث أو التصفية الحالية
          </h3>
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            جرّب تعديل الفلتر، أو كن من أوائل الموثّقين المعتمدين في منطقتك اللهجية.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {editorialBoardMembers.length > 0 && (
            <div className="space-y-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="font-mono text-[11px] tracking-[0.14em] uppercase text-emerald-700 dark:text-[#D9FF43]">
                    EDITORIAL & SCIENTIFIC BOARD
                  </p>
                  <h3 className="font-display text-lg sm:text-xl font-bold text-zinc-950 dark:text-white">
                    الهيئة التحريرية والعلمية المشرفة ({editorialBoardMembers.length})
                  </h3>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  تحكيم المقترحات المعجمية ومراجعة دقة الشواهد السياقية قبل اعتماد الإصدارات
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {editorialBoardMembers.map((person) => renderContributorCard(person, true))}
              </div>
            </div>
          )}

          {communityContributors.length > 0 && (
            <div className="space-y-3.5">
              {editorialBoardMembers.length > 0 && (
                <div className="flex flex-wrap items-baseline justify-between gap-2 pt-2">
                  <div>
                    <p className="font-mono text-[11px] tracking-[0.14em] uppercase text-emerald-700 dark:text-[#D9FF43]">
                      VERIFIED FIELD CONTRIBUTORS
                    </p>
                    <h3 className="font-display text-lg sm:text-xl font-bold text-zinc-950 dark:text-white">
                      مجتمع الموثّقين والمساهمين المعتمدين ({communityContributors.length})
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    إغناء المفردات والتصديق الميداني للتداول اللهجي عبر جهات المغرب
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {communityContributors.map((person) => renderContributorCard(person, false))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Institutional Corpus Attribution & Privacy Guarantee Charter */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-[#0B0B10]">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-[#D9FF43]">
            <CheckCircle2 className="h-4 w-4" />
            <span>النَّسَب العلمي للمتن · الإصدار v{corpusVersion}</span>
          </div>
          <h3
            id="contributors-honor-title"
            className="mt-2 font-display text-lg font-bold text-zinc-950 dark:text-white"
          >
            النَّسَب العلمي للمتن المفتوح ({entriesCount.toLocaleString('en-US')} مدخل)
          </h3>
          <p className="mt-2 text-xs sm:text-sm leading-7 text-zinc-600 dark:text-zinc-400">
            يُبنى متن <strong>ArCode Moroccan Darija Lexicon</strong> بجهد تشاركي مفتوح بين اللسانيين والمطورين والناطقين بالدارجة في مختلف جهات المغرب، وتُحفظ حقوق النَّسَب العلمي لجميع المساهمين المعتمدين وفق رخصة البيانات المفتوحة.
          </p>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-[#0B0B10]">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-[#D9FF43]">
              <ShieldCheck className="h-4 w-4" />
              <span>ضمان الخصوصية والتحكم في الظهور العام</span>
            </div>
            <h3 className="mt-2 font-display text-lg font-bold text-zinc-950 dark:text-white">
              تحكم كامل بخصوصية ظهورك العلني
            </h3>
            <p className="mt-2 text-xs sm:text-sm leading-7 text-zinc-600 dark:text-zinc-400">
              لا تكشف هذه الصفحة البريد الإلكتروني أو المعرّفات الخاصة لأي عضو، ولا تُعرض بطاقة الهوية إلا لمن فعّل الظهور العام. يمكنك في أي وقت تفعيل أو إيقاف ظهور اسمك من إعدادات ملفك الشخصي.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenProfileOrAuth}
              className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-zinc-300 bg-zinc-50 px-4 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 whitespace-nowrap shrink-0 cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-100 dark:hover:border-[#D9FF43]/60"
            >
              <UserPlus className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
              <span>
                {isAuthenticated
                  ? 'إدارة ظهور اسمي وأوسمتي في ملفي الشخصي'
                  : 'أنشئ حساب مساهم لتوثيق اسمك معنا'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 5. Contributor Official Identity Card Modal (بطاقة الهوية المعجمية للمساهم) */}
      {selectedPerson && (() => {
        const wordsCount = selectedPerson.documented_words_count ?? selectedPerson.accepted_count
        const examplesCount =
          selectedPerson.documented_examples_count ?? selectedPerson.attestations_count
        const totalImpact = Math.max(1, wordsCount + examplesCount)
        const wordsRatio = Math.round((wordsCount / totalImpact) * 100)
        const serialId = formatContributorIdentitySerial(selectedPerson)

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs"
            onClick={() => selectContributor(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="contributor-profile-dialog-title"
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 sm:p-7 text-zinc-950 shadow-2xl dark:border-white/15 dark:bg-[#0B0B10] dark:text-white"
            >
              {/* Identity Card Official Top Band */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-[11px] dark:border-white/10 dark:bg-[#07070A]">
                <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-[#D9FF43]">
                  <Fingerprint className="h-3.5 w-3.5 shrink-0" />
                  <span>بطاقة الهوية المعجمية للمساهم</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-zinc-500 dark:text-zinc-400">
                  <span dir="ltr">{serialId}</span>
                  <span aria-hidden="true">·</span>
                  <span>الإصدار v{corpusVersion}</span>
                </div>
              </div>

              {/* Identity Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-white/10">
                <div className="flex items-center gap-4 min-w-0">
                  <Avatar
                    source={selectedPerson.avatar_source}
                    path={selectedPerson.avatar_path}
                    seed={selectedPerson.avatar_seed || selectedPerson.public_slug}
                    githubHandle={selectedPerson.github_handle}
                    displayName={selectedPerson.display_name}
                    size={68}
                    className="ring-2 ring-emerald-600/30 shrink-0 dark:ring-[#D9FF43]/40"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-[#D9FF43]">
                      <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
                      <span>{ROLE_LABELS[selectedPerson.role]}</span>
                      <span aria-hidden="true" className="text-zinc-400">
                        ·
                      </span>
                      <span className="inline-flex items-center gap-1 font-normal text-zinc-500 dark:text-zinc-400">
                        <Calendar className="h-3 w-3" />
                        <span>عضو منذ {selectedPerson.joined_year}</span>
                      </span>
                    </div>
                    <h2
                      id="contributor-profile-dialog-title"
                      className="mt-1 truncate font-display text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white"
                    >
                      {selectedPerson.display_name}
                    </h2>
                    {selectedPerson.github_handle && (
                      <a
                        href={`https://github.com/${encodeURIComponent(selectedPerson.github_handle)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-xs text-zinc-600 hover:text-zinc-950 hover:underline dark:text-zinc-400 dark:hover:text-[#D9FF43]"
                      >
                        <Github className="h-3.5 w-3.5 shrink-0" />
                        <span dir="ltr">@{selectedPerson.github_handle}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDownloadHonorCard(selectedPerson)}
                    title="تنزيل بطاقة شرف المساهم الرسمية كصورة عالية الدقة"
                    className="inline-flex h-10 items-center gap-1.5 rounded-full bg-zinc-950 px-3.5 text-xs font-bold text-white hover:bg-zinc-800 transition-colors cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
                  >
                    {downloadedHonorCard ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>تم التنزيل</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5" />
                        <span>بطاقة الشرف (صورة)</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleCopyContributorPermalink(selectedPerson.public_slug)}
                    title="نسخ الرابط المباشر لبطاقة المساهم"
                    className="inline-flex h-10 items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3.5 text-xs font-semibold text-zinc-700 hover:border-zinc-400 hover:text-zinc-950 transition-colors cursor-pointer dark:border-white/12 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60"
                  >
                    {copiedProfileLink ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
                        <span>تم النسخ</span>
                      </>
                    ) : (
                      <>
                        <Link2 className="h-3.5 w-3.5" />
                        <span>رابط البطاقة</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => selectContributor(null)}
                    aria-label="إغلاق البطاقة التعريفية"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 hover:border-zinc-400 hover:text-zinc-950 transition-colors cursor-pointer dark:border-white/12 dark:text-zinc-300 dark:hover:border-white/30 dark:hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Dialect Region & Specialty */}
              <div className="mt-5 grid grid-cols-1 gap-4 border-b border-zinc-200 pb-5 sm:grid-cols-2 dark:border-white/10">
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">المنطقة اللهجية</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-zinc-950 dark:text-white">
                    <Globe2 className="h-4 w-4 shrink-0 text-emerald-700 dark:text-[#D9FF43]" />
                    <span>{selectedPerson.dialect_region || 'مشترك عام (مختلف الجهات)'}</span>
                  </p>
                  {selectedPerson.dialect_region && onExploreRegionInLexicon && (
                    <button
                      type="button"
                      onClick={() => {
                        const region = selectedPerson.dialect_region
                        selectContributor(null)
                        if (region) onExploreRegionInLexicon(region)
                      }}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline whitespace-nowrap cursor-pointer dark:text-[#D9FF43]"
                    >
                      <span>استعرض مفردات هذه المنطقة</span>
                      <ArrowLeft className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">التخصص والاهتمام اللساني</p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                    {selectedPerson.specialty ||
                      'توثيق المفردات المتداولة ومراجعة الشواهد السياقية للدارجة المغربية'}
                  </p>
                </div>
              </div>

              {/* Detailed Platform Statistics & Impact Distribution */}
              <div className="mt-5 border-b border-zinc-200 pb-5 dark:border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    حصيلة التوثيق والإحصائيات في المنصة
                  </h3>
                  <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                    إجمالي البصمة المعجمية: {(wordsCount + examplesCount).toLocaleString('en-US')}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 dark:border-white/10 dark:bg-[#07070A]">
                    <p className="font-mono text-2xl font-bold tabular-nums text-zinc-950 dark:text-white">
                      {wordsCount.toLocaleString('en-US')}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                      مفردة ساهم في توثيقها
                    </p>
                  </div>

                  <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 dark:border-white/10 dark:bg-[#07070A]">
                    <p className="font-mono text-2xl font-bold tabular-nums text-emerald-700 dark:text-[#D9FF43]">
                      {examplesCount.toLocaleString('en-US')}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                      شاهد وتصديق سياقي
                    </p>
                  </div>

                  <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 dark:border-white/10 dark:bg-[#07070A]">
                    <p className="font-mono text-2xl font-bold tabular-nums text-zinc-950 dark:text-white">
                      {selectedPerson.accepted_count.toLocaleString('en-US')}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                      مقترح معجمي معتمد
                    </p>
                  </div>
                </div>

                {/* Contribution Balance Indicator */}
                {wordsCount + examplesCount > 0 && (
                  <div className="mt-3.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span>توثيق المفردات ({wordsRatio}%)</span>
                      <span>التصديق وتصحيح الشواهد ({100 - wordsRatio}%)</span>
                    </div>
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
                      <div
                        style={{ width: `${wordsRatio}%` }}
                        className="bg-zinc-900 dark:bg-white"
                      />
                      <div
                        style={{ width: `${100 - wordsRatio}%` }}
                        className="bg-emerald-600 dark:bg-[#D9FF43]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Exclusive Platform Moroccan Khatam Medallions */}
              <div className="mt-5 border-b border-zinc-200 pb-5 dark:border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    الأختام والأوسمة العلمية الخاصة بالمعجم ({selectedBadges.length})
                  </h3>
                  <span className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-[#D9FF43]">
                    {selectedHonorStanding.standingTitle} · {selectedHonorStanding.totalPoints} نقطة جدارة
                  </span>
                </div>
                {selectedBadges.length === 0 ? (
                  <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                    عضو مشارك في مجتمع التوثيق المعجمي؛ تُمنح أختام المعجم تلقائياً مع تراكم المقترحات المعتمدة والتصديقات الميدانية.
                  </p>
                ) : (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {selectedBadges.map((badge) => (
                      <MeritBadgeMedallionCard
                        key={badge.id}
                        badge={badge}
                        scarcityLabel={formatBadgeScarcity(badge.id)}
                      />
                    ))}
                  </div>
                )}

                {selectedMilestones.length > 0 && (
                  <div className="mt-4 space-y-2.5 border-t border-zinc-200/70 pt-3.5 dark:border-white/10">
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      التقدم نحو الوسام القادم
                    </p>
                    {selectedMilestones.slice(0, 2).map((m) => (
                      <div key={m.badge.id} className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-950 dark:text-white">
                            <MeritBadgeEmblemIcon
                              icon={m.badge.icon}
                              className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]"
                            />
                            <span>
                              {m.badge.sealName} · {m.badge.label}
                            </span>
                          </span>
                          <span className="font-mono text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-[#D9FF43]">
                            {m.remainingLabel} ({m.progressLabel})
                          </span>
                        </div>
                        <div
                          role="progressbar"
                          aria-label={`التقدم نحو وسام ${m.badge.label}`}
                          aria-valuenow={m.current}
                          aria-valuemin={0}
                          aria-valuemax={m.target}
                          className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10"
                        >
                          <div
                            style={{ width: `${Math.max(8, m.percent)}%` }}
                            className="h-full rounded-full bg-emerald-600 dark:bg-[#D9FF43]"
                          />
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {m.actionHint}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Chronological Platform History Timeline (تاريخه ومسيرته في المنصة) */}
              <div className="mt-5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  <History className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
                  <span>تاريخ المساهم وسجل مسيرته في المنصة</span>
                </div>

                <ol className="relative mt-3.5 ms-2.5 space-y-4 border-s border-zinc-200 ps-5 dark:border-white/15">
                  <li className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute -start-[25px] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-zinc-300 bg-white dark:border-white/25 dark:bg-[#0B0B10]"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 dark:bg-zinc-300" />
                    </span>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-xs font-bold text-zinc-950 dark:text-white">
                        الانضمام وتأسيس الهوية المعجمية
                      </p>
                      <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                        {selectedPerson.joined_year}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-6 text-zinc-600 dark:text-zinc-400">
                      تسجيل العضوية في المنصة وتوثيق النطاق اللهجي (
                      {selectedPerson.dialect_region || 'تداول مغربي عام'}).
                    </p>
                  </li>

                  {examplesCount > 0 && (
                    <li className="relative">
                      <span
                        aria-hidden="true"
                        className="absolute -start-[25px] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-emerald-600 bg-white dark:border-[#D9FF43] dark:bg-[#0B0B10]"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-[#D9FF43]" />
                      </span>
                      <p className="text-xs font-bold text-zinc-950 dark:text-white">
                        المراجعة والتصحيح الميداني للشواهد
                      </p>
                      <p className="mt-0.5 text-xs leading-6 text-zinc-600 dark:text-zinc-400">
                        أنجز {examplesCount.toLocaleString('en-US')} عملية تدقيق وتصديق سياقي لضبط صحة المعاني والشواهد الدارجة.
                      </p>
                    </li>
                  )}

                  {wordsCount > 0 && (
                    <li className="relative">
                      <span
                        aria-hidden="true"
                        className="absolute -start-[25px] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-emerald-600 bg-emerald-50 dark:border-[#D9FF43] dark:bg-[#0B0B10]"
                      >
                        <Check className="h-2.5 w-2.5 text-emerald-700 dark:text-[#D9FF43]" />
                      </span>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-xs font-bold text-zinc-950 dark:text-white">
                          اعتماد المساهمات في المتن الرسمي
                        </p>
                        <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                          Corpus v{corpusVersion}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs leading-6 text-zinc-600 dark:text-zinc-400">
                        ساهم في توثيق واعتماد {wordsCount.toLocaleString('en-US')} مفردة في الفئات الدلالية للمعجم.
                      </p>
                      {selectedPerson.recent_words && selectedPerson.recent_words.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {selectedPerson.recent_words.map((word) => (
                            <button
                              key={word}
                              type="button"
                              disabled={!onInspectWordInLexicon}
                              onClick={() => {
                                selectContributor(null)
                                onInspectWordInLexicon?.(word)
                              }}
                              className="inline-flex min-h-[30px] items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-900 hover:border-zinc-400 whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-default dark:border-white/12 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60"
                            >
                              <BookOpen className="h-3 w-3 text-emerald-700 dark:text-[#D9FF43]" />
                              <span>{word}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  )}

                  <li className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute -start-[25px] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-emerald-600 bg-white dark:border-[#D9FF43] dark:bg-[#0B0B10]"
                    >
                      <Award className="h-2.5 w-2.5 text-emerald-700 dark:text-[#D9FF43]" />
                    </span>
                    <p className="text-xs font-bold text-zinc-950 dark:text-white">
                      المرتبة العلمية الحالية: {ROLE_LABELS[selectedPerson.role]}
                    </p>
                    <p className="mt-0.5 text-xs leading-6 text-zinc-600 dark:text-zinc-400">
                      حاز {selectedBadges.length.toLocaleString('en-US')} أوسمة استحقاق علمية موثقة في سجل الشرف العام.
                    </p>
                  </li>
                </ol>
              </div>

              {/* Academic CV / Bio Attestation Snippet (AR / EN) */}
              {selectedCitations && (
                <div className="mt-5 border-t border-zinc-200 pt-5 dark:border-white/10">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      <Quote className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
                      <span>صيغة إشهاد مرجعي للسيرة الذاتية والملف الأكاديمي</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div
                        role="group"
                        aria-label="لغة صيغة الإشهاد"
                        className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 text-[11px] dark:border-white/10 dark:bg-[#07070A]"
                      >
                        <button
                          type="button"
                          onClick={() => setCitationLang('ar')}
                          className={`rounded-md px-2 py-0.5 font-semibold cursor-pointer ${
                            citationLang === 'ar'
                              ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                              : 'text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          العربية
                        </button>
                        <button
                          type="button"
                          onClick={() => setCitationLang('en')}
                          className={`rounded-md px-2 py-0.5 font-mono font-semibold cursor-pointer ${
                            citationLang === 'en'
                              ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                              : 'text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          EN / CV
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleCopyAcademicCitation()}
                        className="inline-flex min-h-[28px] items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-800 hover:border-zinc-400 cursor-pointer dark:border-white/12 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60"
                      >
                        {copiedCitation ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-700 dark:text-[#D9FF43]" />
                            <span>تم النسخ</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>نسخ الصيغة</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <p
                    dir={citationLang === 'en' ? 'ltr' : 'rtl'}
                    className={`mt-2.5 rounded-xl border border-zinc-200 bg-zinc-50/90 p-3.5 text-xs leading-6 text-zinc-700 select-all dark:border-white/10 dark:bg-[#07070A] dark:text-zinc-300 ${
                      citationLang === 'en' ? 'font-mono text-left' : ''
                    }`}
                  >
                    {citationLang === 'ar' ? selectedCitations.arabic : selectedCitations.english}
                  </p>
                </div>
              )}

              {/* Modal Footer */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => selectContributor(null)}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-zinc-300 bg-white px-5 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 whitespace-nowrap shrink-0 cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:border-white/35"
                >
                  إغلاق
                </button>

                <button
                  type="button"
                  onClick={() => {
                    selectContributor(null)
                    onStartContributing()
                  }}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-zinc-950 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>شارك في توثيق المعجم</span>
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </section>
  )
}
