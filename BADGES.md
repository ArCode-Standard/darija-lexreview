# Badges

Portable badge and contributor-rank collection extracted from **ArCode-Standard/darija-lexreview**.

> This is a reference/export bundle for reuse in a future repository. The existing website continues to use its original source files; this document does not replace or modify the live implementation.

## Contents

- 11 merit-badge definitions with identifiers, codes, tiers, points, descriptions, eligibility criteria, and icon keys.
- Moroccan geometric SVG artwork for merit seals and badge components.
- Four contributor ranks (bronze, silver, gold, master/diamond) and their contribution thresholds.
- Rank medal artwork and podium/rank presentation components.

## Integration notes

The source excerpts below are preserved from the website implementation. They currently use React, TypeScript, Tailwind CSS, and the website's existing UserRole type. When moving them into another repository:

1. Copy the catalog and visual components into the new project's badge module.
2. Replace the relative UserRole import with the destination project's role type, or define a compatible local type.
3. Ensure React and Tailwind CSS are configured, or adapt the class names to the destination styling system.
4. Keep badge IDs and codes stable if existing user awards or records refer to them.
5. Treat the criteria in the catalog as the award policy; do not award badges from display labels alone.

## Source of truth in the current website

The live website still imports the original files:

- src/utils/meritBadges.ts
- src/components/MeritBadgeVisual.tsx
- src/utils/contributorRanks.ts
- src/components/ContributorRankVisual.tsx

Seasonal sprint history and participation data remain separate from permanent merit badges, in src/components/SeasonalLeaderboardSection.tsx and the sprint data/service layer. Sprint participation can contribute to merit-badge eligibility, but seasonal leaderboard entries are not automatically permanent badges.

---
## src/utils/meritBadges.ts

Merit badge catalog, eligibility rules, progress milestones, and tone/tier classes

