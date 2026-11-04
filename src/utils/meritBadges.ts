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
