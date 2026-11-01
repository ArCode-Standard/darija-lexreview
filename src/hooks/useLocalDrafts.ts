import { useCallback, useEffect, useState } from 'react'
import type { LocalDraft } from '../types/lexicon'

const STORAGE_KEY = 'arcode_darija_lexreview_drafts_v1'

export function useLocalDrafts() {
  const [drafts, setDrafts] = useState<Record<string, LocalDraft>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return {}
      const parsed = JSON.parse(raw) as Record<string, LocalDraft>
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts))
    } catch {
      // Ignore storage quota errors gracefully
    }
  }, [drafts])

  const saveDraft = useCallback((draft: LocalDraft) => {
    setDrafts((prev) => ({
      ...prev,
      [draft.entryId]: draft,
    }))
  }, [])

  const removeDraft = useCallback((entryId: string) => {
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[entryId]
      return next
    })
  }, [])

  const clearAllDrafts = useCallback(() => {
    setDrafts({})
  }, [])

  const draftsList = Object.values(drafts).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )

  return {
    drafts,
    draftsList,
    saveDraft,
    removeDraft,
    clearAllDrafts,
  }
}
