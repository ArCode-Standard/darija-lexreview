const MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/gu
const TATWEEL = /\u0640/gu

export interface NormalizationOptions {
  preserveDiacritics?: boolean
  normalizeAlef?: boolean
  normalizeYa?: boolean
}

/** Search-only normalization. Preserve the original submitted form separately. */
export function normalizeArabicForSearch(input: string, options: NormalizationOptions = {}): string {
  let value = input.normalize('NFKC').replace(INVISIBLE, '').replace(TATWEEL, '').trim().replace(/\s+/gu, ' ')
  if (!options.preserveDiacritics) value = value.replace(MARKS, '')
  if (options.normalizeAlef !== false) value = value.replace(/[أإآٱ]/gu, 'ا')
  if (options.normalizeYa) value = value.replace(/ى/gu, 'ي')
  return value
}

/** Conservative Arabizi normalization; ambiguous phonemes are not collapsed. */
export function normalizeArabiziForSearch(input: string): string {
  return input.normalize('NFKC').replace(INVISIBLE, '').toLocaleLowerCase('en').trim()
    .replace(/[’‘´]/gu, "'")
    .replace(/[-‐‑‒–—_]+/gu, ' ')
    .replace(/\s+/gu, ' ')
}

export function normalizeDarijaSearchKey(input: string): string {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/u.test(input)
    ? normalizeArabicForSearch(input).toLocaleLowerCase('ar')
    : normalizeArabiziForSearch(input)
}
