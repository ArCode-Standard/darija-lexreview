import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  DocumentationSprint,
  EntryAttestationSummary,
  LexicalEntry,
  SprintTargetType,
} from '../types/lexicon'

const LOCAL_SPRINTS_STORAGE_KEY = 'darija_lexreview_documentation_sprints_v1'
const LOCAL_PARTICIPATIONS_STORAGE_KEY = 'darija_lexreview_sprint_participations_v1'

export interface ComputedSprintProgress {
  sprint: DocumentationSprint
  matchingEntriesCount: number
  currentCount: number
  goalCount: number
  progressPercent: number
  remainingDays: number | null
  myContributionsCount: number
}

export interface CreateSprintInput {
  title: string
  description: string
  target_type: SprintTargetType
  target_value: string | null
  goal_count: number
  badge_label: string
  duration_days: number
}

const DEFAULT_SPRINTS: DocumentationSprint[] = [
  {
    id: 'default-sprint-regional-examples',
    slug: 'sprint-moroccan-proverbs-and-examples',
    title: 'حملة توثيق ١٠٠ شاهد سياقي للأمثال والمفردات غير المشفوعة بأمثلة',
    description:
      'هدف جماعي لإغناء المفردات والأمثال الشعبية المغربية بشواهد سياقية حية وتصديقات جهوية موثقة من مختلف مناطق المغرب.',
    target_type: 'missing_examples',
    target_value: null,
    goal_count: 100,
    baseline_count: 38,
    badge_label: 'وسام حملة إغناء الشواهد السياقية',
    starts_at: '2026-10-25T00:00:00.000Z',
    ends_at: '2026-12-15T23:59:59.000Z',
    status: 'active',
    created_at: '2026-10-25T00:00:00.000Z',
  },
  {
    id: 'default-sprint-draa-tafilalet',
    slug: 'sprint-draa-tafilalet-attestations',
    title: 'أسبوع توثيق التداول اللهجي لجهة درعة تافيلالت والجنوب الشرقي',
    description:
      'حملة موجهة لرفع التمثيل الجغرافي لمفردات الواحات والجنوب الشرقي عبر التصديق الميداني وإضافة أمثلة سياقية محلية.',
    target_type: 'region',
    target_value: 'درعة تافيلالت',
    goal_count: 60,
    baseline_count: 24,
    badge_label: 'وسام توثيق درعة تافيلالت',
    starts_at: '2026-10-28T00:00:00.000Z',
    ends_at: '2026-12-01T23:59:59.000Z',
    status: 'completed',
    created_at: '2026-10-28T00:00:00.000Z',
  },
]

function loadLocalSprints(): DocumentationSprint[] {
  if (typeof window === 'undefined') return DEFAULT_SPRINTS
  try {
    const raw = window.localStorage.getItem(LOCAL_SPRINTS_STORAGE_KEY)
    if (!raw) return DEFAULT_SPRINTS
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as DocumentationSprint[]
    }
  } catch {
    // Ignore storage error
  }
  return DEFAULT_SPRINTS
}

function saveLocalSprints(sprints: DocumentationSprint[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOCAL_SPRINTS_STORAGE_KEY, JSON.stringify(sprints))
  } catch {
    // Ignore storage error
  }
}

function loadLocalParticipations(userKey: string): Record<string, number> {
  if (typeof window === 'undefined' || !userKey) return {}
  try {
    const raw = window.localStorage.getItem(`${LOCAL_PARTICIPATIONS_STORAGE_KEY}:${userKey}`)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {}
  } catch {
    return {}
  }
}

function saveLocalParticipations(userKey: string, map: Record<string, number>) {
  if (typeof window === 'undefined' || !userKey) return
  try {
    window.localStorage.setItem(
      `${LOCAL_PARTICIPATIONS_STORAGE_KEY}:${userKey}`,
      JSON.stringify(map),
    )
  } catch {
    // Ignore storage error
  }
}

export function doesEntryMatchSprint(entry: LexicalEntry, sprint: DocumentationSprint): boolean {
  switch (sprint.target_type) {
    case 'missing_examples':
      return entry.examples.length === 0
    case 'region': {
      if (!sprint.target_value) return true
      const regions = entry.region ?? []
      return regions.includes(sprint.target_value) || regions.length === 0
    }
    case 'category':
      return sprint.target_value ? entry.category === sprint.target_value : true
    case 'entry_type':
      return sprint.target_value ? (entry.entryType ?? 'word') === sprint.target_value : true
    case 'etymology':
      return sprint.target_value ? entry.etymology === sprint.target_value : true
    default:
      return true
  }
}

