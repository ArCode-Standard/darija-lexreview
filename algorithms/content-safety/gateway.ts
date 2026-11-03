import { scanContent } from './index'
import type { ContentDecision, ContentSurface, SafetyPolicy, TrustedContentContext } from './types'

export type ContentFieldValue = string | null | undefined | Array<string | null | undefined>
export interface ScanContentPayloadInput {
  surface: ContentSurface
  fields: Record<string, ContentFieldValue>
  /** Per-field context must be derived by trusted server code. */
  contexts?: Record<string, TrustedContentContext>
  now?: Date
}
export interface ContentFieldScan {
  field: string
  index?: number
  decision: ContentDecision
  score: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  requiresHumanReview: boolean
  signals: ReturnType<typeof scanContent>['signals']
}
export interface ContentPayloadScanResult {
  decision: ContentDecision
  requiresHumanReview: boolean
  engineVersion: string
  policyVersion: string
  fields: ContentFieldScan[]
}
const DECISION_RANK: Record<ContentDecision, number> = {
  allow: 0, allow_with_context: 1, review: 2, block: 3, urgent_escalation: 4,
}
/** Scans all caller-selected text fields; the caller must explicitly map every writable field. */
export function scanContentPayload(input: ScanContentPayloadInput, policy: SafetyPolicy): ContentPayloadScanResult {
  const fields: ContentFieldScan[] = []
  for (const [field, value] of Object.entries(input.fields)) {
    if (typeof value === 'string') {
      const result = scanContent({ text: value, surface: input.surface, context: input.contexts?.[field], now: input.now }, policy)
      fields.push({ field, decision: result.decision, score: result.score, riskLevel: result.riskLevel, requiresHumanReview: result.requiresHumanReview, signals: result.signals })
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item !== 'string') return
        const result = scanContent({ text: item, surface: input.surface, context: input.contexts?.[field], now: input.now }, policy)
        fields.push({ field, index, decision: result.decision, score: result.score, riskLevel: result.riskLevel, requiresHumanReview: result.requiresHumanReview, signals: result.signals })
      })
    }
  }
  const decision = fields.reduce<ContentDecision>(
    (highest, current) => DECISION_RANK[current.decision] > DECISION_RANK[highest] ? current.decision : highest,
    'allow',
  )
  return {
    decision, requiresHumanReview: fields.some((field) => field.requiresHumanReview),
    engineVersion: '0.1.1', policyVersion: policy.version, fields,
  }
}
