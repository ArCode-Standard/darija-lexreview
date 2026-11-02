import { supabase } from '../lib/supabase'
import type { EvidenceItem, LexicalEntry, LocalDraft, ProposedFields } from '../types/lexicon'
import {
  containsArabicScript,
  findSimilarCorpusEntries,
  isValidArabizi,
  validateEvidenceItems,
} from './validation'
import { buildCorpusArabiziLookup, suggestMoroccanArabizi } from './arabiziTransliterator'
import { computeEntryFingerprint } from './corpusPinning'
import { humanizeSystemError } from './humanizeError'

export interface DraftSyncAuditResult {
  draft: LocalDraft
  ready: boolean
  reason?: string
  normalizedEntryId: string
  cleanedProposedData: ProposedFields
  cleanedEvidence: EvidenceItem[]
}

export function isNewEntryLocalDraft(draft: LocalDraft): boolean {
  return (
    draft.entryId === 'NEW' ||
    draft.entryId.startsWith('NEW:') ||
    draft.proposedData?.submission_kind === 'new_entry'
  )
}

export function auditDraftForSync(
  draft: LocalDraft,
  entries: LexicalEntry[],
): DraftSyncAuditResult {
  const p = draft.proposedData ?? {}
  const isNew = isNewEntryLocalDraft(draft)
  const { cleaned: cleanedEvidence, invalidUrls } = validateEvidenceItems(draft.evidence ?? [])
  const noteTrimmed = (draft.reviewerNote ?? '').trim()
  const lookup = buildCorpusArabiziLookup(entries)

  if (invalidUrls.length > 0) {
    return {
      draft,
      ready: false,
      reason: `يحتوي على رابط مصدر غير صالح (${invalidUrls[0]}).`,
      normalizedEntryId: isNew ? 'NEW' : draft.entryId,
      cleanedProposedData: p,
      cleanedEvidence,
    }
  }

  if (isNew) {
    const wordAr = (p.word_ar ?? '').trim()
    const rawArabizi = (p.arabizi ?? '').trim()
    const arabizi = rawArabizi || suggestMoroccanArabizi(wordAr, lookup)
    const category = (p.category ?? draft.category ?? 'التواصل').trim() || 'التواصل'
    const msa = (p.msa_translation ?? p.meaning ?? '').trim()
    const french = (p.french_translation ?? '').trim()
    const exDarija = (p.example_darija ?? '').trim()
    const rawExArabizi = (p.example_arabizi ?? '').trim()
    const exArabizi = rawExArabizi || suggestMoroccanArabizi(exDarija, lookup)

    if (!wordAr || !containsArabicScript(wordAr)) {
      return {
        draft,
        ready: false,
        reason: 'الكلمة بالدارجة ناقصة في هذه المسودة.',
        normalizedEntryId: 'NEW',
        cleanedProposedData: p,
        cleanedEvidence,
      }
    }
    if (!msa || !containsArabicScript(msa)) {
      return {
        draft,
        ready: false,
        reason: 'معنى الكلمة بالعربية غير مكتمل.',
        normalizedEntryId: 'NEW',
        cleanedProposedData: p,
        cleanedEvidence,
      }
    }
    if (!exDarija || !containsArabicScript(exDarija)) {
      return {
        draft,
        ready: false,
        reason: 'جملة المثال بالدارجة غير مكتملة.',
        normalizedEntryId: 'NEW',
        cleanedProposedData: p,
        cleanedEvidence,
      }
    }
    if (rawArabizi && !isValidArabizi(rawArabizi)) {
      return {
        draft,
        ready: false,
        reason: 'الكتابة اللاتينية تحتوي على رموز غير مدعومة.',
        normalizedEntryId: 'NEW',
        cleanedProposedData: p,
        cleanedEvidence,
      }
    }
    if (rawExArabizi && !isValidArabizi(rawExArabizi)) {
      return {
        draft,
        ready: false,
        reason: 'الكتابة اللاتينية للمثال تحتوي على رموز غير مدعومة.',
        normalizedEntryId: 'NEW',
        cleanedProposedData: p,
        cleanedEvidence,
      }
    }
    if (!p.rights_confirmed) {
      return {
        draft,
        ready: false,
        reason: 'يلزم تفعيل الإقرار بالرخصة المفتوحة قبل الإرسال.',
        normalizedEntryId: 'NEW',
        cleanedProposedData: p,
        cleanedEvidence,
      }
    }

    const collisions = findSimilarCorpusEntries(entries, wordAr, arabizi)
    if (collisions.length > 0 && !noteTrimmed) {
      return {
        draft,
        ready: false,
        reason: 'تتطابق مع مفردة موجودة في المعجم؛ وضح فرق المعنى أولاً.',
        normalizedEntryId: 'NEW',
        cleanedProposedData: p,
        cleanedEvidence,
      }
    }

    return {
      draft,
      ready: true,
      normalizedEntryId: 'NEW',
      cleanedProposedData: {
        ...p,
        submission_kind: 'new_entry',
        word_ar: wordAr,
        arabizi: isValidArabizi(arabizi) ? arabizi : undefined,
        category,
        msa_translation: msa,
        meaning: msa,
        ...(french ? { french_translation: french } : {}),
        example_darija: exDarija,
        example_arabizi: isValidArabizi(exArabizi) ? exArabizi : undefined,
      },
      cleanedEvidence,
    }
  }

  // Edit existing entry draft
  const PROVENANCE_KEYS = new Set([
    'rights_confirmed',
    'rights_holder',
    'license',
    'redistribution_permission',
    'training_permission',
    'commercial_permission',
    'corpus_version',
    'baseline_fingerprint',
  ])
  const cleanOut: ProposedFields = { submission_kind: 'edit_entry' }
  let filledFieldsCount = 0
  for (const [k, v] of Object.entries(p)) {
    if (k === 'submission_kind') continue
    if (PROVENANCE_KEYS.has(k)) {
      ;(cleanOut as Record<string, unknown>)[k] = v
      continue
    }
    if (typeof v === 'string' && v.trim()) {
      ;(cleanOut as Record<string, unknown>)[k] = v.trim()
      filledFieldsCount += 1
    }
  }

  if (cleanOut.example_darija && !cleanOut.example_arabizi) {
    const autoExLat = suggestMoroccanArabizi(cleanOut.example_darija, lookup)
    if (autoExLat && isValidArabizi(autoExLat)) {
      cleanOut.example_arabizi = autoExLat
    }
  }

  if (filledFieldsCount === 0 && !noteTrimmed) {
    return {
      draft,
      ready: false,
      reason: 'لا تحتوي المسودة على تعديل مقترح أو ملاحظة.',
      normalizedEntryId: draft.entryId,
      cleanedProposedData: cleanOut,
      cleanedEvidence,
    }
  }

  return {
    draft,
    ready: true,
    normalizedEntryId: draft.entryId,
    cleanedProposedData: cleanOut,
    cleanedEvidence,
  }
}

