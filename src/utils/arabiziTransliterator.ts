import type { LexicalEntry } from '../types/lexicon'

/**
 * Curated high-frequency Moroccan Darija lexicon map so common words in sentences
 * immediately produce natural, idiomatic Arabizi spellings rather than naive transliteration.
 */
const DARIJA_COMMON_LEXICON: Record<string, string> = {
  بزاف: 'bzzaf',
  شوية: 'chwiya',
  دابا: 'daba',
  دغيا: 'dghya',
  واخا: 'wakha',
  صافي: 'safi',
  مزيان: 'mzyan',
  مزيانة: 'mzyana',
  زوين: 'zwin',
  زوينة: 'zwina',
  خايب: 'khayb',
  خايبة: 'khayba',
  شحال: 'ch7al',
  علاش: '3lach',
  كيفاش: 'kifach',
  فوقاش: 'fo9ach',
  إيمتا: 'imta',
  امتا: 'imta',
  فين: 'fin',
  شكون: 'chkon',
  شنو: 'chno',
  أشنو: 'achno',
  اشنو: 'achno',
  واش: 'wach',
  آش: 'ach',
  هادا: 'hada',
  هذا: 'hada',
  هادي: 'hadi',
  هذه: 'hadi',
  هاد: 'had',
  هادشي: 'hadchi',
  هادو: 'hado',
  داك: 'dak',
  ديك: 'dik',
  داكشي: 'dakchi',
  غادي: 'ghadi',
  غادية: 'ghadya',
  بغيت: 'bghit',
  بغا: 'bgha',
  بغات: 'bghat',
  بغينا: 'bghina',
  كاين: 'kayn',
  كاينة: 'kayna',
  كاينين: 'kaynin',
  ماكاينش: 'makaynch',
  ماشي: 'machi',
  ديال: 'dyal',
  ديالي: 'dyali',
  ديالك: 'dyalk',
  ديالو: 'dyalo',
  ديالها: 'dyalha',
  ديالنا: 'dyalna',
  ديالهم: 'dyalhom',
  مع: 'm3a',
  معايا: 'm3aya',
  معاك: 'm3ak',
  معاه: 'm3ah',
  معاها: 'm3aha',
  حيت: '7it',
  حيتاش: '7itach',
  باش: 'bach',
  بلا: 'bla',
  غير: 'ghir',
  عند: '3nd',
  عندي: '3ndi',
  عندك: '3ndk',
  عندو: '3ndo',
  عندها: '3ndha',
  عافاك: '3afak',
  شكرا: 'chokran',
  الله: 'llah',
  يرحم: 'yr7m',
  الوالدين: 'lwalidin',
  بصح: 'bssa7',
  بالصح: 'bssa7',
  خويا: 'khoya',
  ختي: 'khti',
  الدار: 'ddar',
  دار: 'dar',
  الخدمة: 'lkhdma',
  خدمة: 'khdma',
  السوق: 'sso9',
  الزنقة: 'zzn9a',
  الوقت: 'lwa9t',
  اليوم: 'lyom',
  غدا: 'ghdda',
  البارح: 'lbar7',
  صباح: 'sba7',
  الصباح: 'ssba7',
  الخير: 'lkhir',
  مساء: 'msa',
  الليل: 'llil',
  أتاي: 'atay',
  اتاي: 'atay',
  الخبز: 'lkhobz',
  الما: 'lma',
  الماء: 'lma',
  طوموبيل: 'tomobil',
  الناس: 'nnas',
  واحد: 'wa7d',
  وحدة: 'w7da',
  جوج: 'joj',
  ثلاثة: 'tlata',
  تلاتة: 'tlata',
  أربعة: 'rb3a',
  ربعه: 'rb3a',
  خمسة: 'khmsa',
  كلشي: 'kolchi',
  والو: 'walo',
  حتى: '7tta',
  تما: 'tmma',
  هنا: 'hna',
  لهيه: 'lhih',
  قريب: '9rib',
  بعيد: 'b3id',
  كبير: 'kbir',
  صغير: 'sghir',
  جديد: 'jdid',
  قديم: '9dim',
  سخون: 'skhon',
  بارد: 'bard',
  زربان: 'zrban',
  عيان: '3yyan',
  فرحان: 'fr7an',
  مقلق: 'm9ll9',
  قرعة: '9r3a',
}

const SUN_LETTERS = new Set([
  'ت',
  'ث',
  'د',
  'ذ',
  'ر',
  'ز',
  'س',
  'ش',
  'ص',
  'ض',
  'ط',
  'ظ',
  'ل',
  'ن',
])

const CHAR_MAP: Record<string, string> = {
  أ: 'a',
  إ: 'i',
  آ: 'a',
  ٱ: 'a',
  ء: '2',
  ؤ: 'o',
  ئ: 'i',
  ب: 'b',
  پ: 'p',
  ت: 't',
  ث: 't',
  ج: 'j',
  ح: '7',
  خ: 'kh',
  د: 'd',
  ذ: 'd',
  ر: 'r',
  ز: 'z',
  س: 's',
  ش: 'ch',
  ص: 's',
  ض: 'd',
  ط: 't',
  ظ: 'z',
  ع: '3',
  غ: 'gh',
  ف: 'f',
  ڤ: 'v',
  ق: '9',
  ك: 'k',
  گ: 'g',
  ݣ: 'g',
  ل: 'l',
  م: 'm',
  ن: 'n',
  ه: 'h',
  ة: 'a',
  ى: 'a',
}

