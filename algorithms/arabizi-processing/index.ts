export interface ArabiziCandidate {
  value: string
  alternatives: string[]
  confidence: 'low' | 'medium'
  notes: string[]
}

export interface ArabiziHypothesis {
  value: string
  /** Deterministic ranking score, not a calibrated probability. */
  score: number
  confidence: 'low' | 'medium'
  decisions: string[]
}

export interface ArabiziTransliterationOptions {
  /** Maximum number of distinct full-string hypotheses to return. */
  maxCandidates?: number
}

interface Choice {
  value: string
  score: number
  decision?: string
}

interface PartialHypothesis {
  value: string
  score: number
  decisions: string[]
}

const DIGRAPHS: Record<string, string> = {
  ch: 'ش',
  sh: 'ش',
  kh: 'خ',
  gh: 'غ',
  th: 'ث',
  dh: 'ذ',
  ph: 'ف',
  ou: 'و',
  oo: 'و',
  aa: 'ا',
  ee: 'ي',
  ii: 'ي',
}

const DIGITS: Record<string, string> = {
  '2': 'ء',
  '3': 'ع',
  '5': 'خ',
  '6': 'ط',
  '7': 'ح',
  '8': 'غ',
  '9': 'ق',
}

const LETTERS: Record<string, string> = {
  a: 'ا',
  b: 'ب',
  c: 'ك',
  d: 'د',
  e: 'ي',
  f: 'ف',
  g: 'گ',
  h: 'ه',
  i: 'ي',
  j: 'ج',
  k: 'ك',
  l: 'ل',
  m: 'م',
  n: 'ن',
  o: 'و',
  p: 'ب',
  q: 'ق',
  r: 'ر',
  s: 'س',
  t: 'ت',
  u: 'و',
  v: 'ف',
  w: 'و',
  x: 'كس',
  y: 'ي',
  z: 'ز',
}

const DEFAULT_MAX_CANDIDATES = 5
const MAX_ALLOWED_CANDIDATES = 20

function choicesAt(token: string, index: number): { choices: Choice[]; width: number } {
  const pair = token.slice(index, index + 2)
  const lowerPair = pair.toLowerCase()
  const next = token[index + 1]?.toLowerCase()
  const char = token[index].toLowerCase()
  const isFinal = index === token.length - 1

  if (DIGRAPHS[lowerPair]) {
    return {
      choices: [{ value: DIGRAPHS[lowerPair], score: 0.18, decision: `digraph:${lowerPair}` }],
      width: 2,
    }
  }

  if (DIGITS[char]) {
    return { choices: [{ value: DIGITS[char], score: 0.2, decision: `digit:${char}` }], width: 1 }
  }

  if (char === 'g') {
    const frontVowel = next !== undefined && 'eiy'.includes(next)
    return {
      choices: frontVowel
        ? [
            { value: 'ج', score: 0.22, decision: 'g:front-vowel→ج' },
            { value: 'گ', score: 0.08, decision: 'g:hard-g→گ' },
          ]
        : [
            { value: 'گ', score: 0.22, decision: 'g:hard-g→گ' },
            { value: 'ج', score: 0.06, decision: 'g:alternate→ج' },
          ],
      width: 1,
    }
  }

  if (char === 'c') {
    const softC = next !== undefined && 'eiy'.includes(next)
    return {
      choices: softC
        ? [
            { value: 'س', score: 0.2, decision: 'c:soft→س' },
            { value: 'ك', score: 0.08, decision: 'c:hard→ك' },
          ]
        : [
            { value: 'ك', score: 0.2, decision: 'c:hard→ك' },
            { value: 'س', score: 0.05, decision: 'c:alternate→س' },
          ],
      width: 1,
    }
  }

  if (char === 'q') {
    return {
      choices: [
        { value: 'ق', score: 0.2, decision: 'q→ق' },
        { value: 'ك', score: 0.04, decision: 'q:alternate→ك' },
      ],
      width: 1,
    }
  }

  if ('aeiou'.includes(char)) {
    const mapped = LETTERS[char]
    const choices: Choice[] = [{ value: mapped, score: 0.12, decision: `vowel:${char}→${mapped}` }]

    if (char === 'a' && isFinal) {
      choices.push({ value: 'ة', score: 0.08, decision: 'final-a→ة' })
    }
    if (char === 'e') {
      choices.push({ value: 'ا', score: 0.02, decision: 'e:alternate→ا' })
    }
    // Short vowels are often omitted in informal Arabic-script writing.
    if (!isFinal && index > 0) {
      choices.push({ value: '', score: 0.03, decision: `short-vowel-omitted:${char}` })
    }
    return { choices, width: 1 }
  }

  return {
    choices: [{ value: LETTERS[char] ?? token[index], score: 0.1 }],
    width: 1,
  }
}

