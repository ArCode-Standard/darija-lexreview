import { supabase } from '../lib/supabase'
import type { EvidenceItem, LexicalEntry, LocalDraft, ProposedFields } from '../types/lexicon'
import {
  containsArabicScript,
  findSimilarCorpusEntries,
  isValidArabizi,
  validateEvidenceItems,
} from './validation'
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

  if (invalidUrls.length > 0) {
    return {
      draft,
      ready: false,
      reason: `يحتوي على رابط شاهد غير صالح (${invalidUrls[0]}).`,
      normalizedEntryId: isNew ? 'NEW' : draft.entryId,
      cleanedProposedData: p,
      cleanedEvidence,
    }
  }

  if (isNew) {
    const wordAr = (p.word_ar ?? '').trim()
    const arabizi = (p.arabizi ?? '').trim()
    const category = (p.category ?? draft.category ?? '').trim()
    const msa = (p.msa_translation ?? p.meaning ?? '').trim()
    const french = (p.french_translation ?? '').trim()
    const exDarija = (p.example_darija ?? '').trim()
    const exArabizi = (p.example_arabizi ?? '').trim()

    if (!wordAr || !containsArabicScript(wordAr)) {
      return {
        draft,
        ready: false,
        reason: 'المفردة بالعربية ناقصة في هذه المسودة.',
        normalizedEntryId: 'NEW',
        cleanedProposedData: p,
        cleanedEvidence,
      }
    }
    if (!isValidArabizi(arabizi)) {
      return {
        draft,
        ready: false,
        reason: 'الكتابة بـ Arabizi ناقصة أو غير مطابقة للضوابط.',
        normalizedEntryId: 'NEW',
        cleanedProposedData: p,
        cleanedEvidence,
      }
    }
    if (!category) {
      return {
        draft,
        ready: false,
        reason: 'الفئة المعجمية غير محددة.',
        normalizedEntryId: 'NEW',
        cleanedProposedData: p,
        cleanedEvidence,
      }
    }
    if (!msa || !containsArabicScript(msa)) {
      return {
        draft,
        ready: false,
        reason: 'المقابل بالعربية الفصحى غير مكتمل.',
        normalizedEntryId: 'NEW',
        cleanedProposedData: p,
        cleanedEvidence,
      }
    }
    if (!french) {
      return {
        draft,
        ready: false,
        reason: 'المقابل باللغة الفرنسية مطلوب لاستكمال بطاقة المفردة.',
        normalizedEntryId: 'NEW',
        cleanedProposedData: p,
        cleanedEvidence,
      }
    }
    if (!exDarija || !containsArabicScript(exDarija) || !isValidArabizi(exArabizi)) {
      return {
        draft,
        ready: false,
        reason: 'جملة الشاهد السياقي بالدارجة أو كتابتها بـ Arabizi غير مكتملة.',
        normalizedEntryId: 'NEW',
        cleanedProposedData: p,
        cleanedEvidence,
      }
    }
    if (!p.rights_confirmed) {
      return {
        draft,
        ready: false,
        reason: 'يلزم تأكيد إقرار رخصة الملكية الفكرية قبل الإرسال.',
        normalizedEntryId: 'NEW',
        cleanedProposedData: p,
        cleanedEvidence,
      }
    }
    if (cleanedEvidence.length === 0 && !noteTrimmed) {
      return {
        draft,
        ready: false,
        reason: 'أضف رابط شاهد أو ملاحظة سياق رصد ميداني.',
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
        reason: 'تتطابق مع مدخل قائم في المعجم؛ اشرح فرق المعنى في مذكرة المراجع أولاً.',
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
        arabizi,
        category,
        msa_translation: msa,
        meaning: msa,
        french_translation: french,
        example_darija: exDarija,
        example_arabizi: exArabizi,
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

  if (filledFieldsCount === 0 && !noteTrimmed) {
    return {
      draft,
      ready: false,
      reason: 'لا تحتوي المسودة على حقول معدلة أو مذكرة مراجعة.',
      normalizedEntryId: draft.entryId,
      cleanedProposedData: cleanOut,
      cleanedEvidence,
    }
  }

  if (cleanOut.example_darija && !cleanOut.example_arabizi) {
    return {
      draft,
      ready: false,
      reason: 'الشاهد الجديد يتطلب كتابته اللاتينية بـ Arabizi.',
      normalizedEntryId: draft.entryId,
      cleanedProposedData: cleanOut,
      cleanedEvidence,
    }
  }

  if (cleanedEvidence.length === 0 && !noteTrimmed) {
    return {
      draft,
      ready: false,
      reason: 'أرفق رابط شاهد واحداً على الأقل أو اشرح مبرر المراجعة.',
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
          ? 'جميع المسودات المحفوظة حالياً تحتاج استكمال بعض الحقول الإلزامية قبل إرسالها.'
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
      reviewer_note: item.draft.reviewerNote.trim() || null,
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
      error: humanizeSystemError(insertRes.error, 'تعذر إرسال المسودات حالياً. يرجى المحاولة لاحقاً.'),
    }
  }

  return {
    syncedEntryIds: readyAudits.map((item) => item.draft.entryId),
    skippedAudits,
  }
}
