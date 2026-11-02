import { useMemo, useState } from 'react'
import {
  Award,
  CheckCircle2,
  ExternalLink,
  Github,
  Globe2,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react'
import type { PublicContributorRecord, UserRole } from '../../types/lexicon'
import { Avatar } from '../Avatar'
import { computeContributorBadges, getBadgeClasses } from '../../utils/meritBadges'

interface PublicContributorsPageProps {
  contributors: PublicContributorRecord[]
  loading: boolean
  isAuthenticated: boolean
  entriesCount: number
  corpusVersion: string
  onOpenProfileOrAuth: () => void
  onStartContributing: () => void
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'مشرف عام',
  editor: 'محرر معتمد',
  reviewer: 'مراجع مساهم',
}

type RoleFilter = 'all' | 'staff' | 'reviewers'

export function PublicContributorsPage({
  contributors,
  loading,
  isAuthenticated,
  entriesCount,
  corpusVersion,
  onOpenProfileOrAuth,
  onStartContributing,
}: PublicContributorsPageProps) {
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')

  const filteredContributors = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    return contributors.filter((c) => {
      if (roleFilter === 'staff' && c.role === 'reviewer') return false
      if (roleFilter === 'reviewers' && c.role !== 'reviewer') return false

      if (!trimmed) return true
      const haystack = [
        c.display_name,
        c.dialect_region ?? '',
        c.specialty ?? '',
        c.github_handle ?? '',
        ROLE_LABELS[c.role],
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(trimmed)
    })
  }, [contributors, query, roleFilter])

  const summary = useMemo(() => {
    const staffCount = contributors.filter((c) => c.role !== 'reviewer').length
    const regions = new Set(
      contributors
        .map((c) => c.dialect_region?.trim())
        .filter((r): r is string => Boolean(r)),
    )
    const totalAccepted = contributors.reduce((acc, c) => acc + c.accepted_count, 0)
    const totalAttestations = contributors.reduce((acc, c) => acc + c.attestations_count, 0)
    return {
      total: contributors.length,
      staffCount,
      regionsCount: regions.size,
      totalAccepted,
      totalAttestations,
    }
  }, [contributors])

  return (
    <section className="space-y-6" aria-labelledby="contributors-honor-title">
      {/* Telemetry Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#0B0B10]">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-zinc-500 dark:text-zinc-400">
            PUBLIC CONTRIBUTORS
          </p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-zinc-950 dark:text-white">
            {summary.total.toLocaleString('en-US')}
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            مساهم ومحرر معلَن في لوحة الشرف
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#0B0B10]">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-zinc-500 dark:text-zinc-400">
            EDITORIAL BOARD
          </p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-emerald-700 dark:text-[#D9FF43]">
            {summary.staffCount.toLocaleString('en-US')}
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            محررون معتمدون ومشرفون
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#0B0B10]">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-zinc-500 dark:text-zinc-400">
            REGIONAL COVERAGE
          </p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-zinc-950 dark:text-white">
            {summary.regionsCount.toLocaleString('en-US')}
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            منطقة لهجية مغربية ممثَّلة
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#0B0B10]">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-zinc-500 dark:text-zinc-400">
            VERIFIED IMPACT
          </p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-zinc-950 dark:text-white">
            {(summary.totalAccepted + summary.totalAttestations).toLocaleString('en-US')}
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            مساهمة معتمدة وتصديق ميداني
          </p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#0B0B10]">
        <div className="relative min-w-[240px] flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 start-3.5 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-[#D9FF43]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث باسم المساهم، المنطقة اللهجية، التخصص، أو حساب GitHub..."
            className="min-h-[42px] w-full rounded-xl border border-zinc-200 bg-zinc-50/80 ps-10 pe-3.5 text-xs sm:text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="تصفية المساهمين حسب الدور"
            className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-white/10 dark:bg-[#07070A]"
          >
            {(
              [
                { id: 'all', label: 'الجميع' },
                { id: 'staff', label: 'المحررون والمشرفون' },
                { id: 'reviewers', label: 'المساهمون' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRoleFilter(tab.id)}
                className={`min-h-[32px] rounded-lg px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
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
            className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition-colors cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>ساهم في الإثراء</span>
          </button>
        </div>
      </div>

      {/* Contributors Honor Grid */}
      {loading ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center text-sm text-zinc-500 dark:border-white/10 dark:bg-[#0B0B10] dark:text-zinc-400">
          جارٍ تحميل لوحة شرف المساهمين…
        </div>
      ) : filteredContributors.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center dark:border-white/10 dark:bg-[#0B0B10]">
          <Users className="mx-auto h-8 w-8 text-zinc-400 dark:text-zinc-500" />
          <h3 className="mt-3 font-display text-base font-bold text-zinc-950 dark:text-white">
            لا توجد نتائج مطابقة للبحث الحالي
          </h3>
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            جرّب تعديل عبارة البحث، أو كن من أوائل الموثّقين المعتمدين في منطقتك اللهجية.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredContributors.map((person) => {
            const badges = computeContributorBadges({
              role: person.role,
              acceptedCount: person.accepted_count,
              attestationsCount: person.attestations_count,
              dialectRegion: person.dialect_region,
              githubHandle: person.github_handle,
            })
            return (
              <article
                key={person.public_slug}
                className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 dark:border-white/10 dark:bg-[#0B0B10] dark:hover:border-white/20"
              >
                <div className="space-y-4">
                  {/* Top Identity Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        source={person.avatar_source}
                        path={person.avatar_path}
                        seed={person.avatar_seed || person.public_slug}
                        githubHandle={person.github_handle}
                        displayName={person.display_name}
                        size={44}
                        className="rounded-xl border border-zinc-200 dark:border-white/10"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="truncate font-display text-base font-bold text-zinc-950 dark:text-white">
                            {person.display_name}
                          </h3>
                          {person.is_sandbox && (
                            <span className="rounded-md border border-amber-300/70 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-500/35 dark:bg-amber-950/35 dark:text-amber-300">
                              نموذج معاينة
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          {ROLE_LABELS[person.role]} · انضم {person.joined_year}
                        </p>
                      </div>
                    </div>

                    {person.github_handle && (
                      <a
                        href={`https://github.com/${encodeURIComponent(person.github_handle)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`حساب GitHub: @${person.github_handle}`}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 font-mono text-[11px] text-zinc-700 hover:border-zinc-400 hover:text-zinc-950 dark:border-white/10 dark:bg-[#07070A] dark:text-zinc-300 dark:hover:border-[#D9FF43]/50 dark:hover:text-white"
                      >
                        <Github className="h-3.5 w-3.5 shrink-0" />
                        <span dir="ltr" className="max-w-[92px] truncate">
                          @{person.github_handle}
                        </span>
                        <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                      </a>
                    )}
                  </div>

                  {/* Region & Specialty */}
                  {(person.dialect_region || person.specialty) && (
                    <div className="space-y-1.5 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 text-xs dark:border-white/[0.06] dark:bg-[#07070A]">
                      {person.dialect_region && (
                        <p className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                          <Globe2 className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-[#D9FF43]" />
                          <span>المنطقة اللهجية:</span>
                          <strong className="font-semibold text-zinc-950 dark:text-white">
                            {person.dialect_region}
                          </strong>
                        </p>
                      )}
                      {person.specialty && (
                        <p className="text-zinc-600 dark:text-zinc-400">{person.specialty}</p>
                      )}
                    </div>
                  )}

                  {/* Merit Badges (Proposal #5) */}
                  {badges.length > 0 && (
                    <div className="flex flex-wrap gap-1.5" aria-label="أوسمة الجدارة المعجمية">
                      {badges.map((badge) => (
                        <span
                          key={badge.id}
                          title={badge.description}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${getBadgeClasses(badge.tone)}`}
                        >
                          <Award className="h-3 w-3 shrink-0" />
                          <span>{badge.label}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Verified Metrics Footer */}
                <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-xs dark:border-white/10">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    مساهمات معتمدة:{' '}
                    <strong className="font-mono font-bold text-zinc-950 dark:text-white">
                      {person.accepted_count.toLocaleString('en-US')}
                    </strong>
                  </span>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    تصديقات ميدانية:{' '}
                    <strong className="font-mono font-bold text-emerald-700 dark:text-[#D9FF43]">
                      {person.attestations_count.toLocaleString('en-US')}
                    </strong>
                  </span>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Institutional Corpus Attribution & Privacy Guarantee Charter */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-[#0B0B10]">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-[#D9FF43]">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-mono text-[11px] tracking-[0.14em] uppercase">
              CORPUS ATTRIBUTION · v{corpusVersion}
            </span>
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
            <div className="flex items-center gap-2 text-emerald-700 dark:text-[#D9FF43]">
              <ShieldCheck className="h-4 w-4" />
              <span className="font-mono text-[11px] tracking-[0.14em] uppercase">
                PRIVACY & RLS PROTECTION
              </span>
            </div>
            <h3 className="mt-2 font-display text-lg font-bold text-zinc-950 dark:text-white">
              تحكم كامل بخصوصية ظهورك العلني
            </h3>
            <p className="mt-2 text-xs sm:text-sm leading-7 text-zinc-600 dark:text-zinc-400">
              لا تكشف هذه الصفحة البريد الإلكتروني أو المعرّفات الخاصة لأي عضو. يمكنك في أي وقت تفعيل أو إيقاف ظهور اسمك في لوحة الشرف من إعدادات ملفك الشخصي.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenProfileOrAuth}
              className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-zinc-300 bg-zinc-50 px-4 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-100 dark:hover:border-[#D9FF43]/60"
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
    </section>
  )
}