function keepBestByValue(items: PartialHypothesis[], limit: number): PartialHypothesis[] {
  const best = new Map<string, PartialHypothesis>()
  for (const item of items) {
    const previous = best.get(item.value)
    if (!previous || item.score > previous.score) best.set(item.value, item)
  }
  return [...best.values()]
    .sort((a, b) => b.score - a.score || a.value.localeCompare(b.value))
    .slice(0, limit)
}

function transliterateTokenCandidates(token: string, limit: number): PartialHypothesis[] {
  let beam: PartialHypothesis[] = [{ value: '', score: 0, decisions: [] }]

  for (let index = 0; index < token.length;) {
    const { choices, width } = choicesAt(token, index)
    const expanded: PartialHypothesis[] = []
    for (const current of beam) {
      for (const choice of choices) {
        expanded.push({
          value: current.value + choice.value,
          score: current.score + choice.score,
          decisions: choice.decision
            ? [...current.decisions, choice.decision]
            : current.decisions,
        })
      }
    }
    beam = keepBestByValue(expanded, limit)
    index += width
  }

  return beam
}

/**
 * Returns ranked Arabic-script hypotheses. Scores are deterministic ranking
 * signals only; they are not probabilities and do not establish lexical validity.
 */
export function transliterateArabiziCandidates(
  input: string,
  options: ArabiziTransliterationOptions = {},
): ArabiziHypothesis[] {
  const maxCandidates = options.maxCandidates ?? DEFAULT_MAX_CANDIDATES
  if (!Number.isInteger(maxCandidates) || maxCandidates < 1 || maxCandidates > MAX_ALLOWED_CANDIDATES) {
    throw new RangeError(`maxCandidates must be an integer from 1 to ${MAX_ALLOWED_CANDIDATES}`)
  }
  if (!input.trim()) return []

  // Split only Latin/number runs. Arabic text, whitespace, punctuation, and symbols
  // remain byte-for-byte intact in the surrounding segments.
  const segments = input.split(/([A-Za-z0-9]+)/u)
  let beam: PartialHypothesis[] = [{ value: '', score: 0, decisions: [] }]

  for (const segment of segments) {
    if (!segment) continue
    const isArabiziToken = /^[A-Za-z0-9]+$/u.test(segment)
    const candidates = isArabiziToken
      ? transliterateTokenCandidates(segment.toLowerCase(), maxCandidates)
      : [{ value: segment, score: 0, decisions: [] }]

    const expanded: PartialHypothesis[] = []
    for (const current of beam) {
      for (const candidate of candidates) {
        expanded.push({
          value: current.value + candidate.value,
          score: current.score + candidate.score,
          decisions: [...current.decisions, ...candidate.decisions],
        })
      }
    }
    beam = keepBestByValue(expanded, maxCandidates)
  }

  return beam.map((candidate, index) => ({
    ...candidate,
    confidence: index === 0 && candidate.decisions.length === 0 ? 'medium' : 'low',
  }))
}

/**
 * Backwards-compatible single-best API. alternatives now contains additional
 * ranked hypotheses instead of always being empty.
 */
export function transliterateArabizi(input: string): ArabiziCandidate {
  const candidates = transliterateArabiziCandidates(input)
  const best = candidates[0]
  const notes = [
    'Rule-based N-best transliteration; ranked alternatives are hypotheses, not calibrated probabilities.',
    'Darija spelling varies by speaker, region, and context. Keep the original Arabizi form.',
    'Human review is required before accepting a candidate as a lexical entry.',
  ]

  if (/[cgq]/iu.test(input)) {
    notes.push('The input contains context-sensitive letters (c, g, or q) with multiple plausible mappings.')
  }
  if (/[2456789]/u.test(input)) {
    notes.push('Numeric Arabizi characters were mapped using common conventions.')
  }
  if (/[A-Za-z]/u.test(input) && /[\u0600-\u06FF]/u.test(input)) {
    notes.push('Arabic-script segments were preserved while Latin/number segments were transliterated.')
  }

  return {
    value: best?.value ?? input,
    alternatives: candidates.slice(1).map((candidate) => candidate.value),
    confidence: 'low',
    notes,
  }
}