```typescript
import type { UserRole } from '../types/lexicon'

export type MeritBadgeId =
  | 'admin_steward'
  | 'certified_editor'
  | 'senior_lexicographer'
  | 'attestation_guardian'
  | 'category_expert'
  | 'regional_specialist'
  | 'sprint_champion'
  | 'pioneer_cohort'
  | 'active_corrector'
  | 'verified_contributor'
  | 'github_verified'

export type MeritBadgeTier = 'sovereign' | 'distinguished' | 'merit'

export type MeritBadgeTone = 'gold' | 'lime' | 'emerald' | 'sky' | 'amber' | 'neutral'

export type MeritBadgeIconKey =
  | 'diwan_seal'
  | 'maghrebi_qalam'
  | 'thuraya_crown'
  | 'marrakech_astrolabe'
  | 'zellij_taxonomy'
  | 'atlas_compass'
  | 'sprint_standard'
  | 'atlas_cedar'
  | 'shadda_loupe'
  | 'corpus_stamp'
  | 'open_lineage'

export interface MeritBadge {
  id: MeritBadgeId
  /** Exclusive platform-specific Moroccan seal title */
  sealName: string
  /** Clear functional/scholarly title */
  label: string
  tier: MeritBadgeTier
  tierLabel: string
  code: string
  pointsWeight: number
  description: string
  criteria: string
  valueStatement: string
  tone: MeritBadgeTone
  icon: MeritBadgeIconKey
}

export interface MeritBadgeInput {
  role: UserRole
  acceptedCount?: number
  attestationsCount?: number
  documentedWordsCount?: number
  sprintParticipationsCount?: number
  sprintBadgeLabel?: string | null
  dialectRegion?: string | null
  specialty?: string | null
  githubHandle?: string | null
  joinedYear?: number | null
}

export interface MeritBadgeMilestone {
  badge: MeritBadge
  current: number
  target: number
  remaining: number
  percent: number
  progressLabel: string
  remainingLabel: string
  actionHint: string
}

export const MERIT_TIER_LABELS: Record<MeritBadgeTier, string> = {
  sovereign: 'وسام سيادي رفيع',
  distinguished: 'وسام استحقاق علمي',
  merit: 'وسام جدارة ميدانية',
}

export const MERIT_BADGE_CATALOG: MeritBadge[] = [
  {
    id: 'admin_steward',
    sealName: 'ختم أمانة الديوان',
    label: 'مشرف عام',
    tier: 'sovereign',
    tierLabel: 'وسام سيادي رفيع',
    code: 'ARC-S01',
    pointsWeight: 60,
    description: 'مؤتمن على حوكمة المدونة المعجمية وضبط صلاحيات التحرير واعتماد الإصدارات المرجعية.',
    criteria: 'يُمنح لأمناء المنصة المشرفين على حوكمة المتن والنشر الرسمي.',
    valueStatement: 'أعلى أختام الأمانة المؤسسية وضمان النزاهة العلمية للمتن المفتوح.',
    tone: 'gold',
    icon: 'diwan_seal',
  },
  {
    id: 'certified_editor',
    sealName: 'وسام القلم المحكَّم',
    label: 'محرر معتمد',
    tier: 'sovereign',
    tierLabel: 'وسام سيادي رفيع',
    code: 'ARC-S02',
    pointsWeight: 50,
    description: 'عضو في الهيئة التحريرية مخوّل بتحكيم المقترحات المعجمية وإجازة الشواهد السياقية.',
    criteria: 'عضوية الهيئة التحريرية المعتمدة لمراجعة المقترحات وإقرارها في المتن.',
    valueStatement: 'إجازة علمية بأهلية التحكيم اللساني وصياغة التعاريف المعجمية المعيارية.',
    tone: 'gold',
    icon: 'maghrebi_qalam',
  },
  {
    id: 'senior_lexicographer',
    sealName: 'تاج المتن المغربي',
    label: 'موثّق معجمي متقدم',
    tier: 'sovereign',
    tierLabel: 'وسام سيادي رفيع',
    code: 'ARC-S03',
    pointsWeight: 50,
    description: 'من كبار بُناة المدونة؛ اعتُمدت له 10 مساهمات معجمية محكّمة أو أكثر في المتن الرسمي.',
    criteria: 'اعتماد 10 مداخل أو تعديلات معجمية محكّمة في المتن الرسمي.',
    valueStatement: 'يُدرج حامله ضمن طليعة المؤلفين المساهمين في حفظ الذاكرة اللسانية المغربية.',
    tone: 'gold',
    icon: 'thuraya_crown',
  },
  {
    id: 'attestation_guardian',
    sealName: 'أسطرلاب الشواهد',
    label: 'مدقّق شواهد',
    tier: 'distinguished',
    tierLabel: 'وسام استحقاق علمي',
    code: 'ARC-S04',
    pointsWeight: 35,
    description: 'أنجز 15 عملية رصد وتصديق سياقي ميداني لضبط صحة الشواهد ودقتها اللهجية.',
    criteria: 'إنجاز 15 تصديقاً ميدانياً موثقاً للشواهد السياقية في المعجم.',
    valueStatement: 'شهادة بصرامة التثبّت الميداني وحصانة الشواهد من التصحيف والاضطراب.',
    tone: 'emerald',
    icon: 'marrakech_astrolabe',
  },
  {
    id: 'category_expert',
    sealName: 'خاتم الزليج الدلالي',
    label: 'خبير الفئات',
    tier: 'distinguished',
    tierLabel: 'وسام استحقاق علمي',
    code: 'ARC-S05',
    pointsWeight: 30,
    description: 'متمرس في هندسة الحقول الدلالية وتصنيف المفردات المغربية في أبوابها المعجمية.',
    criteria: 'توثيق 4 مفردات فأكثر مع تحديد التخصص اللساني، أو توثيق 8 مفردات مصنفة.',
    valueStatement: 'يُثبت الكفاءة في التبويب الدلالي وبناء المعاجم الموضوعاتية المتخصصة.',
    tone: 'amber',
    icon: 'zellij_taxonomy',
  },
  {
    id: 'regional_specialist',
    sealName: 'بوصلة الأطلس اللهجي',
    label: 'خبير لهجي جهوي',
    tier: 'distinguished',
    tierLabel: 'وسام استحقاق علمي',
    code: 'ARC-S06',
    pointsWeight: 30,
    description: 'يرصد المتغيرات الصوتية والدلالية والتداول الحي في جهته الجغرافية المغربية.',
    criteria: 'تحديد المنطقة اللهجية مع اعتماد مفردتين أو إنجاز 5 تصديقات جهوية.',
    valueStatement: 'مرجعية مكانية توثّق التنوع الجغرافي للدارجة عبر حواضر المغرب وبواديه.',
    tone: 'emerald',
    icon: 'atlas_compass',
  },
  {
    id: 'sprint_champion',
    sealName: 'لواء النفير المعجمي',
    label: 'مشارك في حملات التوثيق',
    tier: 'distinguished',
    tierLabel: 'وسام استحقاق علمي',
    code: 'ARC-S07',
    pointsWeight: 30,
    description: 'لبّى نداء حملات التوثيق الموجهة لسد الفجوات المعجمية والجهوية ذات الأولوية.',
    criteria: 'المساهمة الميدانية الفعالة في إحدى حملات التوثيق الجماعية الموجهة.',
    valueStatement: 'يُخلّد الأثر التعاوني في المهمات العلمية المركّزة للمنصة.',
    tone: 'lime',
    icon: 'sprint_standard',
  },
  {
    id: 'pioneer_cohort',
    sealName: 'غرسة الرعيل المؤسس',
    label: 'عضو الرعيل المؤسس',
    tier: 'distinguished',
    tierLabel: 'وسام استحقاق تأسيسي',
    code: 'ARC-S08',
    pointsWeight: 30,
    description: 'من الرعيل الأول الذي أرسى اللبنات التأسيسية للمعجم المغربي المفتوح في عام انطلاقه.',
    criteria: 'الانضمام في الحقبة التأسيسية (2026 وما قبلها) مع مساهمة معتمدة أو 3 تصديقات.',
    valueStatement: 'وسام تاريخي تأسيسي يوثّق الأسبقية في بناء صرح المعجم المفتوح.',
    tone: 'emerald',
    icon: 'atlas_cedar',
  },
  {
    id: 'active_corrector',
    sealName: 'عدسة الضبط والتصويب',
    label: 'مصحح نشط',
    tier: 'merit',
    tierLabel: 'وسام جدارة ميدانية',
    code: 'ARC-S09',
    pointsWeight: 20,
    description: 'يواظب على فحص البطاقات المعجمية وتنقيح المعاني والشواهد السياقية بدقة.',
    criteria: 'إنجاز 5 مراجعات وتصديقات ميدانية، أو الجمع بين التوثيق والتصحيح السياقي.',
    valueStatement: 'عنوان اليقظة التحريرية وصيانة المعجم من الهفوات اللغوية والسياقية.',
    tone: 'sky',
    icon: 'shadda_loupe',
  },
  {
    id: 'verified_contributor',
    sealName: 'طابع الاعتماد المعجمي',
    label: 'مساهم موثّق',
    tier: 'merit',
    tierLabel: 'وسام جدارة ميدانية',
    code: 'ARC-S10',
    pointsWeight: 15,
    description: 'اجتازت مساهمته التحكيم العلمي وأُدرجت رسمياً في متن المعجم المغربي المفتوح.',
    criteria: 'اعتماد أول مفردة أو تعديل معجمي رسمي في المتن بعد المراجعة.',
    valueStatement: 'إشهاد رسمي بدخول سجل المؤلفين المساهمين في المدونة المفتوحة.',
    tone: 'emerald',
    icon: 'corpus_stamp',
  },
  {
    id: 'github_verified',
    sealName: 'عقدة النَّسَب المفتوح',
    label: 'هوية GitHub موثقة',
    tier: 'merit',
    tierLabel: 'وسام نَسَب مفتوح',
    code: 'ARC-S11',
    pointsWeight: 10,
    description: 'ربط مساهماته اللسانية بمعرّف GitHub عام لتوثيق النَّسَب العلمي والبرمجي المفتوح.',
    criteria: 'ربط الحساب بهوية GitHub عامة لتعزيز قابلية التحقق الأكاديمي والتقني.',
    valueStatement: 'يجسر الهوية اللسانية بمجتمع المصادر المفتوحة واللسانيات الحاسوبية.',
    tone: 'neutral',
    icon: 'open_lineage',
  },
]

const CATALOG_BY_ID = new Map<MeritBadgeId, MeritBadge>(
  MERIT_BADGE_CATALOG.map((b) => [b.id, b]),
)

function cloneCatalogBadge(
  id: MeritBadgeId,
  overrides?: Partial<Pick<MeritBadge, 'label' | 'description'>>,
): MeritBadge {
  const base = CATALOG_BY_ID.get(id)!
  return overrides ? { ...base, ...overrides } : { ...base }
}

export function computeContributorBadges(input: MeritBadgeInput): MeritBadge[] {
  const badges: MeritBadge[] = []
  const accepted = input.acceptedCount ?? 0
  const attestations = input.attestationsCount ?? 0
  const wordsCount = input.documentedWordsCount ?? accepted
  const sprintParticipations = input.sprintParticipationsCount ?? 0
  const hasRegion = Boolean(input.dialectRegion && input.dialectRegion.trim().length > 0)
  const hasSpecialty = Boolean(input.specialty && input.specialty.trim().length > 0)
  const hasGithub = Boolean(input.githubHandle && input.githubHandle.trim().length > 0)
  const isFoundingCohort =
    input.joinedYear != null &&
    input.joinedYear <= 2026 &&
    (accepted >= 1 || wordsCount >= 1 || attestations >= 3 || input.role !== 'reviewer')

  if (input.role === 'admin') {
    badges.push(cloneCatalogBadge('admin_steward'))
  } else if (input.role === 'editor') {
    badges.push(cloneCatalogBadge('certified_editor'))
  }

  if (accepted >= 10) {
    badges.push(cloneCatalogBadge('senior_lexicographer'))
  } else if (accepted >= 1) {
    badges.push(cloneCatalogBadge('verified_contributor'))
  }

  if (attestations >= 15) {
    badges.push(cloneCatalogBadge('attestation_guardian'))
  }

  if ((hasSpecialty && (wordsCount >= 4 || accepted >= 3)) || wordsCount >= 8) {
    badges.push(
      cloneCatalogBadge('category_expert', {
        description: hasSpecialty
          ? `متخصص في تبويب وتوثيق الحقول الدلالية (${input.specialty}).`
          : 'ساهم في توثيق وتصنيف مفردات متعددة عبر الفئات الدلالية للمعجم.',
      }),
    )
  }

  if (hasRegion && (accepted >= 2 || attestations >= 5 || input.role !== 'reviewer')) {
    badges.push(
      cloneCatalogBadge('regional_specialist', {
        description: `يوثّق التداول الحي والفروق الصوتية والدلالية في منطقة ${input.dialectRegion}.`,
      }),
    )
  }

  if (sprintParticipations >= 1) {
    badges.push(
      cloneCatalogBadge('sprint_champion', {
        label: input.sprintBadgeLabel?.trim() || 'مشارك في حملات التوثيق',
        description: `ساهم بفعالية (${sprintParticipations} مساهمة) في إنجاز أهداف حملات التوثيق الجماعية للمعجم.`,
      }),
    )
  }

  if (isFoundingCohort) {
    badges.push(cloneCatalogBadge('pioneer_cohort'))
  }

  if (attestations >= 5 || (accepted >= 2 && attestations >= 3)) {
    badges.push(cloneCatalogBadge('active_corrector'))
  }

  if (hasGithub) {
    badges.push(cloneCatalogBadge('github_verified'))
  }

  return badges
}

/**
 * Computes the contributor's overall institutional honor standing and total merit points
 * derived strictly from their verified platform seals.
 */
export function computeContributorHonorStanding(badges: MeritBadge[]): {
  totalPoints: number
  sovereignCount: number
  distinguishedCount: number
  standingTitle: string
} {
  const totalPoints = badges.reduce((sum, b) => sum + b.pointsWeight, 0)
  const sovereignCount = badges.filter((b) => b.tier === 'sovereign').length
  const distinguishedCount = badges.filter((b) => b.tier === 'distinguished').length

  let standingTitle = 'عضو مساهم في المدونة'
  if (sovereignCount >= 2 || (sovereignCount >= 1 && totalPoints >= 150)) {
    standingTitle = 'زميل الديوان المعجمي الأعلى'
  } else if (sovereignCount >= 1 || totalPoints >= 95) {
    standingTitle = 'حامل الأختام العلمية الكبرى'
  } else if (distinguishedCount >= 2 || totalPoints >= 55) {
    standingTitle = 'موثّق مرجعي متقدم'
  } else if (badges.length >= 1) {
    standingTitle = 'موثّق معتمد في سجل الشرف'
  }

  return {
    totalPoints,
    sovereignCount,
    distinguishedCount,
    standingTitle,
  }
}

function formatRemainingArabic(
  remaining: number,
  forms: { one: string; two: string; few: string; many: string },
): string {
  if (remaining <= 0) return 'مكتمل'
  if (remaining === 1) return `متبقٍّ ${forms.one}`
  if (remaining === 2) return `متبقٍّ ${forms.two}`
  if (remaining >= 3 && remaining <= 10) return `متبقٍّ ${remaining} ${forms.few}`
  return `متبقٍّ ${remaining} ${forms.many}`
}

/**
 * Computes actionable next-badge milestones for a contributor so every seal
 * feels attainable through clear scholarly contributions.
 */
export function computeNextBadgeMilestones(input: MeritBadgeInput): MeritBadgeMilestone[] {
  const earnedIds = new Set(computeContributorBadges(input).map((b) => b.id))
  const accepted = input.acceptedCount ?? 0
  const attestations = input.attestationsCount ?? 0
  const wordsCount = input.documentedWordsCount ?? accepted
  const sprintParticipations = input.sprintParticipationsCount ?? 0
  const hasRegion = Boolean(input.dialectRegion && input.dialectRegion.trim().length > 0)
  const hasSpecialty = Boolean(input.specialty && input.specialty.trim().length > 0)

  const milestones: MeritBadgeMilestone[] = []

  if (!earnedIds.has('verified_contributor') && !earnedIds.has('senior_lexicographer')) {
    const current = Math.min(accepted, 1)
    const remaining = Math.max(1, 1 - current)
    milestones.push({
      badge: CATALOG_BY_ID.get('verified_contributor')!,
      current,
      target: 1,
      remaining,
      percent: Math.min(100, Math.round((current / 1) * 100)),
      progressLabel: `${current} / 1 مقترح معتمد`,
      remainingLabel: formatRemainingArabic(remaining, {
        one: 'مقترح معتمد واحد',
        two: 'مقترحان معتمدان',
        few: 'مقترحات معتمدة',
        many: 'مقترحاً معتمداً',
      }),
      actionHint: 'اقترح مفردة أو مثلاً موثقاً بشاهد سياقي ليُعتمد في المتن.',
    })
  }

  if (!earnedIds.has('active_corrector')) {
    const current = Math.min(attestations, 5)
    const remaining = Math.max(1, 5 - current)
    milestones.push({
      badge: CATALOG_BY_ID.get('active_corrector')!,
      current,
      target: 5,
      remaining,
      percent: Math.min(100, Math.round((current / 5) * 100)),
      progressLabel: `${current} / 5 مراجعات وتصديقات`,
      remainingLabel: formatRemainingArabic(remaining, {
        one: 'تصديق سياقي واحد',
        two: 'تصديقان سياقيان',
        few: 'تصديقات سياقية',
        many: 'تصديقاً سياقياً',
      }),
      actionHint: 'راجع البطاقات المعجمية وأكّد دقة شواهدها أو نبّه على ما يحتاج تعديلاً.',
    })
  }

  if (!earnedIds.has('category_expert')) {
    const target = hasSpecialty ? 4 : 8
    const current = Math.min(wordsCount, target)
    const remaining = Math.max(1, target - current)
    milestones.push({
      badge: CATALOG_BY_ID.get('category_expert')!,
      current,
      target,
      remaining,
      percent: Math.min(100, Math.round((current / target) * 100)),
      progressLabel: `${current} / ${target} مفردات مصنفة`,
      remainingLabel: formatRemainingArabic(remaining, {
        one: 'مفردة مصنفة واحدة',
        two: 'مفردتان مصنفتان',
        few: 'مفردات مصنفة',
        many: 'مفردة مصنفة',
      }),
      actionHint: hasSpecialty
        ? 'واصل توثيق المفردات ضمن تخصصك الدلالي لنيل الخاتم.'
        : 'حدّد تخصصك اللساني في ملفك الشخصي لتخفيض الشرط إلى 4 مفردات معتمدة.',
    })
  }

  if (!earnedIds.has('regional_specialist')) {
    const current = hasRegion ? Math.min(attestations, 5) : 0
    const remaining = hasRegion ? Math.max(1, 5 - current) : 5
    milestones.push({
      badge: CATALOG_BY_ID.get('regional_specialist')!,
      current,
      target: 5,
      remaining,
      percent: hasRegion ? Math.min(100, Math.round((current / 5) * 100)) : 15,
      progressLabel: hasRegion ? `${current} / 5 تصديقات جهوية` : 'يتطلب تحديد منطقتك اللهجية',
      remainingLabel: hasRegion
        ? formatRemainingArabic(remaining, {
            one: 'تصديق جهوي واحد',
            two: 'تصديقان جهويان',
            few: 'تصديقات جهوية',
            many: 'تصديقاً جهوياً',
          })
        : 'تحديد الجهة + 5 تصديقات',
      actionHint: hasRegion
        ? 'صدّق على 5 شواهد متداولة في منطقتك أو اعتمد مفردتين جهويتين.'
        : 'اختر منطقتك اللهجية في ملفك الشخصي ثم وثّق تداول مفرداتها.',
    })
  }

  if (!earnedIds.has('senior_lexicographer')) {
    const current = Math.min(accepted, 10)
    const remaining = Math.max(1, 10 - current)
    milestones.push({
      badge: CATALOG_BY_ID.get('senior_lexicographer')!,
      current,
      target: 10,
      remaining,
      percent: Math.min(100, Math.round((current / 10) * 100)),
      progressLabel: `${current} / 10 مساهمات معتمدة`,
      remainingLabel: formatRemainingArabic(remaining, {
        one: 'مساهمة معتمدة واحدة',
        two: 'مساهمتان معتمدتان',
        few: 'مساهمات معتمدة',
        many: 'مساهمة معتمدة',
      }),
      actionHint: 'وسام سيادي رفيع يُمنح عند بلوغ 10 مساهمات محكّمة في المتن الرسمي.',
    })
  }

  if (!earnedIds.has('attestation_guardian')) {
    const current = Math.min(attestations, 15)
    const remaining = Math.max(1, 15 - current)
    milestones.push({
      badge: CATALOG_BY_ID.get('attestation_guardian')!,
      current,
      target: 15,
      remaining,
      percent: Math.min(100, Math.round((current / 15) * 100)),
      progressLabel: `${current} / 15 تصديقاً سياقياً`,
      remainingLabel: formatRemainingArabic(remaining, {
        one: 'تصديق سياقي واحد',
        two: 'تصديقان سياقيان',
        few: 'تصديقات سياقية',
        many: 'تصديقاً سياقياً',
      }),
      actionHint: 'واظب على فحص الشواهد السياقية عبر المعجم لنيل أسطرلاب الشواهد.',
    })
  }

  if (!earnedIds.has('sprint_champion')) {
    const current = Math.min(sprintParticipations, 1)
    const remaining = Math.max(1, 1 - current)
    milestones.push({
      badge: CATALOG_BY_ID.get('sprint_champion')!,
      current,
      target: 1,
      remaining,
      percent: Math.min(100, Math.round((current / 1) * 100)),
      progressLabel: `${current} / 1 مساهمة في حملة`,
      remainingLabel: 'متبقٍّ مساهمة واحدة في حملة توثيق',
      actionHint: 'شارك بشاهد أو مفردة ضمن إحدى حملات التوثيق الموجهة الجارية.',
    })
  }

  return milestones.sort((a, b) => b.percent - a.percent).slice(0, 3)
}

export function getBadgeClasses(tone: MeritBadgeTone): string {
  switch (tone) {
    case 'gold':
      return 'border-amber-400/80 bg-amber-50/90 text-amber-950 dark:border-[#D9FF43]/60 dark:bg-[#D9FF43]/14 dark:text-[#D9FF43]'
    case 'lime':
      return 'border-emerald-500/45 bg-emerald-50 text-emerald-950 dark:border-[#D9FF43]/45 dark:bg-[#D9FF43]/10 dark:text-[#D9FF43]'
    case 'emerald':
      return 'border-emerald-400/70 bg-emerald-50/80 text-emerald-900 dark:border-emerald-400/40 dark:bg-emerald-950/45 dark:text-emerald-300'
    case 'sky':
      return 'border-sky-300/80 bg-sky-50/80 text-sky-900 dark:border-sky-400/40 dark:bg-sky-950/45 dark:text-sky-300'
    case 'amber':
      return 'border-amber-300/80 bg-amber-50/75 text-amber-900 dark:border-amber-400/40 dark:bg-amber-950/40 dark:text-amber-300'
    default:
      return 'border-zinc-300/80 bg-zinc-100/90 text-zinc-800 dark:border-white/15 dark:bg-white/[0.05] dark:text-zinc-200'
  }
}

export function getTierPillClasses(tier: MeritBadgeTier): string {
  switch (tier) {
    case 'sovereign':
      return 'text-amber-800 dark:text-[#D9FF43]'
    case 'distinguished':
      return 'text-emerald-800 dark:text-emerald-300'
    default:
      return 'text-sky-800 dark:text-sky-300'
  }
}

```

