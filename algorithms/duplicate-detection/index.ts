import { normalizeForComparison, tokenize } from '../shared/normalize'

export interface DuplicateCandidate {
  id: string
  text: string
}

export interface DuplicateMatch {
  id: string
  text: string
  similarity: number
  method: 'exact' | 'normalized' | 'character-edit' | 'token-overlap' | 'combined'
  reasons: string[]
}

function jaccard(a: string[], b: string[]): number {
  const left = new Set(a)
  const right = new Set(b)
  if (!left.size || !right.size) return 0
  const intersection = [...left].filter((item) => right.has(item)).length
  const union = new Set([...left, ...right]).size
  return union ? intersection / union : 0
}

/** Normalized Levenshtein similarity, operating on Unicode code points. */
function editSimilarity(left: string, right: string): number {
  const a = [...left]
  const b = [...right]
  if (!a.length || !b.length) return a.length === b.length ? 1 : 0
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    previous = current
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length)
}

export function findDuplicateCandidates(
  query: string,
  candidates: DuplicateCandidate[],
  threshold = 0.72,
): DuplicateMatch[] {
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new RangeError('threshold must be between 0 and 1')
  }
  const normalized = normalizeForComparison(query)
  if (!normalized) return []
  const tokens = tokenize(query)

  return candidates.flatMap((candidate) => {
    const other = normalizeForComparison(candidate.text)
    if (!other) return []
    const tokenScore = jaccard(tokens, tokenize(candidate.text))
    const characterScore = editSimilarity(normalized, other)
    const similarity = normalized === other
      ? 1
      : Math.max(characterScore * 0.65 + tokenScore * 0.35, characterScore, tokenScore * 0.9)
    if (similarity < threshold) return []

    const reasons: string[] = []
    if (query === candidate.text) reasons.push('Original strings are identical.')
    else if (normalized === other) reasons.push('Strings are identical after comparison normalization.')
    if (characterScore >= threshold) reasons.push('High character-level edit similarity.')
    if (tokenScore >= threshold) reasons.push('High token-set overlap.')

    const method: DuplicateMatch['method'] = query === candidate.text ? 'exact'
      : normalized === other ? 'normalized'
      : characterScore >= tokenScore ? 'character-edit'
      : tokenScore >= 0.95 ? 'token-overlap' : 'combined'

    return [{ id: candidate.id, text: candidate.text, similarity, method, reasons }]
  }).sort((a, b) => b.similarity - a.similarity)
}
