import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  AttestationVerdict,
  CommunityAttestationRecord,
  DataPermission,
  EntryAttestationSummary,
} from '../types/lexicon'

const LOCAL_ATTESTATIONS_KEY = 'arcode_lexreview_attestations_v1'
const SESSION_PREFS_KEY = 'arcode_lexreview_rapid_prefs_v1'
const CALIBRATION_STATS_KEY = 'arcode_lexreview_calibration_v1'

export interface RapidSessionPrefs {
  dialectRegion: string
  rightsConfirmedOnce: boolean
  trainingPermission: DataPermission
  dailyGoal: number
}

export interface CalibrationStats {
  passed: number
  total: number
}

const DEFAULT_PREFS: RapidSessionPrefs = {
  dialectRegion: 'مشترك عام',
  rightsConfirmedOnce: true,
  trainingPermission: 'not_allowed',
  dailyGoal: 10,
}

/**
 * Initial baseline community signals so editors in editorial moderation
 * can see how crowd consensus and contested flags appear.
 */
const BASELINE_SUMMARIES: Record<string, EntryAttestationSummary> = {
  '1': {
    entryId: '1',
    accurateCount: 7,
    flaggedCount: 0,
    regionalCount: 2,
    weightedAccurateScore: 8.5,
    regions: ['مشترك عام', 'الدار البيضاء والوسط', 'فاس ومكناس'],
  },
  '2': {
    entryId: '2',
    accurateCount: 5,
    flaggedCount: 1,
    regionalCount: 1,
    weightedAccurateScore: 6.5,
    regions: ['مشترك عام', 'مراكش والحوز'],
  },
  '3': {
    entryId: '3',
    accurateCount: 2,
    flaggedCount: 3,
    regionalCount: 1,
    weightedAccurateScore: 2.0,
    regions: ['الرباط وسلا', 'الشمال وجبالة'],
  },
  '4': {
    entryId: '4',
    accurateCount: 6,
    flaggedCount: 0,
    regionalCount: 2,
    weightedAccurateScore: 7.5,
    regions: ['مشترك عام', 'الشرق والريف'],
  },
}

interface HistoryStep {
  entryId: string
  previousRecord: CommunityAttestationRecord | null
  wasSkipped: boolean
}

function readLocalAttestations(): Record<string, CommunityAttestationRecord> {
  try {
    const raw = localStorage.getItem(LOCAL_ATTESTATIONS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, CommunityAttestationRecord>
    }
    return {}
  } catch {
    return {}
  }
}

