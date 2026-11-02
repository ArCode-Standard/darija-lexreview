import { useCallback, useEffect, useState } from 'react'
import type {
  EvidenceItem,
  ProposedFields,
  ReviewDecisionEvent,
  SubmissionRecord,
  SubmissionStatus,
} from '../types/lexicon'

const SANDBOX_STORAGE_KEY = 'arcode_darija_lexreview_sandbox_queue_v3'
const SANDBOX_EVENTS_STORAGE_KEY = 'arcode_darija_lexreview_sandbox_events_v1'



export function useSandboxModeration() {
  const [sandboxItems, setSandboxItems] = useState<SubmissionRecord[]>([])
  const [sandboxEvents, setSandboxEvents] = useState<ReviewDecisionEvent[]>([])

  // Purge seeded demo submissions and audit events left in existing browsers.
  useEffect(() => {
    try {
      localStorage.removeItem(SANDBOX_STORAGE_KEY)
      localStorage.removeItem(SANDBOX_EVENTS_STORAGE_KEY)
    } catch {
      // Ignore unavailable browser storage.
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(sandboxItems))
    } catch {
      // Ignore storage quota errors
    }
  }, [sandboxItems])

  useEffect(() => {
    try {
      localStorage.setItem(SANDBOX_EVENTS_STORAGE_KEY, JSON.stringify(sandboxEvents))
    } catch {
      // Ignore storage quota errors
    }
  }, [sandboxEvents])

  const addSandboxSubmission = useCallback(
    (params: {
      entryId: string
      proposedData: ProposedFields
      evidence: EvidenceItem[]
      reviewerNote: string | null
      supersedesId?: string | null
    }) => {
      const now = new Date().toISOString()
      const item: SubmissionRecord = {
        id: `sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        entry_id: params.entryId,
        supersedes_id: params.supersedesId ?? null,
        proposed_data: params.proposedData,
        evidence: params.evidence,
        reviewer_note: params.reviewerNote,
        status: 'pending',
        editor_note: null,
        created_at: now,
        updated_at: now,
        is_sandbox: true,
      }
      setSandboxItems((prev) => {
        const updatedPrev = params.supersedesId
          ? prev.map((existing) => {
              if (
                existing.id === params.supersedesId &&
                (existing.status === 'pending' ||
                  existing.status === 'needs_changes' ||
                  existing.status === 'rejected')
              ) {
                setSandboxEvents((evPrev) => [
                  ...evPrev,
                  {
                    id: `ev-sup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    submission_id: existing.id,
                    actor_id: 'contributor-session',
                    actor_display_name: 'المراجع الحالي (جلسة محاكاة)',
                    event_type: 'superseded',
                    previous_status: existing.status,
                    new_status: 'superseded',
                    editor_note: `حُلّ محل هذا المقترح بالنسخة المنقحة (${item.id.slice(0, 12)})`,
                    occurred_at: now,
                  },
                ])
                return {
                  ...existing,
                  status: 'superseded' as const,
                  updated_at: now,
                }
              }
              return existing
            })
          : prev
        return [item, ...updatedPrev]
      })
      setSandboxEvents((prev) => [
        ...prev,
        {
          id: `ev-sub-${item.id}`,
          submission_id: item.id,
          actor_id: 'contributor-session',
          actor_display_name: 'المراجع الحالي (جلسة محاكاة)',
          event_type: 'submitted',
          previous_status: null,
          new_status: 'pending',
          editor_note: params.supersedesId
            ? `نسخة منقحة تحل محل المقترح (${params.supersedesId.slice(0, 12)})`
            : null,
          occurred_at: now,
        },
      ])
      return item
    },
    [],
  )

  const withdrawSandboxSubmission = useCallback((id: string) => {
    const now = new Date().toISOString()
    setSandboxItems((prev) => {
      const target = prev.find((item) => item.id === id)
      if (!target || target.status !== 'pending') return prev
      setSandboxEvents((evPrev) => [
        ...evPrev,
        {
          id: `ev-wdr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          submission_id: id,
          actor_id: 'contributor-session',
          actor_display_name: 'المراجع الحالي (جلسة محاكاة)',
          event_type: 'withdrawn',
          previous_status: 'pending',
          new_status: 'withdrawn',
          editor_note: 'سحب المساهم مقترحه قبل صدور قرار تحكيمي.',
          occurred_at: now,
        },
      ])
      return prev.map((item) =>
        item.id === id && item.status === 'pending'
          ? {
              ...item,
              status: 'withdrawn',
              updated_at: now,
            }
          : item,
      )
    })
  }, [])

  const moderateSandboxSubmission = useCallback(
    (params: {
      id: string
      status: SubmissionStatus
      editorNote: string | null
      proposedData: ProposedFields
      editorId?: string
      editorDisplayName?: string
    }) => {
      const now = new Date().toISOString()
      setSandboxItems((prev) => {
        const current = prev.find((i) => i.id === params.id)
        if (current) {
          setSandboxEvents((evPrev) => [
            ...evPrev,
            {
              id: `ev-dec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              submission_id: params.id,
              actor_id: params.editorId ?? current.editor_id ?? 'ed-session',
              actor_display_name:
                params.editorDisplayName ??
                current.editor_display_name ??
                'المحرر الحالي (جلسة محاكاة)',
              event_type: 'decision',
              previous_status: current.status,
              new_status: params.status,
              editor_note: params.editorNote,
              occurred_at: now,
            },
          ])
        }
        return prev.map((item) =>
          item.id === params.id
            ? {
                ...item,
                status: params.status,
                editor_id: params.editorId ?? item.editor_id ?? 'ed-session',
                editor_display_name:
                  params.editorDisplayName ?? item.editor_display_name ?? 'المحرر الحالي (جلسة محاكاة)',
                editor_note: params.editorNote,
                proposed_data: params.proposedData,
                updated_at: now,
              }
            : item,
        )
      })
    },
    [],
  )

  const bulkApproveSandboxSubmissions = useCallback(
    (params: {
      ids: string[]
      editorNote: string
      editorId?: string
      editorDisplayName?: string
    }) => {
      const idSet = new Set(params.ids)
      const now = new Date().toISOString()
      setSandboxItems((prev) => {
        const newDecisionEvents: ReviewDecisionEvent[] = prev
          .filter((item) => idSet.has(item.id))
          .map((item, idx) => ({
            id: `ev-bulk-${Date.now()}-${idx}`,
            submission_id: item.id,
            actor_id: params.editorId ?? item.editor_id ?? 'ed-session',
            actor_display_name:
              params.editorDisplayName ??
              item.editor_display_name ??
              'المحرر الحالي (جلسة محاكاة)',
            event_type: 'decision',
            previous_status: item.status,
            new_status: 'accepted',
            editor_note: params.editorNote,
            occurred_at: now,
          }))
        if (newDecisionEvents.length > 0) {
          setSandboxEvents((evPrev) => [...evPrev, ...newDecisionEvents])
        }
        return prev.map((item) =>
          idSet.has(item.id)
            ? {
                ...item,
                status: 'accepted',
                editor_id: params.editorId ?? item.editor_id ?? 'ed-session',
                editor_display_name:
                  params.editorDisplayName ??
                  item.editor_display_name ??
                  'المحرر الحالي (جلسة محاكاة)',
                editor_note: params.editorNote,
                updated_at: now,
              }
            : item,
        )
      })
    },
    [],
  )

  const markSandboxSubmissionsMerged = useCallback(
    (params: {
      ids: string[]
      releaseVersion: string
      editorId?: string
      editorDisplayName?: string
    }) => {
      const idSet = new Set(params.ids)
      const now = new Date().toISOString()
      const cleanVersion = params.releaseVersion.trim() || '1.5.1'

      setSandboxItems((prev) => {
        const newDecisionEvents: ReviewDecisionEvent[] = prev
          .filter((item) => idSet.has(item.id) && item.status === 'accepted')
          .map((item, idx) => ({
            id: `ev-merge-${Date.now()}-${idx}`,
            submission_id: item.id,
            actor_id: params.editorId ?? item.editor_id ?? 'ed-session',
            actor_display_name:
              params.editorDisplayName ??
              item.editor_display_name ??
              'المحرر الحالي',
            event_type: 'decision',
            previous_status: 'accepted',
            new_status: 'merged',
            editor_note: `تم الدمج والأرشفة ضمن حزمة الإصدار v${cleanVersion.replace(/^v/i, '')}`,
            occurred_at: now,
          }))
        if (newDecisionEvents.length > 0) {
          setSandboxEvents((evPrev) => [...evPrev, ...newDecisionEvents])
        }
        return prev.map((item) =>
          idSet.has(item.id) && item.status === 'accepted'
            ? {
                ...item,
                status: 'merged',
                exported_in_version: cleanVersion.replace(/^v/i, ''),
                exported_at: now,
                updated_at: now,
              }
            : item,
        )
      })
    },
    [],
  )

  const resetSandboxQueue = useCallback(() => {
    setSandboxItems([])
    setSandboxEvents([])
  }, [])

  return {
    sandboxItems,
    sandboxEvents,
    addSandboxSubmission,
    withdrawSandboxSubmission,
    moderateSandboxSubmission,
    bulkApproveSandboxSubmissions,
    markSandboxSubmissionsMerged,
    resetSandboxQueue,
  }
}
