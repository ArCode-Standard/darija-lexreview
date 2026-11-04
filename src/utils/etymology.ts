import type { EtymologyOrigin } from '../types/lexicon'

export interface EtymologyOption {
  value: EtymologyOrigin
  label: string
  shortLabel: string
  description: string
}

export const ETYMOLOGY_OPTIONS: EtymologyOption[] = [
  {
    value: 'arabic_shifted',
    label: 'عربي فصيح محوَّر',
    shortLabel: 'عربي محوَّر',
    description: 'لفظ ذو جذر عربي فصيح تطوّر صوتياً أو دلالياً أو نُحت من تركيب عربي قديم.',
  },
  {
    value: 'amazigh',
    label: 'أصل أمازيغي',
    shortLabel: 'أمازيغي',
    description: 'رافد معجمي أو صرفي أصيل من الأمازيغية المغربية بمختلف تنوعاتها.',
  },
  {
    value: 'andalusi',
    label: 'موروث أندلسي',
    shortLabel: 'أندلسي',
    description: 'رصيد حضري ومعماري وحِرفي انتقل واستقر من العربية الأندلسية في الحواضر المغربية.',
  },
  {
    value: 'romance_loan',
    label: 'مقترض فرنسي / إسباني / برتغالي',
    shortLabel: 'مقترض لاتيني',
    description: 'دخيل معرَّب ومُكيَّف صوتياً على أوزان الدارجة من الفرنسية أو الإسبانية أو البرتغالية.',
  },
  {
    value: 'coined_local',
    label: 'نحت وتوليد محلي',
    shortLabel: 'نحت محلي',
    description: 'صياغة مغربية محلية مبتكرة أو تعبير اصطلاحي متولّد في التداول الاجتماعي.',
  },
  {
    value: 'unspecified',
    label: 'قيد التأصيل اللغوي',
    shortLabel: 'قيد التأصيل',
    description: 'لم يُحسم تأصيله التاريخي بعد ويقبل اقتراحات الباحثين والمساهمين.',
  },
]

const VALID_ETYMOLOGY_SET = new Set<EtymologyOrigin>(ETYMOLOGY_OPTIONS.map((o) => o.value))

export function isValidEtymologyOrigin(val: string | null | undefined): val is EtymologyOrigin {
  return Boolean(val && VALID_ETYMOLOGY_SET.has(val as EtymologyOrigin))
}

export function formatEtymologyLabel(origin?: EtymologyOrigin | string | null): string {
  const found = ETYMOLOGY_OPTIONS.find((o) => o.value === origin)
  return found ? found.label : 'قيد التأصيل اللغوي'
}

export function formatEtymologyShortLabel(origin?: EtymologyOrigin | string | null): string {
  const found = ETYMOLOGY_OPTIONS.find((o) => o.value === origin)
  return found ? found.shortLabel : 'قيد التأصيل'
}

function normalizeArabicBare(word: string): string {
  return word
    .trim()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
}

interface CuratedEtymologyRecord {
  origin: EtymologyOrigin
  note: string
}

/**
 * Curated linguistic etymology dictionary for core Moroccan Darija headwords.
 */
