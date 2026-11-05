import { useCallback, useEffect, useMemo, useState } from 'react'
import type { UserIdentity } from '@supabase/supabase-js'
import {
  Activity,
  ArrowLeft,
  Award,
  BadgeCheck,
  Bookmark,
  BookOpen,
  Check,
  Copy,
  Eye,
  Github,
  Link2,
  LogOut,
  Save,
  Trash2,
  TrendingUp,
  Trophy,
  Unlink,
  UserRound,
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { Avatar, type AvatarSource } from '../Avatar'
import type { LexicalEntry, PublicContributorRecord, ReviewerProfile, SubmissionRecord } from '../../types/lexicon'
import { humanizeSystemError } from '../../utils/humanizeError'
import { getGitHubLogin } from '../../utils/githubIdentity'
import { MeritSealMedallion } from '../MeritBadgeVisual'
import {
  ChampionPodiumBadge,
  MoroccanRankMedal,
  RankBadgeChip,
} from '../ContributorRankVisual'
import { LexicalFootprintRadar } from '../LexicalFootprintRadar'
import {
  computeContributorRank,
} from '../../utils/contributorRanks'
import {
  computeContributorBadges,
  computeContributorHonorStanding,
  computeNextBadgeMilestones,
} from '../../utils/meritBadges'
import { buildContributorProfileUrl } from '../../utils/urlState'
import { MOROCCAN_REGIONS } from '../../utils/validation'
import {
  getLocalPublicListedFallback,
  saveLocalPublicListedFallback,
} from '../../hooks/useCommunityGovernanceAndMessages'

interface ContributorProfilePanelProps {
  profile: ReviewerProfile | null
  userEmail: string | null
  entries?: LexicalEntry[]
  bookmarkedEntryIds?: string[]
  publicContributorSlug?: string | null
  contributors?: PublicContributorRecord[]
  corpusVersion?: string
  sprintParticipationsCount?: number
  sprintBadgeLabel?: string | null
  onOpenBookmarkedEntry?: (entry: LexicalEntry) => void
  onRemoveBookmark?: (entryId: string) => void
  onProfileSaved: () => void
  onOpenContributorsDirectory?: (slug?: string | null) => void
  onOpenPromotionModal?: () => void
}

const roleLabels = { reviewer: 'مراجع مساهم', editor: 'محرر معتمد', admin: 'مشرف عام' } as const

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.1 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  )
}

