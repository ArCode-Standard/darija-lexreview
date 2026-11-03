import { CONTENT_SAFETY_ENGINE_VERSION, scanContent } from './index'
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
const MAX_PAYLOAD_FIELDS = 64
const MAX_ARRAY_ITEMS_PER_FIELD = 200
const DECISION_RANK: Record<ContentDecision, number> = {
  allow: 0, allow_with_context: 1, review: 2, block: 3, urgent_escalation: 4,
}
/** Scans all caller-selected text fields; the caller must explicitly map every writable field. */
export function scanContentPayload(input: ScanContentPayloadInput, policy: SafetyPolicy): ContentPayloadScanResult {
  if (!input || !input.fields || typeof input.fields !== 'object' || Array.isArray(input.fields)) {
    throw new TypeError('fields must be an explicit object of writable text fields')
  }
  const entries = Object.entries(input.fields)
  if (entries.length > MAX_PAYLOAD_FIELDS) throw new RangeError('A content payload may contain at most 64 text fields')
  const fields: ContentFieldScan[] = []
  for (const [field, value] of entries) {
    if (!field.trim() || field.length > 100) throw new TypeError('Content field names must be non-empty and at most 100 characters')
    if (value !== null && value !== undefined && typeof value !== 'string' && !Array.isArray(value)) {
      throw new TypeError('Mapped content fields must be strings, null, or arrays of strings')
    }
    if (Array.isArray(value) && value.length > MAX_ARRAY_ITEMS_PER_FIELD) {
      throw new RangeError('A content field may contain at most 200 text items')
    }
    if (typeof value === 'string') {
      const result = scanContent({ text: value, surface: input.surface, context: input.contexts?.[field], now: input.now }, policy)
      fields.push({ field, decision: result.decision, score: result.score, riskLevel: result.riskLevel, requiresHumanReview: result.requiresHumanReview, signals: result.signals })
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item === null || item === undefined) return
        if (typeof item !== 'string') throw new TypeError('Content arrays may contain only strings or null values')
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
    engineVersion: CONTENT_SAFETY_ENGINE_VERSION, policyVersion: policy.version, fields,
  }
}
