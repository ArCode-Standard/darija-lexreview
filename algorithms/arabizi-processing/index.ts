export interface ArabiziCandidate {
  value: string
  alternatives: string[]
  confidence: 'low' | 'medium'
  notes: string[]
}

const DIGRAPHS: Record<string, string> = {
  ch: 'ش', sh: 'ش', kh: 'خ', gh: 'غ', th: 'ث', dh: 'ذ',
}
const DIGITS: Record<string, string> = {
  '2': 'ء', '3': 'ع', '5': 'خ', '6': 'ط', '7': 'ح', '8': 'غ', '9': 'ق',
}
const LETTERS: Record<string, string> = {
  a: 'ا', b: 'ب', c: 'ك', d: 'د', e: 'ي', f: 'ف', g: 'ج', h: 'ه',
  i: 'ي', j: 'ج', k: 'ك', l: 'ل', m: 'م', n: 'ن', o: 'و', p: 'ب',
  q: 'ق', r: 'ر', s: 'س', t: 'ت', u: 'و', v: 'ف', w: 'و', x: 'كس',
  y: 'ي', z: 'ز',
}

function transliterateToken(token: string): string {
  let result = ''
  for (let index = 0; index < token.length;) {
    const pair = token.slice(index, index + 2)
    if (DIGRAPHS[pair]) {
      result += DIGRAPHS[pair]
      index += 2
      continue
    }
    const char = token[index]
    result += DIGITS[char] ?? LETTERS[char] ?? char
    index += 1
  }
  return result
}

/**
 * Produces a conservative Arabic-script candidate. This is a transliteration aid,
 * not a lexical dictionary or a claim that the resulting spelling is canonical.
 */
export function transliterateArabizi(input: string): ArabiziCandidate {
  const value = input.replace(/[A-Za-z0-9]+/gu, (token) =>
    transliterateToken(token.toLowerCase()),
  )
  const notes = [
    'Transliteration is rule-based; vowels and several consonants have multiple Darija spellings.',
    'Keep the original Arabizi form and request human review before accepting the Arabic candidate.',
  ]
  if (/[cgq]/iu.test(input)) {
    notes.push('The input contains letters whose pronunciation varies by writer and region.')
  }
  if (/[2456789]/u.test(input)) {
    notes.push('Numeric Arabizi characters were mapped using common conventions.')
  }
  return {
    value,
    alternatives: [],
    confidence: 'low',
    notes,
  }
}