function stripDiacriticsKeepShadda(word: string): string {
  // Keep shadda (\u0651) and short vowels (\u064E fatha, \u064F damma, \u0650 kasra) for smarter mapping, drop tatweel/tanwin
  return word.replace(/[\u0640\u064B-\u064D\u0652-\u065F\u0670]/g, '')
}

function normalizeLookupKey(word: string): string {
  return word
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .trim()
}

function transliterateSingleWord(
  rawToken: string,
  corpusLookup?: Map<string, string>,
): string {
  // Preserve leading/trailing punctuation
  const match = rawToken.match(/^([^\u0600-\u06FFa-zA-Z0-9]*)([\s\S]*?)([^\u0600-\u06FFa-zA-Z0-9]*)$/)
  const prefixPunct = (match?.[1] ?? '').replace(/،/g, ',').replace(/؟/g, '?').replace(/؛/g, ';')
  const core = match?.[2] ?? rawToken
  const suffixPunct = (match?.[3] ?? '').replace(/،/g, ',').replace(/؟/g, '?').replace(/؛/g, ';')

  if (!core) return prefixPunct + suffixPunct

  // If already Latin/numbers, return as-is
  if (!/[\u0600-\u06FF]/.test(core)) {
    return `${prefixPunct}${core}${suffixPunct}`
  }

  const lookupKey = normalizeLookupKey(core)
  if (DARIJA_COMMON_LEXICON[lookupKey]) {
    return `${prefixPunct}${DARIJA_COMMON_LEXICON[lookupKey]}${suffixPunct}`
  }

  if (corpusLookup?.has(lookupKey)) {
    const known = corpusLookup.get(lookupKey)!
    return `${prefixPunct}${known}${suffixPunct}`
  }

  // Handle prefixed prepositions "ب" / "ف" / "ل" attached to definite article "ال..."
  const cleaned = stripDiacriticsKeepShadda(core)
  let index = 0
  let out = ''
  let lastConsonant = ''

  // Definite article "ال" at start of word
  if (cleaned.startsWith('ال') && cleaned.length > 2) {
    const third = cleaned[2]
    if (SUN_LETTERS.has(third)) {
      const mapped = CHAR_MAP[third] ?? ''
      out += mapped + mapped
      lastConsonant = mapped
      index = 3
      // Skip explicit shadda right after sun letter if already doubled
      if (cleaned[index] === '\u0651') {
        index += 1
      }
    } else {
      out += 'l'
      lastConsonant = 'l'
      index = 2
    }
  }

  while (index < cleaned.length) {
    const ch = cleaned[index]

    if (ch === '\u0651') {
      // Shadda: geminate last consonant
      if (lastConsonant) {
        out += lastConsonant
      }
      index += 1
      continue
    }

    if (ch === '\u064E') {
      // Fatha
      if (!out.endsWith('a')) out += 'a'
      index += 1
      continue
    }
    if (ch === '\u064F') {
      // Damma
      if (!out.endsWith('o') && !out.endsWith('u')) out += 'o'
      index += 1
      continue
    }
    if (ch === '\u0650') {
      // Kasra
      if (!out.endsWith('i')) out += 'i'
      index += 1
      continue
    }

    if (ch === 'ا') {
      out += 'a'
      lastConsonant = ''
      index += 1
      continue
    }

    if (ch === 'و') {
      // Word-initial waw is usually consonant 'w', interior/final usually 'o' unless followed by vowel
      const next = cleaned[index + 1]
      const isInitial = index === 0
      const followedByAlifOrYa = next === 'ا' || next === 'ي' || next === 'ى' || next === '\u0651'
      if (isInitial || followedByAlifOrYa) {
        out += 'w'
        lastConsonant = 'w'
      } else {
        out += 'o'
        lastConsonant = 'w'
      }
      index += 1
      continue
    }

    if (ch === 'ي') {
      const next = cleaned[index + 1]
      const isInitial = index === 0
      const followedByVowel = next === 'ا' || next === 'و' || next === 'ة' || next === '\u0651'
      if (isInitial || followedByVowel) {
        out += 'y'
        lastConsonant = 'y'
      } else {
        out += 'i'
        lastConsonant = 'y'
      }
      index += 1
      continue
    }

    const mapped = CHAR_MAP[ch]
    if (mapped) {
      out += mapped
      lastConsonant = mapped === 'a' || mapped === 'i' || mapped === 'o' ? '' : mapped
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      out += ch.toLowerCase()
      lastConsonant = ''
    }

    index += 1
  }

  // Collapse accidental triple vowels like "aaa" -> "a"
  const tidy = out.replace(/([aeiou])\1+/g, '$1')
  return `${prefixPunct}${tidy}${suffixPunct}`
}

export function buildCorpusArabiziLookup(entries: LexicalEntry[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const e of entries) {
    const key = normalizeLookupKey(e.word)
    if (!key || !e.latin) continue
    const primaryLatin = e.latin.split('/')[0]?.trim()
    if (primaryLatin && !map.has(key)) {
      map.set(key, primaryLatin)
    }
  }
  return map
}

/**
 * Generates an idiomatic Moroccan Arabizi draft from Arabic Darija text.
 * Contributors can accept it as-is or refine any character in one click.
 */
export function suggestMoroccanArabizi(
  arabicText: string,
  corpusLookup?: Map<string, string>,
): string {
  const trimmed = arabicText.trim()
  if (!trimmed) return ''

  return trimmed
    .split(/(\s+)/)
    .map((part) => (/^\s+$/.test(part) ? ' ' : transliterateSingleWord(part, corpusLookup)))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}
