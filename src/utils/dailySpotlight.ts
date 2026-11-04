import type { LexicalEntry } from '../types/lexicon'

function computeDaySeed(dateInput?: Date | string): number {
  const isoDay =
    typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)
      ? dateInput.slice(0, 10)
      : (dateInput instanceof Date ? dateInput : new Date()).toISOString().slice(0, 10)

  let hash = 2166136261
  for (let i = 0; i < isoDay.length; i++) {
    hash ^= isoDay.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash >>> 0)
}

export interface DailyLexiconSpotlight {
  dateKey: string
  wordOfTheDay: LexicalEntry | null
  proverbOrExpressionOfTheDay: LexicalEntry | null
}

/**
 * Selects a deterministic daily Word of the Day and Proverb/Expression of the Day
 * from documented corpus entries that include rich contextual examples.
 */
export function selectDailyLexiconSpotlight(
  entries: LexicalEntry[],
  dateInput?: Date | string,
): DailyLexiconSpotlight {
  const dateKey =
    typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)
      ? dateInput.slice(0, 10)
      : (dateInput instanceof Date ? dateInput : new Date()).toISOString().slice(0, 10)

  if (entries.length === 0) {
    return { dateKey, wordOfTheDay: null, proverbOrExpressionOfTheDay: null }
  }

  const seed = computeDaySeed(dateKey)

  const documentedWords = entries.filter(
    (e) =>
      e.examples.length > 0 &&
      (!e.entryType || e.entryType === 'word' || e.entryType === 'unknown'),
  )
  const wordPool = documentedWords.length > 0 ? documentedWords : entries
  const wordOfTheDay = wordPool[seed % wordPool.length] ?? entries[0]

  const proverbCandidates = entries.filter(
    (e) =>
      e.id !== wordOfTheDay.id &&
      (e.entryType === 'proverb' ||
        e.entryType === 'expression' ||
        e.entryType === 'conversational' ||
        e.word.trim().includes(' ')),
  )
  const fallbackPool = entries.filter((e) => e.id !== wordOfTheDay.id && e.examples.length > 0)
  const expressionPool =
    proverbCandidates.length > 0
      ? proverbCandidates
      : fallbackPool.length > 0
        ? fallbackPool
        : entries

  const secondSeed = Math.imul(seed ^ 0x9e3779b9, 16777619) >>> 0
  const proverbOrExpressionOfTheDay =
    expressionPool[secondSeed % expressionPool.length] ?? wordOfTheDay

  return {
    dateKey,
    wordOfTheDay,
    proverbOrExpressionOfTheDay,
  }
}

export interface RegionalTaskRecommendation {
  entry: LexicalEntry
  reason: 'missing_example' | 'needs_regional_attestation'
  reasonLabel: string
}

/**
 * Computes personalized micro-tasks for a logged-in member based on their
 * chosen Moroccan dialect region (`dialect_region`), prioritizing entries
 * that lack contextual examples or regional confirmation in their region.
 */
export function selectRegionalMemberTasks(params: {
  entries: LexicalEntry[]
  memberRegion?: string | null
  userVerdictsByEntryId?: Record<string, unknown>
  limit?: number
}): RegionalTaskRecommendation[] {
  const { entries, memberRegion, userVerdictsByEntryId = {}, limit = 4 } = params
  const cleanRegion = (memberRegion ?? '').trim()
  if (!cleanRegion || cleanRegion === 'مشترك عام' || entries.length === 0) {
    return []
  }

  const normalizeRegionToken = (r: string) =>
    r
      .trim()
      .replace(/\s*-\s*/g, ' و')
      .toLowerCase()

  const targetToken = normalizeRegionToken(cleanRegion)
  const firstKeyword = cleanRegion.split(/[\s،-]+/).filter((w) => w.length >= 3)[0] ?? cleanRegion

  const matchesMemberRegion = (regions?: string[]) => {
    if (!regions || regions.length === 0) return false
    return regions.some((r) => {
      const norm = normalizeRegionToken(r)
      return norm === targetToken || r.includes(firstKeyword) || cleanRegion.includes(r.trim())
    })
  }

  const regionalMissingExamples: RegionalTaskRecommendation[] = []
  const generalMissingExamples: RegionalTaskRecommendation[] = []
  const needsRegionalConfirmation: RegionalTaskRecommendation[] = []

  for (const entry of entries) {
    if (userVerdictsByEntryId[entry.id]) continue

    const taggedForRegion = matchesMemberRegion(entry.region)
    if (entry.examples.length === 0 && taggedForRegion) {
      regionalMissingExamples.push({
        entry,
        reason: 'missing_example',
        reasonLabel: `تنقصها جملة شاهد من ${cleanRegion}`,
      })
    } else if (entry.examples.length === 0) {
      generalMissingExamples.push({
        entry,
        reason: 'missing_example',
        reasonLabel: `أضف شاهداً يوثق استعمالها في ${cleanRegion}`,
      })
    } else if (!taggedForRegion) {
      needsRegionalConfirmation.push({
        entry,
        reason: 'needs_regional_attestation',
        reasonLabel: `تحقّق من تداولها أو نطقها في ${cleanRegion}`,
      })
    }

    if (
      regionalMissingExamples.length >= limit &&
      needsRegionalConfirmation.length >= limit
    ) {
      break
    }
  }

  const combined = [
    ...regionalMissingExamples,
    ...generalMissingExamples.slice(0, Math.max(2, Math.ceil(limit / 2))),
    ...needsRegionalConfirmation,
  ]

  const unique: RegionalTaskRecommendation[] = []
  const seen = new Set<string>()
  for (const item of combined) {
    if (!seen.has(item.entry.id)) {
      seen.add(item.entry.id)
      unique.push(item)
      if (unique.length >= limit) break
    }
  }

  return unique
}
