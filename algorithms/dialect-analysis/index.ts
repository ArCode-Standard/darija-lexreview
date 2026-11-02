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
}

/** Region hints are possible only from an explicitly supplied, sourced lexicon. */
export function inferRegionHints(text: string, lexicon: RegionalLexiconEntry[]): RegionHint[] {
  const lower = text.normalize('NFKC').toLocaleLowerCase('ar')
  const grouped = new Map<string, { terms: string[]; sources: string[] }>()
  for (const entry of lexicon) {
    if (!entry.term.trim() || !entry.region.trim() || !entry.sourceId.trim()) continue
    if (!lower.includes(entry.term.normalize('NFKC').toLocaleLowerCase('ar'))) continue
    const current = grouped.get(entry.region) ?? { terms: [], sources: [] }
    current.terms.push(entry.term)
    current.sources.push(entry.sourceId)
    grouped.set(entry.region, current)
  }
  return [...grouped.entries()].map(([region, data]) => ({
    region,
    matchedTerms: [...new Set(data.terms)],
    sourceIds: [...new Set(data.sources)],
    confidence: data.terms.length > 1 ? 'medium' : 'low',
  })).sort((a, b) => b.matchedTerms.length - a.matchedTerms.length)
}
