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

/** Candidate pairs only. Never asserts equivalence and never merges records. */
export function discoverVariantCandidates(items: VariantCandidate[], threshold = 0.82): VariantMatch[] {
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new RangeError('threshold must be finite and between 0 and 1')
  }
  if (!Array.isArray(items)) throw new TypeError('items must be an array')
  const normalized = items.map((item) => ({
    ...item,
    key: normalizeDarijaSearchKey(item.form ?? ''),
  }))
  const results: VariantMatch[] = []
  for (let i = 0; i < normalized.length; i += 1) {
    for (let j = i + 1; j < normalized.length; j += 1) {
      const left = normalized[i]
      const right = normalized[j]
      if (!left.id.trim() || !right.id.trim() || left.id === right.id || !left.key || !right.key) continue
      const same = left.key === right.key
      const jaroWinkler = jaroWinklerSimilarity(left.key, right.key)
      const edit = normalizedEditSimilarity(left.key, right.key)
      const score = same ? 1 : Math.max(jaroWinkler, edit)
      if (score < threshold) continue
      const signals = [
        same ? 'same_normalized_form' : '',
        jaroWinkler >= threshold ? 'jaro_winkler' : '',
        edit >= threshold ? 'edit_similarity' : '',
      ].filter(Boolean)
      results.push({
        leftId: left.id,
        rightId: right.id,
        leftForm: left.form,
        rightForm: right.form,
        score,
        signals,
      })
    }
  }
  return results.sort((a, b) => b.score - a.score || a.leftId.localeCompare(b.leftId) || a.rightId.localeCompare(b.rightId))
}
