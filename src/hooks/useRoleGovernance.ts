import { useCallback, useEffect, useState } from 'react'
import type {
  PromotionRequestStatus,
  ReviewerProfile,
  RolePromotionRequest,
  UserRole,
} from '../types/lexicon'

const PROFILES_SANDBOX_KEY = 'arcode_darija_lexreview_sandbox_profiles_v1'
const PROMO_SANDBOX_KEY = 'arcode_darija_lexreview_sandbox_promotions_v1'


export function useRoleGovernance() {
  const [sandboxProfiles, setSandboxProfiles] = useState<ReviewerProfile[]>([])
  const [sandboxPromotionRequests, setSandboxPromotionRequests] = useState<RolePromotionRequest[]>([])

  // Remove previously shipped fictional demo members and requests from existing browsers.
  useEffect(() => {
    try {
      localStorage.removeItem(PROFILES_SANDBOX_KEY)
      localStorage.removeItem(PROMO_SANDBOX_KEY)
    } catch {
      // Ignore unavailable browser storage.
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(PROFILES_SANDBOX_KEY, JSON.stringify(sandboxProfiles))
    } catch {
      // Ignore quota errors
    }
  }, [sandboxProfiles])

  useEffect(() => {
    try {
      localStorage.setItem(PROMO_SANDBOX_KEY, JSON.stringify(sandboxPromotionRequests))
    } catch {
      // Ignore quota errors
    }
  }, [sandboxPromotionRequests])

  const submitSandboxPromotionRequest = useCallback(
    (params: {
      requesterId: string
      requesterName: string
      dialectRegion: string | null
      experienceSummary: string
      sampleLinks: string | null
    }) => {
      const now = new Date().toISOString()
      const newReq: RolePromotionRequest = {
        id: `promo-sandbox-${Date.now()}`,
        requester_id: params.requesterId,
        requester_name: params.requesterName.trim(),
        dialect_region: params.dialectRegion,
        experience_summary: params.experienceSummary.trim(),
        sample_links: params.sampleLinks?.trim() || null,
        requested_role: 'editor',
        status: 'pending',
        reviewed_by: null,
        reviewed_by_name: null,
        admin_note: null,
        created_at: now,
        updated_at: now,
        is_sandbox: true,
      }

      setSandboxProfiles((prev) => {
        if (prev.some((p) => p.id === params.requesterId)) return prev
        return [
          ...prev,
          {
            id: params.requesterId,
            display_name: params.requesterName.trim(),
            dialect_region: params.dialectRegion,
            role: 'reviewer',
            created_at: now,
          },
        ]
      })

      setSandboxPromotionRequests((prev) => [
        newReq,
        ...prev.filter((r) => !(r.requester_id === params.requesterId && r.status === 'pending')),
      ])
      return newReq
    },
    [],
  )

  const reviewSandboxPromotionRequest = useCallback(
    (params: {
      requestId: string
      decision: Exclude<PromotionRequestStatus, 'pending'>
      adminNote: string | null
      adminId?: string
      adminName?: string
    }) => {
      const now = new Date().toISOString()
      let targetRequesterId: string | null = null

      setSandboxPromotionRequests((prev) =>
        prev.map((req) => {
          if (req.id !== params.requestId) return req
          targetRequesterId = req.requester_id
          return {
            ...req,
            status: params.decision,
            reviewed_by: params.adminId ?? '',
            reviewed_by_name: params.adminName ?? '',
            admin_note: params.adminNote?.trim() || null,
            updated_at: now,
          }
        }),
      )

      if (params.decision === 'approved') {
        setSandboxProfiles((prev) =>
          prev.map((prof) => {
            const matchedReq = sandboxPromotionRequests.find((r) => r.id === params.requestId)
            const reqUserId = targetRequesterId ?? matchedReq?.requester_id
            if (prof.id === reqUserId && prof.role === 'reviewer') {
              return { ...prof, role: 'editor' }
            }
            return prof
          }),
        )
      }
    },
    [sandboxPromotionRequests],
  )

  const updateSandboxMemberRole = useCallback((userId: string, nextRole: UserRole) => {
    setSandboxProfiles((prev) =>
      prev.map((prof) => (prof.id === userId ? { ...prof, role: nextRole } : prof)),
    )
  }, [])

  const resetSandboxGovernance = useCallback(() => {
    setSandboxProfiles([])
    setSandboxPromotionRequests([])
  }, [])

  return {
    sandboxProfiles,
    sandboxPromotionRequests,
    submitSandboxPromotionRequest,
    reviewSandboxPromotionRequest,
    updateSandboxMemberRole,
    resetSandboxGovernance,
  }
}
