import type { Script, TextAnalysis } from '../shared/types'
import { normalizeForComparison, tokenize } from '../shared/normalize'

function detectScript(input: string): Script {
  const arabic = /[\u0600-\u06FF]/u.test(input)
  const latin = /[A-Za-z]/u.test(input)
  if (arabic && latin) return 'mixed'
  if (arabic) return 'arabic'
  if (latin) return 'latin'
  return 'unknown'
}

export function analyzeText(input: string): TextAnalysis {
  const tokens = tokenize(input)
  return {
    original: input,
    normalized: normalizeForComparison(input),
    tokens,
    script: detectScript(input),
    characterCount: [...input].length,
    tokenCount: tokens.length,
  }
}
