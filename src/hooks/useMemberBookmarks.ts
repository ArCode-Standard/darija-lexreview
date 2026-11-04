import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { MemberBookmarkRecord } from '../types/lexicon'

const BOOKMARKS_CACHE_PREFIX = 'arcode_lexreview_member_bookmarks_v1:'
export const GUEST_BOOKMARKS_STORAGE_KEY = 'arcode_lexreview_guest_bookmarks_v1'

function sanitizeBookmarkList(parsed: unknown): string[] {
  if (!Array.isArray(parsed)) return []
  return Array.from(
    new Set(
      parsed
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    ),
  )
}

export function readGuestBookmarks(): string[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(GUEST_BOOKMARKS_STORAGE_KEY)
    if (!raw) return []
    return sanitizeBookmarkList(JSON.parse(raw))
  } catch {
    return []
  }
}

export function writeGuestBookmarks(ids: string[]) {
  if (typeof localStorage === 'undefined') return
  try {
    if (ids.length === 0) {
      localStorage.removeItem(GUEST_BOOKMARKS_STORAGE_KEY)
    } else {
      localStorage.setItem(GUEST_BOOKMARKS_STORAGE_KEY, JSON.stringify(ids))
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function mergeGuestAndMemberBookmarks(
  guestIds: string[],
  memberIds: string[],
): string[] {
  return Array.from(
    new Set(
      [...guestIds, ...memberIds]
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    ),
  )
}

function readCachedBookmarks(userKey: string): string[] {
  if (!userKey || typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(`${BOOKMARKS_CACHE_PREFIX}${userKey}`)
    if (!raw) return []
    return sanitizeBookmarkList(JSON.parse(raw))
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
    () => (userEmail ? userId || userEmail.toLowerCase() : ''),
    [userId, userEmail],
  )

  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() =>
    userKey ? readCachedBookmarks(userKey) : readGuestBookmarks(),
  )
  const [loadingBookmarks, setLoadingBookmarks] = useState(false)

  // Load guest bookmarks when logged out, or migrate guest bookmarks into member cache on login
  useEffect(() => {
    if (!userEmail || !userKey) {
      setBookmarkedIds(readGuestBookmarks())
      return
    }
    const guestIds = readGuestBookmarks()
    const cachedMemberIds = readCachedBookmarks(userKey)
    if (guestIds.length > 0) {
      const merged = mergeGuestAndMemberBookmarks(guestIds, cachedMemberIds)
      setBookmarkedIds(merged)
      writeCachedBookmarks(userKey, merged)
      // If Supabase userId is already resolved, push guest bookmarks to cloud and clear guest storage
      if (supabase && userId) {
        writeGuestBookmarks([])
        void supabase.from('member_bookmarks').upsert(
          guestIds.map((entry_id) => ({
            user_id: userId,
            entry_id,
          })),
          { onConflict: 'user_id,entry_id' },
        )
      } else if (!supabase) {
        writeGuestBookmarks([])
      }
    } else {
      setBookmarkedIds(cachedMemberIds)
    }
  }, [userEmail, userKey, userId])

  // Sync from Supabase member_bookmarks table for authenticated member
  const refreshBookmarks = useCallback(async () => {
    if (!supabase || !userEmail || !userId) return
    setLoadingBookmarks(true)

    const pendingGuestIds = readGuestBookmarks()
    if (pendingGuestIds.length > 0) {
      await supabase.from('member_bookmarks').upsert(
        pendingGuestIds.map((entry_id) => ({
          user_id: userId,
          entry_id,
        })),
        { onConflict: 'user_id,entry_id' },
      )
      writeGuestBookmarks([])
    }

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
      const mergedIds = mergeGuestAndMemberBookmarks(pendingGuestIds, serverIds)
      setBookmarkedIds(mergedIds)
      writeCachedBookmarks(userKey, mergedIds)
    }
  }, [userEmail, userId, userKey])

  useEffect(() => {
    void refreshBookmarks()
  }, [refreshBookmarks])

  const bookmarkedSet = useMemo(() => new Set(bookmarkedIds), [bookmarkedIds])

  const isBookmarked = useCallback(
    (entryId: string) => Boolean(entryId && bookmarkedSet.has(entryId)),
    [bookmarkedSet],
  )

  const toggleBookmark = useCallback(
    async (entryId: string): Promise<{ saved: boolean; mode: 'member' | 'guest' }> => {
      const cleanId = entryId.trim()
      if (!cleanId) {
        return { saved: false, mode: userEmail ? 'member' : 'guest' }
      }

      const currentlySaved = bookmarkedSet.has(cleanId)
      const nextIds = currentlySaved
        ? bookmarkedIds.filter((id) => id !== cleanId)
        : [cleanId, ...bookmarkedIds.filter((id) => id !== cleanId)]

      setBookmarkedIds(nextIds)

      if (!userEmail || !userKey) {
        writeGuestBookmarks(nextIds)
        return { saved: !currentlySaved, mode: 'guest' }
      }

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

      return { saved: !currentlySaved, mode: 'member' }
    },
    [userEmail, userKey, userId, bookmarkedSet, bookmarkedIds],
  )

  const removeBookmark = useCallback(
    async (entryId: string) => {
      const cleanId = entryId.trim()
      if (!cleanId) return

      const nextIds = bookmarkedIds.filter((id) => id !== cleanId)
      setBookmarkedIds(nextIds)

      if (!userEmail || !userKey) {
        writeGuestBookmarks(nextIds)
        return
      }

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
    bookmarkedIds,
    isGuestBookmarkMode: !userEmail,
    loadingBookmarks,
    isBookmarked,
    toggleBookmark,
    removeBookmark,
    refreshBookmarks,
  }
}
