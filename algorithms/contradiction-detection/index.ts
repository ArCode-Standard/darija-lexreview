import type { AlgorithmSignal } from '../shared/types'

const NEGATION = /(?:ما\s*\.\.\.\s*ش|ماشي|مش|موش|ليس|لا|ما|مكاينش|مكينش)/u
const POSITIVE = /(?:كاين|موجود|صحيح|نعم|إييه|ايه)/u

export interface ClaimLike {
  id: string
  text: string
}

/**
 * Flags only explicit lexical polarity clashes. It does not understand full semantics,
 * sarcasm, context, or whether two claims refer to the same sense.
 */
export function detectPolarityConflicts(claims: ClaimLike[]): AlgorithmSignal[] {
  const signals: AlgorithmSignal[] = []
  for (let i = 0; i < claims.length; i += 1) {
    for (let j = i + 1; j < claims.length; j += 1) {
      const a = claims[i]
      const b = claims[j]
      const aNeg = NEGATION.test(a.text)
      const bNeg = NEGATION.test(b.text)
      const aPos = POSITIVE.test(a.text)
      const bPos = POSITIVE.test(b.text)
      if ((aNeg && bPos) || (bNeg && aPos)) {
        signals.push({
          code: 'POSSIBLE_POLARITY_CONFLICT',
          severity: 'review',
          message: 'Two claims contain opposing surface polarity markers; verify context and sense manually.',
          evidence: [a.id, b.id],
        })
      }
    }
  }
  return signals
}
