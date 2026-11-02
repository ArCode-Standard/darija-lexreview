import type { LoadedCorpus } from './dataset'

const DB_NAME = 'arcode_lexreview_corpus_cache_v1'
const STORE_NAME = 'snapshots'
const SNAPSHOT_KEY = 'official_latest'

export interface CachedCorpusSnapshot {
  corpus: LoadedCorpus
  cachedAt: string
}

let memorySnapshotFallback: CachedCorpusSnapshot | null = null

function openCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'))
  })
}

export async function saveCorpusSnapshot(corpus: LoadedCorpus): Promise<string> {
  const cachedAt = new Date().toISOString()
  const payload: CachedCorpusSnapshot = { corpus, cachedAt }
  memorySnapshotFallback = payload

  try {
    const db = await openCacheDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put(payload, SNAPSHOT_KEY)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        db.close()
        reject(tx.error ?? new Error('IndexedDB write failed'))
      }
    })
  } catch {
    // Graceful fallback to in-memory cache if IndexedDB is blocked in private/iframe mode
  }

  return cachedAt
}

export async function loadCorpusSnapshot(): Promise<CachedCorpusSnapshot | null> {
  try {
    const db = await openCacheDb()
    const record = await new Promise<CachedCorpusSnapshot | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const getReq = store.get(SNAPSHOT_KEY)
      getReq.onsuccess = () => {
        db.close()
        const val = getReq.result as CachedCorpusSnapshot | undefined
        if (val && val.corpus && Array.isArray(val.corpus.entries) && val.corpus.entries.length > 0) {
          resolve(val)
        } else {
          resolve(null)
        }
      }
      getReq.onerror = () => {
        db.close()
        reject(getReq.error ?? new Error('IndexedDB read failed'))
      }
    })
    if (record) return record
  } catch {
    // Fall back to in-memory snapshot if available
  }

  return memorySnapshotFallback
}

export async function clearCorpusSnapshot(): Promise<void> {
  memorySnapshotFallback = null
  try {
    const db = await openCacheDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.delete(SNAPSHOT_KEY)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        db.close()
        reject(tx.error ?? new Error('IndexedDB delete failed'))
      }
    })
  } catch {
    // Ignore when IndexedDB is unavailable
  }
}
