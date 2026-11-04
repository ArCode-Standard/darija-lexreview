import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { MemberBookmarkRecord } from '../types/lexicon'

const BOOKMARKS_CACHE_PREFIX = 'arcode_lexreview_member_bookmarks_v1:'

function readCachedBookmarks(userKey: string): string[] {
  if (!userKey || typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(`${BOOKMARKS_CACHE_PREFIX}${userKey}`)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : []
  } catch {
    return []
  }
}

function writeCachedBookmarks(userKey: string, ids: string[]) {
  if (!userKey || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(`${BOOKMARKS_CACHE_PREFIX}${userKey}`, JSON.stringify(ids))
  } catch {
    // Ignore storage quota errors
  }
}

export interface UseMemberBookmarksParams {
  userId: string | null | undefined
  userEmail: string | null
}

export function useMemberBookmarks({ userId, userEmail }: UseMemberBookmarksParams) {
  const userKey = useMemo(
    () => (userEmail ? (userId || userEmail.toLowerCase()) : ''),
    [userId, userEmail],
  )

  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() =>
    userKey ? readCachedBookmarks(userKey) : [],
  )
  const [loadingBookmarks, setLoadingBookmarks] = useState(false)

  // Reset or load user-scoped cache whenever authenticated user changes
  useEffect(() => {
    if (!userEmail || !userKey) {
      setBookmarkedIds([])
      return
    }
    setBookmarkedIds(readCachedBookmarks(userKey))
  }, [userEmail, userKey])

  // Sync from Supabase member_bookmarks table for authenticated member
  const refreshBookmarks = useCallback(async () => {
    if (!supabase || !userEmail || !userId) return
    setLoadingBookmarks(true)
    const { data, error } = await supabase
      .from('member_bookmarks')
      .select('id, user_id, entry_id, note, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(500)
    setLoadingBookmarks(false)

    if (!error && Array.isArray(data)) {
      const serverIds = Array.from(
        new Set(
          (data as MemberBookmarkRecord[])
            .map((row) => row.entry_id?.trim())
            .filter((id): id is string => Boolean(id)),
        ),
      )
      setBookmarkedIds(serverIds)
      writeCachedBookmarks(userKey, serverIds)
    }
  }, [userEmail, userId, userKey])

  useEffect(() => {
    void refreshBookmarks()
  }, [refreshBookmarks])

  const bookmarkedSet = useMemo(() => new Set(bookmarkedIds), [bookmarkedIds])

  const isBookmarked = useCallback(
    (entryId: string) => Boolean(userEmail && bookmarkedSet.has(entryId)),
    [userEmail, bookmarkedSet],
  )

  const toggleBookmark = useCallback(
    async (entryId: string): Promise<{ saved: boolean }> => {
      const cleanId = entryId.trim()
      if (!userEmail || !userKey || !cleanId) {
        return { saved: false }
      }

      const currentlySaved = bookmarkedSet.has(cleanId)
      const nextIds = currentlySaved
        ? bookmarkedIds.filter((id) => id !== cleanId)
        : [cleanId, ...bookmarkedIds.filter((id) => id !== cleanId)]

      setBookmarkedIds(nextIds)
      writeCachedBookmarks(userKey, nextIds)

      if (supabase && userId) {
        if (currentlySaved) {
          await supabase
            .from('member_bookmarks')
            .delete()
            .eq('user_id', userId)
            .eq('entry_id', cleanId)
        } else {
          await supabase.from('member_bookmarks').upsert(
            {
              user_id: userId,
              entry_id: cleanId,
            },
            { onConflict: 'user_id,entry_id' },
          )
        }
      }

      return { saved: !currentlySaved }
    },
    [userEmail, userKey, userId, bookmarkedSet, bookmarkedIds],
  )

  const removeBookmark = useCallback(
    async (entryId: string) => {
      const cleanId = entryId.trim()
      if (!userEmail || !userKey || !cleanId) return

      const nextIds = bookmarkedIds.filter((id) => id !== cleanId)
      setBookmarkedIds(nextIds)
      writeCachedBookmarks(userKey, nextIds)

      if (supabase && userId) {
        await supabase
          .from('member_bookmarks')
          .delete()
          .eq('user_id', userId)
          .eq('entry_id', cleanId)
      }
    },
    [userEmail, userKey, userId, bookmarkedIds],
  )

  return {
    bookmarkedIds: userEmail ? bookmarkedIds : [],
    loadingBookmarks,
    isBookmarked,
    toggleBookmark,
    removeBookmark,
    refreshBookmarks,
  }
}
