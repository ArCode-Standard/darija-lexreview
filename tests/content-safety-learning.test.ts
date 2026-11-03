import { describe, expect, it } from 'vitest'
import { scanContent, type SafetyPolicy } from '../algorithms/content-safety'
import { buildApprovedDataset, calculateEvaluationReport, evaluateReleaseGate, reviewFeedbackCandidate, submitFeedbackCandidate } from '../algorithms/learning-system'
import type { FeedbackCandidate } from '../algorithms/learning-system'

const policy: SafetyPolicy = {
  version: 'test-policy-1',
  rules: [
    { id: 'p-1', phrase: 'sample-profanity', category: 'profanity', severity: 2 },
    { id: 'a-1', phrase: 'sample-insult', category: 'personal_abuse', severity: 4 },
    { id: 'h-1', phrase: 'sample-hate', category: 'hate_speech', severity: 5 },
    { id: 't-1', phrase: 'sample-threat', category: 'threat', severity: 5 },
  ],
  reviewThreshold: 20, blockThreshold: 70, maxCharacters: 5000,
  maxRepeatedCharacterRun: 8, maxUrls: 3,
}

function makeCandidate(domain: 'linguistic' | 'content_safety' = 'linguistic'): FeedbackCandidate {
  return submitFeedbackCandidate({
    id: 'candidate-1', domain, source: 'editor_correction', sourceSurface: 'lexicon',
    groupId: 'sense-group-1', text: 'دارجة', label: 'accepted-example',
    rationale: 'Supported by an editorial source', contributorRef: 'contributor-1',
    consentToDatasetUse: true, license: 'CC-BY-4.0',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  })
}

describe('content safety engine', () => {
  it('does not block profanity-only mention in trusted linguistic context', () => {
    const result = scanContent({
      text: 'sample-profanity', surface: 'lexicon',
      context: { purpose: 'linguistic_analysis', quotedForEvidence: true },
      now: new Date('2026-01-01T00:00:00.000Z'),
    }, policy)
    expect(result.decision).toBe('allow_with_context')
  })
  it('sends ambiguous profanity to review rather than automatic blocking', () => {
    expect(scanContent({ text: 'sample-profanity', surface: 'comment' }, policy).decision).toBe('review')
  })
  it('blocks targeted personal abuse when trusted context confirms targeting', () => {
    const result = scanContent({
      text: 'sample-insult', surface: 'comment',
      context: { purpose: 'general', targetedAtPerson: true },
    }, policy)
    expect(result.decision).toBe('block')
  })
  it('escalates threat signals', () => {
    expect(scanContent({ text: 'sample-threat', surface: 'discussion' }, policy).decision).toBe('urgent_escalation')
  })
  it('rejects invalid threshold configurations', () => {
    expect(() => scanContent({ text: 'hello', surface: 'comment' }, {
      ...policy, reviewThreshold: 90, blockThreshold: 20,
    })).toThrow(RangeError)
  })
})

describe('governed learning pipeline', () => {
  it('rejects private-message sources and missing consent', () => {
    expect(() => submitFeedbackCandidate({
      id: 'x', domain: 'linguistic', source: 'editor_correction',
      sourceSurface: 'private_message', groupId: 'g', text: 'x', label: 'y',
      rationale: 'z', contributorRef: 'c', consentToDatasetUse: true, license: 'CC0',
    })).toThrow(/Private-message/)
    expect(() => submitFeedbackCandidate({
      id: 'x', domain: 'linguistic', source: 'editor_correction',
      sourceSurface: 'lexicon', groupId: 'g', text: 'x', label: 'y',
      rationale: 'z', contributorRef: 'c', consentToDatasetUse: false, license: 'CC0',
    })).toThrow(/consent/)
  })
  it('prevents contributors from approving their own examples', () => {
    expect(() => reviewFeedbackCandidate({
      candidate: makeCandidate(), reviewerRef: 'contributor-1', role: 'editor',
      decision: 'approve', reason: 'Looks good',
    })).toThrow(/own feedback/)
  })
  it('requires two independent approvals for content-safety training examples', () => {
    const first = reviewFeedbackCandidate({
      candidate: makeCandidate('content_safety'), reviewerRef: 'editor-1',
      role: 'editor', decision: 'approve', reason: 'Confirmed',
    })
    expect(first.status).toBe('pending')
    const second = reviewFeedbackCandidate({
      candidate: first, reviewerRef: 'admin-1', role: 'admin',
      decision: 'approve', reason: 'Second review',
    })
    expect(second.status).toBe('approved')
  })
  it('builds deterministic dataset splits from approved candidates only', () => {
    const pending = makeCandidate()
    const approved = reviewFeedbackCandidate({
      candidate: pending, reviewerRef: 'editor-1', role: 'editor',
      decision: 'approve', reason: 'Verified',
    })
    const a = buildApprovedDataset([pending, approved], 'dataset-1')
    const b = buildApprovedDataset([approved], 'dataset-1')
    expect(a.fingerprint).toBe(b.fingerprint)
    expect(a.train.length + a.validation.length + a.test.length).toBe(1)
  })
  it('calculates class metrics and enforces release gates', () => {
    const report = calculateEvaluationReport('dataset-1', ['safe', 'unsafe'], ['safe', 'safe'])
    expect(report.classes.find((item) => item.label === 'unsafe')?.falseNegative).toBe(1)
    const gate = evaluateReleaseGate(report, {
      minSamples: 2, minPrecision: 0.9, minRecall: 0.9,
      minMacroF1: 0.9, minClassF1: 0.9,
    })
    expect(gate.approved).toBe(false)
    expect(gate.failures).toContain('class_f1_below_threshold')
  })
})
