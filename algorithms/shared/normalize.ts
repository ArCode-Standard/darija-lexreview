/** Unicode normalization that does not rewrite or replace the original text. */
export function normalizeForComparison(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[\u200B-\u200F\uFEFF]/g, '')
    .toLocaleLowerCase('ar')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function tokenize(input: string): string[] {
  const normalized = normalizeForComparison(input)
  return normalized ? normalized.split(' ') : []
}
