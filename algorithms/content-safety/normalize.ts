const ARABIC_MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/gu
const TATWEEL = /\u0640/gu
const ARABIC_FOLD: Record<string, string> = {
  'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا',
  'ى': 'ي', 'ئ': 'ي', 'ؤ': 'و',
  'ک': 'ك', 'ی': 'ي',
}
const CONFUSABLE_FOLD: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's',
  '7': 't', '@': 'a', '$': 's',
}
function mapCharacters(value: string, map: Record<string, string>): string {
  return Array.from(value, (character) => map[character] ?? character).join('')
}
export function normalizeSafetyText(input: string): string {
  return mapCharacters(input.normalize('NFKC').toLocaleLowerCase().replace(INVISIBLE, '').replace(TATWEEL, '').replace(ARABIC_MARKS, ''), ARABIC_FOLD)
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/gu, ' ')
}
export function obfuscationSkeleton(input: string): string {
  return mapCharacters(normalizeSafetyText(input), CONFUSABLE_FOLD)
    .replace(/(.)\1{2,}/gu, '$1$1')
}

export function compactObfuscationKey(input: string): string {
  return obfuscationSkeleton(input).replace(/\s+/gu, '')
}
export function countUrls(input: string): number {
  return input.match(/(?:https?:\/\/|www\.)[^\s]+/giu)?.length ?? 0
}
export function longestRepeatedCharacterRun(input: string): number {
  let longest = 0
  let current = 0
  let previous = ''
  for (const character of input) {
    current = character === previous ? current + 1 : 1
    previous = character
    if (current > longest) longest = current
  }
  return longest
}