export function useDocumentationSprints(params: {
  entries: LexicalEntry[]
  summariesByEntryId: Record<string, EntryAttestationSummary>
  userId?: string | null
  userEmail?: string | null
}) {
  const { entries, summariesByEntryId, userId, userEmail } = params
  const userKey = userId || userEmail || ''

  const [sprints, setSprints] = useState<DocumentationSprint[]>(() => loadLocalSprints())
  const [myParticipationsBySprintId, setMyParticipationsBySprintId] = useState<
    Record<string, number>
  >(() => loadLocalParticipations(userKey))
  const [totalParticipationsBySprintId, setTotalParticipationsBySprintId] = useState<
    Record<string, number>
  >({})

  useEffect(() => {
    setMyParticipationsBySprintId(loadLocalParticipations(userKey))
  }, [userKey])

  const refreshSprints = useCallback(async () => {
    const client = supabase
    if (!client) return

    const { data: sprintRows, error: sprintErr } = await client
      .from('documentation_sprints')
      .select('*')
      .order('created_at', { ascending: false })

    if (!sprintErr && Array.isArray(sprintRows) && sprintRows.length > 0) {
      const typed = sprintRows as DocumentationSprint[]
      setSprints(typed)
      saveLocalSprints(typed)
    }

    const { data: partRows, error: partErr } = await client
      .from('sprint_participations')
      .select('sprint_id, user_id, contributions_count')

    if (!partErr && Array.isArray(partRows)) {
      const totals: Record<string, number> = {}
      const mine: Record<string, number> = { ...loadLocalParticipations(userKey) }

      for (const row of partRows as Array<{
        sprint_id: string
        user_id: string
        contributions_count: number
      }>) {
        totals[row.sprint_id] = (totals[row.sprint_id] ?? 0) + (row.contributions_count || 0)
        if (userId && row.user_id === userId) {
          mine[row.sprint_id] = Math.max(mine[row.sprint_id] ?? 0, row.contributions_count || 0)
        }
      }
      setTotalParticipationsBySprintId(totals)
      if (userKey) {
        setMyParticipationsBySprintId(mine)
        saveLocalParticipations(userKey, mine)
      }
    }
  }, [userId, userKey])

  useEffect(() => {
    void refreshSprints()
  }, [refreshSprints])

  const computedSprints = useMemo<ComputedSprintProgress[]>(() => {
    const nowMs = Date.now()

    return sprints.map((sprint) => {
      const matchingEntries = entries.filter((e) => doesEntryMatchSprint(e, sprint))
      let attestedMatchingCount = 0
      for (const entry of matchingEntries) {
        const sum = summariesByEntryId[entry.id]
        if (sum) {
          attestedMatchingCount += sum.accurateCount + sum.regionalCount
        }
      }

      const liveParticipationSum = totalParticipationsBySprintId[sprint.id] ?? 0
      const myCount = myParticipationsBySprintId[sprint.id] ?? 0
      const rawCurrent =
        sprint.status === 'completed'
          ? sprint.goal_count
          : sprint.baseline_count +
            Math.max(liveParticipationSum, myCount) +
            attestedMatchingCount

      const currentCount = Math.min(sprint.goal_count, Math.max(0, rawCurrent))
      const progressPercent =
        sprint.goal_count > 0
          ? Math.min(100, Math.round((currentCount / sprint.goal_count) * 100))
          : 0

      let remainingDays: number | null = null
      if (sprint.ends_at) {
        const diff = new Date(sprint.ends_at).getTime() - nowMs
        remainingDays = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
      }

      return {
        sprint,
        matchingEntriesCount: matchingEntries.length,
        currentCount,
        goalCount: sprint.goal_count,
        progressPercent,
        remainingDays,
        myContributionsCount: myCount,
      }
    })
  }, [
    sprints,
    entries,
    summariesByEntryId,
    totalParticipationsBySprintId,
    myParticipationsBySprintId,
  ])

  const activeSprintProgress = useMemo(
    () => computedSprints.find((item) => item.sprint.status === 'active') ?? null,
    [computedSprints],
  )

  const totalMySprintContributions = useMemo(
    () => Object.values(myParticipationsBySprintId).reduce((acc, v) => acc + v, 0),
    [myParticipationsBySprintId],
  )

  const recordSprintParticipation = useCallback(
    async (entry?: LexicalEntry | null) => {
      if (!userKey) return
      const active = sprints.find((s) => s.status === 'active')
      if (!active) return
      if (entry && !doesEntryMatchSprint(entry, active)) return

      const nextCount = (myParticipationsBySprintId[active.id] ?? 0) + 1
      const nextMap = { ...myParticipationsBySprintId, [active.id]: nextCount }
      setMyParticipationsBySprintId(nextMap)
      saveLocalParticipations(userKey, nextMap)

      const client = supabase
      if (client && userId && !active.id.startsWith('default-')) {
        await client.from('sprint_participations').upsert(
          {
            sprint_id: active.id,
            user_id: userId,
            contributions_count: nextCount,
            last_contributed_at: new Date().toISOString(),
          },
          { onConflict: 'sprint_id,user_id' },
        )
      }
    },
    [userKey, userId, sprints, myParticipationsBySprintId],
  )

  const createSprint = useCallback(
    async (input: CreateSprintInput): Promise<{ ok: boolean; error?: string }> => {
      const cleanTitle = input.title.trim()
      const cleanDesc = input.description.trim()
      const cleanBadge = input.badge_label.trim()
      if (cleanTitle.length < 4 || cleanDesc.length < 8 || cleanBadge.length < 4) {
        return { ok: false, error: 'يرجى استيفاء عنوان الحملة ووصفها واسم الوسام المخصص.' }
      }

      const slug = `sprint-${Date.now().toString(36)}`
      const nowIso = new Date().toISOString()
      const endsAtIso =
        input.duration_days > 0
          ? new Date(Date.now() + input.duration_days * 24 * 60 * 60 * 1000).toISOString()
          : null

      const newSprint: DocumentationSprint = {
        id: `local-${slug}`,
        slug,
        title: cleanTitle,
        description: cleanDesc,
        target_type: input.target_type,
        target_value: input.target_value?.trim() || null,
        goal_count: Math.max(5, Math.min(10000, Math.round(input.goal_count))),
        baseline_count: 0,
        badge_label: cleanBadge,
        starts_at: nowIso,
        ends_at: endsAtIso,
        status: 'active',
        created_by: userId ?? null,
        created_at: nowIso,
      }

      const client = supabase
      if (client && userId) {
        const { data, error } = await client
          .from('documentation_sprints')
          .insert({
            slug: newSprint.slug,
            title: newSprint.title,
            description: newSprint.description,
            target_type: newSprint.target_type,
            target_value: newSprint.target_value,
            goal_count: newSprint.goal_count,
            baseline_count: 0,
            badge_label: newSprint.badge_label,
            starts_at: newSprint.starts_at,
            ends_at: newSprint.ends_at,
            status: 'active',
            created_by: userId,
          })
          .select('*')
          .maybeSingle()

        if (!error && data) {
          const inserted = data as DocumentationSprint
          const updated = [
            inserted,
            ...sprints.map((s) =>
              s.status === 'active' ? { ...s, status: 'archived' as const } : s,
            ),
          ]
          setSprints(updated)
          saveLocalSprints(updated)
          return { ok: true }
        }
      }

      const updatedLocal = [
        newSprint,
        ...sprints.map((s) =>
          s.status === 'active' ? { ...s, status: 'archived' as const } : s,
        ),
      ]
      setSprints(updatedLocal)
      saveLocalSprints(updatedLocal)
      return { ok: true }
    },
    [sprints, userId],
  )

  const updateSprintStatus = useCallback(
    async (sprintId: string, nextStatus: 'active' | 'completed' | 'archived') => {
      const updated = sprints.map((s) => {
        if (s.id === sprintId) return { ...s, status: nextStatus }
        if (nextStatus === 'active' && s.status === 'active') {
          return { ...s, status: 'archived' as const }
        }
        return s
      })
      setSprints(updated)
      saveLocalSprints(updated)

      const client = supabase
      if (client && !sprintId.startsWith('default-') && !sprintId.startsWith('local-')) {
        await client
          .from('documentation_sprints')
          .update({ status: nextStatus, updated_at: new Date().toISOString() })
          .eq('id', sprintId)
      }
    },
    [sprints],
  )

  return {
    sprints: computedSprints,
    activeSprintProgress,
    totalMySprintContributions,
    recordSprintParticipation,
    createSprint,
    updateSprintStatus,
    refreshSprints,
  }
}
