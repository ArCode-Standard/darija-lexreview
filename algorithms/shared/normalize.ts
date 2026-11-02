/** Unicode normalization used only for comparison. The source spelling is never mutated. */
const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/gu

export function normalizeForComparison(input: string): string {
  return input
    .normalize('NFKC')
    .replace(INVISIBLE, '')
    .replace(DIACRITICS, '')
    .replace(/[\u0640]/gu, '')
    .replace(/[أإآٱ]/gu, 'ا')
    .replace(/[ىی]/gu, 'ي')
    .replace(/ک/gu, 'ك')
    .toLocaleLowerCase('ar')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ')
}

/** Tokenizes normalized text on Unicode letter/number boundaries. */
export function tokenize(input: string): string[] {
  const normalized = normalizeForComparison(input)
  return normalized ? normalized.split(' ') : []
}

export function hasArabicScript(input: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/u.test(input)
}

export function hasLatinScript(input: string): boolean {
  return /[A-Za-z\u00C0-\u024F]/u.test(input)
}

/** Escapes regular-expression metacharacters in user-provided text. */
export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
