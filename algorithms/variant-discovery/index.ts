import { normalizeDarijaSearchKey } from '../normalization'
import { jaroWinklerSimilarity, normalizedEditSimilarity } from '../similarity'

export interface VariantCandidate {
  id: string
  form: string
  script?: 'arabic' | 'arabizi' | 'unknown'
  region?: string
}

export interface VariantMatch {
  leftId: string
  rightId: string
  leftForm: string
  rightForm: string
  score: number
  signals: string[]
}

export interface VariantDiscoveryOptions {
  /** Small corpora use exhaustive comparison to preserve complete pair coverage. */
  exhaustiveBelow?: number
  /** Ignore very common n-gram postings; they add cost but little discrimination. */
  maxBlockSize?: number
  /** Bound candidate comparisons per record in indexed mode. */
  maxCandidatesPerItem?: number
}

export interface VariantDiscoveryStats {
  strategy: 'exhaustive' | 'indexed'
  inputCount: number
  eligibleCount: number
  candidatePairs: number
  comparedPairs: number
  skippedCommonBlocks: number
  truncatedItems: number
}

export interface VariantDiscoveryResult {
  matches: VariantMatch[]
  stats: VariantDiscoveryStats
}

interface NormalizedCandidate extends VariantCandidate {
  key: string
  index: number
}

function uniqueBigrams(value: string): string[] {
  const chars = Array.from(value)
  if (chars.length < 2) return []
  const grams = new Set<string>()
  for (let i = 0; i < chars.length - 1; i += 1) {
    grams.add(chars[i] + chars[i + 1])
  }
  return [...grams]
}

function buildCandidatePairs(
  items: NormalizedCandidate[],
  options: Required<VariantDiscoveryOptions>,
): { pairs: Array<[number, number]>; skippedCommonBlocks: number; truncatedItems: number; strategy: 'exhaustive' | 'indexed' } {
  const eligible = items.filter((item) => item.id.trim() && item.key)
  const pairs = new Set<string>()
  const exhaustive = eligible.length <= options.exhaustiveBelow

  if (exhaustive) {
    for (let i = 0; i < eligible.length; i += 1) {
      for (let j = i + 1; j < eligible.length; j += 1) {
        if (eligible[i].id !== eligible[j].id) pairs.add(`${eligible[i].index}:${eligible[j].index}`)
      }
    }
    return {
      pairs: [...pairs].map((pair) => pair.split(':').map(Number) as [number, number]),
      skippedCommonBlocks: 0,
      truncatedItems: 0,
      strategy: 'exhaustive',
    }
  }

  const postings = new Map<string, number[]>()
  const exact = new Map<string, number[]>()
  const perItem = new Map<number, number>()
  const truncated = new Set<number>()
  for (const item of eligible) {
    // Keep only exact-form records that still have candidate capacity. This avoids
    // rescanning a saturated duplicate bucket (which would itself become quadratic).
    const sameKey = exact.get(item.key) ?? []
    let itemCount = perItem.get(item.index) ?? 0
    for (let cursor = sameKey.length - 1; cursor >= 0 && itemCount < options.maxCandidatesPerItem; cursor -= 1) {
      const otherIndex = sameKey[cursor]
      const other = items[otherIndex]
      if (other.id === item.id) continue
      const otherCount = perItem.get(otherIndex) ?? 0
      if (otherCount >= options.maxCandidatesPerItem) {
        sameKey.splice(cursor, 1)
        truncated.add(otherIndex)
        continue
      }
      pairs.add(`${Math.min(otherIndex, item.index)}:${Math.max(otherIndex, item.index)}`)
      itemCount += 1
      perItem.set(item.index, itemCount)
      const nextOtherCount = otherCount + 1
      perItem.set(otherIndex, nextOtherCount)
      if (nextOtherCount >= options.maxCandidatesPerItem) {
        sameKey.splice(cursor, 1)
        truncated.add(otherIndex)
      }
    }
    if (itemCount < options.maxCandidatesPerItem) sameKey.push(item.index)
    else truncated.add(item.index)
    exact.set(item.key, sameKey)

    for (const gram of uniqueBigrams(item.key)) {
      const posting = postings.get(gram) ?? []
      posting.push(item.index)
      postings.set(gram, posting)
    }
  }

  const skipped = new Set<string>()
  for (const [gram, posting] of postings) {
    if (posting.length > options.maxBlockSize) {
      skipped.add(gram)
      continue
    }
    for (let a = 0; a < posting.length; a += 1) {
      for (let b = a + 1; b < posting.length; b += 1) {
        const left = Math.min(posting[a], posting[b])
        const right = Math.max(posting[a], posting[b])
        if (items[left].id === items[right].id) continue
        const pair = `${left}:${right}`
        if (pairs.has(pair)) continue
        const leftCount = perItem.get(left) ?? 0
        const rightCount = perItem.get(right) ?? 0
        if (leftCount >= options.maxCandidatesPerItem || rightCount >= options.maxCandidatesPerItem) {
          if (leftCount >= options.maxCandidatesPerItem) truncated.add(left)
          if (rightCount >= options.maxCandidatesPerItem) truncated.add(right)
          continue
        }
        pairs.add(pair)
        perItem.set(left, leftCount + 1)
        perItem.set(right, rightCount + 1)
      }
    }
  }

  return {
    pairs: [...pairs].map((pair) => pair.split(':').map(Number) as [number, number]),
    skippedCommonBlocks: skipped.size,
    truncatedItems: truncated.size,
    strategy: 'indexed',
  }
}

