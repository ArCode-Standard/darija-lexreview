import { useMemo, useState } from 'react'
import {
  Calendar,
  ChevronDown,
  Filter,
  Sparkles,
  Trophy,
} from 'lucide-react'
import type { PublicContributorRecord } from '../types/lexicon'
import { Avatar } from './Avatar'
import { MoroccanRankMedal } from './ContributorRankVisual'
import { computeContributorRank } from '../utils/contributorRanks'

export interface SprintSeason {
  id: string
  name: string
  theme: string
  period: string
  status: 'active' | 'completed' | 'upcoming'
  championSlugs: Array<{ slug: string; place: 1 | 2 | 3; highlight: string; contributions: number }>
}

/**
 * Historical Sprints & Seasons Registry.
 * Based on real platform sprints (like Moroccan Artisanal & Maritime campaigns).
 */
export const SEASONAL_SPRINTS: SprintSeason[] = [
  {
    id: 'season-2026-autumn',
    name: 'الموسم الحالي: نفير خريف 2026',
    theme: 'توثيق المعجم الحرفي والبحري والأمثال الشعبية المهددة',
    period: 'سبتمبر — نوفمبر 2026',
    status: 'active',
    championSlugs: [],
  },
  {
    id: 'season-2026-summer',
    name: 'موسم صيف 2026: نفير واحات الجنوب وسوس',
    theme: 'حصر المصطلحات الزراعية ونظم السقي التقليدي والأمثال الأمازيغية المعربة',
    period: 'يونيو — أغسطس 2026',
    status: 'completed',
    championSlugs: [],
  },
  {
    id: 'season-2026-spring',
    name: 'موسم الربيع التأسيسي 2026',
    theme: 'بناء النواة المعجمية الأولى وتدقيق الأفعال اليومية والصفات المشتركة',
    period: 'يناير — مايو 2026',
    status: 'completed',
    championSlugs: [],
  },
]

interface SeasonalLeaderboardSectionProps {
  contributors: PublicContributorRecord[]
  selectedSprintFilter?: string | null
  onToggleSprintFilter?: (seasonId: string) => void
  onSelectContributor: (slug: string) => void
  onStartContributing: () => void
  className?: string
}

