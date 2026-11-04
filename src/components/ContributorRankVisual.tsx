import type { ContributorRank, MetallicTier } from '../utils/contributorRanks'
import { getRankTierClasses } from '../utils/contributorRanks'

interface RankMedalIconProps {
  tier: MetallicTier
  size?: number
  className?: string
}

/**
 * Bespoke Moroccan geometric metallic medal icons:
 * - Bronze: Warm copper medallion with 8-pointed Moroccan Khatam star and laurel lines.
 * - Silver: Gleaming polished silver shield with Moroccan geometric rosette.
 * - Gold: Radiant 24k gold 8-pointed Khatam star with interlocking geometric facets.
 * - Master/Diamond: Radiant sovereign seal with Moroccan star and emerald/lime brilliance.
 */
export function RankMedalIcon({
  tier,
  size = 20,
  className = '',
}: RankMedalIconProps) {
  switch (tier) {
    case 'bronze':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
          className={`shrink-0 text-[#B87333] dark:text-[#E09858] ${className}`}
        >
          <circle
            cx="16"
            cy="16"
            r="14"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <circle cx="16" cy="16" r="11" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1" />
          {/* Moroccan 8-pointed star rosette */}
          <rect
            x="9.5"
            y="9.5"
            width="13"
            height="13"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.3"
            fill="currentColor"
            fillOpacity="0.25"
          />
          <rect
            x="9.5"
            y="9.5"
            width="13"
            height="13"
            rx="1.5"
            transform="rotate(45 16 16)"
            stroke="currentColor"
            strokeWidth="1.3"
            fill="currentColor"
            fillOpacity="0.2"
          />
          <circle cx="16" cy="16" r="2.2" fill="currentColor" />
        </svg>
      )

    case 'silver':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
          className={`shrink-0 text-slate-400 dark:text-zinc-200 ${className}`}
        >
          {/* Silver Hexagonal Medallion with Laurel Inset */}
          <path
            d="M16 2.5 L27 8.5 L27 23.5 L16 29.5 L5 23.5 L5 8.5 Z"
            fill="currentColor"
            fillOpacity="0.14"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <circle cx="16" cy="16" r="9" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" />
          <path
            d="M16 8.5 L18.2 13.5 L23.5 14.2 L19.5 17.8 L20.7 23.2 L16 20.3 L11.3 23.2 L12.5 17.8 L8.5 14.2 L13.8 13.5 Z"
            fill="currentColor"
            fillOpacity="0.35"
            stroke="currentColor"
            strokeWidth="1.1"
          />
        </svg>
      )

    case 'gold':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
          className={`shrink-0 text-amber-500 dark:text-amber-300 ${className}`}
        >
          {/* 8-pointed Moroccan Golden Medallion */}
          <rect
            x="5.5"
            y="5.5"
            width="21"
            height="21"
            rx="2.5"
            fill="currentColor"
            fillOpacity="0.18"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <rect
            x="5.5"
            y="5.5"
            width="21"
            height="21"
            rx="2.5"
            transform="rotate(45 16 16)"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <circle cx="16" cy="16" r="7.5" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.2" />
          <path
            d="M16 10.5 L17.5 14.5 L21.5 16 L17.5 17.5 L16 21.5 L14.5 17.5 L10.5 16 L14.5 14.5 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1"
          />
        </svg>
      )

    case 'master':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
          className={`shrink-0 text-emerald-600 dark:text-[#D9FF43] ${className}`}
        >
          {/* Diamond Sovereign Crown Medallion with Emerald Inset */}
          <circle
            cx="16"
            cy="16"
            r="14"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="2"
          />
          <rect
            x="7"
            y="7"
            width="18"
            height="18"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeDasharray="2 2"
          />
          <path
            d="M8.5 21.5 L11.5 11.5 L16 16 L20.5 11.5 L23.5 21.5 Z"
            fill="currentColor"
            fillOpacity="0.3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="11.5" cy="10" r="1.5" fill="currentColor" />
          <circle cx="16" cy="14" r="1.5" fill="currentColor" />
          <circle cx="20.5" cy="10" r="1.5" fill="currentColor" />
        </svg>
      )
  }
}

interface RankBadgeChipProps {
  rank: ContributorRank
  size?: 'sm' | 'md'
  showTier?: boolean
  className?: string
}

export function RankBadgeChip({
  rank,
  size = 'sm',
  showTier = false,
  className = '',
}: RankBadgeChipProps) {
  const styles = getRankTierClasses(rank.tier)
  const isSm = size === 'sm'

  return (
    <span
      title={`رتبة ${rank.name} (${rank.tierLabel}) — ${rank.description}`}
      className={`inline-flex items-center gap-1.5 rounded-lg border font-semibold transition-colors ${
        styles.badgeBg
      } ${styles.border} ${styles.text} ${
        isSm ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      } ${className}`}
    >
      <RankMedalIcon tier={rank.tier} size={isSm ? 14 : 16} />
      <span>{rank.name}</span>
      {showTier && (
        <>
          <span aria-hidden="true" className="opacity-50">
            ·
          </span>
          <span className={`font-normal text-[10px] ${styles.pillText}`}>
            {rank.tierLabel}
          </span>
        </>
      )}
    </span>
  )
}

interface RankProgressCardProps {
  rank: ContributorRank
  className?: string
}

export function RankProgressCard({ rank, className = '' }: RankProgressCardProps) {
  const styles = getRankTierClasses(rank.tier)
  const isMaxRank = rank.nextRankMin === null

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 transition-colors ${styles.badgeBg} ${styles.border} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-current/25 bg-white/70 p-2 dark:bg-[#07070A]/80">
            <RankMedalIcon tier={rank.tier} size={36} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
              <span>الرتبة المعجمية الرسمية</span>
              <span aria-hidden="true">·</span>
              <span className={`font-bold ${styles.pillText}`}>{rank.tierLabel}</span>
            </div>
            <h4 className="font-display text-base sm:text-lg font-bold text-zinc-950 dark:text-white">
              {rank.name}
            </h4>
          </div>
        </div>

        <span className="font-mono text-xs font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
          {rank.currentContributions.toLocaleString('en-US')} مساهمة كلية
        </span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
        {rank.description}
      </p>

      {/* Progress Bar towards Next Rank */}
      <div className="mt-3.5 space-y-1.5 border-t border-current/15 pt-3">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-zinc-600 dark:text-zinc-400">
            {isMaxRank
              ? 'أعلى مرتبة معجمية شرفية في المتن'
              : `التقدم نحو الرتبة التالية (الحد الأدنى: ${rank.nextRankMin} مساهمة)`}
          </span>
          <span className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {isMaxRank ? 'مكتمل' : `متبقٍّ ${rank.remainingForNext}`}
          </span>
        </div>

        <div
          role="progressbar"
          aria-label={`التقدم في رتبة ${rank.name}`}
          aria-valuenow={rank.progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
        >
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

        <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400">{rank.actionHint}</p>
      </div>
    </div>
  )
}
