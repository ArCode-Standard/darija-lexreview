import { supabase } from './supabase'

export type ContentWriteOperation =
  | 'review_submissions.create'
  | 'review_submissions.decision'
  | 'community_attestations.upsert'
  | 'reviewer_profiles.update'
  | 'reviewer_profiles.admin_update'
  | 'member_messages.create'
  | 'member_moderation_reports.create'
  | 'member_moderation_reports.resolve'
  | 'role_promotion_requests.create'
  | 'role_promotion_requests.decision'

const RPC_BY_OPERATION: Record<ContentWriteOperation, string> = {
  'review_submissions.create': 'submit_review_submission',
  'review_submissions.decision': 'decide_review_submission',
  'community_attestations.upsert': 'submit_community_attestation',
  'reviewer_profiles.update': 'update_reviewer_profile_content',
  'reviewer_profiles.admin_update': 'update_reviewer_profile_governance',
  'member_messages.create': 'send_member_message',
  'member_moderation_reports.create': 'submit_moderation_report',
  'member_moderation_reports.resolve': 'resolve_moderation_report',
  'role_promotion_requests.create': 'submit_role_promotion_request',
  'role_promotion_requests.decision': 'decide_role_promotion_request',
}

export interface ContentScanSummary {
  decision: 'allow' | 'allow_with_context' | 'review' | 'block' | 'urgent_escalation'
  requiresHumanReview: boolean
  engineVersion: string
  policyVersion: string
  expiresInSeconds?: number
}

export interface ContentWriteResult<T = unknown> {
  data: T | null
  error: unknown | null
  scan?: ContentScanSummary
}

/**
 * Every content-bearing mutation must pass through the server gateway first.
 * There is intentionally no direct-REST fallback: falling back would recreate
 * the exact bypass this boundary is designed to close.
 */
export async function writeScannedContent<T = unknown>(
  operation: ContentWriteOperation,
  payload: Record<string, unknown>,
): Promise<ContentWriteResult<T>> {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data: scan, error: scanError } = await supabase.functions.invoke(
    'content-safety-gateway',
    { body: { operation, payload } },
  )

  if (scanError) return { data: null, error: scanError }
  if (
    !scan ||
    (scan.decision !== 'allow' && scan.decision !== 'allow_with_context') ||
    typeof scan.writeToken !== 'string' ||
    !scan.writeToken ||
    !scan.writePayload ||
    typeof scan.writePayload !== 'object' ||
    Array.isArray(scan.writePayload)
  ) {
    const decision = typeof scan?.decision === 'string' ? scan.decision : 'unavailable'
    return {
      data: null,
      error: new Error(`Content gateway did not authorize this write (decision: ${decision}).`),
      scan: scan && typeof scan === 'object' ? {
        decision,
        requiresHumanReview: Boolean(scan.requiresHumanReview),
        engineVersion: String(scan.engineVersion ?? 'unknown'),
        policyVersion: String(scan.policyVersion ?? 'unknown'),
      } as ContentScanSummary : undefined,
    }
  }

  const { data, error } = await supabase.rpc(RPC_BY_OPERATION[operation], {
    p_payload: scan.writePayload,
    p_scan_token: scan.writeToken,
  })

  return {
    data: (data ?? null) as T | null,
    error,
    scan: {
      decision: scan.decision,
      requiresHumanReview: Boolean(scan.requiresHumanReview),
      engineVersion: String(scan.engineVersion),
      policyVersion: String(scan.policyVersion),
      expiresInSeconds: Number(scan.expiresInSeconds ?? 90),
    },
  }
}
