import type {
  ContextualExample,
  EntryType,
  LexicalEntry,
  ProvenanceInfo,
  RawOfficialCorpus,
  RegisterType,
  SourceType,
} from '../types/lexicon'

const LEXICON_URL =
  'https://raw.githubusercontent.com/ArCode-Standard/moroccan-darija-dataset/main/data/moroccan-darija.json'
const EXAMPLES_URL =
  'https://raw.githubusercontent.com/ArCode-Standard/moroccan-darija-dataset/main/data/context-examples.json'

const DEFAULT_PROVENANCE: ProvenanceInfo = {
  sourceType: 'original',
  sourceName: 'ArCode Standard — عينة توضيحية',
  rightsHolder: 'ArCode Standard',
  license: 'CC BY-NC 4.0',
  redistributionPermission: 'allowed',
  trainingPermission: 'allowed',
  commercialPermission: 'not_allowed',
  notes: 'بيانات عرض محلي لا تمثل نسخة رسمية كاملة من المعجم.',
}

export const DEMO_ENTRIES: LexicalEntry[] = [
  {
    id: '1',
    numericId: 1,
    word: 'بزاف',
    latin: 'bzzaf',
    meaning: 'كثير؛ بدرجة كبيرة',
    french: 'Beaucoup, très',
    category: 'الكمية والدرجة',
    entryType: 'word',
    register: 'neutral',
    status: 'pending',
    reviewNotes: 'مدخل توضيحي لعرض بنية الفحص اللغوي عند تعذر الاتصال بالمستودع.',
    provenance: DEFAULT_PROVENANCE,
    examples: [
      {
        id: 'ctx-000001',
        entryId: '1',
        darijaAr: 'عندي بزاف ديال الخدمة اليوم.',
        darijaLatin: '3ndi bzzaf dyal lkhdma lyoum.',
        meaningAr: 'لديّ الكثير من العمل اليوم.',
        meaningFr: 'J’ai beaucoup de travail aujourd’hui.',
        register: 'neutral',
        reviewStatus: 'pending',
      },
    ],
  },
  {
    id: '2',
    numericId: 2,
    word: 'واخا',
    latin: 'wakha',
    meaning: 'حسناً؛ رغم ذلك، حسب السياق',
    french: 'D’accord ; même si',
    category: 'التواصل',
    entryType: 'word',
    register: 'neutral',
    status: 'pending',
    reviewNotes: 'تتعدد دلالات الكلمة بين الموافقة والاستدراك تبعاً لتركيب الجملة.',
    provenance: DEFAULT_PROVENANCE,
    examples: [
      {
        id: 'ctx-000002',
        entryId: '2',
        darijaAr: 'واخا، غادي نجي معاك في العشية.',
        darijaLatin: 'wakha, ghadi nji m3ak f l3chiya.',
        meaningAr: 'حسناً، سآتي معك في المساء.',
        meaningFr: 'D’accord, je viendrai avec toi ce soir.',
        register: 'neutral',
        reviewStatus: 'pending',
      },
    ],
  },
  {
    id: '3',
    numericId: 3,
    word: 'دابا',
    latin: 'daba',
    meaning: 'الآن؛ في الوقت الحالي',
    french: 'Maintenant',
    category: 'الزمن',
    entryType: 'word',
    register: 'neutral',
    status: 'pending',
    reviewNotes: 'ظرف زمان شائع في مختلف الحواضر والجهات المغربية.',
    provenance: DEFAULT_PROVENANCE,
    examples: [
      {
        id: 'ctx-000003',
        entryId: '3',
        darijaAr: 'غادي نبداو المراجعة دابا.',
        darijaLatin: 'ghadi nbdaw lmraja3a daba.',
        meaningAr: 'سنبدأ المراجعة الآن.',
        meaningFr: 'Nous allons commencer la révision maintenant.',
        register: 'neutral',
        reviewStatus: 'pending',
      },
    ],
  },
  {
    id: '4',
    numericId: 4,
    word: 'شنو',
    latin: 'chno',
    meaning: 'ماذا؛ ما الاستفهامية',
    french: 'Quoi ; que',
    category: 'الاستفهام',
    entryType: 'question',
    register: 'neutral',
    status: 'pending',
    reviewNotes: 'ترد بصيغ صوتية متقاربة مثل شنو وأشنو.',
    provenance: DEFAULT_PROVENANCE,
    examples: [],
  },
  {
    id: '5',
    numericId: 5,
    word: 'مزيان',
    latin: 'mzyan',
    meaning: 'جيد؛ حسن؛ مناسب',
    french: 'Bien ; bon',
    category: 'الصفات',
    entryType: 'word',
    register: 'neutral',
    status: 'pending',
    reviewNotes: 'تستعمل صفةً وظرفاً للتعبير عن الجودة أو الموافقة.',
    provenance: DEFAULT_PROVENANCE,
    examples: [
      {
        id: 'ctx-000004',
        entryId: '5',
        darijaAr: 'هاد الشاهد واضح ومزيان للتوثيق.',
        darijaLatin: 'had chahid waD7 w mzyan lttawtiq.',
        meaningAr: 'هذا الشاهد واضح ومناسب للتوثيق.',
        meaningFr: 'Cet exemple est clair et pertinent pour la documentation.',
        register: 'neutral',
        reviewStatus: 'pending',
      },
    ],
  },
]

