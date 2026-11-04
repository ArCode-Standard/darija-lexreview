import type { LexicalEntry } from '../types/lexicon'

export interface ThematicCollectionDefinition {
  slug: string
  numberLabel: string
  title: string
  subtitle: string
  editorialNote: string
  culturalContext: string
  matcher: (entry: LexicalEntry) => boolean
}

export interface ComputedThematicCollection extends ThematicCollectionDefinition {
  entries: LexicalEntry[]
  withExamplesCount: number
}

const KITCHEN_REGEX =
  /طعام|أكل|مطبخ|شرب|مشروب|خبز|أتاي|اتاي|شاي|نعناع|طاجين|طنجية|كسكس|حريرة|زلافة|براد|صينية|ملح|سكر|عسل|زيت|أركان|اركان|لحم|سمك|حوت|خضر|فاكه|بهار|توابل|طبخ|مائدة|كوزينة|قهوة|حليب|ماء|جوع|شبع/i

const GREETING_REGEX =
  /تحية|سلام|ترحيب|مجاملة|شكر|دعاء|تواصل|تعارف|وداع|تبارك|الله|مرحبا|لاباس|بخير|صحة|عافية|مبروك|عواشر|سمح|عفاك|واخا|بسلامة|صباح|مساء/i

const CRAFTS_ARCH_REGEX =
  /معمار|دار|بيت|منزل|غرفة|باب|ساروت|زليج|رياض|سقاية|حرفة|صناعة|سوق|قيسارية|لباس|ملابس|جلابة|بلغة|قفطان|حايك|أداة|أدوات|أثاث|طابلة|فراش|زربية|خشب|نحاس|جلد|فخار|مدينة|زنقة|درب|حومة/i

const PROVERB_IDIOM_REGEX =
  /مثل|أمثال|حكمة|تعبير|اصطلاح|كناية|مجاز/i

const DAILY_TIME_MOTION_REGEX =
  /زمن|وقت|يوم|ساعة|دابا|بكري|غدا|بارح|حركة|سفر|طريق|خدمة|عمل|كمية|بزاف|شوية|درجة|استفهام|شنو|علاش|فوقاش|فين|شحال/i

