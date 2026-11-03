import { describe, expect, it } from 'vitest'
import { normalizeSafetyText, obfuscationSkeleton, scanContent, type SafetyPolicy } from '../algorithms/content-safety'
import { scanContentPayload } from '../algorithms/content-safety/gateway'
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
  it('normalizes Arabic marks and catches a separated-letter evasion candidate', () => {
    const result = scanContent({
      text: 's a m p l e - p r o f a n i t y', surface: 'comment',
    }, policy)
    expect(result.decision).toBe('review')
    expect(result.signals.some((signal) => signal.category === 'profanity')).toBe(true)
  })
  it('allows quoted threat evidence to enter the report review path', () => {
    const result = scanContent({
      text: 'sample-threat', surface: 'report',
      context: { purpose: 'moderation_report', quotedForEvidence: true },
    }, policy)
    expect(result.decision).toBe('allow_with_context')
    expect(result.requiresHumanReview).toBe(true)
  })
  it('aggregates decisions across all explicitly mapped payload fields', () => {
    const result = scanContentPayload({
      surface: 'report',
      fields: { title: 'A neutral report', reason: 'sample-threat', evidence: ['sample-threat'] },
      contexts: { reason: { purpose: 'moderation_report', quotedForEvidence: true }, evidence: { purpose: 'moderation_report', quotedForEvidence: true } },
    }, policy)
    expect(result.decision).toBe('allow_with_context')
    expect(result.requiresHumanReview).toBe(true)
    expect(result.fields).toHaveLength(3)
  })
  it('preserves Moroccan Arabizi digit conventions in obfuscation skeletons', () => {
    expect(obfuscationSkeleton('3lach 5ayb 7chouma')).toBe('علاش خايب حشوما')
  })
  it('hard-blocks content that exceeds the configured maximum size', () => {
    const result = scanContent({ text: 'x'.repeat(5001), surface: 'comment' }, policy)
    expect(result.decision).toBe('block')
    expect(result.score).toBe(100)
    expect(result.signals[0]?.code).toBe('content_length_limit_exceeded')
  })
  it('rejects invalid surfaces and timestamps', () => {
    expect(() => scanContent({ text: 'hello', surface: 'unknown' as never }, policy)).toThrow(/surface/)
    expect(() => scanContent({ text: 'hello', surface: 'comment', now: new Date('invalid') }, policy)).toThrow(/valid Date/)
  })
  it('rejects payload values that could otherwise hide nested text', () => {
    expect(() => scanContentPayload({
      surface: 'comment', fields: { body: { nested: 'sample-threat' } as never },
    }, policy)).toThrow(/strings, null, or arrays/)
    expect(() => scanContentPayload({
      surface: 'comment', fields: { body: ['valid', 42 as never] },
    }, policy)).toThrow(/only strings/)
  })
  it('normalizes Arabic diacritics and tatweel without changing source text', () => {
    expect(normalizeSafetyText('أَهْلًا ـ')).toBe('اهلا')
  })
  it('does not match a rule as a substring inside an unrelated word', () => {
    const result = scanContent({ text: 'education', surface: 'comment' }, {
      ...policy,
      rules: [{ id: 'short', phrase: 'cat', category: 'profanity', severity: 2 }],
    })
    expect(result.decision).toBe('allow')
    expect(result.signals).toHaveLength(0)
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
    } )).toThrow(/not eligible/)
    expect(() => submitFeedbackCandidate({
      id: 'x', domain: 'linguistic', source: 'editor_correction',
      sourceSurface: 'lexicon', groupId: 'g', text: 'x', label: 'y',
      rationale: 'z', contributorRef: 'c', consentToDatasetUse: false, license: 'CC0',
    })).toThrow(/consent/)
  })
  it('rejects obvious personal identifiers before a candidate enters review', () => {
    expect(() => submitFeedbackCandidate({
      id: 'pii', domain: 'linguistic', source: 'editor_correction',
      sourceSurface: 'lexicon', groupId: 'g', text: 'contact me at user@example.com',
      label: 'x', rationale: 'y', contributorRef: 'c',
      consentToDatasetUse: true, license: 'CC0',
    })).toThrow(/personal data/)
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
  it('builds deterministic dataset splits from approved candidates only', async () => {
    const pending = makeCandidate()
    const approved = reviewFeedbackCandidate({
      candidate: pending, reviewerRef: 'editor-1', role: 'editor',
      decision: 'approve', reason: 'Verified',
    })
    const a = await buildApprovedDataset([pending, approved], 'dataset-1')
    const b = await buildApprovedDataset([approved], 'dataset-1')
    expect(a.fingerprint).toBe(b.fingerprint)
    expect(a.fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(a.train.length + a.validation.length + a.test.length).toBe(1)
  })
  it('does not permit a reviewer to approve the same candidate twice', () => {
    const first = reviewFeedbackCandidate({
      candidate: makeCandidate('content_safety'), reviewerRef: 'editor-1',
      role: 'editor', decision: 'approve', reason: 'Confirmed',
    })
    expect(() => reviewFeedbackCandidate({
      candidate: first, reviewerRef: 'editor-1', role: 'editor',
      decision: 'approve', reason: 'Second review',
    })).toThrow(/twice/)
  })
  it('includes provenance in the dataset fingerprint', async () => {
    const first = reviewFeedbackCandidate({
      candidate: makeCandidate(), reviewerRef: 'editor-1', role: 'editor',
      decision: 'approve', reason: 'Verified',
    })
    const secondCandidate = { ...makeCandidate(), source: 'moderation_decision' as const }
    const second = reviewFeedbackCandidate({
      candidate: secondCandidate, reviewerRef: 'editor-1', role: 'editor',
      decision: 'approve', reason: 'Verified',
    })
    const a = await buildApprovedDataset([first], 'dataset-a')
    const b = await buildApprovedDataset([second], 'dataset-a')
    expect(a.fingerprint).not.toBe(b.fingerprint)
  })
  it('rejects overlong feedback before it enters the review queue', () => {
    expect(() => submitFeedbackCandidate({
      id: 'long', domain: 'linguistic', source: 'editor_correction',
      sourceSurface: 'lexicon', groupId: 'g', text: 'x'.repeat(5001),
      label: 'x', rationale: 'y', contributorRef: 'c',
      consentToDatasetUse: true, license: 'CC0',
    })).toThrow(RangeError)
  })
  it('does not export a forged approved status without independent review records', async () => {
    const forged = { ...makeCandidate('content_safety'), status: 'approved' as const }
    const dataset = await buildApprovedDataset([forged], 'dataset-forged')
    expect(dataset.train.length + dataset.validation.length + dataset.test.length).toBe(0)
  })
  it('does not export forged reviewer records with empty rationale or invalid timestamps', async () => {
    const forged = {
      ...makeCandidate('content_safety'),
      status: 'approved' as const,
      reviews: [
        { reviewerRef: 'editor-1', role: 'editor' as const, decision: 'approve' as const, reason: '', reviewedAt: 'invalid' },
        { reviewerRef: 'admin-1', role: 'admin' as const, decision: 'approve' as const, reason: 'Verified', reviewedAt: '2026-01-01T00:00:00.000Z' },
      ],
    }
    const dataset = await buildApprovedDataset([forged], 'dataset-invalid-review')
    expect(dataset.train.length + dataset.validation.length + dataset.test.length).toBe(0)
  })
  it('calculates class metrics and enforces release gates', () => {
    const report = calculateEvaluationReport('dataset-1', ['safe', 'unsafe'], ['safe', 'safe'])
    expect(report.classes.find((item) => item.label === 'unsafe')?.falseNegative).toBe(1)
    expect(report.classes.find((item) => item.label === 'unsafe')?.falseNegativeRate).toBe(1)
    const gate = evaluateReleaseGate(report, {
      minSamples: 2, minPrecision: 0.9, minRecall: 0.9,
      minMacroF1: 0.9, minClassF1: 0.9, maxFalsePositiveRate: 0.05, maxFalseNegativeRate: 0.05,
    })
    expect(gate.approved).toBe(false)
    expect(gate.failures).toContain('class_f1_below_threshold')
  })
})
