import type { UserRole } from '../types/lexicon'

export type MeritBadgeId =
  | 'admin_steward'
  | 'certified_editor'
  | 'senior_lexicographer'
  | 'verified_contributor'
  | 'attestation_guardian'
  | 'regional_specialist'
  | 'github_verified'

export interface MeritBadge {
  id: MeritBadgeId
  label: string
  description: string
  tone: 'lime' | 'emerald' | 'sky' | 'amber' | 'neutral'
}

export interface MeritBadgeInput {
  role: UserRole
  acceptedCount?: number
  attestationsCount?: number
  dialectRegion?: string | null
  githubHandle?: string | null
}

export function computeContributorBadges(input: MeritBadgeInput): MeritBadge[] {
  const badges: MeritBadge[] = []
  const accepted = input.acceptedCount ?? 0
  const attestations = input.attestationsCount ?? 0
  const hasRegion = Boolean(input.dialectRegion && input.dialectRegion.trim().length > 0)
  const hasGithub = Boolean(input.githubHandle && input.githubHandle.trim().length > 0)

  if (input.role === 'admin') {
    badges.push({
      id: 'admin_steward',
      label: 'مشرف عام',
      description: 'مسؤول عن حوكمة المتن وإدارة صلاحيات الأعضاء والإصدارات الرسمية.',
      tone: 'lime',
    })
  } else if (input.role === 'editor') {
    badges.push({
      id: 'certified_editor',
      label: 'محرر معتمد',
      description: 'مخوّل بتحكيم المقترحات المعجمية وتدقيق الشواهد السياقية.',
      tone: 'lime',
    })
  }

  if (accepted >= 10) {
    badges.push({
      id: 'senior_lexicographer',
      label: 'موثّق معجمي متقدم',
      description: 'اعتُمدت له 10 مساهمات معجمية أو أكثر في المتن الرسمي.',
      tone: 'emerald',
    })
  } else if (accepted >= 1) {
    badges.push({
      id: 'verified_contributor',
      label: 'مساهم موثّق',
      description: 'ساهم بمفردات أو تعديلات مقبولة ومعتمدة في المعجم.',
      tone: 'emerald',
    })
  }

  if (attestations >= 15) {
    badges.push({
      id: 'attestation_guardian',
      label: 'مدقّق شواهد',
      description: 'أنجز 15 تصديقاً ميدانياً أو أكثر لضبط جودة المفردات والشواهد.',
      tone: 'sky',
    })
  }

  if (hasRegion && (accepted >= 2 || attestations >= 5 || input.role !== 'reviewer')) {
    badges.push({
      id: 'regional_specialist',
      label: 'خبير لهجي جهوي',
      description: `يوثّق الاستعمال المتداول في منطقة ${input.dialectRegion}.`,
      tone: 'amber',
    })
  }

  if (hasGithub) {
    badges.push({
      id: 'github_verified',
      label: 'هوية GitHub موثقة',
      description: 'ربط حسابه بمعرّف GitHub مفتوح المصدر لتوثيق النَّسَب العلمي.',
      tone: 'neutral',
    })
  }

  return badges
}

export function getBadgeClasses(tone: MeritBadge['tone']): string {
  switch (tone) {
    case 'lime':
      return 'border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:border-[#D9FF43]/45 dark:bg-[#D9FF43]/12 dark:text-[#D9FF43]'
    case 'emerald':
      return 'border-emerald-300/70 bg-emerald-50/70 text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-950/35 dark:text-emerald-300'
    case 'sky':
      return 'border-sky-300/70 bg-sky-50/70 text-sky-800 dark:border-sky-500/35 dark:bg-sky-950/35 dark:text-sky-300'
    case 'amber':
      return 'border-amber-300/70 bg-amber-50/70 text-amber-900 dark:border-amber-500/35 dark:bg-amber-950/35 dark:text-amber-300'
    default:
      return 'border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-white/12 dark:bg-white/[0.04] dark:text-zinc-300'
  }
}