export const THEMATIC_COLLECTIONS: ThematicCollectionDefinition[] = [
  {
    slug: 'moroccan-proverbs',
    numberLabel: '01',
    title: 'أشهر الأمثال والتعابير الشعبية المغربية',
    subtitle: 'حِكَم التجربة اليومية والكنايات المسكوكة في اللسان المغربي',
    editorialNote:
      'يجمع هذا المعجم المصغّر الأمثال السائرة والتعابير الاصطلاحية والجمل التخاطبية التي تختزل البلاغة الشعبية المغربية وسياقات استعمالها.',
    culturalContext: 'البلاغة الشعبية · الكنايات والتعابير الاصطلاحية',
    matcher: (entry) =>
      entry.entryType === 'proverb' ||
      entry.entryType === 'expression' ||
      entry.entryType === 'sentence' ||
      PROVERB_IDIOM_REGEX.test(`${entry.category} ${entry.reviewNotes}`),
  },
  {
    slug: 'moroccan-kitchen-atay',
    numberLabel: '02',
    title: 'معجم المطبخ المغربي وجلسة أتاي',
    subtitle: 'ألفاظ الضيافة، أواني المائدة، الأطباق التراثية، وطقوس الشاي المغربي',
    editorialNote:
      'من البرّاد والزلافة إلى الطاجين والكسكسو؛ مفردات المطبخ المغربي التي تعكس التمازج الحضاري بين الرصيد العربي والأمازيغي والأندلسي.',
    culturalContext: 'فنون الطبخ · الضيافة وأواني المائدة',
    matcher: (entry) =>
      KITCHEN_REGEX.test(`${entry.word} ${entry.meaning} ${entry.category} ${entry.french}`),
  },
  {
    slug: 'greetings-courtesy',
    numberLabel: '03',
    title: 'عبارات الترحيب والمجاملة والدعاء المغربية',
    subtitle: 'مفاتيح التخاطب اليومي المهذب وأدب اللقاء والاستئذان',
    editorialNote:
      'تتميّز الدارجة المغربية بثراء صيغ المجاملة والدعاء المتبادل في التحية، الضيافة، الشكر، والاعتذار في مختلف المناسبات الاجتماعية.',
    culturalContext: 'آداب التخاطب · التحايا والأدعية المتداولة',
    matcher: (entry) =>
      entry.entryType === 'conversational' ||
      entry.register === 'religious' ||
      entry.register === 'formal' ||
      GREETING_REGEX.test(`${entry.word} ${entry.meaning} ${entry.category}`),
  },
  {
    slug: 'crafts-architecture',
    numberLabel: '04',
    title: 'مفردات الصناعة التقليدية والمعمار واللباس',
    subtitle: 'معجم الدار المغربية، الحِرف اليدوية، الأسواق العتيقة، والأزياء',
    editorialNote:
      'توثيق للمصطلحات المرتبطة بالفضاء العمراني المغربي (الدرب، الرياض، الزليج، القيسارية) وأدوات الحرفيين واللباس التقليدي.',
    culturalContext: 'العمران العتيق · الحِرف والأسواق واللباس',
    matcher: (entry) =>
      CRAFTS_ARCH_REGEX.test(`${entry.word} ${entry.meaning} ${entry.category} ${entry.french}`),
  },
  {
    slug: 'amazigh-andalusi-roots',
    numberLabel: '05',
    title: 'روافد أمازيغية وأندلسية في الدارجة',
    subtitle: 'رحلة في الجذور التاريخية المشتركة التي صاغت فصاحة اللسان المغربي',
    editorialNote:
      'معجم انتقائي يُبرز المفردات ذات التأصيل الأمازيغي العريق والموروث الحضري الأندلسي المستعملة يومياً على امتداد جهات المغرب.',
    culturalContext: 'التأصيل التاريخي · التلاقح الأمازيغي والأندلسي',
    matcher: (entry) => entry.etymology === 'amazigh' || entry.etymology === 'andalusi',
  },
  {
    slug: 'daily-time-motion',
    numberLabel: '06',
    title: 'إيقاع الحياة اليومية والزمن والاستفهام',
    subtitle: 'المفردات النواة الأكثر تردداً في المحادثة المغربية المعاصرة',
    editorialNote:
      'مدخل مثالي للمتعلمين وأبناء الجالية والباحثين؛ يضم ظروف الزمان والمقدار وأدوات الاستفهام والأفعال المحورية في الكلام اليومي.',
    culturalContext: 'الرصيد النواة · الزمن والكمية والاستفهام',
    matcher: (entry) =>
      entry.entryType === 'question' ||
      DAILY_TIME_MOTION_REGEX.test(`${entry.word} ${entry.meaning} ${entry.category}`),
  },
]

export function buildThematicCollections(entries: LexicalEntry[]): ComputedThematicCollection[] {
  return THEMATIC_COLLECTIONS.map((def) => {
    const matched = entries.filter((entry) => def.matcher(entry))
    // Sort entries that have contextual examples first for a richer visitor reading experience
    const sorted = [...matched].sort((a, b) => {
      if ((b.examples.length > 0 ? 1 : 0) !== (a.examples.length > 0 ? 1 : 0)) {
        return (b.examples.length > 0 ? 1 : 0) - (a.examples.length > 0 ? 1 : 0)
      }
      return a.word.localeCompare(b.word, 'ar')
    })
    return {
      ...def,
      entries: sorted,
      withExamplesCount: sorted.filter((e) => e.examples.length > 0).length,
    }
  })
}

export function findThematicCollectionBySlug(
  collections: ComputedThematicCollection[],
  slug: string | null | undefined,
): ComputedThematicCollection | null {
  if (!slug) return null
  return collections.find((c) => c.slug === slug.trim()) ?? null
}