export const DEMO_RAW_CORPUS: RawOfficialCorpus = {
  lexiconMeta: {
    title: 'Moroccan Darija Lexicon',
    title_ar: 'معجم الدارجة المغربية',
    language: 'ary',
    language_name: 'الدارجة المغربية (Moroccan Arabic)',
    version: '1.5.0',
    created: '2026-10-29',
    entries_count: DEMO_ENTRIES.length,
    categories_count: 5,
    license: 'CC BY-NC 4.0',
    license_url: 'https://creativecommons.org/licenses/by-nc/4.0/',
    attribution: 'ArCode Standard — Moroccan Darija Lexicon',
  },
  rawEntries: DEMO_ENTRIES.map((e) => ({
    id: e.numericId ?? 1,
    category: e.category,
    darija_ar: e.word,
    darija_latin: e.latin,
    fusha_ar: e.meaning,
    fr: e.french,
    provenance: {
      source_type: e.provenance.sourceType,
      source_name: e.provenance.sourceName,
      rights_holder: e.provenance.rightsHolder,
      redistribution_permission: e.provenance.redistributionPermission,
      training_permission: e.provenance.trainingPermission,
      commercial_permission: e.provenance.commercialPermission,
      license: e.provenance.license,
      notes: e.provenance.notes,
    },
    review: {
      status: 'pending',
      notes: e.reviewNotes,
    },
  })),
  examplesMeta: {
    lexicon_version: '1.5.0',
    version: '1.0.0',
    examples_count: 4,
  },
  rawExamples: DEMO_ENTRIES.flatMap((e) =>
    e.examples.map((ex) => ({
      id: ex.id,
      entry_id: e.numericId ?? 1,
      meaning_ar: ex.meaningAr,
      meaning_fr: ex.meaningFr,
      example_darija_ar: ex.darijaAr,
      example_darija_latin: [ex.darijaLatin],
      register: ex.register,
      provenance: {
        source_type: 'original',
        source_name: 'ArCode Standard — عينة توضيحية',
        rights_holder: 'ArCode Standard',
        redistribution_permission: 'allowed',
        training_permission: 'allowed',
        commercial_permission: 'not_allowed',
        license: 'CC BY-NC 4.0',
      },
      review: {
        status: 'pending',
      },
    })),
  ),
}

export interface LoadedCorpus {
  entries: LexicalEntry[]
  totalExamplesCount: number
  categories: string[]
  rawCorpus: RawOfficialCorpus
}