export function ContributorProfilePanel({
  profile,
  userEmail,
  entries = [],
  bookmarkedEntryIds = [],
  publicContributorSlug = null,
  contributors = [],
  sprintParticipationsCount = 0,
  sprintBadgeLabel = null,
  onOpenBookmarkedEntry,
  onRemoveBookmark,
  onProfileSaved,
  onOpenContributorsDirectory,
  onOpenPromotionModal,
}: ContributorProfilePanelProps) {
  const [name, setName] = useState(profile?.display_name ?? '')
  const [region, setRegion] = useState(profile?.dialect_region ?? '')
  const [specialty, setSpecialty] = useState(profile?.specialty ?? '')
  const [github, setGithub] = useState(profile?.github_handle ?? '')
  const [contactEmail, setContactEmail] = useState('')
  const [shareContactEmail, setShareContactEmail] = useState(false)
  const [avatarSource, setAvatarSource] = useState<AvatarSource>(profile?.avatar_source ?? 'arcode')
  const [avatarPath, setAvatarPath] = useState<string | null>(profile?.avatar_path ?? null)
  const [avatarSeed, setAvatarSeed] = useState(profile?.avatar_seed || profile?.id || 'darija-lexreview')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [publicListed, setPublicListed] = useState<boolean>(
    profile?.public_listed ?? getLocalPublicListedFallback(profile?.id),
  )
  const [copiedPublicUrl, setCopiedPublicUrl] = useState(false)
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([])
  const [attestationsCount, setAttestationsCount] = useState(0)
  const [identities, setIdentities] = useState<UserIdentity[]>([])
  const [linkingProvider, setLinkingProvider] = useState<'github' | 'google' | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase && profile))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activityError, setActivityError] = useState<string | null>(null)
  const [dbContributors, setDbContributors] = useState<PublicContributorRecord[]>([])

  const bookmarkedEntries = useMemo(() => {
    if (!bookmarkedEntryIds.length || !entries.length) return []
    const byId = new Map(entries.map((e) => [e.id, e]))
    return bookmarkedEntryIds
      .map((id) => byId.get(id))
      .filter((e): e is LexicalEntry => Boolean(e))
  }, [bookmarkedEntryIds, entries])

  const resolvedPublicSlug = useMemo(() => {
    if (publicContributorSlug) return publicContributorSlug
    if (profile?.id) return `self-${profile.id.slice(0, 8)}`
    return null
  }, [publicContributorSlug, profile?.id])

  const directContributorUrl = useMemo(
    () => (resolvedPublicSlug ? buildContributorProfileUrl(resolvedPublicSlug) : null),
    [resolvedPublicSlug],
  )

  async function handleCopyMyContributorUrl() {
    if (!directContributorUrl) return
    try {
      await navigator.clipboard.writeText(directContributorUrl)
      setCopiedPublicUrl(true)
      window.setTimeout(() => setCopiedPublicUrl(false), 2200)
    } catch {
      // Ignore clipboard unavailability
    }
  }

  useEffect(() => {
    setName(profile?.display_name ?? '')
    setRegion(profile?.dialect_region ?? '')
    setSpecialty(profile?.specialty ?? '')
    setGithub(profile?.github_handle ?? '')
    setAvatarSource(profile?.avatar_source ?? 'arcode')
    setAvatarPath(profile?.avatar_path ?? null)
    setAvatarSeed(profile?.avatar_seed || profile?.id || 'darija-lexreview')
    setPublicListed(profile?.public_listed ?? getLocalPublicListedFallback(profile?.id))
  }, [profile])

  useEffect(() => {
    let active = true
    async function loadContactPreferences() {
      if (!supabase || !profile?.id) {
        setContactEmail('')
        setShareContactEmail(false)
        return
      }
      const { data, error: contactError } = await supabase
        .from('member_contact_preferences')
        .select('contact_email, share_with_admins')
        .eq('user_id', profile.id)
        .maybeSingle()
      if (!active) return
      if (contactError) {
        setContactEmail('')
        setShareContactEmail(false)
        return
      }
      setContactEmail(data?.contact_email ?? '')
      setShareContactEmail(data?.share_with_admins ?? false)
    }
    void loadContactPreferences()
    return () => { active = false }
  }, [profile?.id])

  const loadIdentities = useCallback(async () => {
    if (!supabase || !userEmail) return
    const res = await supabase.auth.getUserIdentities()
    if (!res.error && res.data?.identities) {
      setIdentities(res.data.identities)
    }
  }, [userEmail])

  useEffect(() => {
    void loadIdentities()
  }, [loadIdentities])

  useEffect(() => {
    let active = true
    async function loadActivity() {
      if (!supabase || !profile) {
        setLoading(false)
        return
      }
      setLoading(true)
      const [submissionsResult, attestationsResult, profilesResult] = await Promise.all([
        supabase
          .from('review_submissions')
          .select('id, entry_id, status, created_at, updated_at, editor_note, reviewer_note, proposed_data, evidence')
          .eq('reviewer_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('community_attestations')
          .select('id', { count: 'exact', head: true })
          .eq('reviewer_id', profile.id),
        supabase
          .from('reviewer_profiles')
          .select('id, display_name, role, dialect_region, specialty, github_handle, avatar_source, avatar_path, avatar_seed, created_at, public_listed')
          .limit(100),
      ])
      if (!active) return
      if (submissionsResult.error || attestationsResult.error) {
        setActivityError('تعذر تحميل سجل النشاط بالكامل. أعد تحميل الصفحة أو تحقق من صلاحيات الحساب.')
      } else {
        setActivityError(null)
        setSubmissions((submissionsResult.data ?? []) as SubmissionRecord[])
        setAttestationsCount(attestationsResult.count ?? 0)

        if (!profilesResult.error && profilesResult.data) {
          const mappedDbList: PublicContributorRecord[] = profilesResult.data.map((p) => {
            const slug = `self-${p.id.slice(0, 8)}`
            const year = p.created_at ? new Date(p.created_at).getFullYear() : 2026
            return {
              public_slug: slug,
              display_name: p.display_name || 'مساهم معتمد',
              role: p.role || 'reviewer',
              dialect_region: p.dialect_region || null,
              specialty: p.specialty || null,
              github_handle: p.github_handle || null,
              avatar_source: p.avatar_source || 'arcode',
              avatar_path: p.avatar_path || null,
              avatar_seed: p.avatar_seed || p.id,
              accepted_count: p.id === profile.id ? submissionsResult.data?.filter((s) => ['accepted', 'merged'].includes(s.status)).length ?? 0 : 0,
              attestations_count: p.id === profile.id ? attestationsResult.count ?? 0 : 0,
              documented_words_count: p.id === profile.id ? submissionsResult.data?.filter((s) => ['accepted', 'merged'].includes(s.status)).length ?? 0 : 0,
              documented_examples_count: p.id === profile.id ? attestationsResult.count ?? 0 : 0,
              joined_year: year,
            }
          })
          setDbContributors(mappedDbList)
        }
      }
      setLoading(false)
    }
    void loadActivity()
    return () => {
      active = false
    }
  }, [profile])

  const counts = useMemo(
    () => ({
      total: submissions.length,
      pending: submissions.filter((item) => item.status === 'pending').length,
      accepted: submissions.filter((item) => ['accepted', 'merged'].includes(item.status)).length,
      needsChanges: submissions.filter((item) => item.status === 'needs_changes').length,
    }),
    [submissions],
  )

  const joinedYear = useMemo(() => {
    return profile?.created_at ? new Date(profile.created_at).getFullYear() : 2026
  }, [profile?.created_at])

  const totalContributions = counts.accepted + attestationsCount
  const rank = useMemo(() => computeContributorRank(totalContributions), [totalContributions])

  const badgeInput = useMemo(
    () => ({
      role: profile?.role ?? 'reviewer',
      acceptedCount: counts.accepted,
      documentedWordsCount: counts.accepted,
      attestationsCount,
      dialectRegion: region || profile?.dialect_region || null,
      specialty: specialty || profile?.specialty || null,
      githubHandle: github || profile?.github_handle || null,
      sprintParticipationsCount,
      sprintBadgeLabel: sprintBadgeLabel ?? undefined,
      joinedYear,
    }),
    [
      profile?.role,
      profile?.dialect_region,
      profile?.specialty,
      profile?.github_handle,
      counts.accepted,
      attestationsCount,
      region,
      specialty,
      github,
      sprintParticipationsCount,
      sprintBadgeLabel,
      joinedYear,
    ],
  )

  const earnedBadges = useMemo(() => computeContributorBadges(badgeInput), [badgeInput])
  const standing = useMemo(() => computeContributorHonorStanding(earnedBadges), [earnedBadges])
  const nextMilestones = useMemo(() => computeNextBadgeMilestones(badgeInput), [badgeInput])

  const userRecordForLeaderboard = useMemo<PublicContributorRecord>(() => {
    const currentTotalAccepted = counts.accepted
    const currentTotalAttestations = attestationsCount
    const matched = contributors.find(
      (c) =>
        c.public_slug === resolvedPublicSlug ||
        (c.display_name &&
          c.display_name.trim() === (name.trim() || profile?.display_name || '').trim()) ||
        (c.github_handle && github && c.github_handle.toLowerCase() === github.toLowerCase()),
    )
    if (matched) {
      return {
        ...matched,
        documented_words_count: Math.max(matched.documented_words_count ?? 0, currentTotalAccepted),
        documented_examples_count: Math.max(
          matched.documented_examples_count ?? 0,
          currentTotalAttestations,
        ),
        accepted_count: Math.max(matched.accepted_count ?? 0, currentTotalAccepted),
        attestations_count: Math.max(matched.attestations_count ?? 0, currentTotalAttestations),
        dialect_region: region || matched.dialect_region,
        specialty: specialty || matched.specialty,
        github_handle: github || matched.github_handle,
        sprint_participations_count:
          sprintParticipationsCount || matched.sprint_participations_count || 0,
      }
    }
    return {
      public_slug: resolvedPublicSlug || 'self-member',
      display_name: name.trim() || profile?.display_name || 'مساهم معتمد',
      role: profile?.role ?? 'reviewer',
      dialect_region: region || profile?.dialect_region || null,
      specialty: specialty || profile?.specialty || null,
      github_handle: github || profile?.github_handle || null,
      avatar_source: avatarSource,
      avatar_seed: avatarSeed,
      avatar_path: avatarPath,
      joined_year: joinedYear,
      accepted_count: currentTotalAccepted,
      attestations_count: currentTotalAttestations,
      documented_words_count: currentTotalAccepted,
      documented_examples_count: currentTotalAttestations,
      sprint_participations_count: sprintParticipationsCount,
      sprint_badge_label: sprintBadgeLabel,
    }
  }, [
    contributors,
    resolvedPublicSlug,
    name,
    profile,
    github,
    counts.accepted,
    attestationsCount,
    region,
    specialty,
    avatarSource,
    avatarSeed,
    avatarPath,
    sprintParticipationsCount,
    sprintBadgeLabel,
    joinedYear,
  ])

  const sortedLeaderboard = useMemo(() => {
    const listMap = new Map<string, PublicContributorRecord>()
    for (const c of [...contributors, ...dbContributors]) {
      listMap.set(c.public_slug, c)
    }
    listMap.set(userRecordForLeaderboard.public_slug, userRecordForLeaderboard)
    return Array.from(listMap.values()).sort((a, b) => {
      const totA =
        (a.documented_words_count ?? a.accepted_count ?? 0) +
        (a.documented_examples_count ?? a.attestations_count ?? 0)
      const totB =
        (b.documented_words_count ?? b.accepted_count ?? 0) +
        (b.documented_examples_count ?? b.attestations_count ?? 0)
      return totB - totA
    })
  }, [contributors, dbContributors, userRecordForLeaderboard])

  const myRankPosition = useMemo(() => {
    const index = sortedLeaderboard.findIndex(
      (c) =>
        c.public_slug === userRecordForLeaderboard.public_slug ||
        (c.display_name && c.display_name === userRecordForLeaderboard.display_name),
    )
    return index >= 0 ? index + 1 : 1
  }, [sortedLeaderboard, userRecordForLeaderboard])

  const isDiamond = totalContributions >= 60 || rank.tier === 'master'
  const isTopThree = myRankPosition <= 3

  const githubIdentity = identities.find((id) => id.provider === 'github')
  const linkedGithubHandle = getGitHubLogin(githubIdentity)
  const googleIdentity = identities.find((id) => id.provider === 'google')
  const canUnlinkIdentity = identities.length > 1

  useEffect(() => {
    if (!linkedGithubHandle || !profile?.id || !supabase) return
    setGithub(linkedGithubHandle)
    if (profile.github_handle === linkedGithubHandle) return

    let active = true
    void supabase
      .from('reviewer_profiles')
      .update({ github_handle: linkedGithubHandle })
      .eq('id', profile.id)
      .then(({ error: syncError }) => {
        if (!active) return
        if (syncError) {
          setError('تم ربط GitHub، لكن تعذر حفظ المعرّف تلقائياً. أعد المحاولة لاحقاً.')
          return
        }
        setMessage('تم جلب معرّف GitHub العام وحفظه تلقائياً.')
        onProfileSaved()
      })

    return () => {
      active = false
    }
  }, [linkedGithubHandle, profile?.id, profile?.github_handle, onProfileSaved])

  async function handleAvatarUpload(file: File) {
    if (!supabase || !profile) return
    if (file.size > 2097152 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('استخدم صورة PNG أو JPG أو WebP لا يتجاوز حجمها 2 ميغابايت.')
      return
    }
    setAvatarUploading(true)
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = profile.id + '/' + crypto.randomUUID() + '.' + extension
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    })
    setAvatarUploading(false)
    if (uploadError) setError('تعذر رفع الصورة. تحقق من إعدادات خدمة تخزين الملفات في المنصة.')
    else { setAvatarPath(path); setAvatarSource('upload'); setMessage('تم رفع الصورة. اضغط حفظ التغييرات لاعتمادها.') }
  }

  async function saveProfile() {
    if (!supabase || !profile) return
    setSaving(true)
    setError(null)
    setMessage(null)
    const normalizedContactEmail = contactEmail.trim().toLowerCase()
    if (normalizedContactEmail && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(normalizedContactEmail)) {
      setSaving(false)
      setError('أدخل بريداً إلكترونياً صحيحاً أو اترك الحقل فارغاً.')
      return
    }
    if (shareContactEmail && !normalizedContactEmail) {
      setSaving(false)
      setError('أدخل بريد التواصل قبل تفعيل مشاركته مع الإدارة.')
      return
    }
    saveLocalPublicListedFallback(profile.id, publicListed)

    const basePayload = {
      display_name: name.trim() || null,
      dialect_region: region.trim() || null,
      specialty: specialty.trim() || null,
      github_handle: github.trim().replace(/^@/, '') || null,
      avatar_source: avatarSource,
      avatar_path: avatarSource === 'upload' ? avatarPath : null,
      avatar_seed: avatarSeed.trim().slice(0, 80) || profile.id,
    }

    let result = await supabase
      .from('reviewer_profiles')
      .update({
        ...basePayload,
        public_listed: publicListed,
      })
      .eq('id', profile.id)

    if (result.error) {
      result = await supabase
        .from('reviewer_profiles')
        .update(basePayload)
        .eq('id', profile.id)
    }

    setSaving(false)
    if (result.error) {
      setError('تعذر حفظ الملف الشخصي. تحقق من الاتصال ثم أعد المحاولة.')
      return
    }

    const contactResult = await supabase
      .from('member_contact_preferences')
      .upsert({
        user_id: profile.id,
        contact_email: normalizedContactEmail || null,
        share_with_admins: shareContactEmail && Boolean(normalizedContactEmail),
      }, { onConflict: 'user_id' })

    if (contactResult.error) {
      setSaving(false)
      setError('تم حفظ بيانات الملف الشخصي، لكن تعذر حفظ إعدادات بريد التواصل. أعد المحاولة بعد تحديث قاعدة البيانات.')
      return
    }

    if (profile.avatar_path && profile.avatar_path !== (avatarSource === 'upload' ? avatarPath : null)) {
      await supabase.storage.from('avatars').remove([profile.avatar_path])
    }
    setMessage('تم حفظ بيانات الملف الشخصي وتحديث إعدادات الظهور العام.')
    onProfileSaved()
  }

  async function handleLinkProvider(provider: 'github' | 'google') {
    if (!supabase || linkingProvider) return
    setLinkingProvider(provider)
    setError(null)
    setMessage(null)
    try {
      const { error: linkErr } = await supabase.auth.linkIdentity({
        provider,
        options: {
          redirectTo: `${window.location.origin}/?tab=profile#workspace`,
          scopes: provider === 'github' ? 'read:user user:email' : undefined,
        },
      })
      if (linkErr) throw linkErr
    } catch (err) {
      setLinkingProvider(null)
      setError(
        humanizeSystemError(
          err,
          `تعذر ربط حساب ${provider === 'github' ? 'GitHub' : 'Google'}. تأكد من تفعيل ربط الحسابات الخارجية في إعدادات المنصة.`,
        ),
      )
    }
  }

  async function handleUnlinkProvider(identity: UserIdentity) {
    if (!supabase || !canUnlinkIdentity || saving) return
    setSaving(true)
    setError(null)
    setMessage(null)
    const { error: unlinkErr } = await supabase.auth.unlinkIdentity(identity)
    setSaving(false)
    if (unlinkErr) {
      setError(humanizeSystemError(unlinkErr, 'تعذر فك ارتباط الحساب حالياً.'))
      return
    }
    await loadIdentities()
    onProfileSaved()
    setMessage(`تم فك ارتباط حساب ${identity.provider === 'github' ? 'GitHub' : 'Google'}.`)
  }

  async function handleSignOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    onProfileSaved()
  }

  if (!profile) {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-white/10 dark:bg-[#0C0C10]">
        <UserRound className="mx-auto h-8 w-8 text-zinc-400" />
        <h2 className="mt-3 text-lg font-bold text-zinc-950 dark:text-white">ملفك الشخصي</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          سجّل الدخول لعرض ملفك ومتابعة مساهماتك وربط حسابي GitHub وGoogle.
        </p>
      </section>
    )
  }

  const inputClass =
    'min-h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-3.5 text-sm font-normal text-zinc-950 outline-none transition-colors focus:border-zinc-950 focus:bg-white dark:border-white/12 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]'

  return (
    <section className="space-y-6" aria-labelledby="profile-title">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.14em] uppercase text-emerald-700 dark:text-[#D9FF43]">
            CONTRIBUTOR PROFILE / الحساب والمساهمات
          </p>
          <h2 id="profile-title" className="mt-1.5 font-display text-2xl font-bold text-zinc-950 dark:text-white">
            ملفي الشخصي وربط الحسابات
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            إدارة هويتك العلمية، ربط GitHub وGoogle، ومتابعة أثر مساهماتك في إثراء المعجم.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-[#D9FF43]">
            <BadgeCheck className="h-4 w-4" />
            <span>{roleLabels[profile.role]}</span>
          </span>
          {profile.role === 'reviewer' && onOpenPromotionModal && (
            <button
              type="button"
              onClick={onOpenPromotionModal}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-emerald-600/40 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100 transition-colors cursor-pointer dark:border-[#D9FF43]/40 dark:bg-[#D9FF43]/12 dark:text-[#D9FF43] dark:hover:bg-[#D9FF43]/20"
            >
              <span>طلب ترقية إلى محرر معتمد</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer dark:border-white/15 dark:bg-[#0C0C10] dark:text-zinc-200 dark:hover:border-white/30"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>خروج</span>
          </button>
        </div>
      </header>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)]">
        <div className="space-y-5">
          {/* Identity Metadata Card */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-[#0C0C10]">
            <div className="flex items-center gap-3.5 border-b border-zinc-200 pb-4 dark:border-white/10">
              <Avatar source={avatarSource} path={avatarPath} seed={avatarSeed} githubHandle={github} displayName={name} size={52} />
              <div className="min-w-0">
                <h3 className="font-display text-base font-bold text-zinc-950 dark:text-white">
                  {profile.display_name || 'مساهم جديد'}
                </h3>
                <p className="truncate font-mono text-xs text-zinc-500 dark:text-zinc-400" dir="ltr">
                  {userEmail}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-white/10 dark:bg-[#07070A]">
              <div className="flex flex-wrap items-center gap-4">
                <Avatar source={avatarSource} path={avatarPath} seed={avatarSeed} githubHandle={github} displayName={name} size={76} />
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-zinc-950 dark:text-white">الصورة الشخصية</h4>
                  <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">اختر مصدر الصورة أو أنشئ شخصية رمزية خاصة بك.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <label className="min-h-9 cursor-pointer rounded-lg bg-zinc-950 px-3 py-2 text-xs font-semibold text-white dark:bg-[#D9FF43] dark:text-[#050507]">
                      رفع صورة
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleAvatarUpload(file); event.currentTarget.value = '' }} />
                    </label>
                    <button type="button" onClick={() => { setAvatarSource('github'); setAvatarPath(null) }} className="min-h-9 rounded-lg border border-zinc-300 px-3 text-xs font-semibold text-zinc-700 dark:border-white/15 dark:text-zinc-300">GitHub</button>
                    <button type="button" onClick={() => { setAvatarSource('arcode'); setAvatarPath(null) }} className="min-h-9 rounded-lg border border-zinc-300 px-3 text-xs font-semibold text-zinc-700 dark:border-white/15 dark:text-zinc-300">شخصيات ArCode</button>
                  </div>
                </div>
              </div>
              {avatarSource === 'arcode' && (
                <label className="mt-4 block space-y-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  <span>معرّف الشخصية</span>
                  <input value={avatarSeed} onChange={(event) => setAvatarSeed(event.target.value)} maxLength={80} dir="ltr" className={inputClass + ' text-left font-mono'} />
                </label>
              )}
              {avatarSource === 'github' && !github.trim() && <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">أضف معرّف GitHub في الحقل أدناه لعرض صورته.</p>}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <span>الاسم المعروض</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <span>المنطقة اللهجية</span>
                <input
                  list="profile-moroccan-regions-list"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  maxLength={80}
                  placeholder="مثال: فاس ومكناس، الشمال وجبالة، سوس والجنوب..."
                  className={inputClass}
                />
                <datalist id="profile-moroccan-regions-list">
                  {MOROCCAN_REGIONS.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <span>التخصص أو مجال الاهتمام</span>
                <input
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  maxLength={120}
                  placeholder="مثال: المعجم، اللسانيات، الترجمة..."
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <span className="inline-flex items-center gap-1">
                  <Github className="h-3.5 w-3.5" /> معرّف GitHub العام
                </span>
                <input
                  value={github}
                  onChange={(e) => setGithub(e.target.value)}
                  readOnly={Boolean(linkedGithubHandle)}
                  maxLength={80}
                  dir="ltr"
                  placeholder="username"
                  aria-describedby="github-handle-help"
                  className={`${inputClass} text-left font-mono`}
                />
                <span id="github-handle-help" className="mt-1 block text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                  {linkedGithubHandle
                    ? 'تم جلب المعرّف من حساب GitHub المرتبط ولا يحتاج إلى إدخال يدوي.'
                    : 'اربط حساب GitHub ليتم جلب المعرّف العام تلقائياً.'}
                </span>
              </label>
            </div>

            <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#0B0B10]">
              <div className="mb-3">
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white">بريد التواصل مع إدارة ArCode</h3>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  هذا البريد اختياري ومنفصل عن بريد تسجيل الدخول. لن يظهر إلا للمشرف العام إذا فعّلت الموافقة أدناه، ولا يُنشر في دليل المساهمين.
                </p>
              </div>
              <label className="block space-y-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <span>بريد التواصل</span>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  maxLength={254}
                  autoComplete="email"
                  dir="ltr"
                  placeholder="name@example.com"
                  className={inputClass + ' text-left'}
                />
              </label>
              <label className="mt-3 flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={shareContactEmail}
                  onChange={(event) => setShareContactEmail(event.target.checked)}
                  disabled={!contactEmail.trim()}
                  className="mt-0.5 h-4 w-4 rounded accent-emerald-600"
                />
                <span>
                  <strong className="block font-bold text-zinc-950 dark:text-white">أوافق على مشاركة هذا البريد مع المشرف العام</strong>
                  <span className="mt-0.5 block text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                    يمكنك سحب الموافقة أو تغيير البريد في أي وقت. عند إلغاء الموافقة لن يظهر البريد للإدارة.
                  </span>
                </span>
              </label>
            </div>

            {/* Public Honor Roll Visibility Toggle + Direct Permalink */}
            <div className="mt-4 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 dark:border-white/10 dark:bg-[#07070A]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-start gap-2.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={publicListed}
                    onChange={(e) => setPublicListed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded accent-emerald-600"
                  />
                  <span>
                    <strong className="block font-bold text-zinc-950 dark:text-white">
                      إظهار اسمي وأوسمتي في «لوحة المساهمين العامة»
                    </strong>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      لا يُعرض بريدك الإلكتروني أبداً؛ تظهر بياناتك التعريفية وأوسمتك وصورتك الشخصية التي اخترتها.
                    </span>
                  </span>
                </label>

                {onOpenContributorsDirectory && (
                  <button
                    type="button"
                    onClick={() => onOpenContributorsDirectory(publicListed ? resolvedPublicSlug : null)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline cursor-pointer dark:text-[#D9FF43]"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>معاينة بطاقتي في لوحة الشرف</span>
                  </button>
                )}
              </div>

              {publicListed && directContributorUrl && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200/80 pt-3 text-xs dark:border-white/10">
                  <span className="truncate font-mono text-[11px] text-zinc-600 dark:text-zinc-400" dir="ltr">
                    {directContributorUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopyMyContributorUrl()}
                    className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold text-zinc-800 hover:border-zinc-950 cursor-pointer dark:border-white/15 dark:bg-[#0C0C10] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60"
                  >
                    {copiedPublicUrl ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
                        <span>تم نسخ رابط بطاقتك</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>نسخ رابط ملفك العام</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={saveProfile}
                disabled={saving || avatarUploading}
                className="inline-flex min-h-10 items-center gap-2 rounded-full bg-zinc-950 px-5 py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}</span>
              </button>
              {message && (
                <span role="status" className="text-xs font-medium text-emerald-700 dark:text-[#D9FF43]">
                  {message}
                </span>
              )}
              {error && (
                <span role="alert" className="text-xs font-medium text-red-600 dark:text-[#FF3B2F]">
                  {error}
                </span>
              )}
            </div>
            <p className="mt-3 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
              يمكنك تعديل بياناتك التعريفية وإعداد ظهورك العلني فقط. لا يمكن تغيير الدور أو الصلاحيات التحريرية إلا عبر حوكمة الإدارة.
            </p>
          </div>

          {/* Leaderboard Standing & Bespoke Podium Badges Section */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6 shadow-xs dark:border-white/10 dark:bg-[#0C0C10]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-500/10 text-amber-600 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-zinc-950 dark:text-white">
                    ترتيبك ومكانتك في لوحة صدارة المساهمين المعتمدين
                  </h3>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    مكانتك التوثيقية المباشرة بناءً على إجمالي المفردات والشواهد المحكَّمة
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/30 bg-emerald-50 px-3 py-1 font-mono text-xs font-bold text-emerald-800 dark:border-[#D9FF43]/30 dark:bg-[#D9FF43]/10 dark:text-[#D9FF43]">
                  <span>المرتبة #{myRankPosition}</span>
                  <span className="font-normal text-zinc-500 dark:text-zinc-400">من أصل {sortedLeaderboard.length}</span>
                </span>

                {onOpenContributorsDirectory && (
                  <button
                    type="button"
                    onClick={() => onOpenContributorsDirectory(resolvedPublicSlug)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold text-zinc-800 hover:border-zinc-950 transition-colors cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:border-white/35"
                  >
                    <span>عرض لوحة الشرف الكاملة</span>
                    <ArrowLeft className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Active Earned Honors & Badges Grid (1st, 2nd, 3rd, Diamond) */}
            <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              {/* Podium Ranking Box */}
              <div
                className={`rounded-xl border p-4 transition-all ${
                  myRankPosition === 1
                    ? 'border-amber-400/80 bg-amber-500/10 dark:border-amber-400/50 dark:bg-amber-400/10'
                    : myRankPosition === 2
                      ? 'border-slate-300 bg-slate-100/70 dark:border-white/20 dark:bg-white/5'
                      : myRankPosition === 3
                        ? 'border-amber-700/60 bg-amber-950/10 dark:border-amber-600/40 dark:bg-amber-950/20'
                        : 'border-zinc-200 bg-zinc-50/70 dark:border-white/10 dark:bg-[#07070A]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                    منصة الصدارة
                  </span>
                  {isTopThree ? (
                    <ChampionPodiumBadge place={myRankPosition as 1 | 2 | 3} size="sm" showLabel={false} />
                  ) : (
                    <span className="font-mono text-xs font-bold text-zinc-500">#{myRankPosition}</span>
                  )}
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <MoroccanRankMedal
                    place={isTopThree ? (myRankPosition as 1 | 2 | 3) : undefined}
                    tier={rank.tier}
                    size={34}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-950 dark:text-white">
                      {myRankPosition === 1
                        ? 'المركز الأول (ذهب مغربي)'
                        : myRankPosition === 2
                          ? 'المركز الثاني (فضة أندلسية)'
                          : myRankPosition === 3
                            ? 'المركز الثالث (نحاس مسكوك)'
                            : `المرتبة #${myRankPosition} في الدليل`}
                    </p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {isTopThree ? 'وسام منصة التتويج المباشر' : 'بناء مستمر للمتن'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Diamond Tier Box */}
              <div
                className={`rounded-xl border p-4 transition-all ${
                  isDiamond
                    ? 'border-emerald-600/60 bg-emerald-500/10 dark:border-[#D9FF43]/50 dark:bg-[#D9FF43]/10'
                    : 'border-zinc-200 bg-zinc-50/70 dark:border-white/10 dark:bg-[#07070A]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                    الوسام الألماسي السيادي
                  </span>
                  {isDiamond ? (
                    <ChampionPodiumBadge place="diamond" size="sm" showLabel={false} />
                  ) : (
                    <span className="rounded px-1.5 py-0.5 font-mono text-[10px] bg-zinc-200 text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
                      {totalContributions}/60
                    </span>
                  )}
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <MoroccanRankMedal place="diamond" size={34} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-950 dark:text-white">
                      {isDiamond ? 'الوسام الألماسي المكتمل 💎' : 'شارة الألماس السيادية'}
                    </p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {isDiamond
                        ? 'أعلى مراتب التحكيم المعجمي'
                        : `متبقي ${Math.max(0, 60 - totalContributions)} مساهمة للاستحقاق`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Current Rank Tier Box */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-white/10 dark:bg-[#07070A]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                    الرتبة المعجمية
                  </span>
                  <RankBadgeChip rank={rank} size="sm" showTier />
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <MoroccanRankMedal tier={rank.tier} size={34} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-950 dark:text-white">{rank.name}</p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{rank.tierLabel}</p>
                  </div>
                </div>
              </div>

              {/* Total Impact Score */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-white/10 dark:bg-[#07070A]">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                    إجمالي الأثر التراكمي
                  </span>
                  <TrendingUp className="h-4 w-4 text-emerald-700 dark:text-[#D9FF43]" />
                </div>
                <div className="mt-2">
                  <p className="font-mono text-2xl font-bold tabular-nums text-zinc-950 dark:text-white">
                    {totalContributions}
                  </p>
                  <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400">
                    {counts.accepted} مفردة + {attestationsCount} شاهد محكّم
                  </p>
                </div>
              </div>
            </div>

            {/* Mini Leaderboard Podium Showcase (Top 3 Leaders + Current User Standing) */}
            <div className="mt-5 rounded-xl border border-zinc-200/90 bg-zinc-50/60 p-4 dark:border-white/10 dark:bg-[#07070A]/60">
              <div className="flex items-center justify-between border-b border-zinc-200/80 pb-2.5 dark:border-white/10">
                <span className="text-xs font-bold text-zinc-900 dark:text-white">
                  منصة صدارة المعجم (Top 3) وموقعك التنافسي
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  تحديث فوري بناءً على المتن الحقيقي
                </span>
              </div>

              <div className="mt-3 divide-y divide-zinc-200/70 dark:divide-white/8">
                {sortedLeaderboard.slice(0, 3).map((item, idx) => {
                  const itemWords = item.documented_words_count ?? item.accepted_count ?? 0
                  const itemEx = item.documented_examples_count ?? item.attestations_count ?? 0
                  const itemTot = itemWords + itemEx
                  const itemRank = computeContributorRank(itemTot)
                  const isMe =
                    item.public_slug === userRecordForLeaderboard.public_slug ||
                    item.display_name === userRecordForLeaderboard.display_name
                  const placeNum = (idx + 1) as 1 | 2 | 3

                  return (
                    <div
                      key={item.public_slug}
                      className={`flex items-center justify-between py-2.5 px-2 rounded-lg transition-colors ${
                        isMe ? 'bg-emerald-500/10 dark:bg-[#D9FF43]/10 font-bold' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <MoroccanRankMedal place={placeNum} size={28} />
                        <Avatar
                          source={item.avatar_source}
                          path={item.avatar_path}
                          seed={item.avatar_seed || item.public_slug}
                          githubHandle={item.github_handle}
                          displayName={item.display_name}
                          size={30}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-zinc-950 dark:text-white">
                            {item.display_name}{' '}
                            {isMe && (
                              <span className="text-emerald-700 dark:text-[#D9FF43]">(أنت)</span>
                            )}
                          </p>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                            {item.dialect_region || 'مشترك عام'} · {itemRank.name}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <ChampionPodiumBadge place={placeNum} size="sm" showLabel={false} />
                        <span className="font-mono text-xs font-bold tabular-nums text-zinc-950 dark:text-white">
                          {itemTot} مساهمة
                        </span>
                      </div>
                    </div>
                  )
                })}

                {/* If current user is not in top 3, display their row below */}
                {myRankPosition > 3 && (
                  <div className="flex items-center justify-between py-2.5 px-2 rounded-lg bg-emerald-500/10 dark:bg-[#D9FF43]/10 mt-1">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg font-mono text-xs font-bold bg-zinc-200 dark:bg-white/10 text-zinc-800 dark:text-zinc-200">
                        #{myRankPosition}
                      </span>
                      <Avatar
                        source={avatarSource}
                        path={avatarPath}
                        seed={avatarSeed}
                        githubHandle={github}
                        displayName={name}
                        size={30}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-zinc-950 dark:text-white">
                          {userRecordForLeaderboard.display_name}{' '}
                          <span className="text-emerald-700 dark:text-[#D9FF43]">(أنت)</span>
                        </p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                          {userRecordForLeaderboard.dialect_region || 'مشترك عام'} · {rank.name}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <RankBadgeChip rank={rank} size="sm" showTier />
                      <span className="font-mono text-xs font-bold tabular-nums text-emerald-700 dark:text-[#D9FF43]">
                        {totalContributions} مساهمة
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 5-Axis Lexical Footprint Radar Card */}
          <LexicalFootprintRadar
            person={userRecordForLeaderboard}
            badges={earnedBadges}
            size={270}
            className="w-full"
          />

          {/* Linked Accounts Card: GitHub + Google */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-[#0C0C10]">
            <h3 className="font-display text-base font-bold text-zinc-950 dark:text-white">
              الحسابات المرتبطة (GitHub وGoogle)
            </h3>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              اربط حسابك بكلا المزوّدين لتسجيل الدخول بنقرة واحدة وتوثيق هويتك البرمجية والأكاديمية.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-white/10 dark:bg-[#07070A]">
                <div className="flex items-center gap-3 min-w-0">
                  <Github className="h-5 w-5 shrink-0 text-zinc-950 dark:text-white" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-950 dark:text-white">GitHub</p>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {githubIdentity
                        ? String(githubIdentity.identity_data?.user_name || githubIdentity.identity_data?.email || 'مرتبط')
                        : 'غير مرتبط حالياً'}
                    </p>
                  </div>
                </div>
                {githubIdentity ? (
                  canUnlinkIdentity && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleUnlinkProvider(githubIdentity)}
                      className="inline-flex items-center gap-1 rounded-full border border-zinc-300 px-3 py-1 text-xs font-semibold text-zinc-700 hover:border-red-500 hover:text-red-600 cursor-pointer dark:border-white/15 dark:text-zinc-300 dark:hover:border-[#FF3B2F] dark:hover:text-[#FF3B2F]"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                      <span>فك الارتباط</span>
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    disabled={!isSupabaseConfigured || Boolean(linkingProvider)}
                    onClick={() => handleLinkProvider('github')}
                    className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507]"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    <span>{linkingProvider === 'github' ? 'جارٍ التحويل...' : 'ربط GitHub'}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-white/10 dark:bg-[#07070A]">
                <div className="flex items-center gap-3 min-w-0">
                  <GoogleIcon />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-950 dark:text-white">Google</p>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {googleIdentity
                        ? String(googleIdentity.identity_data?.email || 'مرتبط')
                        : 'غير مرتبط حالياً'}
                    </p>
                  </div>
                </div>
                {googleIdentity ? (
                  canUnlinkIdentity && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleUnlinkProvider(googleIdentity)}
                      className="inline-flex items-center gap-1 rounded-full border border-zinc-300 px-3 py-1 text-xs font-semibold text-zinc-700 hover:border-red-500 hover:text-red-600 cursor-pointer dark:border-white/15 dark:text-zinc-300 dark:hover:border-[#FF3B2F] dark:hover:text-[#FF3B2F]"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                      <span>فك الارتباط</span>
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    disabled={!isSupabaseConfigured || Boolean(linkingProvider)}
                    onClick={() => handleLinkProvider('google')}
                    className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507]"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    <span>{linkingProvider === 'google' ? 'جارٍ التحويل...' : 'ربط Google'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-[#0C0C10]">
            <div className="flex items-center gap-2 text-sm font-bold text-zinc-950 dark:text-white">
              <Activity className="h-4 w-4 text-emerald-700 dark:text-[#D9FF43]" />
              <span>ملخص النشاط</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                ['آخر 100 مساهمة', counts.total],
                ['مقبولة / مدمجة', counts.accepted],
                ['قيد المراجعة', counts.pending],
                ['تحتاج تعديلاً', counts.needsChanges],
                ['تدقيقات المجتمع', attestationsCount],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 dark:border-white/10 dark:bg-[#07070A]"
                >
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</p>
                  <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-zinc-950 dark:text-white">
                    {loading ? '—' : value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {activityError && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
            >
              {activityError}
            </p>
          )}

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-[#0C0C10]">
            <div className="space-y-5">
              {/* Rank & Podium Standing Card */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-white/10 dark:bg-[#07070A]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/80 pb-3 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <MoroccanRankMedal
                      place={isTopThree ? (myRankPosition as 1 | 2 | 3) : undefined}
                      tier={rank.tier}
                      size={28}
                    />
                    <div>
                      <p className="text-xs font-bold text-zinc-950 dark:text-white">
                        الرتبة المعجمية: {rank.name}
                      </p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        {rank.tierLabel} · {totalContributions} مساهمة وتصديق
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isDiamond ? (
                      <ChampionPodiumBadge place="diamond" size="sm" showLabel={false} />
                    ) : isTopThree ? (
                      <ChampionPodiumBadge
                        place={myRankPosition as 1 | 2 | 3}
                        size="sm"
                        showLabel={false}
                      />
                    ) : null}
                    <RankBadgeChip rank={rank} size="sm" showTier />
                  </div>
                </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {rank.nextRankMin === null ? 'الرتبة الألماسية المكتملة' : 'التقدم نحو الرتبة القادمة'}
                        </span>
                        <span className="font-mono font-bold tabular-nums text-emerald-700 dark:text-[#D9FF43]">
                          {rank.nextRankMin === null ? '100%' : `${rank.progressPercent}%`}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
                        <div
                          style={{ width: `${rank.progressPercent}%` }}
                          className={`h-full rounded-full transition-all ${
                            rank.tier === 'master'
                              ? 'bg-emerald-600 dark:bg-[#D9FF43]'
                              : rank.tier === 'gold'
                                ? 'bg-amber-500 dark:bg-amber-400'
                                : rank.tier === 'silver'
                                  ? 'bg-zinc-600 dark:bg-zinc-300'
                                  : 'bg-amber-800 dark:bg-amber-500'
                          }`}
                        />
                      </div>
                      <p className="mt-1.5 text-[10.5px] text-zinc-500 dark:text-zinc-400">
                        {rank.actionHint}
                      </p>
                    </div>
                  </div>

                  {/* Badges Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-zinc-950 dark:text-white">
                      <Award className="h-4 w-4 text-emerald-700 dark:text-[#D9FF43]" />
                      <span>أختام وأوسمة المعجم الخاصة ({earnedBadges.length})</span>
                    </div>
                    <span className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-[#D9FF43]">
                      {standing.standingTitle}
                    </span>
                  </div>

                  {earnedBadges.length === 0 ? (
                    <p className="text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                      تُمنح أختام المعجم تلقائياً وفق معايير علمية موثقة فور اعتماد مساهماتك أو إنجاز تصديقات ميدانية.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {earnedBadges.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-start gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 dark:border-white/10 dark:bg-[#07070A]"
                        >
                          <MeritSealMedallion
                            icon={b.icon}
                            tone={b.tone}
                            tier={b.tier}
                            size={38}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-bold text-zinc-950 dark:text-white">
                                {b.sealName}{' '}
                                <span className="font-normal text-zinc-500 dark:text-zinc-400">
                                  · {b.label}
                                </span>
                              </p>
                              <span className="font-mono text-[10px] text-zinc-400">
                                {b.code}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11px] leading-5 text-zinc-600 dark:text-zinc-400">
                              {b.valueStatement}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {nextMilestones.length > 0 && (
                    <div className="border-t border-zinc-200 pt-4 dark:border-white/10">
                      <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        أختام قيد الاستحقاق (خطوتك القادمة)
                      </p>
                      <div className="mt-2.5 space-y-3">
                        {nextMilestones.map((m) => (
                          <div key={m.badge.id} className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-semibold text-zinc-900 dark:text-zinc-200">
                                {m.badge.sealName} · {m.badge.label}
                              </span>
                              <span className="font-mono text-[11px] tabular-nums text-emerald-700 dark:text-[#D9FF43]">
                                {m.progressLabel}
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
                              <div
                                style={{ width: `${Math.max(6, m.percent)}%` }}
                                className="h-full rounded-full bg-emerald-600 transition-all dark:bg-[#D9FF43]"
                              />
                            </div>
                            <p className="text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
                              {m.actionHint}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-[#0C0C10]">
            <div className="flex items-center gap-2 text-sm font-bold text-zinc-950 dark:text-white">
              <BookOpen className="h-4 w-4 text-emerald-700 dark:text-[#D9FF43]" />
              <span>مبادئ المساهمة</span>
            </div>
            <ul className="mt-3 space-y-2 text-xs leading-6 text-zinc-600 dark:text-zinc-400">
              <li>قدّم شواهد قابلة للتحقق كلما أمكن.</li>
              <li>ميّز بين الاستعمال المحلي والاستعمال واسع الانتشار.</li>
              <li>لا تعتبر إرسال الاقتراح اعتماداً نهائياً له حتى يمر بالتحكيم.</li>
            </ul>
          </div>
        </aside>
      </div>

      {/* Saved Words & Proverbs (Member Bookmarks) */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#0C0C10]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-6 py-4 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-emerald-700 dark:text-[#D9FF43]" />
              <h3 className="font-display font-bold text-zinc-950 dark:text-white">
                مفرداتي المحفوظة ({bookmarkedEntries.length})
              </h3>
            </div>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              المفردات والأمثال المغربية التي حفظتها في مفضلتك للرجوع السريع إليها.
            </p>
          </div>
        </div>

        {bookmarkedEntries.length === 0 ? (
          <p className="p-6 text-sm text-zinc-500 dark:text-zinc-400">
            لم تحفظ أي مفردة في مفضلتك بعد. يمكنك الضغط على زر «حفظ» داخل أي بطاقة قاموسية لإضافتها هنا.
          </p>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-white/10">
            {bookmarkedEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <strong className="font-display text-base font-bold text-zinc-950 dark:text-white">
                      {entry.word}
                    </strong>
                    {entry.latin && (
                      <span dir="ltr" className="font-mono text-xs text-emerald-700 dark:text-[#D9FF43]">
                        /{entry.latin}/
                      </span>
                    )}
                    <span aria-hidden="true" className="text-xs text-zinc-400">
                      ·
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {entry.category}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-600 dark:text-zinc-400">
                    {entry.meaning}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {onOpenBookmarkedEntry && (
                    <button
                      type="button"
                      onClick={() => onOpenBookmarkedEntry(entry)}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-full border border-zinc-300 bg-zinc-50 px-3.5 py-1 text-xs font-semibold text-zinc-800 hover:border-zinc-950 cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60"
                    >
                      <span>فتح البطاقة</span>
                      <ArrowLeft className="h-3 w-3" />
                    </button>
                  )}

                  {onRemoveBookmark && (
                    <button
                      type="button"
                      onClick={() => onRemoveBookmark(entry.id)}
                      aria-label={`إزالة ${entry.word} من المفضلة`}
                      className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full border border-zinc-200 text-zinc-500 hover:border-red-500 hover:text-red-600 cursor-pointer dark:border-white/12 dark:text-zinc-400 dark:hover:border-[#FF3B2F] dark:hover:text-[#FF3B2F]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#0C0C10]">
        <div className="border-b border-zinc-200 px-6 py-4 dark:border-white/10">
          <h3 className="font-display font-bold text-zinc-950 dark:text-white">سجل مساهماتي</h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            آخر 100 اقتراح أرسلتها إلى المنصة.
          </p>
        </div>
        {loading ? (
          <p className="p-6 text-sm text-zinc-500">جارٍ تحميل النشاط…</p>
        ) : activityError ? (
          <p role="alert" className="p-6 text-sm text-red-700 dark:text-red-300">
            تعذر عرض السجل لأن تحميل البيانات لم يكتمل.
          </p>
        ) : submissions.length === 0 ? (
          <p className="p-6 text-sm text-zinc-500 dark:text-zinc-400">لا توجد مساهمات مسجلة بعد.</p>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-white/10">
            {submissions.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                    {String(item.proposed_data?.word_ar || item.entry_id)}
                  </p>
                  <p className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(item.created_at).toLocaleDateString('ar-MA')} · {item.entry_id}
                  </p>
                </div>
                <span className="text-xs font-medium text-emerald-700 dark:text-[#D9FF43]">
                  {(
                    {
                      pending: 'قيد المراجعة',
                      accepted: 'مقبول',
                      merged: 'مدمج',
                      rejected: 'مرفوض',
                      needs_changes: 'يحتاج تعديلاً',
                      withdrawn: 'مسحوب',
                      superseded: 'استُبدل',
                    } as Record<string, string>
                  )[item.status] ?? item.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