const CURATED_HEADWORD_ETYMOLOGIES: Record<string, CuratedEtymologyRecord> = {
  // Classical Arabic shifted / contracted (عربي فصيح محوَّر)
  بزاف: {
    origin: 'arabic_shifted',
    note: 'منحوتة صوتياً من التركيب العربي الفصيح «بالجُزاف» (أي بلا كيل ولا حساب) للدلالة على الكثرة.',
  },
  بالزاف: {
    origin: 'arabic_shifted',
    note: 'صيغة محافظة على لام التعريف من «بالجُزاف» في العربية الفصحى.',
  },
  دابا: {
    origin: 'arabic_shifted',
    note: 'محوَّرة صوتياً عن المصدر المنصوب «دَأْباً» في العربية الفصحى وتطورت للدلالة على الحال والآن.',
  },
  شنو: {
    origin: 'arabic_shifted',
    note: 'منحوتة تركيبياً من «أيُّ شيءٍ هو؟» عبر مراحل التخفيف الصوتي المشتركة في اللهجات المغاربية.',
  },
  اشنو: {
    origin: 'arabic_shifted',
    note: 'منحوتة من الاستفهام الفصيح «أيُّ شيءٍ هو؟» مع بقاء همزة الاستفهام في مطلعها.',
  },
  اش: {
    origin: 'arabic_shifted',
    note: 'نحت قديم موثق في التراث النحوي من «أيُّ شيء» للاستفهام.',
  },
  مزيان: {
    origin: 'arabic_shifted',
    note: 'مشتقة على وزن صيغة مبالغة محلية من الجذر العربي «ز-ي-ن» بمعنى الحَسَن والجميل.',
  },
  شحال: {
    origin: 'arabic_shifted',
    note: 'مركبة نحتاً من «أيُّ شَيءٍ حالُ...» أو «شَيء حال» للدلالة على الكمّ والمقدار والسعر.',
  },
  علاش: {
    origin: 'arabic_shifted',
    note: 'منحوتة من الجار والمجرور الاستفهامي الفصيح «عَلى أيِّ شَيء؟» بمعنى لماذا.',
  },
  فوقاش: {
    origin: 'arabic_shifted',
    note: 'منحوتة من التركيب الزماني «في وَقْتِ أيِّ شَيء؟» بمعنى متى.',
  },
  فين: {
    origin: 'arabic_shifted',
    note: 'متطورة من «في أَيْنَ» للاستفهام عن المكان.',
  },
  بكري: {
    origin: 'arabic_shifted',
    note: 'من الجذر العربي الفصيح «بُكْرة» (أول النهار) للدلالة على التبكير أو الزمن الماضي.',
  },
  غادي: {
    origin: 'arabic_shifted',
    note: 'اسم فاعل من «غدا يغدو» الفصيحة، تطور في الدارجة إلى أداة فعلية تدل على الاستقبال.',
  },
  حيت: {
    origin: 'arabic_shifted',
    note: 'تطور صوتي ودلالي للظرف الفصيح «حَيْثُ» بإبدال الثاء تاءً للدلالة على التعليل (لأنّ).',
  },
  واقيلا: {
    origin: 'arabic_shifted',
    note: 'منحوتة من العبارة التراثية الفقهية «وقيلَ» التي تُفيد الاحتمال والظن.',
  },
  شوية: {
    origin: 'arabic_shifted',
    note: 'تصغير عربي قديم لكلمة «شَيء» («شُوَيّة») للدلالة على القليل.',
  },
  باش: {
    origin: 'arabic_shifted',
    note: 'منحوتة من «بِأيِّ شَيء» وتُستعمل للتعليل والغاية (لكي).',
  },
  بحال: {
    origin: 'arabic_shifted',
    note: 'مشتقة من «بِحالِ...» الفصيحة للدلالة على المماثلة والتشبيه.',
  },
  ديال: {
    origin: 'arabic_shifted',
    note: 'أداة إضافة ونسبة مغاربية متطورة عن الموصول «الذي لِـ...» بتخفيف الذال دالاً.',
  },
  زعما: {
    origin: 'arabic_shifted',
    note: 'من الجذر الفصيح «زَعَمَ يَزْعُمُ» بمعنى القول الظني أو التفسير («أيْ / بمعنى»).',
  },
  صافي: {
    origin: 'arabic_shifted',
    note: 'من «صافٍ» العربية، تطورت دلالياً للإشارة إلى تمام الأمر واكتماله («خلاص / يكفي»).',
  },
  دغيا: {
    origin: 'arabic_shifted',
    note: 'ظرف سرعة متداول يُردّ إلى «دَغْية» في الاستعمال المغاربي بمعنى الفور والعجلة.',
  },
  هدرة: {
    origin: 'arabic_shifted',
    note: 'من الجذر العربي «هـ-د-ر» (هدير الصوت والكلام)، انزاحت دلالتها لتعني مطلق الحديث والكلام.',
  },
  خدمة: {
    origin: 'arabic_shifted',
    note: 'اتسع مدلول «الخِدْمة» الفصيحة في الدارجة المغربية ليشمل مطلق العمل والوظيفة والمهنة.',
  },

  // Amazigh substrate & lexicon (أصل أمازيغي)
  واخا: {
    origin: 'amazigh',
    note: 'لفظة ذات أصل أمازيغي راسخ في التداول المغربي المشترك تفيد القبول والموافقة أو الاستدراك.',
  },
  ساروت: {
    origin: 'amazigh',
    note: 'من الأمازيغية «تاساروت» (tasarut) بمعنى المفتاح.',
  },
  تبروري: {
    origin: 'amazigh',
    note: 'من الأمازيغية «أبروري» (abruri) بمعنى حَبّ البَرَد المتساقط مع المطر.',
  },
  زلافة: {
    origin: 'amazigh',
    note: 'مرتبطة بالرصيد المغاربي والأمازيغي لآنية الخزف العميقة المخصصة للحريرة والحساء.',
  },
  كسكسو: {
    origin: 'amazigh',
    note: 'من الجذر الأمازيغي «سكسو» (seksu) الدال على فتل السميد وطهيه بالبخار.',
  },
  اركان: {
    origin: 'amazigh',
    note: 'اسم أمازيغي أصيل («أرگان» argan) للشجرة المباركة المستوطنة بجنوب غرب المغرب.',
  },
  بزطام: {
    origin: 'amazigh',
    note: 'لفظ متداول في الدارجة والأمازيغية للدلالة على حافظة النقود الجلدية.',
  },
  مش: {
    origin: 'amazigh',
    note: 'من الأمازيغية «أموشّ» (amucc) بمعنى القطّ.',
  },
  موش: {
    origin: 'amazigh',
    note: 'من الأمازيغية «أموشّ» (amucc) بمعنى القطّ.',
  },
  تافراوت: {
    origin: 'amazigh',
    note: 'لفظ طوبونيمي ومعجمي أمازيغي يعني الحوض أو المجرى الخشبي للماء في الواحات والجبال.',
  },
  اگادير: {
    origin: 'amazigh',
    note: 'من الأمازيغية «أگادير» (agadir) بمعنى المخزن الجماعي المحصّن أو السور.',
  },
  واش: {
    origin: 'amazigh',
    note: 'أداة استفهام تصديقي ناتجة عن تفاعل تركيبي بين «وا»/«أش» وأدوات الاستفهام المغاربية والأمازيغية.',
  },

  // Andalusi heritage (موروث أندلسي)
  زليج: {
    origin: 'andalusi',
    note: 'مصطلح حضاري أندلسي مغربي أصيل للبلاط الخزفي المزجّج والمنقوش هندسياً.',
  },
  رياض: {
    origin: 'andalusi',
    note: 'امتداد للمفهوم المعماري الأندلسي المغربي للدار ذات الفناء الداخلي المشجّر والنافورة.',
  },
  طنجية: {
    origin: 'andalusi',
    note: 'إرث مطبخي وحِرفي حضري عريق في مراكش والحواضر المتصلة بالتقاليد الأندلسية المغربية.',
  },
  قيسارية: {
    origin: 'andalusi',
    note: 'مصطلح أسواق المدن العتيقة الموروث عن التنظيم الحضري الأندلسي والمغربي.',
  },
  عرسة: {
    origin: 'andalusi',
    note: 'تسمية حضرية أندلسية مغربية للبستان المسوّر داخل المدينة أو على أطرافها.',
  },
  سقاية: {
    origin: 'andalusi',
    note: 'منشأة السبيل المائي المزخرفة بالزليج والجبس في حواضر المغرب والأندلس.',
  },
  بسطيلة: {
    origin: 'andalusi',
    note: 'من المطبخ الأندلسي الموريسكي العريق (pastilla) الذي استقر وتطور في الحواضر المغربية.',
  },
  اتاي: {
    origin: 'andalusi',
    note: 'دخلت الكلمة عبر الموانئ المغربية الأطلسية في القرن الثامن عشر وتجذرت في الثقافة الحضرية والشعبية المغربية.',
  },

  // Romance loans: French / Spanish / Portuguese (مقترض فرنسي / إسباني / برتغالي)
  طوموبيل: {
    origin: 'romance_loan',
    note: 'معرّبة صوتياً عن الفرنسية «automobile» مع تفخيم الطاء على سنن الصوتيات المغربية.',
  },
  كوزينة: {
    origin: 'romance_loan',
    note: 'مقترضة من الإسبانية/الإيطالية «cocina / cucina» بمعنى المطبخ.',
  },
  فابور: {
    origin: 'romance_loan',
    note: 'مقترضة من الإسبانية «a favor / por favor» للدلالة على المجانية («بالمجان»).',
  },
  سبيطار: {
    origin: 'romance_loan',
    note: 'تكييف صوتي قديم لكلمة «hospital» اللاتينية/الإسبانية بمعنى المستشفى.',
  },
  طابلة: {
    origin: 'romance_loan',
    note: 'مقترضة من اللاتينية الدارجة/الإسبانية والفرنسية «tabla / table» بمعنى المائدة.',
  },
  روبيني: {
    origin: 'romance_loan',
    note: 'مقترضة من الفرنسية «robinet» بمعنى الصنبور.',
  },
  كاميون: {
    origin: 'romance_loan',
    note: 'مقترضة من الفرنسية/الإسبانية «camion / camión» بمعنى الشاحنة.',
  },
  بلاصة: {
    origin: 'romance_loan',
    note: 'مقترضة من الإسبانية/الفرنسية «plaza / place» بمعنى المكان أو المقعد.',
  },
  سيمانة: {
    origin: 'romance_loan',
    note: 'مقترضة من الإسبانية/البرتغالية «semana» بمعنى الأسبوع.',
  },
  كارطة: {
    origin: 'romance_loan',
    note: 'مقترضة من الإسبانية «carta» بمعنى البطاقة أو أوراق اللعب.',
  },
  فورشيطة: {
    origin: 'romance_loan',
    note: 'مقترضة من الفرنسية «fourchette» بمعنى الشوكة.',
  },
  تلفزة: {
    origin: 'romance_loan',
    note: 'تعريب قياسي شائع من «télévision».',
  },

  // Local Moroccan coinage / morphological innovation (نحت وتوليد محلي)
  تبركيك: {
    origin: 'coined_local',
    note: 'توليد محلي على وزن «تَفْعليل» الدارج للدلالة على التلصص وتتبع أخبار الناس.',
  },
  تخربيق: {
    origin: 'coined_local',
    note: 'صياغة مغربية محلية على وزن المصادر الرباعية الدارجة للدلالة على الخلط والكلام غير المتماسك.',
  },
  تكركير: {
    origin: 'coined_local',
    note: 'توليد صوتي محلي يحاكي صوت القهقهة أو التدحرج.',
  },
}

