import { useCallback, useEffect, useMemo, useState } from 'react'
import type { UserIdentity } from '@supabase/supabase-js'
import {
  Activity,
  Award,
  BadgeCheck,
  BookOpen,
  Eye,
  Github,
  Link2,
  LogOut,
  Save,
  Unlink,
  UserRound,
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { Avatar, type AvatarSource } from '../Avatar'
import type { ReviewerProfile, SubmissionRecord } from '../../types/lexicon'
import { humanizeSystemError } from '../../utils/humanizeError'
import { computeContributorBadges, getBadgeClasses } from '../../utils/meritBadges'
import {
  getLocalPublicListedFallback,
  saveLocalPublicListedFallback,
} from '../../hooks/useCommunityGovernanceAndMessages'

interface ContributorProfilePanelProps {
  profile: ReviewerProfile | null
  userEmail: string | null
  onProfileSaved: () => void
  onOpenContributorsDirectory?: () => void
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
  onProfileSaved,
  onOpenContributorsDirectory,
}: ContributorProfilePanelProps) {
  const [name, setName] = useState(profile?.display_name ?? '')
  const [region, setRegion] = useState(profile?.dialect_region ?? '')
  const [specialty, setSpecialty] = useState(profile?.specialty ?? '')
  const [github, setGithub] = useState(profile?.github_handle ?? '')
  const [avatarSource, setAvatarSource] = useState<AvatarSource>(profile?.avatar_source ?? 'arcode')
  const [avatarPath, setAvatarPath] = useState<string | null>(profile?.avatar_path ?? null)
  const [avatarSeed, setAvatarSeed] = useState(profile?.avatar_seed || profile?.id || 'darija-lexreview')
  const [publicListed, setPublicListed] = useState<boolean>(
    profile?.public_listed ?? getLocalPublicListedFallback(profile?.id),
  )
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([])
  const [attestationsCount, setAttestationsCount] = useState(0)
  const [identities, setIdentities] = useState<UserIdentity[]>([])
  const [linkingProvider, setLinkingProvider] = useState<'github' | 'google' | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase && profile))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activityError, setActivityError] = useState<string | null>(null)

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
      const [submissionsResult, attestationsResult] = await Promise.all([
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
      ])
      if (!active) return
      if (submissionsResult.error || attestationsResult.error) {
        setActivityError('تعذر تحميل سجل النشاط بالكامل. أعد تحميل الصفحة أو تحقق من صلاحيات الحساب.')
      } else {
        setActivityError(null)
        setSubmissions((submissionsResult.data ?? []) as SubmissionRecord[])
        setAttestationsCount(attestationsResult.count ?? 0)
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

  const githubIdentity = identities.find((id) => id.provider === 'github')
  const googleIdentity = identities.find((id) => id.provider === 'google')
  const canUnlinkIdentity = identities.length > 1

  async function saveProfile() {
    if (!supabase || !profile) return
    setSaving(true)
    setError(null)
    setMessage(null)
    saveLocalPublicListedFallback(profile.id, publicListed)

    const basePayload = {
      display_name: name.trim() || null,
      dialect_region: region.trim() || null,
      specialty: specialty.trim() || null,
      github_handle: github.trim().replace(/^@/, '') || null,
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
          `تعذر ربط حساب ${provider === 'github' ? 'GitHub' : 'Google'}. تأكد من تفعيل ربط الهويات في Supabase.`,
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
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-[#D9FF43]">
            <BadgeCheck className="h-4 w-4" />
            <span>{roleLabels[profile.role]}</span>
          </span>
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
              <div className="grid h-12 w-12 place-items-center rounded-full bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]">
                <UserRound className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-base font-bold text-zinc-950 dark:text-white">
                  {profile.display_name || 'مساهم جديد'}
                </h3>
                <p className="truncate font-mono text-xs text-zinc-500 dark:text-zinc-400" dir="ltr">
                  {userEmail}
                </p>
              </div>
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
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  maxLength={80}
                  placeholder="مثال: الرباط، فاس، الشمال..."
                  className={inputClass}
                />
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
                  maxLength={80}
                  dir="ltr"
                  placeholder="username"
                  className={`${inputClass} text-left font-mono`}
                />
              </label>
            </div>

            {/* Public Honor Roll Visibility Toggle */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 dark:border-white/10 dark:bg-[#07070A]">
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
                    لا يُعرض بريدك الإلكتروني أبداً؛ يظهر فقط الاسم المعروض، المنطقة اللهجية، التخصص، وأوسمتك العلمية.
                  </span>
                </span>
              </label>

              {onOpenContributorsDirectory && (
                <button
                  type="button"
                  onClick={onOpenContributorsDirectory}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline cursor-pointer dark:text-[#D9FF43]"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>معاينة لوحة الشرف</span>
                </button>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={saveProfile}
                disabled={saving}
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
            <div className="flex items-center gap-2 text-sm font-bold text-zinc-950 dark:text-white">
              <Award className="h-4 w-4 text-emerald-700 dark:text-[#D9FF43]" />
              <span>أوسمة الجدارة المعجمية</span>
            </div>
            {(() => {
              const earnedBadges = computeContributorBadges({
                role: profile.role,
                acceptedCount: counts.accepted,
                attestationsCount,
                dialectRegion: region || profile.dialect_region,
                githubHandle: github || profile.github_handle,
              })
              return earnedBadges.length === 0 ? (
                <p className="mt-3 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                  تُمنح الأوسمة تلقائياً فور اعتماد أول مساهمة لك أو إنجاز تصديقات ميدانية أو ربط هوية GitHub.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {earnedBadges.map((b) => (
                    <span
                      key={b.id}
                      title={b.description}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${getBadgeClasses(b.tone)}`}
                    >
                      <Award className="h-3.5 w-3.5" />
                      <span>{b.label}</span>
                    </span>
                  ))}
                </div>
              )
            })()}
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
