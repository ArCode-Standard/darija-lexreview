export interface ArabiziCandidate {
  value: string
  confidence: 'low' | 'medium'
  notes: string[]
}

const DIGIT_MAP: Record<string, string> = {
  '2': 'ء', '3': 'ع', '5': 'خ', '6': 'ط', '7': 'ح', '8': 'غ', '9': 'ق',
}

/**
 * Conservative character-level conversion. Arabizi is ambiguous and dialect-dependent;
 * the output is a candidate for review, not an authoritative transliteration.
 */
export function transliterateArabizi(input: string): ArabiziCandidate {
  let value = ''
  const notes: string[] = []
  for (const char of input.toLowerCase()) {
    if (DIGIT_MAP[char]) value += DIGIT_MAP[char]
    else if (/[a-z]/u.test(char)) value += char
    else value += char
  }
  if (/\d/u.test(input)) notes.push('Numeric characters were mapped using a conservative common convention.')
  if (/[cgq]/iu.test(input)) notes.push('Latin letters may have multiple Darija readings; human verification is required.')
  if (!notes.length) notes.push('No unambiguous Arabic conversion was inferred; original Latin spelling is retained.')
  return { value, confidence: 'low', notes }
}
