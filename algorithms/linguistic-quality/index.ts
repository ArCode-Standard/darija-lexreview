import type { AlgorithmSignal, ScoredResult } from '../shared/types'

export interface LexicalEntryDraft {
  term: string
  definition?: string
  example?: string
  sourceUrl?: string
}

/** Completeness score only; it is not a linguistic correctness or authenticity score. */
export function scoreEntryCompleteness(entry: LexicalEntryDraft): ScoredResult {
  const signals: AlgorithmSignal[] = []
  let score = 0
  if (entry.term.trim()) score += 35
  else signals.push({ code: 'MISSING_TERM', severity: 'warning', message: 'Lexical term is missing.' })
  if (entry.definition?.trim()) score += 30
  else signals.push({ code: 'MISSING_DEFINITION', severity: 'warning', message: 'Definition is missing.' })
  if (entry.example?.trim()) score += 25
  else signals.push({ code: 'MISSING_EXAMPLE', severity: 'info', message: 'Usage example is missing.' })
  if (entry.sourceUrl && /^https?:\/\//i.test(entry.sourceUrl)) score += 10
  else signals.push({ code: 'MISSING_SOURCE_URL', severity: 'review', message: 'A verifiable source URL has not been supplied.' })
  return { score, signals }
}
