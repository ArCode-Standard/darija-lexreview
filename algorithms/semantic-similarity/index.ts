export interface VectorCandidate {
  id: string
  vector: number[]
}

export interface VectorMatch {
  id: string
  similarity: number
}

/** Cosine similarity for caller-supplied vectors; no model or network call is performed. */
export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length !== right.length) throw new RangeError('vectors must have the same dimensions')
  if (!left.length) throw new RangeError('vectors must not be empty')
  if (![...left, ...right].every(Number.isFinite)) throw new TypeError('vectors must contain only finite numbers')

  const leftScale = Math.max(...left.map(Math.abs))
  const rightScale = Math.max(...right.map(Math.abs))
  if (leftScale === 0 || rightScale === 0) return 0

  let dot = 0
  let leftNorm = 0
  let rightNorm = 0
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index] / leftScale
    const b = right[index] / rightScale
    dot += a * b
    leftNorm += a * a
    rightNorm += b * b
  }
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm))
}

/** Ranks precomputed embeddings supplied by the caller; vectors are not generated here. */
export function rankVectorCandidates(
  queryVector: number[],
  candidates: VectorCandidate[],
  threshold = 0,
): VectorMatch[] {
  if (!Number.isFinite(threshold) || threshold < -1 || threshold > 1) {
    throw new RangeError('threshold must be between -1 and 1')
  }
  if (!Array.isArray(candidates)) throw new TypeError('candidates must be an array')
  // Validate the query even when no candidates are supplied.
  cosineSimilarity(queryVector, queryVector)
  return candidates
    .map(({ id, vector }) => ({ id, similarity: cosineSimilarity(queryVector, vector) }))
    .filter((match) => match.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
}
