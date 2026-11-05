import type { ContributorRank, MetallicTier } from '../utils/contributorRanks'
import { getRankTierClasses } from '../utils/contributorRanks'

export type ChampionRankPlace = 1 | 2 | 3 | 'diamond' | 'master'

interface MoroccanRankMedalProps {
  place?: ChampionRankPlace
  tier?: MetallicTier
  size?: number
  className?: string
  showRibbon?: boolean
}

/**
 * Bespoke Moroccan Geometric Medallion for:
 * - 1st Place (Gold 🥇): Royal 8-pointed Moroccan Khatam, interlocking 24k gold stars, geometric rosette & central crown
 * - 2nd Place (Silver 🥈): Sterling Silver Andalusian arched shield, 8-fold star & calligraphic qalam/keystone
 * - 3rd Place (Bronze 🥉): Warm Moroccan Copper/Bronze medallion with geometric palm/cedar palmette & 8-pointed star
 * - Diamond Sovereign / Master (💎): Radiant 12-pointed sovereign polygon, dual diamond facets, emerald/lime jewel core
 */
export function MoroccanRankMedal({
  place,
  tier,
  size = 40,
  className = '',
}: MoroccanRankMedalProps) {
  // Determine canonical style key
  const effectiveKey: ChampionRankPlace =
    place !== undefined
      ? place
      : tier === 'master'
        ? 'diamond'
        : tier === 'gold'
          ? 1
          : tier === 'silver'
            ? 2
            : 3

  switch (effectiveKey) {
    case 1:
      // المركز الأول — خاتم الذهب المريني عيار 24 (Moroccan Gold First Place Medallion)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 44 44"
          fill="none"
          aria-hidden="true"
          className={`shrink-0 text-amber-500 dark:text-amber-300 ${className}`}
        >
          {/* Outer Moroccan 8-pointed Khatam star: Two interlocking curved-corner squares */}
          <rect
            x="6.5"
            y="6.5"
            width="31"
            height="31"
            rx="3"
            fill="currentColor"
            fillOpacity="0.18"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <rect
            x="6.5"
            y="6.5"
            width="31"
            height="31"
            rx="3"
            transform="rotate(45 22 22)"
            fill="currentColor"
            fillOpacity="0.14"
            stroke="currentColor"
            strokeWidth="1.6"
          />

          {/* Golden Cardinal Points Jewels */}
          <circle cx="22" cy="3.5" r="1.3" fill="currentColor" />
          <circle cx="22" cy="40.5" r="1.3" fill="currentColor" />
          <circle cx="3.5" cy="22" r="1.3" fill="currentColor" />
          <circle cx="40.5" cy="22" r="1.3" fill="currentColor" />

          {/* Inner Coin Engraved Bezel */}
          <circle
            cx="22"
            cy="22"
            r="12.5"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeOpacity="0.6"
            strokeDasharray="2.5 1.5"
          />
          <circle
            cx="22"
            cy="22"
            r="10.2"
            stroke="currentColor"
            strokeWidth="0.8"
            strokeOpacity="0.4"
          />

          {/* Royal 8-pointed Star & Crown Center Piece */}
          <path
            d="M22 13.5 L24.2 18.2 L29.2 18.8 L25.5 22.3 L26.6 27.2 L22 24.6 L17.4 27.2 L18.5 22.3 L14.8 18.8 L19.8 18.2 Z"
            fill="currentColor"
            fillOpacity="0.35"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          {/* Center Royal Core */}
          <circle cx="22" cy="21.5" r="2.2" fill="currentColor" />
          {/* Radiating Moroccan sunlight flares */}
          <line x1="22" y1="10.8" x2="22" y2="12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="22" y1="31" x2="22" y2="33" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="11" y1="22" x2="13" y2="22" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="31" y1="22" x2="33" y2="22" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )

    case 2:
      // المركز الثاني — وسام الفضة الأندلسي السداسي (Moroccan Silver Second Place Shield)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 44 44"
          fill="none"
          aria-hidden="true"
          className={`shrink-0 text-slate-400 dark:text-zinc-200 ${className}`}
        >
          {/* Andalusian Hexagonal Medallion Frame */}
          <path
            d="M22 3.5 L37 12.2 L37 31.8 L22 40.5 L7 31.8 L7 12.2 Z"
            fill="currentColor"
            fillOpacity="0.14"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />

          {/* Inset Concentric Hexagon */}
          <path
            d="M22 7.2 L33.8 14 L33.8 30 L22 36.8 L10.2 30 L10.2 14 Z"
            stroke="currentColor"
            strokeWidth="0.9"
            strokeOpacity="0.45"
            strokeDasharray="3 1.5"
            strokeLinejoin="round"
          />

          {/* Inner Medallion Circle */}
          <circle cx="22" cy="22" r="10.5" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" />

          {/* Calligraphic Precision Reed Pen (القلم المبسوط) & Horseshoe Arch Motif */}
          <path
            d="M22 13.5 L26.5 19.5 L24.5 28.5 H19.5 L17.5 19.5 Z"
            fill="currentColor"
            fillOpacity="0.3"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <line x1="22" y1="14" x2="22" y2="22" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          <circle cx="22" cy="23.5" r="1.5" fill="currentColor" />
          <line x1="18.5" y1="26.5" x2="25.5" y2="26.5" stroke="currentColor" strokeWidth="1.1" />

          {/* Side Sterling Rosettes */}
          <circle cx="13.5" cy="22" r="1.3" fill="currentColor" fillOpacity="0.8" />
          <circle cx="30.5" cy="22" r="1.3" fill="currentColor" fillOpacity="0.8" />
        </svg>
      )

    case 3:
      // المركز الثالث — طابع النحاس المغربي المسكوك (Moroccan Bronze Third Place Medallion)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 44 44"
          fill="none"
          aria-hidden="true"
          className={`shrink-0 text-[#B87333] dark:text-[#E09858] ${className}`}
        >
          {/* Heavy Beveled Moroccan Copper Roundel */}
          <circle
            cx="22"
            cy="22"
            r="19"
            fill="currentColor"
            fillOpacity="0.15"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <circle
            cx="22"
            cy="22"
            r="15.5"
            stroke="currentColor"
            strokeWidth="1"
            strokeOpacity="0.5"
            strokeDasharray="2 2"
          />

          {/* Moroccan 8-pointed Zellij Inset (Square A + Square B) */}
          <rect
            x="12"
            y="12"
            width="20"
            height="20"
            rx="2"
            fill="currentColor"
            fillOpacity="0.22"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <rect
            x="12"
            y="12"
            width="20"
            height="20"
            rx="2"
            transform="rotate(45 22 22)"
            fill="currentColor"
            fillOpacity="0.18"
            stroke="currentColor"
            strokeWidth="1.2"
          />

          {/* Central Atlas Cedar / Palmette Evergreen Branch */}
          <path
            d="M22 15 L25.5 19.5 H18.5 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.9"
          />
          <path
            d="M22 18.5 L27 24 H17 Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="0.9"
          />
          <line x1="22" y1="24" x2="22" y2="28.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="18" y1="28.5" x2="26" y2="28.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="22" cy="22" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      )

    case 'diamond':
    case 'master':
    default:
      // المرتبة الألماسية المذهبة — تاج المتن المغربي الأعلى (Diamond Sovereign Sovereign Seal)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 44 44"
          fill="none"
          aria-hidden="true"
          className={`shrink-0 text-emerald-600 dark:text-[#D9FF43] ${className}`}
        >
          {/* Sovereign 12-pointed Star: 3 Interlocking Squares rotated at 0, 30, and 60 deg */}
          <rect
            x="6.5"
            y="6.5"
            width="31"
            height="31"
            rx="2.5"
            fill="currentColor"
            fillOpacity="0.14"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="6.5"
            y="6.5"
            width="31"
            height="31"
            rx="2.5"
            transform="rotate(30 22 22)"
            fill="currentColor"
            fillOpacity="0.10"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <rect
            x="6.5"
            y="6.5"
            width="31"
            height="31"
            rx="2.5"
            transform="rotate(60 22 22)"
            fill="currentColor"
            fillOpacity="0.10"
            stroke="currentColor"
            strokeWidth="1.3"
          />

          {/* Sovereign Cardinal Jewel Studs */}
          <circle cx="22" cy="2.8" r="1.4" fill="currentColor" />
          <circle cx="22" cy="41.2" r="1.4" fill="currentColor" />
          <circle cx="2.8" cy="22" r="1.4" fill="currentColor" />
          <circle cx="41.2" cy="22" r="1.4" fill="currentColor" />

          {/* Inner Brilliant Diamond Coin Bezel */}
          <circle
            cx="22"
            cy="22"
            r="12.2"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeOpacity="0.65"
          />
          <circle
            cx="22"
            cy="22"
            r="10"
            stroke="currentColor"
            strokeWidth="0.75"
            strokeOpacity="0.4"
            strokeDasharray="2 1.5"
          />

          {/* Radiant Diamond Facet Inset with Central Crown */}
          <path
            d="M22 13 L28 19 L22 31 L16 19 Z"
            fill="currentColor"
            fillOpacity="0.25"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <line x1="16" y1="19" x2="28" y2="19" stroke="currentColor" strokeWidth="1" />
          <line x1="22" y1="13" x2="22" y2="31" stroke="currentColor" strokeWidth="1" />
          <circle cx="22" cy="19" r="2.4" fill="currentColor" />
          <circle cx="22" cy="19" r="1" fill="#0B0B10" className="dark:fill-white" />
        </svg>
      )
  }
}