export async function syncLocalDraftsToAccount(
  draftsList: LocalDraft[],
  entries: LexicalEntry[],
  corpusVersion = '1.5.0',
): Promise<{
  syncedEntryIds: string[]
  skippedAudits: DraftSyncAuditResult[]
  error?: string
}> {
  const audits = draftsList.map((d) => auditDraftForSync(d, entries))
  const readyAudits = audits.filter((a) => a.ready)
  const skippedAudits = audits.filter((a) => !a.ready)

  if (readyAudits.length === 0) {
    return {
      syncedEntryIds: [],
      skippedAudits,
      error:
        skippedAudits.length > 0
          ? 'المسودات المحفوظة حالياً تحتاج استكمال الحقول الأساسية قبل إرسالها.'
          : undefined,
    }
  }

  if (!supabase) {
    return {
      syncedEntryIds: [],
      skippedAudits,
      error: 'خدمة المزامنة السحابية غير متاحة حالياً؛ ستبقى مسوداتك محفوظة بأمان على جهازك.',
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      syncedEntryIds: [],
      skippedAudits,
      error: 'يرجى تسجيل الدخول أولاً لمزامنة المسودات مع حسابك.',
    }
  }

  const entryById = new Map(entries.map((e) => [e.id, e]))

  const rowsWithPinning = readyAudits.map((item) => {
    const baseEntry = entryById.get(item.normalizedEntryId)
    const fp =
      item.cleanedProposedData.baseline_fingerprint ||
      (baseEntry ? computeEntryFingerprint(baseEntry) : null)
    const ver = item.cleanedProposedData.corpus_version || corpusVersion
    const enrichedProposed: ProposedFields = {
      ...item.cleanedProposedData,
      corpus_version: ver,
      ...(fp ? { baseline_fingerprint: fp } : {}),
    }
    return {
      entry_id: item.normalizedEntryId,
      corpus_version: ver,
      baseline_fingerprint: fp,
      proposed_data: enrichedProposed,
      evidence: item.cleanedEvidence,
      reviewer_note:
        item.draft.reviewerNote.trim() || 'مساهمة معجمية مزامنة من مسودات المراجع',
      status: 'pending' as const,
    }
  })

  let insertRes = await supabase.from('review_submissions').insert(rowsWithPinning)

  if (insertRes.error) {
    const fallbackRows = rowsWithPinning.map((r) => ({
      entry_id: r.entry_id,
      proposed_data: r.proposed_data,
      evidence: r.evidence,
      reviewer_note: r.reviewer_note,
      status: r.status,
    }))
    insertRes = await supabase.from('review_submissions').insert(fallbackRows)
  }

  if (insertRes.error) {
    return {
      syncedEntryIds: [],
      skippedAudits,
      error: humanizeSystemError(
        insertRes.error,
        'تعذر إرسال المسودات حالياً. يرجى المحاولة لاحقاً.',
      ),
    }
  }

  return {
    syncedEntryIds: readyAudits.map((item) => item.draft.entryId),
    skippedAudits,
  }
}