---

## src/components/MeritBadgeVisual.tsx

Original SVG artwork, seals, chips, and medallion cards

```tsx
import {
  type MeritBadge,
  type MeritBadgeIconKey,
  type MeritBadgeTier,
  type MeritBadgeTone,
  getBadgeClasses,
  getTierPillClasses,
} from '../utils/meritBadges'

/**
 * Inner bespoke geometric artwork tailored exclusively for ArCode Moroccan Darija Lexicon.
 * Drawn inside a 40x40 coordinate system centered at (20, 20).
 */
function renderInnerSealGlyph(icon: MeritBadgeIconKey) {
  switch (icon) {
    case 'diwan_seal':
      // Andalusian Horseshoe Arch & Sovereign Keystone
      return (
        <g stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M13.5 27.5V20.8C13.5 16.5 16.4 13.4 20 13.4C23.6 13.4 26.5 16.5 26.5 20.8V27.5" />
          <path d="M16.2 27.5V21.2C16.2 18.7 17.9 16.8 20 16.8C22.1 16.8 23.8 18.7 23.8 21.2V27.5" />
          <line x1="11.5" y1="27.5" x2="28.5" y2="27.5" />
          <path d="M20 10.6L21.3 12.2L20 13.8L18.7 12.2Z" fill="currentColor" stroke="none" />
        </g>
      )

    case 'maghrebi_qalam':
      // Maghrebi Calligraphic Reed Pen Nib (القلم المغربي المبسوط) + Precision Crossbar
      return (
        <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M20 11.5L25.6 19.2L23.2 27.8H16.8L14.4 19.2L20 11.5Z" />
          <line x1="20" y1="11.8" x2="20" y2="20.4" />
          <circle cx="20" cy="21.6" r="1.45" fill="currentColor" stroke="none" />
          <line x1="15.2" y1="25.2" x2="24.8" y2="25.2" />
        </g>
      )

    case 'thuraya_crown':
      // Moroccan Thuraya Crown & Sovereign Star
      return (
        <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M12.6 25.2L14.2 16.4L18.1 20.3L20 13.2L21.9 20.3L25.8 16.4L27.4 25.2H12.6Z" />
          <line x1="13" y1="27.6" x2="27" y2="27.6" />
          <circle cx="20" cy="11.4" r="1.15" fill="currentColor" stroke="none" />
        </g>
      )

    case 'marrakech_astrolabe':
      // Marrakech Brass Astrolabe Rete & Alidade Sight Rule (الأسطرلاب المراكشي)
      return (
        <g stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <circle cx="20" cy="20.8" r="7.2" />
          <path d="M15.2 18.2C16.6 20.1 18.2 21 20 21C21.8 21 23.4 20.1 24.8 18.2" />
          <line x1="14.4" y1="25.4" x2="25.6" y2="16.2" />
          <circle cx="20" cy="20.8" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="20" cy="12" r="1.4" />
        </g>
      )

    case 'zellij_taxonomy':
      // Interlocking 4-Fold Moroccan Zellij Rosette (فسيفساء الحقول الدلالية)
      return (
        <g stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M20 12L23.2 16.8L28 20L23.2 23.2L20 28L16.8 23.2L12 20L16.8 16.8Z" />
          <rect x="16.8" y="16.8" width="6.4" height="6.4" rx="0.8" />
          <circle cx="20" cy="20" r="1.2" fill="currentColor" stroke="none" />
        </g>
      )

    case 'atlas_compass':
      // Moroccan Compass Rose & Twin Atlas Peaks (بوصلة الأطلس اللهجي)
      return (
        <g stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M20 11.6L22.1 17.9L28.4 20L22.1 22.1L20 28.4L17.9 22.1L11.6 20L17.9 17.9Z" />
          <circle cx="20" cy="20" r="2.1" />
        </g>
      )

    case 'sprint_standard':
      // Heraldic Expedition Banner & Star (لواء النفير المعجمي)
      return (
        <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <line x1="14.5" y1="11.8" x2="14.5" y2="28.4" />
          <path d="M14.5 13H26.4L23.8 17.4L26.4 21.8H14.5" />
          <circle cx="19.6" cy="17.4" r="1.35" fill="currentColor" stroke="none" />
        </g>
      )

    case 'atlas_cedar':
      // Founding Moroccan Atlas Cedar Emblem (غرسة الرعيل المؤسس)
      return (
        <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M20 12.2L24.8 17.4H15.2L20 12.2Z" />
          <path d="M20 16.2L26.4 22.2H13.6L20 16.2Z" />
          <line x1="20" y1="22.2" x2="20" y2="27.4" />
          <line x1="15.5" y1="27.4" x2="24.5" y2="27.4" />
        </g>
      )

    case 'shadda_loupe':
      // Arabic Shadda Calligraphic Diacritic inside Precision Optical Ring (عدسة الضبط والتصويب)
      return (
        <g stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <circle cx="19.2" cy="19.2" r="6.4" />
          <path d="M16.2 18.6C16.2 20.3 17.6 20.8 18.6 19.3C19.1 18.5 19.2 17.7 19.2 17.5C19.2 17.7 19.4 18.5 19.9 19.3C20.8 20.8 22.2 20.3 22.2 18.6" />
          <line x1="23.9" y1="23.9" x2="27.6" y2="27.6" />
        </g>
      )

    case 'corpus_stamp':
      // Open Arabic Lexicon Codex & Verification Star (طابع الاعتماد المعجمي)
      return (
        <g stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M20 16.2C18.2 14.9 15.6 14.6 12.8 15.2V25.8C15.6 25.2 18.2 25.5 20 26.8C21.8 25.5 24.4 25.2 27.2 25.8V15.2C24.4 14.6 21.8 14.9 20 16.2Z" />
          <line x1="20" y1="16.2" x2="20" y2="26.6" />
          <path d="M20 11.4L21.1 13.1L20 14.4L18.9 13.1Z" fill="currentColor" stroke="none" />
        </g>
      )

    case 'open_lineage':
    default:
      // Open-Source Lineage Nodes (عقدة النَّسَب المفتوح)
      return (
        <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <circle cx="15.2" cy="15.5" r="2.1" />
          <circle cx="24.8" cy="15.5" r="2.1" />
          <circle cx="20" cy="25.2" r="2.3" />
          <path d="M16.6 17.2L19.1 23.1" />
          <path d="M23.4 17.2L20.9 23.1" />
        </g>
      )
  }
}

function getSealFrameColors(tone: MeritBadgeTone, tier: MeritBadgeTier): string {
  if (tier === 'sovereign' || tone === 'gold') {
    return 'text-amber-800 dark:text-[#D9FF43]'
  }
  switch (tone) {
    case 'lime':
      return 'text-emerald-800 dark:text-[#D9FF43]'
    case 'emerald':
      return 'text-emerald-800 dark:text-emerald-300'
    case 'sky':
      return 'text-sky-800 dark:text-sky-300'
    case 'amber':
      return 'text-amber-800 dark:text-amber-300'
    default:
      return 'text-zinc-700 dark:text-zinc-200'
  }
}

/**
 * Full 8-pointed Moroccan Zellij Khatam Medallion SVG (خاتم الزليج الثماني المغربي).
 * Renders outer interlocking rotated squares + inner coin ring + bespoke glyph.
 */
export function MeritSealMedallion({
  icon,
  tone = 'emerald',
  tier = 'distinguished',
  size = 44,
  className = '',
}: {
  icon: MeritBadgeIconKey
  tone?: MeritBadgeTone
  tier?: MeritBadgeTier
  size?: number
  className?: string
}) {
  const colorClass = getSealFrameColors(tone, tier)
  const isSovereign = tier === 'sovereign'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${colorClass} ${className}`}
    >
      {/* Moroccan 8-pointed Khatam Star: Square A + Square B rotated 45 deg */}
      <rect
        x="6.5"
        y="6.5"
        width="27"
        height="27"
        rx="2.5"
        fill="currentColor"
        fillOpacity={isSovereign ? '0.13' : '0.08'}
        stroke="currentColor"
        strokeWidth={isSovereign ? '1.45' : '1.25'}
      />
      <rect
        x="6.5"
        y="6.5"
        width="27"
        height="27"
        rx="2.5"
        transform="rotate(45 20 20)"
        fill="currentColor"
        fillOpacity={isSovereign ? '0.10' : '0.06'}
        stroke="currentColor"
        strokeWidth={isSovereign ? '1.45' : '1.25'}
      />

      {/* Inner Engraved Medallion Ring */}
      <circle
        cx="20"
        cy="20"
        r="11.2"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="0.9"
      />

      {/* Sovereign Cardinal Studs for highest-rank seals */}
      {isSovereign && (
        <g fill="currentColor" fillOpacity="0.75">
          <circle cx="20" cy="4.2" r="0.9" />
          <circle cx="20" cy="35.8" r="0.9" />
          <circle cx="4.2" cy="20" r="0.9" />
          <circle cx="35.8" cy="20" r="0.9" />
        </g>
      )}

      {/* Exclusive Platform Glyph */}
      {renderInnerSealGlyph(icon)}
    </svg>
  )
}

