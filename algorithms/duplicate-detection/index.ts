import { normalizeForComparison, tokenize } from '../shared/normalize'

export interface DuplicateCandidate {
  id: string
  text: string
}

export interface DuplicateMatch {
  id: string
  text: string
  similarity: number
  method: 'exact' | 'normalized' | 'token-overlap'
}

function jaccard(a: string[], b: string[]): number {
  const left = new Set(a)
  const right = new Set(b)
  if (!left.size && !right.size) return 1
  const intersection = [...left].filter((item) => right.has(item)).length
  const union = new Set([...left, ...right]).size
  return union ? intersection / union : 0
}

export function findDuplicateCandidates(
  query: string,
  candidates: DuplicateCandidate[],
  threshold = 0.72,
): DuplicateMatch[] {
  const normalized = normalizeForComparison(query)
  const tokens = tokenize(query)
  return candidates.flatMap((candidate) => {
    const other = normalizeForComparison(candidate.text)
    const similarity = normalized === other ? 1 : jaccard(tokens, tokenize(candidate.text))
    if (similarity < threshold) return []
    const method = query === candidate.text ? 'exact'
      : normalized === other ? 'normalized' : 'token-overlap'
    return [{ id: candidate.id, text: candidate.text, similarity, method }]
  }).sort((a, b) => b.similarity - a.similarity)
}