/**
 * Generates explainable spelling-variant candidates. Indexed mode is approximate:
 * it uses shared character bigrams and bounded postings, so callers must treat
 * absent matches as "not surfaced", never as proof that two forms differ.
 */
export function discoverVariantCandidatesWithStats(
  items: VariantCandidate[],
  threshold = 0.82,
  suppliedOptions: VariantDiscoveryOptions = {},
): VariantDiscoveryResult {
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new RangeError('threshold must be finite and between 0 and 1')
  }
  if (!Array.isArray(items)) throw new TypeError('items must be an array')
  const options: Required<VariantDiscoveryOptions> = {
    exhaustiveBelow: suppliedOptions.exhaustiveBelow ?? 256,
    maxBlockSize: suppliedOptions.maxBlockSize ?? 64,
    maxCandidatesPerItem: suppliedOptions.maxCandidatesPerItem ?? 128,
  }
  if (!Number.isInteger(options.exhaustiveBelow) || options.exhaustiveBelow < 0
    || !Number.isInteger(options.maxBlockSize) || options.maxBlockSize < 2
    || !Number.isInteger(options.maxCandidatesPerItem) || options.maxCandidatesPerItem < 1) {
    throw new RangeError('Discovery limits must be positive integers (exhaustiveBelow may be zero)')
  }

  const normalized: NormalizedCandidate[] = items.map((item, index) => {
    if (!item || typeof item.id !== 'string' || typeof item.form !== 'string') {
      throw new TypeError('Each variant candidate requires string id and form fields')
    }
    return { ...item, key: normalizeDarijaSearchKey(item.form), index }
  })
  const eligibleCount = normalized.filter((item) => item.id.trim() && item.key).length
  const generated = buildCandidatePairs(normalized, options)
  const matches: VariantMatch[] = []

  for (const [leftIndex, rightIndex] of generated.pairs) {
    const left = normalized[leftIndex]
    const right = normalized[rightIndex]
    const same = left.key === right.key
    const jaroWinkler = jaroWinklerSimilarity(left.key, right.key)
    const edit = normalizedEditSimilarity(left.key, right.key)
    const score = same ? 1 : Math.max(jaroWinkler, edit)
    if (score < threshold) continue
    matches.push({
      leftId: left.id,
      rightId: right.id,
      leftForm: left.form,
      rightForm: right.form,
      score,
      signals: [
        same ? 'same_normalized_form' : '',
        jaroWinkler >= threshold ? 'jaro_winkler' : '',
        edit >= threshold ? 'edit_similarity' : '',
      ].filter(Boolean),
    })
  }

  matches.sort((a, b) => b.score - a.score
    || a.leftId.localeCompare(b.leftId)
    || a.rightId.localeCompare(b.rightId))

  return {
    matches,
    stats: {
      strategy: generated.strategy,
      inputCount: items.length,
      eligibleCount,
      candidatePairs: generated.pairs.length,
      comparedPairs: generated.pairs.length,
      skippedCommonBlocks: generated.skippedCommonBlocks,
      truncatedItems: generated.truncatedItems,
    },
  }
}

/** Backwards-compatible convenience API; use the stats variant for large corpora. */
export function discoverVariantCandidates(
  items: VariantCandidate[],
  threshold = 0.82,
  options: VariantDiscoveryOptions = {},
): VariantMatch[] {
  return discoverVariantCandidatesWithStats(items, threshold, options).matches
}
