import type { EvidenceItem, LexicalEntry } from '../types/lexicon'
import { toDarijaPhoneticSkeleton } from './phoneticSearch'

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
 * Normalizes Arabic text for exact/orthographic duplicate detection.
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

/**
 * Deeper Moroccan Darija orthographic normalization to catch common spelling
 * divergences across contributors:
 * - Taa marbuta / haa / final feminine -a (`دغيا` <-> `دغية` <-> `دغيه`)
 * - Kaf / Gaf variants (`ك` <-> `گ` <-> `ݣ` <-> `ک`)
 * - Prosthetic initial alif before consonant clusters (`شنو` <-> `أشنو`, `شحال` <-> `اشحال`)
 * - Optional interior long-vowel letters (`واخا` <-> `وخا`, `بزاف` <-> `بيزاف`, `مزيان` <-> `مزين`)
 */
export function normalizeDarijaOrthographicKey(input: string): string {
  let s = normalizeArabicHeadword(input)
    .replace(/[گݣک]/g, 'ك')
    .replace(/[پ]/g, 'ب')
    .replace(/[ڤ]/g, 'ف')

  if (!s) return ''

  return s
    .split(' ')
    .map((word) => {
      if (word.length < 3) return word
      let w = word
      // Normalize final -a / -ah / -at feminine Darija spelling (`دغيا` / `دغية` / `دغيه`)
      w = w.replace(/[ها]$/, 'ه')
      // Strip prosthetic initial alif on 4+ char words (`اشنو` -> `شنو`, `اشحال` -> `شحال`)
      if (w.length >= 4 && w.startsWith('ا') && !w.startsWith('ال')) {
        w = w.slice(1)
      }
      // Collapse interior weak vowels (`ا`, `و`, `ي`) while keeping first & last char intact
      if (w.length >= 4) {
        const first = w[0]
        const last = w[w.length - 1]
        const middle = w.slice(1, -1).replace(/[اوي]/g, '')
        w = `${first}${middle}${last}`
      }
      // Collapse geminated letters
      w = w.replace(/(.)\1+/g, '$1')
      return w
    })
    .join(' ')
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

export const MAX_EVIDENCE_ITEMS = 10

export function validateEvidenceItems(items: EvidenceItem[]): {
  cleaned: EvidenceItem[]
  invalidUrls: string[]
  tooMany: boolean
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

  return {
    cleaned: cleaned.slice(0, MAX_EVIDENCE_ITEMS),
    invalidUrls,
    tooMany: cleaned.length > MAX_EVIDENCE_ITEMS,
  }
}

export function containsArabicScript(value: string): boolean {
  return ARABIC_SCRIPT_RE.test(value.trim())
}

export function isValidArabizi(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.length > 0 && LATIN_ARABIZI_RE.test(trimmed) && !ARABIC_SCRIPT_RE.test(trimmed)
}

export interface FuzzyCorpusMatch {
  entry: LexicalEntry
  matchKind: 'exact' | 'darija_spelling' | 'phonetic'
}

/**
 * Smart Darija duplicate & near-spelling detector for the New Entry Proposal form.
 * Catches exact matches plus Darija spelling divergences (تاء مربوطة/هاء/ألف، كاف/گاف،
 * حذف أو إثبات الألف والواو والياء، وهمزة الوصل مثل شنو/أشنو) and phonetic Arabizi collisions.
 */
export function findFuzzyCorpusMatches(
  entries: LexicalEntry[],
  wordAr: string,
  arabizi: string,
): FuzzyCorpusMatch[] {
  const normAr = normalizeArabicHeadword(wordAr)
  const orthoAr = normalizeDarijaOrthographicKey(wordAr)
  const normLat = normalizeArabizi(arabizi)
  const skelInput = toDarijaPhoneticSkeleton(wordAr || arabizi)

  if (!normAr && !normLat) return []

  const results: FuzzyCorpusMatch[] = []
  const seen = new Set<string>()

  for (const entry of entries) {
    const entryNormAr = normalizeArabicHeadword(entry.word)
    const entryOrthoAr = normalizeDarijaOrthographicKey(entry.word)
    const entryLatParts = normalizeArabizi(entry.latin)
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean)

    const isExactAr = normAr.length >= 2 && entryNormAr === normAr
    const isExactLat = normLat.length >= 3 && entryLatParts.includes(normLat)

    if (isExactAr || isExactLat) {
      seen.add(entry.id)
      results.push({ entry, matchKind: 'exact' })
      continue
    }

    const isDarijaSpellingVariant =
      orthoAr.length >= 2 &&
      entryOrthoAr.length >= 2 &&
      orthoAr === entryOrthoAr

    if (isDarijaSpellingVariant && !seen.has(entry.id)) {
      seen.add(entry.id)
      results.push({ entry, matchKind: 'darija_spelling' })
      continue
    }

    if (skelInput.length >= 3) {
      const entrySkels = [
        toDarijaPhoneticSkeleton(entry.word),
        ...entryLatParts.map((p) => toDarijaPhoneticSkeleton(p)),
      ].filter((s) => s.length >= 3)

      // Unify trailing h/t/a variance on phonetic skeletons (e.g. dghya -> d4y vs dghyah -> d4yh)
      const stripWeakTail = (s: string) => (s.length >= 3 ? s.replace(/^a/, '').replace(/[ht]$/, '') : s)
      const coreInput = stripWeakTail(skelInput)

      const isPhoneticCollision =
        coreInput.length >= 2 &&
        entrySkels.some((es) => {
          const coreEntry = stripWeakTail(es)
          return es === skelInput || (coreEntry.length >= 2 && coreEntry === coreInput && Math.abs(es.length - skelInput.length) <= 1)
        })

      if (isPhoneticCollision && !seen.has(entry.id)) {
        seen.add(entry.id)
        results.push({ entry, matchKind: 'phonetic' })
      }
    }
  }

  const rank: Record<FuzzyCorpusMatch['matchKind'], number> = {
    exact: 0,
    darija_spelling: 1,
    phonetic: 2,
  }
  return results.sort((a, b) => rank[a.matchKind] - rank[b.matchKind])
}

/**
 * Finds exact or orthographically normalized matches in the official lexicon.
 */
export function findSimilarCorpusEntries(
  entries: LexicalEntry[],
  wordAr: string,
  arabizi: string,
): LexicalEntry[] {
  return findFuzzyCorpusMatches(entries, wordAr, arabizi).map((m) => m.entry)
}
