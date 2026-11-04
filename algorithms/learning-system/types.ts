export type FeedbackSource = 'lexicon_suggestion' | 'editor_correction' | 'moderation_appeal' | 'moderation_decision' | 'benchmark_annotation'
export type FeedbackDomain = 'linguistic' | 'content_safety'
export type FeedbackStatus = 'pending' | 'approved' | 'rejected'

export interface FeedbackCandidate {
  id: string
  domain: FeedbackDomain
  source: FeedbackSource
  sourceSurface: string
  groupId: string
  text: string
  label: string
  rationale: string
  contributorRef: string
  consentToDatasetUse: boolean
  license: string
  status: FeedbackStatus
  createdAt: string
  reviews: Array<{
    reviewerRef: string
    role: 'editor' | 'admin'
    decision: 'approve' | 'reject'
    reason: string
    reviewedAt: string
  }>
}

export interface DatasetExample {
  id: string
  groupId: string
  text: string
  label: string
  domain: FeedbackDomain
  source: FeedbackSource
  license: string
}

export interface DatasetSplit {
  train: DatasetExample[]
  validation: DatasetExample[]
  test: DatasetExample[]
  fingerprint: string
  version: string
}

export interface ClassMetrics {
  label: string
  truePositive: number
  falsePositive: number
  falseNegative: number
  trueNegative: number
  falsePositiveRate: number
  falseNegativeRate: number
  precision: number
  recall: number
  f1: number
}

export interface EvaluationReport {
  datasetVersion: string
  sampleCount: number
  classes: ClassMetrics[]
  macroPrecision: number
  macroRecall: number
  macroF1: number
  macroFalsePositiveRate: number
  macroFalseNegativeRate: number
}

export interface ReleaseGate {
  minSamples: number
  minPrecision: number
  minRecall: number
  minMacroF1: number
  minClassF1: number
  maxFalsePositiveRate: number
  maxFalseNegativeRate: number
}

export interface ModelRelease {
  id: string
  version: string
  artifactDigest: string
  datasetVersion: string
  codeCommit: string
  evaluation: EvaluationReport
  approvedBy: string[]
  status: 'candidate' | 'approved' | 'active' | 'rolled_back'
  createdAt: string
}