/**
 * Backwards-compatible alias for existing code referencing RankMedalIcon.
 */
export function RankMedalIcon({
  tier,
  size = 20,
  className = '',
}: {
  tier: MetallicTier
  size?: number
  className?: string
}) {
  return <MoroccanRankMedal tier={tier} size={size} className={className} />
}

/**
 * Top Three & Diamond Tier Honor Ribbon Badge.
 * Used across the weekly champions ticker, leaderboards, and user profile panels.
 */
interface ChampionPodiumBadgeProps {
  place: ChampionRankPlace
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  customLabel?: string
  className?: string
}

export function ChampionPodiumBadge({
  place,
  size = 'md',
  showLabel = true,
  customLabel,
  className = '',
}: ChampionPodiumBadgeProps) {
  const isSm = size === 'sm'
  const isLg = size === 'lg'

  const meta = (() => {
    switch (place) {
      case 1:
        return {
          label: customLabel || 'المركز الأول · ذهب مغربي',
          shortLabel: 'المركز الأول',
          placeNum: '#1',
          bg: 'bg-amber-500/10 dark:bg-amber-400/15',
          border: 'border-amber-400/80 dark:border-amber-400/60',
          text: 'text-amber-900 dark:text-amber-300',
          badgePill: 'bg-amber-500 text-white dark:bg-[#D9FF43] dark:text-[#050507]',
        }
      case 2:
        return {
          label: customLabel || 'المركز الثاني · فضة أندلسية',
          shortLabel: 'المركز الثاني',
          placeNum: '#2',
          bg: 'bg-slate-200/50 dark:bg-white/10',
          border: 'border-slate-300 dark:border-white/20',
          text: 'text-slate-800 dark:text-zinc-200',
          badgePill: 'bg-slate-600 text-white dark:bg-zinc-200 dark:text-zinc-950',
        }
      case 3:
        return {
          label: customLabel || 'المركز الثالث · نحاس مسكوك',
          shortLabel: 'المركز الثالث',
          placeNum: '#3',
          bg: 'bg-amber-950/10 dark:bg-amber-950/30',
          border: 'border-amber-700/50 dark:border-amber-600/50',
          text: 'text-amber-900 dark:text-amber-300',
          badgePill: 'bg-[#B87333] text-white dark:bg-[#E09858] dark:text-zinc-950',
        }
      case 'diamond':
      case 'master':
      default:
        return {
          label: customLabel || 'المرتبة الألماسية المذهبة · خبير لغوي',
          shortLabel: 'المرتبة الألماسية',
          placeNum: '💎',
          bg: 'bg-emerald-500/10 dark:bg-[#D9FF43]/10',
          border: 'border-emerald-600/50 dark:border-[#D9FF43]/50',
          text: 'text-emerald-900 dark:text-[#D9FF43]',
          badgePill: 'bg-emerald-700 text-white dark:bg-[#D9FF43] dark:text-[#050507]',
        }
    }
  })()

  const medalSize = isSm ? 18 : isLg ? 32 : 24

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xl border font-semibold transition-all ${
        meta.bg
      } ${meta.border} ${meta.text} ${
        isSm ? 'px-2 py-0.5 text-[11px]' : isLg ? 'px-3.5 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'
      } ${className}`}
    >
      <MoroccanRankMedal place={place} size={medalSize} />
      <span className={`rounded-md px-1.5 py-0.2 font-mono text-[10px] font-bold ${meta.badgePill}`}>
        {meta.placeNum}
      </span>
      {showLabel && <span>{isSm ? meta.shortLabel : meta.label}</span>}
    </span>
  )
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
      <MoroccanRankMedal tier={rank.tier} size={isSm ? 16 : 18} />
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
          <div className="rounded-xl border border-current/25 bg-white/80 p-2 dark:bg-[#07070A]/80 shadow-xs">
            <MoroccanRankMedal tier={rank.tier} size={38} />
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
