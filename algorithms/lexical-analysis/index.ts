import { hasArabicScript, hasLatinScript, normalizeForComparison, tokenize } from '../shared/normalize'

export interface LexicalForm {
  original: string
  comparisonForm: string
  tokens: string[]
  hasArabicDiacritics: boolean
  hasTatweel: boolean
  hasMixedScripts: boolean
}

/** Produces a comparison key; never use it to overwrite the canonical spelling. */
export function analyzeLexicalForm(input: string): LexicalForm {
  return {
    original: input,
    comparisonForm: normalizeForComparison(input),
    tokens: tokenize(input),
    hasArabicDiacritics: /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/u.test(input),
    hasTatweel: /\u0640/u.test(input),
    hasMixedScripts: hasArabicScript(input) && hasLatinScript(input),
  }
}
