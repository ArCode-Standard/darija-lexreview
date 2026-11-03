export interface ReviewTask {
  id: string
  hasContradiction?: boolean
  evidenceComplete?: boolean
  reviewerDisagreement?: boolean
  lastReviewedAt?: string | null
  impactCount?: number
}

export interface ReviewPriorityResult {
  id: string
  score: number
  reasons: string[]
}

/** Explainable operational queue score; not a correctness or acceptance probability. */
export function rankReviewTasks(tasks: ReviewTask[], now = new Date()): ReviewPriorityResult[] {
  if (!Array.isArray(tasks)) throw new TypeError('tasks must be an array')
  if (!Number.isFinite(now.getTime())) throw new TypeError('now must be a valid date')
  return tasks.map((task) => {
    if (!task.id.trim()) throw new TypeError('Every review task requires an ID')
    let score = 0
    const reasons: string[] = []
    if (task.hasContradiction) { score += 35; reasons.push('contradiction_detected') }
    if (task.reviewerDisagreement) { score += 25; reasons.push('reviewer_disagreement') }
    if (!task.evidenceComplete) { score += 15; reasons.push('incomplete_evidence') }

    if (task.lastReviewedAt) {
      const timestamp = Date.parse(task.lastReviewedAt)
      if (Number.isFinite(timestamp)) {
        const days = Math.max(0, (now.getTime() - timestamp) / 86_400_000)
        const stalePoints = Math.min(15, Math.floor(days / 30) * 3)
        if (stalePoints) { score += stalePoints; reasons.push('stale_review') }
      } else {
        score += 8
        reasons.push('invalid_review_timestamp')
      }
    } else {
      score += 8
      reasons.push('never_reviewed')
    }

    const impact = task.impactCount ?? 0
    if (Number.isFinite(impact) && impact > 0) {
      score += Math.min(10, Math.floor(Math.log2(Math.floor(impact) + 1) * 2))
      reasons.push('high_dependency_impact')
    } else if (!Number.isFinite(impact) || impact < 0) {
      reasons.push('invalid_impact_count')
    }
    return { id: task.id, score: Math.min(100, score), reasons }
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}