export function MeritBadgeEmblemIcon({
  icon,
  className = 'h-4 w-4',
}: {
  icon: MeritBadgeIconKey
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <rect
        x="6.5"
        y="6.5"
        width="27"
        height="27"
        rx="3"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="1.5"
      />
      <rect
        x="6.5"
        y="6.5"
        width="27"
        height="27"
        rx="3"
        transform="rotate(45 20 20)"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="1.5"
      />
      {renderInnerSealGlyph(icon)}
    </svg>
  )
}

interface MeritBadgeChipProps {
  badge: MeritBadge
  size?: 'sm' | 'md'
  showSealName?: boolean
  onClick?: (badge: MeritBadge) => void
}

export function MeritBadgeChip({
  badge,
  size = 'sm',
  showSealName = false,
  onClick,
}: MeritBadgeChipProps) {
  const toneClasses = getBadgeClasses(badge.tone)
  const sizeClasses =
    size === 'md'
      ? 'gap-1.5 rounded-xl px-2.5 py-1 text-xs'
      : 'gap-1.5 rounded-lg px-2 py-0.5 text-[11px]'

  const innerContent = (
    <>
      <MeritBadgeEmblemIcon
        icon={badge.icon}
        className={size === 'md' ? 'h-4 w-4 shrink-0' : 'h-3.5 w-3.5 shrink-0'}
      />
      <span>
        {showSealName ? `${badge.sealName} · ${badge.label}` : badge.label}
      </span>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClick(badge)
        }}
        title={`انقر لعرض معايير والهدف من وسام: ${badge.sealName} (${badge.label})`}
        aria-label={`عرض تفاصيل ومعايير وسام ${badge.sealName} (${badge.label})`}
        className={`inline-flex items-center border font-semibold transition-colors cursor-pointer hover:border-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:hover:border-[#D9FF43]/75 dark:focus-visible:outline-[#D9FF43] ${sizeClasses} ${toneClasses}`}
      >
        {innerContent}
      </button>
    )
  }

  return (
    <span
      title={`${badge.sealName} (${badge.label}) — ${badge.description}`}
      className={`inline-flex items-center border font-semibold transition-colors ${sizeClasses} ${toneClasses}`}
    >
      {innerContent}
    </span>
  )
}