export async function fetchOfficialCorpus(): Promise<LoadedCorpus> {
  const [lexRes, exRes] = await Promise.all([
    fetch(LEXICON_URL),
    fetch(EXAMPLES_URL).catch(() => null),
  ])

  if (!lexRes.ok) {
    throw new Error('تعذر تحميل ملف المعجم الرسمي من GitHub')
  }

  const lexPayload = (await lexRes.json()) as {
    meta?: Record<string, unknown>
    categories?: Array<string | { category?: unknown; count?: unknown }>
    entries?: Array<Record<string, unknown>>
  }

  if (!Array.isArray(lexPayload.entries) || lexPayload.entries.length === 0) {
    throw new Error('بنية ملف المعجم غير صالحة')
  }

  const examplesByEntry = new Map<string, ContextualExample[]>()
  let rawExamples: Array<Record<string, unknown>> = []
  let examplesMeta: Record<string, unknown> = {
    lexicon_version: String(lexPayload.meta?.version ?? '1.5.0'),
    version: '1.0.0',
    examples_count: 0,
  }

  if (exRes && exRes.ok) {
    try {
      const exPayload = (await exRes.json()) as {
        meta?: Record<string, unknown>
        examples?: Array<Record<string, unknown>>
      }
      if (exPayload.meta && typeof exPayload.meta === 'object') {
        examplesMeta = exPayload.meta
      }
      if (Array.isArray(exPayload.examples)) {
        rawExamples = exPayload.examples
        for (const item of exPayload.examples) {
          const entryId = String(item.entry_id ?? '')
          if (!entryId) continue
          const latinRaw = item.example_darija_latin
          const darijaLatin = Array.isArray(latinRaw)
            ? latinRaw.map(String).join(' / ')
            : String(latinRaw ?? '')
          const reviewObj =
            typeof item.review === 'object' && item.review !== null
              ? (item.review as Record<string, unknown>)
              : {}

          const parsedEx: ContextualExample = {
            id: String(item.id ?? ''),
            entryId,
            darijaAr: String(item.example_darija_ar ?? ''),
            darijaLatin,
            meaningAr: String(item.meaning_ar ?? ''),
            meaningFr: String(item.meaning_fr ?? ''),
            exampleFushaAr: item.example_fusha_ar ? String(item.example_fusha_ar) : undefined,
            exampleFr: item.example_fr ? String(item.example_fr) : undefined,
            register: (String(item.register ?? 'neutral') as RegisterType) || 'neutral',
            region: Array.isArray(item.region) ? item.region.map(String) : undefined,
            reviewStatus: String(reviewObj.status ?? 'pending'),
          }
          const bucket = examplesByEntry.get(entryId) ?? []
          bucket.push(parsedEx)
          examplesByEntry.set(entryId, bucket)
        }
      }
    } catch {
      // Non-fatal if context-examples fails parsing
    }
  }

  const entries: LexicalEntry[] = lexPayload.entries.map((item) => {
    const idStr = String(item.id ?? '')
    const numId = typeof item.id === 'number' ? item.id : Number.parseInt(idStr, 10)
    const latinVal = Array.isArray(item.darija_latin)
      ? item.darija_latin.map(String).join(' / ')
      : String(item.darija_latin ?? '')

    const prov =
      typeof item.provenance === 'object' && item.provenance !== null
        ? (item.provenance as Record<string, unknown>)
        : {}
    const rev =
      typeof item.review === 'object' && item.review !== null
        ? (item.review as Record<string, unknown>)
        : {}

    return {
      id: idStr,
      numericId: Number.isNaN(numId) ? null : numId,
      word: String(item.darija_ar ?? ''),
      latin: latinVal,
      meaning: String(item.fusha_ar ?? '—'),
      french: String(item.fr ?? '—'),
      category: String(item.category ?? 'غير مصنف'),
      entryType: item.entry_type ? (String(item.entry_type) as EntryType) : undefined,
      register: item.register ? (String(item.register) as RegisterType) : undefined,
      region: Array.isArray(item.region) ? item.region.map(String) : undefined,
      status: String(rev.status ?? 'pending'),
      reviewNotes: String(rev.notes ?? ''),
      provenance: {
        sourceType: (String(prov.source_type ?? 'original') as SourceType) || 'original',
        sourceName: String(prov.source_name ?? 'ArCode Standard'),
        sourceUrl: prov.source_url ? String(prov.source_url) : undefined,
        rightsHolder: String(prov.rights_holder ?? 'ArCode Standard'),
        license: String(prov.license ?? 'CC BY-NC 4.0'),
        redistributionPermission:
          (prov.redistribution_permission as ProvenanceInfo['redistributionPermission']) ??
          'allowed',
        trainingPermission:
          (prov.training_permission as ProvenanceInfo['trainingPermission']) ?? 'allowed',
        commercialPermission:
          (prov.commercial_permission as ProvenanceInfo['commercialPermission']) ?? 'not_allowed',
        notes: String(prov.notes ?? ''),
      },
      examples: examplesByEntry.get(idStr) ?? [],
    }
  })

  const categorySet = new Set<string>()
  if (Array.isArray(lexPayload.categories)) {
    for (const c of lexPayload.categories) {
      if (typeof c === 'string' && c.trim()) {
        categorySet.add(c.trim())
      } else if (typeof c === 'object' && c !== null && typeof c.category === 'string') {
        const trimmed = c.category.trim()
        if (trimmed) categorySet.add(trimmed)
      }
    }
  }
  for (const e of entries) {
    if (e.category) categorySet.add(e.category)
  }

  return {
    entries,
    totalExamplesCount: rawExamples.length || entries.reduce((acc, e) => acc + e.examples.length, 0),
    categories: Array.from(categorySet),
    rawCorpus: {
      lexiconMeta: lexPayload.meta ?? DEMO_RAW_CORPUS.lexiconMeta,
      rawEntries: lexPayload.entries,
      examplesMeta,
      rawExamples,
    },
  }
}

