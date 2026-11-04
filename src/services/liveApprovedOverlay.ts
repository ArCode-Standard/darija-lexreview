import { supabase } from '../lib/supabase'
import type {
  ContextualExample,
  LexicalEntry,
  RegisterType,
  SubmissionRecord,
} from '../types/lexicon'
import { isNewEntrySubmission } from './exporter'
import { normalizeArabicHeadword } from '../utils/validation'

export interface LiveCorpusMergeResult {
  entries: LexicalEntry[]
  categories: string[]
  totalExamplesCount: number
  liveOverlayCount: number
  liveNewEntriesCount: number
  liveUpdatedEntriesCount: number
}

function normalizeRegister(value?: string): RegisterType {
  if (
    value === 'neutral' ||
    value === 'formal' ||
    value === 'informal' ||
    value === 'vulgar' ||
    value === 'literary' ||
    value === 'religious'
  ) {
    return value
  }
  return 'neutral'
}

/**
 * Merges editor-approved submissions (`status === 'accepted'`) that have not yet been
 * exported into the static GitHub JSON release onto the base corpus in memory.
 * This ensures newly approved Darija entries, meanings, etymologies, and contextual examples
 * become visible immediately to readers and researchers without waiting for a manual release cut.
 */
export function mergeApprovedSubmissionsIntoCorpus(
  baseEntries: LexicalEntry[],
  approvedSubmissions: SubmissionRecord[],
): LiveCorpusMergeResult {
  const unexportedAccepted = approvedSubmissions.filter(
    (sub) => sub.status === 'accepted' && !sub.exported_in_version,
  )

  if (unexportedAccepted.length === 0) {
    const categories = Array.from(new Set(baseEntries.map((e) => e.category).filter(Boolean)))
    const totalExamplesCount = baseEntries.reduce((sum, e) => sum + e.examples.length, 0)
    return {
      entries: baseEntries,
      categories,
      totalExamplesCount,
      liveOverlayCount: 0,
      liveNewEntriesCount: 0,
      liveUpdatedEntriesCount: 0,
    }
  }

  // Clone map keyed by entry ID for deterministic ascending chronological application
  const entriesById = new Map<string, LexicalEntry>()
  const existingHeadwords = new Set<string>()
  let maxNumericId = 0

  for (const entry of baseEntries) {
    entriesById.set(entry.id, {
      ...entry,
      examples: [...entry.examples],
      region: entry.region ? [...entry.region] : undefined,
    })
    existingHeadwords.add(normalizeArabicHeadword(entry.word))
    if (typeof entry.numericId === 'number' && entry.numericId > maxNumericId) {
      maxNumericId = entry.numericId
    }
  }

  const ordered = [...unexportedAccepted].sort((a, b) =>
    (a.updated_at || a.created_at).localeCompare(b.updated_at || b.created_at),
  )

  const updatedIds = new Set<string>()
  const newEntries: LexicalEntry[] = []

  for (const sub of ordered) {
    const p = sub.proposed_data ?? {}

    if (isNewEntrySubmission(sub)) {
      const wordAr = (p.word_ar ?? '').trim()
      if (!wordAr) continue
      const normalizedHead = normalizeArabicHeadword(wordAr)
      if (!normalizedHead || existingHeadwords.has(normalizedHead)) continue

      maxNumericId += 1
      const syntheticId = `live-${sub.id.slice(0, 8)}`
      const exampleDarija = (p.example_darija ?? '').trim()
      const examples: ContextualExample[] = exampleDarija
        ? [
            {
              id: `ctx-live-${sub.id.slice(0, 8)}`,
              entryId: syntheticId,
              darijaAr: exampleDarija,
              darijaLatin: (p.example_arabizi ?? '').trim(),
              meaningAr: (p.example_translation ?? p.meaning ?? '').trim(),
              meaningFr: (p.example_french ?? '').trim(),
              register: normalizeRegister(p.register),
              region: p.regions && p.regions.length > 0 ? [...p.regions] : undefined,
              reviewStatus: 'reviewed',
            },
          ]
        : []

      const createdEntry: LexicalEntry = {
        id: syntheticId,
        numericId: maxNumericId,
        word: wordAr,
        latin: (p.arabizi ?? '').trim(),
        meaning: (p.meaning ?? p.msa_translation ?? '').trim() || 'مفردة معتمدة حديثاً',
        french: (p.french_translation ?? '').trim(),
        category: (p.category ?? '').trim() || 'عام',
        entryType: p.entry_type ?? 'word',
        register: p.register ?? 'neutral',
        etymology: p.etymology,
        etymologyNote: p.etymology_note?.trim() || undefined,
        region: p.regions && p.regions.length > 0 ? [...p.regions] : undefined,
        status: 'reviewed',
        reviewNotes: sub.editor_note?.trim() || 'معتمد تحريرياً وبانتظار الدمج في الحزمة الدورية القادمة.',
        provenance: {
          sourceType: p.source_type ?? 'contributor',
          sourceName: p.source_name?.trim() || 'مساهمة مجتمعية معتمدة',
          rightsHolder: p.rights_holder?.trim() || 'Darija LexReview Community',
          license: p.license?.trim() || 'CC BY-NC 4.0',
          redistributionPermission: p.redistribution_permission ?? 'allowed',
          trainingPermission: p.training_permission ?? 'allowed',
          commercialPermission: p.commercial_permission ?? 'not_allowed',
          notes: 'مدخل معتمد في قاعدة التحكيم المباشرة.',
        },
        examples,
      }

      existingHeadwords.add(normalizedHead)
      newEntries.push(createdEntry)
      continue
    }

    const existing = entriesById.get(sub.entry_id)
    if (!existing) continue

    const updated: LexicalEntry = {
      ...existing,
      word: p.word_ar?.trim() || existing.word,
      latin: p.arabizi?.trim() || existing.latin,
      meaning: p.meaning?.trim() || p.msa_translation?.trim() || existing.meaning,
      french: p.french_translation?.trim() || existing.french,
      category: p.category?.trim() || existing.category,
      entryType: p.entry_type ?? existing.entryType,
      register: p.register ?? existing.register,
      etymology: p.etymology ?? existing.etymology,
      etymologyNote: p.etymology_note?.trim() || existing.etymologyNote,
      region:
        p.regions && p.regions.length > 0
          ? Array.from(new Set([...(existing.region ?? []), ...p.regions]))
          : existing.region,
      status: 'reviewed',
      examples: [...existing.examples],
    }

    const candidateEx = (p.example_darija ?? '').trim()
    if (candidateEx) {
      const normalizedEx = normalizeArabicHeadword(candidateEx)
      const alreadyHasExample = updated.examples.some(
        (ex) => normalizeArabicHeadword(ex.darijaAr) === normalizedEx,
      )
      if (!alreadyHasExample) {
        updated.examples.push({
          id: `ctx-live-${sub.id.slice(0, 8)}`,
          entryId: updated.id,
          darijaAr: candidateEx,
          darijaLatin: (p.example_arabizi ?? '').trim(),
          meaningAr: (p.example_translation ?? '').trim(),
          meaningFr: (p.example_french ?? '').trim(),
          register: normalizeRegister(p.register ?? updated.register),
          region: p.regions && p.regions.length > 0 ? [...p.regions] : updated.region,
          reviewStatus: 'reviewed',
        })
      }
    }

    entriesById.set(existing.id, updated)
    updatedIds.add(existing.id)
  }

  const mergedEntries = [...newEntries, ...Array.from(entriesById.values())]
  const categories = Array.from(new Set(mergedEntries.map((e) => e.category).filter(Boolean)))
  const totalExamplesCount = mergedEntries.reduce((sum, e) => sum + e.examples.length, 0)

  return {
    entries: mergedEntries,
    categories,
    totalExamplesCount,
    liveOverlayCount: newEntries.length + updatedIds.size,
    liveNewEntriesCount: newEntries.length,
    liveUpdatedEntriesCount: updatedIds.size,
  }
}

export async function fetchLiveApprovedSubmissions(): Promise<SubmissionRecord[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('review_submissions')
      .select(
        'id, entry_id, proposed_data, evidence, reviewer_note, status, editor_note, created_at, updated_at, exported_in_version',
      )
      .eq('status', 'accepted')
      .order('updated_at', { ascending: true })
      .limit(400)

    if (error || !Array.isArray(data)) return []
    return data as SubmissionRecord[]
  } catch {
    return []
  }
}