const ROMANCE_LATIN_PATTERNS =
  /\b(tomobil|kouzina|kozina|sbitar|fabor|fabour|blasa|blassa|simana|robini|kamyon|tabla|fourchita|karta|bisklet|tilifon|frmasyan|bolis)\b/i

const AMAZIGH_MORPH_PATTERNS =
  /^(ت[اأإآ][\u0621-\u064A]{2,}ت|أ[\u0621-\u064A]{2,}و)$/

/**
 * Resolves an entry's etymological origin and scholarly note from explicit JSON fields
 * or deterministic linguistic heuristics over Moroccan Darija morphology & lexicon.
 */
export function resolveEntryEtymology(params: {
  explicitOrigin?: unknown
  explicitNote?: unknown
  word: string
  latin: string
  meaning: string
  category: string
  entryType?: string
  reviewNotes?: string
}): { etymology: EtymologyOrigin; etymologyNote?: string } {
  if (typeof params.explicitOrigin === 'string' && isValidEtymologyOrigin(params.explicitOrigin)) {
    return {
      etymology: params.explicitOrigin,
      etymologyNote:
        typeof params.explicitNote === 'string' && params.explicitNote.trim()
          ? params.explicitNote.trim()
          : undefined,
    }
  }

  const bare = normalizeArabicBare(params.word)
  const strippedArticle = bare.startsWith('ال') && bare.length > 4 ? bare.slice(2) : bare

  const exact =
    CURATED_HEADWORD_ETYMOLOGIES[bare] ?? CURATED_HEADWORD_ETYMOLOGIES[strippedArticle]
  if (exact) {
    return { etymology: exact.origin, etymologyNote: exact.note }
  }

  const notesText = `${params.reviewNotes ?? ''} ${params.meaning ?? ''}`
  if (/أمازيغ|امازيغ|تشلحيت|تاريفيت|تمزيغت/.test(notesText)) {
    return {
      etymology: 'amazigh',
      etymologyNote: 'تُشير الملاحظات المعجمية إلى رافد أمازيغي في بنية الكلمة أو تداولها.',
    }
  }
  if (/أندلس|اندلس|غرناط|موريسك/.test(notesText)) {
    return {
      etymology: 'andalusi',
      etymologyNote: 'ينتمي اللفظ إلى الموروث الحضري الأندلسي المغربي المشترك.',
    }
  }
  if (/فرنس|إسبان|اسبان|برتغال|لاتين/.test(notesText) || ROMANCE_LATIN_PATTERNS.test(params.latin)) {
    return {
      etymology: 'romance_loan',
      etymologyNote: 'لفظ مقترض من اللغات الرومانسية ومُكيَّف صوتياً على أوزان الدارجة المغربية.',
    }
  }

  // Amazigh circumfix t-...-t noun pattern (e.g., تاساروت / تامغرابت / تافراوت)
  if (AMAZIGH_MORPH_PATTERNS.test(bare) && !bare.endsWith('ات')) {
    return {
      etymology: 'amazigh',
      etymologyNote: 'تحمل الكلمة البنية الصرفية الأمازيغية المؤنثة (تـ...ـت) الشائعة في الدارجة المغربية.',
    }
  }

  // Proverbs & multi-word idiomatic expressions coined in Moroccan social life
  if (params.entryType === 'proverb' || params.category.includes('أمثال')) {
    return {
      etymology: 'coined_local',
      etymologyNote: 'مَثَل وصياغة شعبية متولّدة من التجربة الاجتماعية المغربية.',
    }
  }

  if (
    params.entryType === 'expression' ||
    params.entryType === 'conversational' ||
    bare.split(/\s+/).length >= 3
  ) {
    return {
      etymology: 'coined_local',
      etymologyNote: 'تركيب تداولي مسكوك في الاستعمال اليومي المغربي.',
    }
  }

  // Andalusi urban crafts / architecture semantic indicators
  if (
    /زليج|جبص|فسيفساء|معمار|قيسارية|فندق عتيق|طنجية|بسطيلة|ملحون|طرب آلة/.test(
      `${params.word} ${params.meaning} ${params.category}`,
    )
  ) {
    return {
      etymology: 'andalusi',
      etymologyNote: 'مفردة مرتبطة بمعجم الحواضر العتيقة والتراث الأندلسي المغربي.',
    }
  }

  // Romance phonetic markers (p / v in Latin transcription or típica endings)
  if (/[pv]/i.test(params.latin) && !/\b(priv|prov)\b/i.test(params.latin) && bare.length >= 4) {
    return {
      etymology: 'romance_loan',
      etymologyNote: 'يُظهر الرسم الصوتي خصائص اقتراض صوتي معاصر مكيف في التداول الحضري.',
    }
  }

  // Classical Arabic cognate heuristic (majority of single-word Moroccan verbs, nouns, adjectives, time/space)
  if (
    bare.length >= 2 &&
    bare.split(/\s+/).length <= 2 &&
    !/[پڤ]/.test(params.word) &&
    params.meaning &&
    params.meaning !== '—'
  ) {
    return {
      etymology: 'arabic_shifted',
      etymologyNote: 'مدخل ذو جذر عربي تطور صوتياً أو تخصص دلالياً في اللسان الدارج المغربي.',
    }
  }

  return { etymology: 'unspecified' }
}
