import type { AlgorithmSignal } from '../shared/types'
import { normalizeForComparison, tokenize } from '../shared/normalize'

const NEGATION_MARKERS = new Set([
  'ماشي', 'مش', 'موش', 'ليس', 'لا', 'مكاينش', 'مكينش', 'ماكاينش',
])
const POSITIVE_MARKERS = new Set([
  'كاين', 'موجود', 'صحيح', 'نعم', 'اييه', 'ايه', 'بصح',
])

export interface ClaimLike {
  id: string
  text: string
  subject?: string
}

interface Polarity {
  negative: boolean
  positive: boolean
  content: Set<string>
}

function inspectClaim(text: string): Polarity {
  const tokens = tokenize(text)
  const splitNegation = tokens.some((token, index) =>
    token === 'ما' && Boolean(tokens[index + 1]?.endsWith('ش')),
  )
  const negative = splitNegation || tokens.some((token) => NEGATION_MARKERS.has(token))
  const positive = tokens.some((token) => POSITIVE_MARKERS.has(token))
  const stop = new Set([...NEGATION_MARKERS, ...POSITIVE_MARKERS, 'ما', 'ش', 'و'])
  return {
    negative,
    positive,
    content: new Set(tokens.filter((token) => token.length > 1 && !stop.has(token))),
  }
}

function sharesTopic(a: ClaimLike, b: ClaimLike, left: Polarity, right: Polarity): boolean {
  if (a.subject?.trim() && b.subject?.trim()) {
    return normalizeForComparison(a.subject) === normalizeForComparison(b.subject)
  }
  for (const token of left.content) if (right.content.has(token)) return true
  return false
}

/** Surface-polarity alert only; it is not a semantic contradiction classifier. */
export function detectPolarityConflicts(claims: ClaimLike[]): AlgorithmSignal[] {
  const signals: AlgorithmSignal[] = []
  for (let i = 0; i < claims.length; i += 1) {
    for (let j = i + 1; j < claims.length; j += 1) {
      const a = claims[i]
      const b = claims[j]
      const left = inspectClaim(a.text)
      const right = inspectClaim(b.text)
      const opposing = (left.negative && right.positive) || (right.negative && left.positive)
      if (!opposing || !sharesTopic(a, b, left, right)) continue
      signals.push({
        code: 'POSSIBLE_POLARITY_CONFLICT',
        severity: 'review',
        message: 'Opposing surface polarity markers occur in claims with a shared topic; verify scope, time, and sense manually.',
        evidence: [a.id, b.id],
      })
    }
  }
  return signals
}