interface MeritBadgeMedallionCardProps {
  badge: MeritBadge
  scarcityLabel?: string
  onClick?: (badge: MeritBadge) => void
}

export function MeritBadgeMedallionCard({
  badge,
  scarcityLabel,
  onClick,
}: MeritBadgeMedallionCardProps) {
  const tierTextClass = getTierPillClasses(badge.tier)
  const isSovereign = badge.tier === 'sovereign'

  const baseSurfaceClasses = isSovereign
    ? 'border-amber-300/80 bg-amber-50/35 dark:border-[#D9FF43]/35 dark:bg-[#0D0F07]'
    : 'border-zinc-200/90 bg-zinc-50/70 dark:border-white/10 dark:bg-[#07070A]'

  const cardBody = (
    <>
      <div className="mt-0.5 shrink-0">
        <MeritSealMedallion
          icon={badge.icon}
          tone={badge.tone}
          tier={badge.tier}
          size={48}
        />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
          <span className={`font-bold ${tierTextClass}`}>{badge.tierLabel}</span>
          <span className="font-mono text-zinc-400 dark:text-zinc-500">
            {scarcityLabel ? `${scarcityLabel} · ${badge.code}` : badge.code}
          </span>
        </div>

        <div className="flex flex-wrap items-baseline gap-1.5">
          <p className="font-display text-xs sm:text-sm font-bold text-zinc-950 dark:text-white">
            {badge.sealName}
          </p>
          <span aria-hidden="true" className="text-xs text-zinc-400">
            ·
          </span>
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            {badge.label}
          </span>
        </div>

        <p className="text-[11px] leading-5 text-zinc-600 dark:text-zinc-400">
          {badge.description}
        </p>

        <p className="pt-0.5 text-[10.5px] leading-4 font-medium text-emerald-800/90 dark:text-zinc-300">
          القيمة العلمية: {badge.valueStatement}
        </p>

        {onClick && (
          <p className="pt-1 text-[10.5px] font-semibold text-emerald-700 group-hover/medallion:underline dark:text-[#D9FF43]">
            عرض معايير الاستحقاق والهدف ←
          </p>
        )}
      </div>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClick(badge)
        }}
        aria-label={`عرض معايير والهدف من وسام ${badge.sealName} (${badge.label})`}
        className={`group/medallion flex w-full items-start gap-3.5 rounded-2xl border p-3.5 text-start transition-colors cursor-pointer hover:border-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:hover:border-[#D9FF43]/70 dark:focus-visible:outline-[#D9FF43] ${baseSurfaceClasses}`}
      >
        {cardBody}
      </button>
    )
  }

  return (
    <div
      className={`flex items-start gap-3.5 rounded-2xl border p-3.5 transition-colors ${baseSurfaceClasses}`}
    >
      {cardBody}
    </div>
  )
}

```

---

## src/utils/contributorRanks.ts

Contributor rank thresholds, calculation, and visual theme tokens

```typescript
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

```

---

## src/components/ContributorRankVisual.tsx

Original gold/silver/bronze/diamond rank medals, podium badge, and rank presentation

```tsx
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

```

---