export async function loadCorpusWithOfflineFallback(): Promise<{
  corpus: LoadedCorpus
  mode: 'live' | 'cached'
  cachedAt: string
}> {
  const { loadCorpusSnapshot, saveCorpusSnapshot } = await import('./corpusCache')
  try {
    const liveCorpus = await fetchOfficialCorpus()
    const cachedAt = await saveCorpusSnapshot(liveCorpus)
    return {
      corpus: liveCorpus,
      mode: 'live',
      cachedAt,
    }
  } catch (liveErr) {
    const cached = await loadCorpusSnapshot()
    if (cached && cached.corpus.entries.length > 0) {
      return {
        corpus: cached.corpus,
        mode: 'cached',
        cachedAt: cached.cachedAt,
      }
    }
    throw liveErr
  }
}

export function formatStatusLabel(status: string): string {
  switch (status.toLowerCase()) {
    case 'merged':
      return 'مدمج في الإصدار الرسمي'
    case 'approved':
    case 'accepted':
    case 'verified':
    case 'reviewed':
      return 'معتمد'
    case 'pending':
    case 'in_review':
      return 'قيد المراجعة'
    case 'rejected':
      return 'مرفوض'
    case 'needs_changes':
    case 'needs_correction':
      return 'يحتاج تعديلاً'
    case 'withdrawn':
      return 'مسحوب من المساهم'
    case 'superseded':
      return 'مُستبدل بنسخة منقحة'
    default:
      return status
  }
}

export function formatRegisterLabel(register: string): string {
  switch (register.toLowerCase()) {
    case 'neutral':
      return 'استعمال عام محايد'
    case 'formal':
      return 'سياق رسمي مهذب'
    case 'informal':
    case 'colloquial':
      return 'تداول يومي عفوي'
    case 'literary':
      return 'سياق أدبي / تراثي'
    case 'religious':
      return 'سياق ديني / دعائي'
    default:
      return register
  }
}

export function formatAccessionCode(id: string, numericId: number | null): string {
  if (id === 'NEW' || id.startsWith('NEW:')) {
    return 'NEW-ENTRY'
  }
  if (numericId !== null) {
    return `LEX-${String(numericId).padStart(4, '0')}`
  }
  const parsed = Number.parseInt(id, 10)
  if (!Number.isNaN(parsed)) {
    return `LEX-${String(parsed).padStart(4, '0')}`
  }
  return `LEX-${id.toUpperCase()}`
}
