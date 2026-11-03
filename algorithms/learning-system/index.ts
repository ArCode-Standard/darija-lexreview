import type { DatasetExample, DatasetSplit, EvaluationReport, FeedbackCandidate, FeedbackDomain, FeedbackSource, ModelRelease, ReleaseGate } from './types'
export * from './types'
const ALLOWED_SURFACES = new Set(['profile', 'lexicon', 'contribution', 'review', 'comment', 'discussion', 'report', 'benchmark'])
const ALLOWED_SOURCES = new Set<FeedbackSource>(['lexicon_suggestion', 'editor_correction', 'moderation_appeal', 'moderation_decision', 'benchmark_annotation'])
const PERSONAL_DATA_PATTERNS = [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu, /(?:\+?\d[\d\s().-]{7,}\d)/u]
export interface SubmitFeedbackInput {
  id: string; domain: FeedbackDomain; source: FeedbackSource; sourceSurface: string
  groupId: string; text: string; label: string; rationale: string; contributorRef: string
  consentToDatasetUse: boolean; license: string; createdAt?: Date
}
export function submitFeedbackCandidate(input: SubmitFeedbackInput): FeedbackCandidate {
  if (!ALLOWED_SOURCES.has(input.source)) throw new TypeError('Unsupported feedback source')
  if (!ALLOWED_SURFACES.has(input.sourceSurface.toLowerCase())) throw new Error('This content surface is not eligible for the learning pipeline')
  if (!input.consentToDatasetUse) throw new Error('Explicit dataset-use consent is required')
  if (!input.license.trim()) throw new Error('A documented data-use license is required')
  if (!input.id.trim() || !input.groupId.trim() || !input.contributorRef.trim()) throw new TypeError('Candidate identifiers and provenance are required')
  const text = input.text.trim()
  if (!text || !input.label.trim() || !input.rationale.trim()) throw new TypeError('Text, label, and rationale are required')
  if (PERSONAL_DATA_PATTERNS.some((pattern) => pattern.test(text))) throw new Error('Candidate appears to contain personal data and must be redacted before submission')
  return { ...input, text, status: 'pending', containsPersonalData: false, createdAt: (input.createdAt ?? new Date()).toISOString(), reviews: [] }
}
export interface ReviewFeedbackInput {
  candidate: FeedbackCandidate; reviewerRef: string; role: 'user' | 'editor' | 'admin'
  decision: 'approve' | 'reject'; reason: string; reviewedAt?: Date
}
export function reviewFeedbackCandidate(input: ReviewFeedbackInput): FeedbackCandidate {
  if (input.role !== 'editor' && input.role !== 'admin') throw new Error('Only editors or admins can review learning candidates')
  if (input.candidate.status !== 'pending') throw new Error('Only pending candidates can be reviewed')
  if (!input.reason.trim()) throw new TypeError('A review reason is required')
  if (input.reviewerRef === input.candidate.contributorRef) throw new Error('Contributors cannot approve their own feedback')
  if (input.candidate.reviews.some((review) => review.reviewerRef === input.reviewerRef)) throw new Error('A reviewer cannot review the same candidate twice')
  const review = { reviewerRef: input.reviewerRef, role: input.role, decision: input.decision, reason: input.reason.trim(), reviewedAt: (input.reviewedAt ?? new Date()).toISOString() }
  const reviews = [...input.candidate.reviews, review]
  const approvalCount = reviews.filter((item) => item.decision === 'approve').length
  const rejectionCount = reviews.filter((item) => item.decision === 'reject').length
  const approved = input.candidate.domain === 'content_safety' ? approvalCount >= 2 && rejectionCount === 0 : approvalCount >= 1 && rejectionCount === 0
  return { ...input.candidate, reviews, status: rejectionCount > 0 ? 'rejected' : approved ? 'approved' : 'pending' }
}
function stableHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619) }
  return hash >>> 0
}
/** Group-aware splits prevent related examples from leaking across train/validation/test. */
export async function buildApprovedDataset(candidates: FeedbackCandidate[], version: string): Promise<DatasetSplit> {
  if (!version.trim()) throw new TypeError('Dataset version is required')
  const approved = candidates.filter((candidate) => candidate.status === 'approved' && candidate.consentToDatasetUse &&
    !candidate.containsPersonalData && ALLOWED_SURFACES.has(candidate.sourceSurface.toLowerCase()) && candidate.license.trim().length > 0)
  const unique = new Map<string, DatasetExample>()
  for (const candidate of approved) {
    const key = candidate.id + ':' + candidate.label
    if (!unique.has(key)) unique.set(key, {
      id: candidate.id, groupId: candidate.groupId, text: candidate.text, label: candidate.label,
      domain: candidate.domain, source: candidate.source, license: candidate.license,
    })
  }
  const examples = [...unique.values()].sort((a, b) => a.id.localeCompare(b.id))
  const train: DatasetExample[] = [], validation: DatasetExample[] = [], test: DatasetExample[] = []
  for (const example of examples) {
    const bucket = stableHash(example.groupId) % 100
    if (bucket < 70) train.push(example)
    else if (bucket < 85) validation.push(example)
    else test.push(example)
  }
  const canonical = examples.map((example) => [example.id, example.groupId, example.text, example.label, example.license].join('|')).join('\n')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  const fingerprint = 'sha256:' + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return { train, validation, test, fingerprint, version }
}
export function calculateEvaluationReport(datasetVersion: string, expected: string[], predicted: string[]): EvaluationReport {
  if (expected.length !== predicted.length) throw new RangeError('Expected and predicted arrays must have equal length')
  const labels = [...new Set([...expected, ...predicted])].sort()
  const classes = labels.map((label) => {
    let truePositive = 0, falsePositive = 0, falseNegative = 0
    for (let index = 0; index < expected.length; index += 1) {
      if (expected[index] === label && predicted[index] === label) truePositive += 1
      else if (expected[index] !== label && predicted[index] === label) falsePositive += 1
      else if (expected[index] === label && predicted[index] !== label) falseNegative += 1
    }
    const trueNegative = expected.length - truePositive - falsePositive - falseNegative
    const falsePositiveRate = falsePositive + trueNegative === 0 ? 0 : falsePositive / (falsePositive + trueNegative)
    const falseNegativeRate = falseNegative + truePositive === 0 ? 0 : falseNegative / (falseNegative + truePositive)
    const precision = truePositive + falsePositive === 0 ? 0 : truePositive / (truePositive + falsePositive)
    const recall = truePositive + falseNegative === 0 ? 0 : truePositive / (truePositive + falseNegative)
    const f1 = precision + recall === 0 ? 0 : 2 * precision * recall / (precision + recall)
    return { label, truePositive, falsePositive, falseNegative, trueNegative, falsePositiveRate, falseNegativeRate, precision, recall, f1 }
  })
  const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
  return { datasetVersion, sampleCount: expected.length, classes, macroPrecision: mean(classes.map((item) => item.precision)), macroRecall: mean(classes.map((item) => item.recall)), macroF1: mean(classes.map((item) => item.f1)) }
}
export function evaluateReleaseGate(report: EvaluationReport, gate: ReleaseGate): { approved: boolean; failures: string[] } {
  const failures: string[] = []
  const thresholds = [gate.minPrecision, gate.minRecall, gate.minMacroF1, gate.minClassF1, gate.maxFalsePositiveRate, gate.maxFalseNegativeRate]
  if (!Number.isInteger(gate.minSamples) || gate.minSamples < 1 || thresholds.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new RangeError('Release gate thresholds must be within [0, 1] and minSamples must be a positive integer')
  }
  if (report.sampleCount < gate.minSamples) failures.push('insufficient_evaluation_samples')
  if (report.macroPrecision < gate.minPrecision) failures.push('macro_precision_below_threshold')
  if (report.macroRecall < gate.minRecall) failures.push('macro_recall_below_threshold')
  if (report.macroF1 < gate.minMacroF1) failures.push('macro_f1_below_threshold')
  if (report.classes.some((item) => item.f1 < gate.minClassF1)) failures.push('class_f1_below_threshold')
  if (report.classes.some((item) => item.falsePositiveRate > gate.maxFalsePositiveRate)) failures.push('class_false_positive_rate_above_threshold')
  if (report.classes.some((item) => item.falseNegativeRate > gate.maxFalseNegativeRate)) failures.push('class_false_negative_rate_above_threshold')
  return { approved: failures.length === 0, failures }
}
export function validateModelRelease(release: ModelRelease, gate: ReleaseGate): { valid: boolean; failures: string[] } {
  const failures = evaluateReleaseGate(release.evaluation, gate).failures
  if (!/^sha256:[a-f0-9]{64}$/i.test(release.artifactDigest)) failures.push('invalid_artifact_digest')
  if (!release.datasetVersion.trim() || release.datasetVersion !== release.evaluation.datasetVersion) failures.push('dataset_version_mismatch')
  if (!/^[a-f0-9]{7,40}$/i.test(release.codeCommit)) failures.push('invalid_code_commit')
  if (new Set(release.approvedBy).size < 2) failures.push('two_independent_approvals_required')
  return { valid: failures.length === 0, failures }
}
