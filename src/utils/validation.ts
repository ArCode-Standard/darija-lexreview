import type { EvidenceItem, LexicalEntry } from '../types/lexicon'

const ARABIC_DIACRITICS_RE = /[\u064B-\u065F\u0670\u0640]/g
const ARABIC_SCRIPT_RE = /[\u0600-\u06FF]/
const LATIN_ARABIZI_RE = /[a-zA-Z0-9]/

export const MOROCCAN_REGIONS = [
  'مشترك عام',
  'الدار البيضاء والوسط',
  'الرباط وسلا',
  'فاس ومكناس',
  'الشمال وجبالة',
  'مراكش والحوز',
  'سوس والجنوب',
  'الشرق والريف',
  'الأقاليم الصحراوية',
] as const

export const ENTRY_TYPE_OPTIONS = [
  { value: 'word', label: 'مفردة مفردة (word)' },
  { value: 'expression', label: 'تعبير اصطلاحي (expression)' },
  { value: 'conversational', label: 'عبارة تخاطبية (conversational)' },
  { value: 'proverb', label: 'مثل شعبي (proverb)' },
  { value: 'question', label: 'صيغة استفهام (question)' },
  { value: 'sentence', label: 'جملة تامة (sentence)' },
] as const

export const REGISTER_OPTIONS = [
  { value: 'neutral', label: 'عام محايد (neutral)' },
  { value: 'informal', label: 'يومي عفوي (informal)' },
  { value: 'formal', label: 'رسمي مهذب (formal)' },
  { value: 'literary', label: 'أدبي / تراثي (literary)' },
  { value: 'religious', label: 'دعائي / ديني (religious)' },
] as const

export const SOURCE_TYPE_OPTIONS = [
  { value: 'contributor', label: 'توثيق ميداني أصلي من المساهم' },
  { value: 'web', label: 'محتوى مغربي منشور على الويب' },
  { value: 'corpus', label: 'مدونة نصية أو أرشيف عام' },
  { value: 'other', label: 'مصدر سمعي أو مرئي عام' },
] as const

export const ARABIZI_CONVENTIONS = [
  { symbol: '3', letter: 'ع / ء' },
  { symbol: '7', letter: 'ح' },
  { symbol: '9', letter: 'ق' },
  { symbol: 'gh / 4', letter: 'غ' },
  { symbol: 'kh', letter: 'خ' },
  { symbol: 'ch', letter: 'ش' },
  { symbol: 'ou', letter: 'و (مد)' },
] as const

/**
 * Normalizes Arabic text for reliable duplicate/collision detection.
 */
export function normalizeArabicHeadword(input: string): string {
  return input
    .trim()
    .replace(ARABIC_DIACRITICS_RE, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
}

export function normalizeArabizi(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Validates and normalizes an external evidence URL.
 * Strictly blocks javascript:, data:, vbscript:, file:, and credentialed URLs to prevent XSS.
 */
export function sanitizeExternalUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > 2048) return null
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null
    }
    if (parsed.username || parsed.password) {
      return null
    }
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return null
    }
    return parsed.toString()
  } catch {
    return null
  }
}

export function validateEvidenceItems(items: EvidenceItem[]): {
  cleaned: EvidenceItem[]
  invalidUrls: string[]
} {
  const cleaned: EvidenceItem[] = []
  const invalidUrls: string[] = []

  for (const item of items) {
    const rawUrl = (item.url ?? '').trim()
    const note = (item.note ?? '').trim().slice(0, 1000)

    if (!rawUrl && !note) continue

    if (rawUrl) {
      const safe = sanitizeExternalUrl(rawUrl)
      if (!safe) {
        invalidUrls.push(rawUrl)
        continue
      }
      cleaned.push({ url: safe, note })
    } else {
      cleaned.push({ url: '', note })
    }
  }

  return { cleaned, invalidUrls }
}

export function containsArabicScript(value: string): boolean {
  return ARABIC_SCRIPT_RE.test(value.trim())
}

export function isValidArabizi(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.length > 0 && LATIN_ARABIZI_RE.test(trimmed) && !ARABIC_SCRIPT_RE.test(trimmed)
}

/**
 * Finds exact or orthographically normalized matches in the official lexicon.
 */
export function findSimilarCorpusEntries(
  entries: LexicalEntry[],
  wordAr: string,
  arabizi: string,
): LexicalEntry[] {
  const normAr = normalizeArabicHeadword(wordAr)
  const normLat = normalizeArabizi(arabizi)

  if (!normAr && !normLat) return []

  return entries.filter((entry) => {
    const entryNormAr = normalizeArabicHeadword(entry.word)
    const entryNormLat = normalizeArabizi(entry.latin)

    const arMatch = normAr.length >= 2 && entryNormAr === normAr
    const latMatch =
      normLat.length >= 3 &&
      entryNormLat
        .split('/')
        .map((s) => s.trim())
        .includes(normLat)

    return arMatch || latMatch
  })
}