function readSessionPrefs(): RapidSessionPrefs {
  try {
    const raw = localStorage.getItem(SESSION_PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<RapidSessionPrefs>
    return {
      dialectRegion:
        typeof parsed.dialectRegion === 'string' && parsed.dialectRegion.trim()
          ? parsed.dialectRegion
          : DEFAULT_PREFS.dialectRegion,
      rightsConfirmedOnce:
        typeof parsed.rightsConfirmedOnce === 'boolean'
          ? parsed.rightsConfirmedOnce
          : DEFAULT_PREFS.rightsConfirmedOnce,
      trainingPermission: parsed.trainingPermission ?? DEFAULT_PREFS.trainingPermission,
      dailyGoal:
        typeof parsed.dailyGoal === 'number' && [5, 10, 20, 50].includes(parsed.dailyGoal)
          ? parsed.dailyGoal
          : DEFAULT_PREFS.dailyGoal,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

function readCalibrationStats(): CalibrationStats {
  try {
    const raw = localStorage.getItem(CALIBRATION_STATS_KEY)
    if (!raw) return { passed: 0, total: 0 }
    const parsed = JSON.parse(raw) as Partial<CalibrationStats>
    return {
      passed: typeof parsed.passed === 'number' && parsed.passed >= 0 ? parsed.passed : 0,
      total: typeof parsed.total === 'number' && parsed.total >= 0 ? parsed.total : 0,
    }
  } catch {
    return { passed: 0, total: 0 }
  }
}

export function useCommunityAttestations(userEmail: string | null, corpusVersion = '1.5.0') {
  const [localRecords, setLocalRecords] = useState<Record<string, CommunityAttestationRecord>>(
    () => readLocalAttestations(),
  )
  const [remoteSummaries, setRemoteSummaries] = useState<
    Record<string, EntryAttestationSummary>
  >({})
  const [remoteUserRecords, setRemoteUserRecords] = useState<
    Record<string, CommunityAttestationRecord>
  >({})
  const [skippedIds, setSkippedIds] = useState<Set<string>>(() => new Set())
  const [history, setHistory] = useState<HistoryStep[]>([])
  const [sessionPrefs, setSessionPrefs] = useState<RapidSessionPrefs>(() => readSessionPrefs())
  const [calibrationStats, setCalibrationStats] = useState<CalibrationStats>(() =>
    readCalibrationStats(),
  )

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_ATTESTATIONS_KEY, JSON.stringify(localRecords))
    } catch {
      // Ignore storage quota errors
    }
  }, [localRecords])

  useEffect(() => {
    try {
      localStorage.setItem(SESSION_PREFS_KEY, JSON.stringify(sessionPrefs))
    } catch {
      // Ignore storage quota errors
    }
  }, [sessionPrefs])

  useEffect(() => {
    try {
      localStorage.setItem(CALIBRATION_STATS_KEY, JSON.stringify(calibrationStats))
    } catch {
      // Ignore storage quota errors
    }
  }, [calibrationStats])

  const recordCalibrationOutcome = useCallback((passed: boolean) => {
    setCalibrationStats((prev) => ({
      passed: prev.passed + (passed ? 1 : 0),
      total: prev.total + 1,
    }))
  }, [])

  const refreshRemoteAttestations = useCallback(async () => {
    if (!supabase) return

    let rpcRes = await supabase.rpc('get_entry_attestation_summaries', {
      p_corpus_version: corpusVersion,
    })
    if (rpcRes.error) {
      // Graceful fallback if the database has the older zero-argument RPC signature
      rpcRes = await supabase.rpc('get_entry_attestation_summaries')
    }

    if (!rpcRes.error && Array.isArray(rpcRes.data)) {
      const nextMap: Record<string, EntryAttestationSummary> = {}
      for (const row of rpcRes.data as Array<{
        entry_id: string
        accurate_count: number
        flagged_count: number
        regional_count: number
        weighted_accurate_score?: number | null
        regions: string[] | null
      }>) {
        const acc = Number(row.accurate_count ?? 0)
        nextMap[String(row.entry_id)] = {
          entryId: String(row.entry_id),
          accurateCount: acc,
          flaggedCount: Number(row.flagged_count ?? 0),
          regionalCount: Number(row.regional_count ?? 0),
          weightedAccurateScore:
            row.weighted_accurate_score !== undefined && row.weighted_accurate_score !== null
              ? Number(row.weighted_accurate_score)
              : acc,
          regions: Array.isArray(row.regions) ? row.regions : [],
        }
      }
      setRemoteSummaries(nextMap)
    }

    if (userEmail) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const ownRes = await supabase
          .from('community_attestations')
          .select('entry_id, verdict, dialect_region, note, updated_at')
          .eq('reviewer_id', user.id)
        if (!ownRes.error && Array.isArray(ownRes.data)) {
          const ownMap: Record<string, CommunityAttestationRecord> = {}
          for (const r of ownRes.data as Array<{
            entry_id: string
            verdict: AttestationVerdict
            dialect_region: string | null
            note: string | null
            updated_at: string
          }>) {
            ownMap[String(r.entry_id)] = {
              entry_id: String(r.entry_id),
              verdict: r.verdict,
              dialect_region: r.dialect_region,
              note: r.note,
              updated_at: r.updated_at,
              is_local: false,
            }
          }
          setRemoteUserRecords(ownMap)
        }
      }
    } else {
      setRemoteUserRecords({})
    }
  }, [userEmail, corpusVersion])

  useEffect(() => {
    refreshRemoteAttestations()
  }, [refreshRemoteAttestations])

  const userVerdictsByEntryId = useMemo(() => {
    return {
      ...localRecords,
      ...remoteUserRecords,
    }
  }, [localRecords, remoteUserRecords])

  const totalAttestationsCount = useMemo(
    () => Object.keys(userVerdictsByEntryId).length,
    [userVerdictsByEntryId],
  )

  const summariesByEntryId = useMemo(() => {
    const merged: Record<string, EntryAttestationSummary> = {}

    const baseSource =
      Object.keys(remoteSummaries).length > 0 ? remoteSummaries : BASELINE_SUMMARIES

    for (const [id, item] of Object.entries(baseSource)) {
      merged[id] = {
        entryId: id,
        accurateCount: item.accurateCount,
        flaggedCount: item.flaggedCount,
        regionalCount: item.regionalCount,
        weightedAccurateScore: item.weightedAccurateScore ?? item.accurateCount,
        regions: [...item.regions],
      }
    }

    const trustMultiplier =
      calibrationStats.total >= 2
        ? calibrationStats.passed / calibrationStats.total >= 0.8
          ? 1.2
          : 0.5
        : 1.0

    // Layer local records that have not yet been reflected in remoteSummaries, ignoring < 800ms rushed clicks
    for (const [entryId, rec] of Object.entries(localRecords)) {
      if (remoteUserRecords[entryId]) continue
      if (typeof rec.response_ms === 'number' && rec.response_ms < 800) continue
      const current = merged[entryId] ?? {
        entryId,
        accurateCount: 0,
        flaggedCount: 0,
        regionalCount: 0,
        weightedAccurateScore: 0,
        regions: [],
      }
      if (rec.verdict === 'accurate') {
        current.accurateCount += 1
        current.weightedAccurateScore = Number(
          ((current.weightedAccurateScore ?? 0) + trustMultiplier).toFixed(1),
        )
      }
      if (rec.verdict === 'needs_correction') current.flaggedCount += 1
      if (rec.verdict === 'regional_variant') current.regionalCount += 1
      if (rec.dialect_region && !current.regions.includes(rec.dialect_region)) {
        current.regions.push(rec.dialect_region)
      }
      merged[entryId] = current
    }

    return merged
  }, [remoteSummaries, localRecords, remoteUserRecords, calibrationStats])

  const completedTodayCount = useMemo(() => {
    const todayPrefix = new Date().toISOString().slice(0, 10)
    return Object.values(userVerdictsByEntryId).filter((r) =>
      r.updated_at.startsWith(todayPrefix),
    ).length
  }, [userVerdictsByEntryId])

  const updateSessionPrefs = useCallback((patch: Partial<RapidSessionPrefs>) => {
    setSessionPrefs((prev) => ({ ...prev, ...patch }))
  }, [])

  const recordAttestation = useCallback(
    async (params: {
      entryId: string
      verdict: AttestationVerdict
      dialectRegion?: string | null
      note?: string | null
      responseMs?: number | null
      baselineFingerprint?: string | null
    }): Promise<{ storedLive: boolean }> => {
      const prevRec = userVerdictsByEntryId[params.entryId] ?? null
      setHistory((prev) => [
        ...prev.slice(-29),
        {
          entryId: params.entryId,
          previousRecord: prevRec,
          wasSkipped: skippedIds.has(params.entryId),
        },
      ])

      setSkippedIds((prev) => {
        if (!prev.has(params.entryId)) return prev
        const next = new Set(prev)
        next.delete(params.entryId)
        return next
      })

      const nowIso = new Date().toISOString()
      const regionVal = params.dialectRegion?.trim() || sessionPrefs.dialectRegion || null
      const noteVal = params.note?.trim() || null
      const clampedMs =
        typeof params.responseMs === 'number' && Number.isFinite(params.responseMs)
          ? Math.min(600000, Math.max(0, Math.round(params.responseMs)))
          : null

      // Try live upsert if authenticated + Supabase configured (with fallback if migration columns not applied yet)
      if (supabase && userEmail) {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          let upsertRes = await supabase.from('community_attestations').upsert(
            {
              entry_id: params.entryId,
              reviewer_id: user.id,
              verdict: params.verdict,
              dialect_region: regionVal,
              note: noteVal,
              corpus_version: corpusVersion,
              baseline_fingerprint: params.baselineFingerprint ?? null,
              response_ms: clampedMs,
            },
            { onConflict: 'entry_id,reviewer_id' },
          )

          if (upsertRes.error) {
            upsertRes = await supabase.from('community_attestations').upsert(
              {
                entry_id: params.entryId,
                reviewer_id: user.id,
                verdict: params.verdict,
                dialect_region: regionVal,
                note: noteVal,
              },
              { onConflict: 'entry_id,reviewer_id' },
            )
          }

          if (!upsertRes.error) {
            setRemoteUserRecords((prev) => ({
              ...prev,
              [params.entryId]: {
                entry_id: params.entryId,
                verdict: params.verdict,
                dialect_region: regionVal,
                note: noteVal,
                updated_at: nowIso,
                corpus_version: corpusVersion,
                response_ms: clampedMs,
                is_local: false,
              },
            }))
            refreshRemoteAttestations()
            return { storedLive: true }
          }
        }
      }

      // Fallback to local attestation record
      setLocalRecords((prev) => ({
        ...prev,
        [params.entryId]: {
          entry_id: params.entryId,
          verdict: params.verdict,
          dialect_region: regionVal,
          note: noteVal,
          updated_at: nowIso,
          corpus_version: corpusVersion,
          response_ms: clampedMs,
          is_local: true,
        },
      }))
      return { storedLive: false }
    },
    [
      userVerdictsByEntryId,
      skippedIds,
      sessionPrefs.dialectRegion,
      userEmail,
      corpusVersion,
      refreshRemoteAttestations,
    ],
  )

  const skipEntry = useCallback(
    (entryId: string) => {
      setHistory((prev) => [
        ...prev.slice(-29),
        {
          entryId,
          previousRecord: userVerdictsByEntryId[entryId] ?? null,
          wasSkipped: skippedIds.has(entryId),
        },
      ])
      setSkippedIds((prev) => {
        const next = new Set(prev)
        next.add(entryId)
        return next
      })
    },
    [userVerdictsByEntryId, skippedIds],
  )

  const undoLastStep = useCallback(async (): Promise<string | null> => {
    if (history.length === 0) return null
    const last = history[history.length - 1]
    setHistory((prev) => prev.slice(0, -1))

    setSkippedIds((prev) => {
      const next = new Set(prev)
      if (last.wasSkipped) next.add(last.entryId)
      else next.delete(last.entryId)
      return next
    })

    if (last.previousRecord) {
      setLocalRecords((prev) => ({
        ...prev,
        [last.entryId]: last.previousRecord!,
      }))
    } else {
      setLocalRecords((prev) => {
        const copy = { ...prev }
        delete copy[last.entryId]
        return copy
      })
      if (supabase && userEmail) {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          await supabase
            .from('community_attestations')
            .delete()
            .eq('entry_id', last.entryId)
            .eq('reviewer_id', user.id)
          setRemoteUserRecords((prev) => {
            const copy = { ...prev }
            delete copy[last.entryId]
            return copy
          })
          refreshRemoteAttestations()
        }
      }
    }

    return last.entryId
  }, [history, userEmail, refreshRemoteAttestations])

  const resetSessionSkips = useCallback(() => {
    setSkippedIds(new Set())
  }, [])

  return {
    userVerdictsByEntryId,
    summariesByEntryId,
    skippedIds,
    canUndo: history.length > 0,
    completedTodayCount,
    totalAttestationsCount,
    calibrationStats,
    recordCalibrationOutcome,
    sessionPrefs,
    updateSessionPrefs,
    recordAttestation,
    skipEntry,
    undoLastStep,
    resetSessionSkips,
    refreshRemoteAttestations,
  }
}
