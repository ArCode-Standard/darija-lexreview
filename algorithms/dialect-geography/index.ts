export interface RegionalObservation {
  entryId: string
  region?: string | null
  count?: number
}

export interface RegionalDistribution {
  entryId: string
  observed: Array<{ region: string; count: number }>
  unknownCount: number
  total: number
  coverage: 'documented' | 'partially_documented' | 'undocumented'
}

/** Summarizes supplied observations; missing data never means non-use. */
export function summarizeRegionalDistribution(rows: RegionalObservation[]): RegionalDistribution[] {
  if (!Array.isArray(rows)) throw new TypeError('rows must be an array')
  const groups = new Map<string, { regions: Map<string, number>; unknown: number }>()

  for (const row of rows) {
    const entryId = row.entryId?.trim()
    if (!entryId) throw new TypeError('Every regional observation requires an entry ID')
    const count = row.count === undefined ? 1 : row.count
    if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('Observation counts must be non-negative safe integers')
    const amount = count
    if (amount === 0) continue
    const group = groups.get(entryId) ?? { regions: new Map<string, number>(), unknown: 0 }
    const region = row.region?.trim()
    if (region) group.regions.set(region, (group.regions.get(region) ?? 0) + amount)
    else group.unknown += amount
    groups.set(entryId, group)
  }

  return [...groups].map(([entryId, group]) => {
    const observed = [...group.regions]
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count || a.region.localeCompare(b.region))
    const total = group.unknown + observed.reduce((sum, item) => sum + item.count, 0)
    return {
      entryId,
      observed,
      unknownCount: group.unknown,
      total,
      coverage: observed.length === 0 ? 'undocumented' : group.unknown > 0 ? 'partially_documented' : 'documented',
    }
  }).sort((a, b) => a.entryId.localeCompare(b.entryId))
}
