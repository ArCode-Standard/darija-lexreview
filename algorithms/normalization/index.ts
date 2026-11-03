const MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g
export interface NormalizationOptions { preserveDiacritics?: boolean; normalizeAlef?: boolean; normalizeYa?: boolean }

/** Search-only normalization. Always preserve the original submitted form separately. */
export function normalizeArabicForSearch(input: string, options: NormalizationOptions = {}): string {
  let value = input.normalize('NFC').replace(/\u0640/g, '').trim().replace(/\s+/g, ' ')
  if (!options.preserveDiacritics) value = value.replace(MARKS, '')
  if (options.normalizeAlef !== false) value = value.replace(/[أإآٱ]/g, 'ا')
  if (options.normalizeYa) value = value.replace(/ى/g, 'ي')
  return value
}
/** Conservative Arabizi normalization; does not collapse ambiguous phonemes. */
export function normalizeArabiziForSearch(input: string): string {
  return input.normalize('NFKC').toLocaleLowerCase('en').trim()
    .replace(/[’‘\`´]/g, "'").replace(/[-‐‑‒–—_]+/g, ' ').replace(/\s+/g, ' ')
}
export function normalizeDarijaSearchKey(input: string): string {
  return /[\u0600-\u06FF]/.test(input) ? normalizeArabicForSearch(input) : normalizeArabiziForSearch(input)
}