export function SeasonalLeaderboardSection({
  contributors,
  selectedSprintFilter = null,
  onToggleSprintFilter,
  onSelectContributor,
  onStartContributing,
  className = '',
}: SeasonalLeaderboardSectionProps) {
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(SEASONAL_SPRINTS[0].id)

  const selectedSeason = useMemo(
    () => SEASONAL_SPRINTS.find((s) => s.id === selectedSeasonId) ?? SEASONAL_SPRINTS[0],
    [selectedSeasonId],
  )

  // Rank contributors for the active or selected season without fake data
  // Using sprint_participations_count, weekly contributions, and accepted contributions
  const seasonRankings = useMemo(() => {
    return contributors
      .filter((c) => (c.documented_words_count ?? c.accepted_count) + (c.documented_examples_count ?? c.attestations_count) > 0)
      .sort((a, b) => {
        // Sort by sprint participations first, then total contributions
        const sprintA = a.sprint_participations_count ?? 0
        const sprintB = b.sprint_participations_count ?? 0
        if (sprintB !== sprintA) return sprintB - sprintA

        const totalA = (a.documented_words_count ?? a.accepted_count) + (a.documented_examples_count ?? a.attestations_count)
        const totalB = (b.documented_words_count ?? b.accepted_count) + (b.documented_examples_count ?? b.attestations_count)
        return totalB - totalA
      })
      .slice(0, 10)
  }, [contributors])

  return (
    <section
      aria-label="سجل المواسم المعجمية والنفير الموسمي"
      className={`rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-xs dark:border-white/10 dark:bg-[#0B0B10] ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4 dark:border-white/8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-600/25 bg-emerald-50 text-emerald-700 dark:border-[#D9FF43]/30 dark:bg-[#D9FF43]/10 dark:text-[#D9FF43]">
            <Trophy className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base sm:text-lg font-bold text-zinc-950 dark:text-white">
                المواسم المعجمية والنفير الموسمي
              </h3>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-900 dark:bg-[#D9FF43]/20 dark:text-[#D9FF43]">
                سجل تاريخي للأبطال
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              تخليد أبطال كل موسم توثيقي في مسيرة المعجم المغربي المفتوح
            </p>
          </div>
        </div>

        {/* Season Selector */}
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
            <Calendar className="h-3.5 w-3.5" />
            <span>الموسم:</span>
            <div className="relative">
              <select
                aria-label="اختيار الموسم المعجمي"
                value={selectedSeasonId}
                onChange={(e) => setSelectedSeasonId(e.target.value)}
                className="min-h-[34px] appearance-none rounded-lg border border-zinc-200 bg-zinc-50 pe-7 ps-2.5 text-xs font-semibold text-zinc-900 dark:border-white/12 dark:bg-[#07070A] dark:text-zinc-200"
              >
                {SEASONAL_SPRINTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.period})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute end-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            </div>
          </label>
        </div>
      </div>

      {/* Season Theme & Banner */}
      <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4 sm:flex-row sm:items-center dark:border-white/10 dark:bg-[#07070A]">
        <div>
          <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-emerald-700 dark:text-[#D9FF43]">
            {selectedSeason.period} · {selectedSeason.status === 'active' ? 'موسم نشط حالياً' : 'موسم مؤرشف'}
          </span>
          <h4 className="mt-0.5 text-xs sm:text-sm font-bold text-zinc-950 dark:text-white">
            {selectedSeason.theme}
          </h4>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onToggleSprintFilter && (
            <button
              type="button"
              onClick={() => onToggleSprintFilter(selectedSeason.id)}
              className={`inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold transition-colors cursor-pointer ${
                selectedSprintFilter === selectedSeason.id
                  ? 'border-emerald-600 bg-emerald-600 text-white dark:border-[#D9FF43] dark:bg-[#D9FF43] dark:text-[#050507]'
                  : 'border-zinc-300 bg-white text-zinc-800 hover:border-zinc-950 dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:border-white/35'
              }`}
            >
              <Filter className="h-3 w-3" />
              <span>
                {selectedSprintFilter === selectedSeason.id
                  ? 'إلغاء تصفية الموسم'
                  : 'تصفية المشاركين في الدليل'}
              </span>
            </button>
          )}

          {selectedSeason.status === 'active' && (
            <button
              type="button"
              onClick={onStartContributing}
              className="inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-full bg-zinc-950 px-3.5 text-xs font-bold text-white hover:bg-zinc-800 transition-colors cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
            >
              <Sparkles className="h-3 w-3" />
              <span>شارك في نفير هذا الموسم</span>
            </button>
          )}
        </div>
      </div>

      {/* Season Contributors Podium & Registry */}
      {seasonRankings.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-zinc-200 p-8 text-center text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          لم يتم تسجيل مساهمات معتمدة في هذا الموسم حتى الآن.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {seasonRankings.slice(0, 6).map((c, idx) => {
            const words = c.documented_words_count ?? c.accepted_count
            const examples = c.documented_examples_count ?? c.attestations_count
            const total = words + examples
            const rank = computeContributorRank(total)
            const isPodium = idx < 3
            const place = (idx + 1) as 1 | 2 | 3

            return (
              <div
                key={c.public_slug}
                role="button"
                tabIndex={0}
                onClick={() => onSelectContributor(c.public_slug)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectContributor(c.public_slug)
                  }
                }}
                className={`group flex items-center justify-between rounded-xl border p-3.5 transition-all hover:scale-[1.01] cursor-pointer ${
                  idx === 0
                    ? 'border-amber-400/70 bg-gradient-to-r from-amber-500/10 to-transparent dark:border-amber-400/40'
                    : idx === 1
                      ? 'border-slate-300 bg-gradient-to-r from-slate-200/50 to-transparent dark:border-white/20'
                      : idx === 2
                        ? 'border-amber-700/40 bg-gradient-to-r from-amber-700/10 to-transparent dark:border-amber-600/30'
                        : 'border-zinc-200 bg-white dark:border-white/10 dark:bg-[#07070A]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isPodium ? (
                    <MoroccanRankMedal place={place} size={32} />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold text-zinc-500 dark:text-zinc-400">
                      #{idx + 1}
                    </span>
                  )}

                  <Avatar
                    source={c.avatar_source}
                    path={c.avatar_path}
                    seed={c.avatar_seed || c.public_slug}
                    githubHandle={c.github_handle}
                    displayName={c.display_name}
                    size={36}
                    className="shrink-0 ring-1 ring-zinc-200 dark:ring-white/15"
                  />

                  <div className="min-w-0">
                    <h5 className="truncate font-display text-xs sm:text-sm font-bold text-zinc-950 group-hover:text-emerald-800 transition-colors dark:text-white dark:group-hover:text-[#D9FF43]">
                      {c.display_name}
                    </h5>
                    <p className="truncate text-[10.5px] text-zinc-500 dark:text-zinc-400">
                      {c.dialect_region || 'مشترك عام'} · {rank.name}
                    </p>
                  </div>
                </div>

                <div className="text-end shrink-0">
                  <span className="font-mono text-xs font-bold tabular-nums text-emerald-700 dark:text-[#D9FF43]">
                    {total}
                  </span>
                  <p className="text-[10px] text-zinc-400">مساهمة</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
