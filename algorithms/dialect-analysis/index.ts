import { normalizeForComparison, tokenize } from '../shared/normalize'

export interface RegionalLexiconEntry {
  term: string
  region: string
  sourceId: string
}

export interface RegionHint {
  region: string
  matchedTerms: string[]
  sourceIds: string[]
  confidence: 'low' | 'medium'
  evidenceCount: number
}

/** Region hints require sourced entries and exact token/phrase matches. */
export function inferRegionHints(text: string, lexicon: RegionalLexiconEntry[]): RegionHint[] {
  const textTokens = tokenize(text)
  const textSet = new Set(textTokens)
  const grouped = new Map<string, { terms: Set<string>; sources: Set<string> }>()

  for (const entry of lexicon) {
    const term = normalizeForComparison(entry.term)
    const region = entry.region.trim()
    const sourceId = entry.sourceId.trim()
    if (!term || !region || !sourceId) continue
    const termTokens = term.split(' ')
    const isPhrase = termTokens.length > 1
      ? textTokens.some((_, index) => termTokens.every((part, offset) => textTokens[index + offset] === part))
      : textSet.has(term)
    if (!isPhrase) continue

    const current = grouped.get(region) ?? { terms: new Set<string>(), sources: new Set<string>() }
    current.terms.add(entry.term)
    current.sources.add(sourceId)
    grouped.set(region, current)
  }

  return [...grouped.entries()].map(([region, data]) => ({
    region,
    matchedTerms: [...data.terms],
    sourceIds: [...data.sources],
    confidence: data.terms.size >= 3 && data.sources.size >= 2 ? 'medium' : 'low',
    evidenceCount: data.terms.size,
  })).sort((a, b) => b.evidenceCount - a.evidenceCount)
}
