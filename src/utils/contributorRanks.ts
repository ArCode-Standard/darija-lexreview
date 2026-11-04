export type ContributorRankId = 'novice' | 'seasoned' | 'researcher' | 'expert'
export type MetallicTier = 'bronze' | 'silver' | 'gold' | 'master'

export interface ContributorRankConfig {
  id: ContributorRankId
  name: string
  shortLabel: string
  tier: MetallicTier
  tierLabel: string
  minContributions: number
  nextRankMin: number | null
  description: string
  actionHint: string
}

export interface ContributorRank extends ContributorRankConfig {
  currentContributions: number
  remainingForNext: number
  progressPercent: number
}

export const CONTRIBUTOR_RANKS_CONFIG: ContributorRankConfig[] = [
  {
    id: 'novice',
    name: 'مبتدئ',
    shortLabel: 'رتبة برونزية',
    tier: 'bronze',
    tierLabel: 'المرتبة البرونزية',
    minContributions: 0,
    nextRankMin: 10,
    description: 'في مستهل مسيرة التوثيق المعجمي والتصديق الميداني للدارجة المغربية.',
    actionHint: 'أنجز مساهمات معتمدة لتصل إلى رتبة «مساهم متمرس».',
  },
  {
    id: 'seasoned',
    name: 'مساهم متمرس',
    shortLabel: 'رتبة فضية',
    tier: 'silver',
    tierLabel: 'المرتبة الفضية',
    minContributions: 10,
    nextRankMin: 30,
    description: 'رصيد متقدم ومستقر من المفردات والشواهد المعتمدة بانتظام في المتن.',
    actionHint: 'واصل التوثيق والتدقيق للارتقاء إلى رتبة «باحث دارجة».',
  },
  {
    id: 'researcher',
    name: 'باحث دارجة',
    shortLabel: 'رتبة ذهبية',
    tier: 'gold',
    tierLabel: 'المرتبة الذهبية',
    minContributions: 30,
    nextRankMin: 60,
    description: 'أثر لغوي رصين وبصمة بحثية عميقة في إثراء الحقول الدلالية والتدقيق الجهوي.',
    actionHint: 'اقتربت من بلوغ أعلى مرتبة معجمية: «خبير لغوي».',
  },
  {
    id: 'expert',
    name: 'خبير لغوي',
    shortLabel: 'رتبة ألماسي مذهب',
    tier: 'master',
    tierLabel: 'المرتبة الألماسية المذهبة',
    minContributions: 60,
    nextRankMin: null,
    description: 'مرجعية معجمية عليا ساهمت في بناء أعمدة المتن وتحكيم أصالته اللسانية.',
    actionHint: 'أعلى رتبة معجمية شرفية في المنصة.',
  },
]

export function computeContributorRank(totalContributions: number): ContributorRank {
  const count = Math.max(0, Math.floor(Number(totalContributions) || 0))

  let matched = CONTRIBUTOR_RANKS_CONFIG[0]
  for (let i = CONTRIBUTOR_RANKS_CONFIG.length - 1; i >= 0; i--) {
    if (count >= CONTRIBUTOR_RANKS_CONFIG[i].minContributions) {
      matched = CONTRIBUTOR_RANKS_CONFIG[i]
      break
    }
  }

  const nextMin = matched.nextRankMin
  const remaining = nextMin !== null ? Math.max(0, nextMin - count) : 0
  const progressPercent =
    nextMin !== null
      ? Math.min(
          100,
          Math.max(
            8,
            Math.round(
              ((count - matched.minContributions) / (nextMin - matched.minContributions)) * 100,
            ),
          ),
        )
      : 100

  return {
    ...matched,
    currentContributions: count,
    remainingForNext: remaining,
    progressPercent,
  }
}

export function getRankTierClasses(tier: MetallicTier): {
  badgeBg: string
  border: string
  text: string
  glow: string
  pillText: string
} {
  switch (tier) {
    case 'bronze':
      return {
        badgeBg: 'bg-amber-950/10 dark:bg-amber-950/30',
        border: 'border-amber-700/40 dark:border-amber-600/50',
        text: 'text-amber-900 dark:text-amber-300',
        glow: 'shadow-amber-900/10',
        pillText: 'text-amber-800 dark:text-amber-400',
      }
    case 'silver':
      return {
        badgeBg: 'bg-zinc-200/50 dark:bg-zinc-800/50',
        border: 'border-zinc-300 dark:border-zinc-600',
        text: 'text-zinc-800 dark:text-zinc-200',
        glow: 'shadow-zinc-400/10',
        pillText: 'text-zinc-700 dark:text-zinc-300',
      }
    case 'gold':
      return {
        badgeBg: 'bg-amber-100/70 dark:bg-amber-950/40',
        border: 'border-amber-400/80 dark:border-amber-400/50',
        text: 'text-amber-900 dark:text-amber-300',
        glow: 'shadow-amber-500/15',
        pillText: 'text-amber-700 dark:text-amber-400',
      }
    case 'master':
      return {
        badgeBg: 'bg-emerald-50/80 dark:bg-[#D9FF43]/10',
        border: 'border-emerald-600/60 dark:border-[#D9FF43]/60',
        text: 'text-emerald-900 dark:text-[#D9FF43]',
        glow: 'shadow-emerald-500/20',
        pillText: 'text-emerald-700 dark:text-[#D9FF43]',
      }
  }
}
