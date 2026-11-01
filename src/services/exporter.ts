import type {
  ExportValidationIssue,
  OfficialExportBundle,
  RawOfficialCorpus,
  SubmissionRecord,
} from '../types/lexicon'
import { normalizeArabicHeadword, sanitizeExternalUrl } from '../utils/validation'

const ALLOWED_ENTRY_KEYS = new Set([
  'id',
  'category',
  'darija_ar',
  'darija_latin',
  'fusha_ar',
  'fr',
  'entry_type',
  'region',
  'register',
  'provenance',
  'review',
])

const ALLOWED_LEXICON_PROV_KEYS = new Set([
  'source_type',
  'source_name',
  'source_url',
  'accessed_at',
  'contributor_id',
  'rights_holder',
  'redistribution_permission',
  'training_permission',
  'commercial_permission',
  'license',
  'notes',
])

const ALLOWED_EXAMPLE_KEYS = new Set([
  'id',
  'entry_id',
  'sense_id',
  'meaning_ar',
  'meaning_fr',
  'example_darija_ar',
  'example_darija_latin',
  'example_fusha_ar',
  'example_fr',
  'region',
  'register',
  'provenance',
  'review',
])

const ALLOWED_EXAMPLE_PROV_KEYS = new Set([
  'source_type',
  'source_name',
  'source_url',
  'accessed_at',
  'rights_holder',
  'license',
  'notes',
  'redistribution_permission',
  'training_permission',
  'commercial_permission',
])

const ALLOWED_REVIEW_KEYS = new Set(['status', 'reviewer_id', 'reviewed_at', 'notes'])

const VALID_ENTRY_TYPES = new Set([
  'word',
  'expression',
  'sentence',
  'proverb',
  'question',
  'conversational',
  'unknown',
])

const VALID_REGISTERS = new Set([
  'neutral',
  'formal',
  'informal',
  'vulgar',
  'literary',
  'religious',
  'unknown',
])

const VALID_SOURCE_TYPES = new Set([
  'original',
  'contributor',
  'dictionary',
  'corpus',
  'web',
  'other',
  'unknown',
])

const VALID_PERMISSIONS = new Set(['allowed', 'not_allowed', 'unknown', 'not_applicable'])
const VALID_REVIEW_STATUSES = new Set([
  'pending',
  'in_review',
  'reviewed',
  'rejected',
  'needs_correction',
  'unknown',
])

const CTX_ID_RE = /^ctx-[0-9]{6}$/
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function formatIsoDate(dateInput?: string): string {
  if (dateInput) {
    const parsed = new Date(dateInput)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10)
    }
  }
  return new Date().toISOString().slice(0, 10)
}

export function bumpPatchVersion(currentVersion: string): string {
  const parts = currentVersion.trim().split('.')
  if (parts.length === 3) {
    const patch = Number.parseInt(parts[2], 10)
    if (!Number.isNaN(patch)) {
      return `${parts[0]}.${parts[1]}.${patch + 1}`
    }
  }
  return `${currentVersion.trim() || '1.5.0'}-rev1`
}

function stripDisallowedKeys(
  obj: Record<string, unknown>,
  allowed: Set<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (allowed.has(k) && v !== undefined) {
      out[k] = v
    }
  }
  return out
}

export function isNewEntrySubmission(sub: SubmissionRecord): boolean {
  return (
    sub.entry_id === 'NEW' ||
    sub.entry_id.startsWith('NEW:') ||
    sub.proposed_data?.submission_kind === 'new_entry'
  )
}

/**
 * Deterministically merges accepted submissions onto a deep clone of the official corpus
 * and runs strict schema.json + context-schema.json validation.
 */
export function buildOfficialExportBundle(
  rawCorpus: RawOfficialCorpus,
  acceptedSubmissions: SubmissionRecord[],
  targetLexiconVersion: string,
): OfficialExportBundle {
  const issues: ExportValidationIssue[] = []

  // Deep clone raw arrays so state is never mutated
  const entriesClone: Array<Record<string, unknown>> = JSON.parse(
    JSON.stringify(rawCorpus.rawEntries),
  )
  const examplesClone: Array<Record<string, unknown>> = JSON.parse(
    JSON.stringify(rawCorpus.rawExamples),
  )

  // Sort chronologically by updated_at ascending so later editorial approvals deterministically win
  const sortedSubs = [...acceptedSubmissions].sort(
    (a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
  )

  const entryIndexById = new Map<number, number>()
  let maxEntryId = 0
  const normalizedHeadwordMap = new Map<string, number>()

  entriesClone.forEach((entry, idx) => {
    const numId = typeof entry.id === 'number' ? entry.id : Number.parseInt(String(entry.id), 10)
    if (!Number.isNaN(numId)) {
      entryIndexById.set(numId, idx)
      if (numId > maxEntryId) maxEntryId = numId
    }
    const normWord = normalizeArabicHeadword(String(entry.darija_ar ?? ''))
    if (normWord && !Number.isNaN(numId)) {
      normalizedHeadwordMap.set(`${normWord}::${String(entry.category ?? '')}`, numId)
    }
  })

  let maxCtxNum = 0
  for (const ex of examplesClone) {
    const idStr = String(ex.id ?? '')
    const match = /^ctx-(\d+)$/.exec(idStr)
    if (match) {
      const n = Number.parseInt(match[1], 10)
      if (n > maxCtxNum) maxCtxNum = n
    }
  }

  const acceptedEditCounts = new Map<number, number>()
  for (const candidate of sortedSubs) {
    if (candidate.status !== 'accepted' || isNewEntrySubmission(candidate)) continue
    const targetId = Number.parseInt(candidate.entry_id, 10)
    if (!Number.isNaN(targetId)) acceptedEditCounts.set(targetId, (acceptedEditCounts.get(targetId) ?? 0) + 1)
  }
  const conflictedEditIds = new Set([...acceptedEditCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id))
  for (const id of conflictedEditIds) {
    conflictsCount += 1
    issues.push({ severity: 'error', target: 'conflict', itemRef: 'LEX-' + String(id).padStart(4, '0'), message: 'توجد عدة مقترحات معتمدة للمدخل نفسه. أُوقفت جميعها حتى تسوية التعارض.' })
  }
  const modifiedEntriesMap = new Map<number, Record<string, unknown>>()
  const addedEntries: Array<Record<string, unknown>> = []
  const addedExamples: Array<Record<string, unknown>> = []
  const appliedSubmissionIds: string[] = []
  let conflictsCount = 0

  for (const sub of sortedSubs) {
    if (sub.status !== 'accepted') continue
    const p = sub.proposed_data ?? {}
    const reviewedDate = formatIsoDate(sub.updated_at)
    const firstSafeUrl = sub.evidence
      ?.map((ev) => sanitizeExternalUrl(ev.url ?? ''))
      .find((u): u is string => Boolean(u))

    if (isNewEntrySubmission(sub)) {
      const wordAr = (p.word_ar ?? '').trim()
      const arabizi = (p.arabizi ?? '').trim()
      const category = (p.category ?? '').trim()
      const fushaAr = (p.msa_translation ?? p.meaning ?? '').trim()
      const fr = (p.french_translation ?? '').trim()

      if (!wordAr || !arabizi || !category || !fushaAr || !fr) {
        issues.push({
          severity: 'error',
          target: 'lexicon',
          itemRef: `Submission ${sub.id.slice(0, 8)}`,
          message:
            'مقترح مفردة جديدة يفتقد أحد الحقول الإلزامية الخمسة (الدارجة، Arabizi، الفئة، الفصحى، الفرنسية).',
        })
        continue
      }

      const dupKey = `${normalizeArabicHeadword(wordAr)}::${category}`
      const existingId = normalizedHeadwordMap.get(dupKey)
      if (existingId !== undefined) {
        conflictsCount += 1
        issues.push({
          severity: 'error',
          target: 'conflict',
          itemRef: `${wordAr} (LEX-${String(existingId).padStart(4, '0')})`,
          message: `المفردة الجديدة «${wordAr}» تطابق مدخلاً موجوداً في نفس الفئة (#${existingId}). تأكد من كونها معنىً مغايراً.`,
        })
      }

      maxEntryId += 1
      const assignedId = maxEntryId
      normalizedHeadwordMap.set(dupKey, assignedId)

      const sourceType = VALID_SOURCE_TYPES.has(String(p.source_type))
        ? String(p.source_type)
        : 'contributor'

      const provenanceObj: Record<string, unknown> = {
        source_type: sourceType,
        source_name: (p.source_name ?? '').trim() || 'Darija LexReview — مساهمة مراجعة',
        rights_holder: 'unknown',
        redistribution_permission: 'unknown',
        training_permission: 'unknown',
        commercial_permission: 'unknown',
        license: 'unknown',
        accessed_at: reviewedDate,
      }
      if (firstSafeUrl) {
        provenanceObj.source_url = firstSafeUrl
      }
      if (p.usage_note?.trim()) {
        provenanceObj.notes = p.usage_note.trim()
      }

      const reviewObj: Record<string, unknown> = {
        status: 'reviewed',
        reviewed_at: reviewedDate,
      }
      if (sub.editor_note?.trim()) {
        reviewObj.notes = sub.editor_note.trim()
      }

      const newEntryObj: Record<string, unknown> = {
        id: assignedId,
        category,
        darija_ar: wordAr,
        darija_latin: arabizi,
        fusha_ar: fushaAr,
        fr,
      }

      if (p.entry_type && VALID_ENTRY_TYPES.has(p.entry_type)) {
        newEntryObj.entry_type = p.entry_type
      }
      if (p.register && VALID_REGISTERS.has(p.register)) {
        newEntryObj.register = p.register
      }
      if (Array.isArray(p.regions) && p.regions.length > 0) {
        const uniqueRegions = Array.from(new Set(p.regions.map((r) => r.trim()).filter(Boolean)))
        if (uniqueRegions.length > 0) newEntryObj.region = uniqueRegions
      }

      newEntryObj.provenance = stripDisallowedKeys(provenanceObj, ALLOWED_LEXICON_PROV_KEYS)
      newEntryObj.review = stripDisallowedKeys(reviewObj, ALLOWED_REVIEW_KEYS)

      entriesClone.push(newEntryObj)
      addedEntries.push(newEntryObj)
      appliedSubmissionIds.push(sub.id)

      // Append contextual example if supplied
      const exAr = (p.example_darija ?? '').trim()
      const exLat = (p.example_arabizi ?? '').trim()
      if (exAr) {
        if (!exLat) {
          issues.push({
            severity: 'warning',
            target: 'examples',
            itemRef: `${wordAr} (#${assignedId})`,
            message: `تم تضمين المفردة الجديدة «${wordAr}»، لكن لم يُضف شاهدها السياقي إلى context-examples.json لغياب الكتابة اللاتينية للشاهد (example_darija_latin).`,
          })
        } else {
          maxCtxNum += 1
          const ctxId = `ctx-${String(maxCtxNum).padStart(6, '0')}`
          const exProv: Record<string, unknown> = {
            source_type: sourceType,
            source_name: (p.source_name ?? '').trim() || 'Darija LexReview — مساهمة مراجعة',
            rights_holder: 'unknown',
            redistribution_permission: 'unknown',
            training_permission: 'unknown',
            commercial_permission: 'unknown',
            license: 'unknown',
            accessed_at: reviewedDate,
          }
          if (firstSafeUrl) exProv.source_url = firstSafeUrl

          const newEx: Record<string, unknown> = {
            id: ctxId,
            entry_id: assignedId,
            meaning_ar: fushaAr,
            meaning_fr: fr,
            example_darija_ar: exAr,
            example_darija_latin: Array.from(
              new Set(
                exLat
                  .split('/')
                  .map((s) => s.trim())
                  .filter(Boolean),
              ),
            ),
            register:
              p.register && VALID_REGISTERS.has(p.register) ? p.register : 'neutral',
            provenance: stripDisallowedKeys(exProv, ALLOWED_EXAMPLE_PROV_KEYS),
            review: {
              status: 'reviewed',
              reviewed_at: reviewedDate,
            },
          }
          if (p.example_translation?.trim()) {
            newEx.example_fusha_ar = p.example_translation.trim()
          }
          if (p.example_french?.trim()) {
            newEx.example_fr = p.example_french.trim()
          }
          if (Array.isArray(newEntryObj.region)) {
            newEx.region = newEntryObj.region
          }

          examplesClone.push(newEx)
          addedExamples.push(newEx)
        }
      }
    } else {
      // Modification to an existing entry
      const targetNumId = Number.parseInt(sub.entry_id, 10)
      const targetIdx = entryIndexById.get(targetNumId)

      if (Number.isNaN(targetNumId) || targetIdx === undefined) {
        issues.push({
          severity: 'error',
          target: 'lexicon',
          itemRef: `Entry #${sub.entry_id}`,
          message: `المدخل رقم #${sub.entry_id} غير موجود في ملف المعجم الأساسي المحمّل.`,
        })
        continue
      }

      if (conflictedEditIds.has(targetNumId)) continue

      const existing = { ...entriesClone[targetIdx] }

      if (p.word_ar?.trim()) existing.darija_ar = p.word_ar.trim()
      if (p.arabizi?.trim()) existing.darija_latin = p.arabizi.trim()
      if (p.category?.trim()) existing.category = p.category.trim()
      if (p.msa_translation?.trim()) {
        existing.fusha_ar = p.msa_translation.trim()
      } else if (p.meaning?.trim()) {
        existing.fusha_ar = p.meaning.trim()
      }
      if (p.french_translation?.trim()) existing.fr = p.french_translation.trim()
      if (p.entry_type && VALID_ENTRY_TYPES.has(p.entry_type)) {
        existing.entry_type = p.entry_type
      }
      if (p.register && VALID_REGISTERS.has(p.register)) {
        existing.register = p.register
      }
      if (Array.isArray(p.regions) && p.regions.length > 0) {
        const uniqueRegions = Array.from(new Set(p.regions.map((r) => r.trim()).filter(Boolean)))
        if (uniqueRegions.length > 0) existing.region = uniqueRegions
      }

      const existingProv: Record<string, unknown> =
        typeof existing.provenance === 'object' && existing.provenance !== null
          ? { ...(existing.provenance as Record<string, unknown>) }
          : {
              source_type: 'original',
              rights_holder: 'unknown',
              redistribution_permission: 'unknown',
              training_permission: 'unknown',
              commercial_permission: 'unknown',
              license: 'unknown',
            }

      if (firstSafeUrl && !existingProv.source_url) {
        existingProv.source_url = firstSafeUrl
      }
      if (p.usage_note?.trim()) {
        existingProv.notes = p.usage_note.trim()
      }

      const existingRev =
        typeof existing.review === 'object' && existing.review !== null
          ? { ...(existing.review as Record<string, unknown>) }
          : {}
      existingRev.status = 'reviewed'
      existingRev.reviewed_at = reviewedDate
      if (sub.editor_note?.trim()) {
        existingRev.notes = sub.editor_note.trim()
      }

      existing.provenance = stripDisallowedKeys(existingProv, ALLOWED_LEXICON_PROV_KEYS)
      existing.review = stripDisallowedKeys(existingRev, ALLOWED_REVIEW_KEYS)

      const sanitizedEntry = stripDisallowedKeys(existing, ALLOWED_ENTRY_KEYS)
      entriesClone[targetIdx] = sanitizedEntry
      modifiedEntriesMap.set(targetNumId, sanitizedEntry)
      appliedSubmissionIds.push(sub.id)

      // Check if reviewer also proposed a new contextual example for this existing entry
      const exAr = (p.example_darija ?? '').trim()
      const exLat = (p.example_arabizi ?? '').trim()
      if (exAr) {
        if (!exLat) {
          issues.push({
            severity: 'warning',
            target: 'examples',
            itemRef: `LEX-${String(targetNumId).padStart(4, '0')}`,
            message: `تم تحديث المدخل #${targetNumId}، لكن لم يُضف المثال السياقي «${exAr.slice(0, 28)}...» إلى context-examples.json لعدم توفر الكتابة اللاتينية للمثال (Arabizi).`,
          })
        } else {
          maxCtxNum += 1
          const ctxId = `ctx-${String(maxCtxNum).padStart(6, '0')}`
          const exProv: Record<string, unknown> = {
            source_type: 'contributor',
            source_name: 'Darija LexReview — مساهمة مراجعة',
            rights_holder: 'ArCode Standard Contributors',
            redistribution_permission: 'allowed',
            training_permission: 'allowed',
            commercial_permission: 'not_allowed',
            license: 'CC BY-NC 4.0',
            accessed_at: reviewedDate,
          }
          if (firstSafeUrl) exProv.source_url = firstSafeUrl

          const newEx: Record<string, unknown> = {
            id: ctxId,
            entry_id: targetNumId,
            meaning_ar: String(sanitizedEntry.fusha_ar ?? ''),
            meaning_fr: String(sanitizedEntry.fr ?? ''),
            example_darija_ar: exAr,
            example_darija_latin: Array.from(
              new Set(
                exLat
                  .split('/')
                  .map((s) => s.trim())
                  .filter(Boolean),
              ),
            ),
            register:
              p.register && VALID_REGISTERS.has(p.register) ? p.register : 'neutral',
            provenance: stripDisallowedKeys(exProv, ALLOWED_EXAMPLE_PROV_KEYS),
            review: {
              status: 'reviewed',
              reviewed_at: reviewedDate,
            },
          }
          if (p.example_translation?.trim()) {
            newEx.example_fusha_ar = p.example_translation.trim()
          }
          if (p.example_french?.trim()) {
            newEx.example_fr = p.example_french.trim()
          }

          examplesClone.push(newEx)
          addedExamples.push(newEx)
        }
      }
    }
  }

  // Recompute category counts deterministically preserving order of appearance
  const categoryCountMap = new Map<string, number>()
  for (const entry of entriesClone) {
    const cat = String(entry.category ?? '').trim()
    if (cat) {
      categoryCountMap.set(cat, (categoryCountMap.get(cat) ?? 0) + 1)
    }
  }
  const recomputedCategories = Array.from(categoryCountMap.entries()).map(
    ([category, count]) => ({ category, count }),
  )

  const cleanVersion = targetLexiconVersion.trim() || '1.5.1'

  const updatedLexiconMeta: Record<string, unknown> = {
    ...rawCorpus.lexiconMeta,
    language: 'ary',
    version: cleanVersion,
    entries_count: entriesClone.length,
    categories_count: recomputedCategories.length,
    license: String(rawCorpus.lexiconMeta.license ?? 'CC BY-NC 4.0'),
  }

  const updatedExamplesMeta: Record<string, unknown> = {
    lexicon_version: cleanVersion,
    version: String(rawCorpus.examplesMeta.version ?? '1.0.0'),
    examples_count: examplesClone.length,
  }

  // Run strict self-audit against schema.json & context-schema.json
  const schemaAuditIssues = auditGeneratedSchemas(
    entriesClone,
    examplesClone,
    recomputedCategories,
  )
  issues.push(...schemaAuditIssues)

  const modifiedEntries = Array.from(modifiedEntriesMap.values())

  const prMarkdown = generatePullRequestMarkdown({
    targetVersion: cleanVersion,
    modifiedCount: modifiedEntries.length,
    addedEntriesCount: addedEntries.length,
    addedExamplesCount: addedExamples.length,
    totalEntries: entriesClone.length,
    totalExamples: examplesClone.length,
    appliedIds: appliedSubmissionIds,
  })

  return {
    lexiconJson: {
      meta: updatedLexiconMeta,
      categories: recomputedCategories,
      entries: entriesClone,
    },
    examplesJson: {
      meta: updatedExamplesMeta,
      examples: examplesClone,
    },
    patchSummary: {
      generated_at: new Date().toISOString(),
      target_version: cleanVersion,
      applied_submission_ids: appliedSubmissionIds,
      modified_entries: modifiedEntries,
      added_entries: addedEntries,
      added_examples: addedExamples,
    },
    prMarkdown,
    issues,
    stats: {
      modifiedEntriesCount: modifiedEntries.length,
      addedEntriesCount: addedEntries.length,
      addedExamplesCount: addedExamples.length,
      conflictsCount,
    },
  }
}

function auditGeneratedSchemas(
  entries: Array<Record<string, unknown>>,
  examples: Array<Record<string, unknown>>,
  categories: Array<{ category: string; count: number }>,
): ExportValidationIssue[] {
  const auditIssues: ExportValidationIssue[] = []
  const seenIds = new Set<number>()

  for (const cat of categories) {
    if (!cat.category || typeof cat.count !== 'number' || cat.count < 0) {
      auditIssues.push({
        severity: 'error',
        target: 'lexicon',
        itemRef: `Category ${cat.category || '?'}`,
        message: 'عنصر فئة غير صالح في مصفوفة categories.',
      })
    }
  }

  for (const entry of entries) {
    const ref = `LEX-${String(entry.id ?? '?')}`
    for (const key of Object.keys(entry)) {
      if (!ALLOWED_ENTRY_KEYS.has(key)) {
        auditIssues.push({
          severity: 'error',
          target: 'lexicon',
          itemRef: ref,
          message: `خاصية غير مسموح بها في المدخل (${key}) تخالف additionalProperties: false.`,
        })
      }
    }

    if (typeof entry.id !== 'number' || !Number.isInteger(entry.id) || entry.id < 1) {
      auditIssues.push({
        severity: 'error',
        target: 'lexicon',
        itemRef: ref,
        message: 'معرف المدخل (id) يجب أن يكون عدداً صحيحاً موجباً.',
      })
    } else if (seenIds.has(entry.id)) {
      auditIssues.push({
        severity: 'error',
        target: 'lexicon',
        itemRef: ref,
        message: `تكرار في المعرف الرقمي للمدخل (#${entry.id}).`,
      })
    } else {
      seenIds.add(entry.id)
    }

    for (const reqField of ['category', 'darija_ar', 'darija_latin', 'fusha_ar', 'fr']) {
      const val = entry[reqField]
      if (typeof val !== 'string' || val.trim().length === 0) {
        auditIssues.push({
          severity: 'error',
          target: 'lexicon',
          itemRef: ref,
          message: `الحقل الإلزامي (${reqField}) فارغ أو غير نصي.`,
        })
      }
    }

    if (entry.review && typeof entry.review === 'object') {
      const rev = entry.review as Record<string, unknown>
      if (!VALID_REVIEW_STATUSES.has(String(rev.status ?? ''))) {
        auditIssues.push({
          severity: 'error',
          target: 'lexicon',
          itemRef: ref,
          message: `قيمة review.status غير صالحة (${String(rev.status)}).`,
        })
      }
      if (rev.reviewed_at && !ISO_DATE_RE.test(String(rev.reviewed_at))) {
        auditIssues.push({
          severity: 'error',
          target: 'lexicon',
          itemRef: ref,
          message: 'صيغة تاريخ review.reviewed_at يجب أن تطابق YYYY-MM-DD.',
        })
      }
    }
  }

  const seenCtxIds = new Set<string>()
  for (const ex of examples) {
    const idStr = String(ex.id ?? '')
    for (const key of Object.keys(ex)) {
      if (!ALLOWED_EXAMPLE_KEYS.has(key)) {
        auditIssues.push({
          severity: 'error',
          target: 'examples',
          itemRef: idStr || 'ctx-?',
          message: `خاصية غير مسموح بها في الشاهد (${key}) تخالف context-schema.json.`,
        })
      }
    }

    if (!CTX_ID_RE.test(idStr)) {
      auditIssues.push({
        severity: 'error',
        target: 'examples',
        itemRef: idStr || 'ctx-?',
        message: `معرف الشاهد (${idStr}) لا يطابق النمط القياسي ^ctx-[0-9]{6}$.`,
      })
    } else if (seenCtxIds.has(idStr)) {
      auditIssues.push({
        severity: 'error',
        target: 'examples',
        itemRef: idStr,
        message: `تكرار في معرف الشاهد السياقي (${idStr}).`,
      })
    } else {
      seenCtxIds.add(idStr)
    }

    if (typeof ex.entry_id !== 'number' || !seenIds.has(ex.entry_id)) {
      auditIssues.push({
        severity: 'error',
        target: 'examples',
        itemRef: idStr,
        message: `الشاهد يشير إلى مدخل غير موجود (entry_id: ${String(ex.entry_id)}).`,
      })
    }

    if (
      !Array.isArray(ex.example_darija_latin) ||
      ex.example_darija_latin.length === 0 ||
      ex.example_darija_latin.some((item) => typeof item !== 'string' || !item.trim())
    ) {
      auditIssues.push({
        severity: 'error',
        target: 'examples',
        itemRef: idStr,
        message: 'الحقل example_darija_latin يجب أن يكون مصفوفة نصوص غير فارغة.',
      })
    }

    if (ex.provenance && typeof ex.provenance === 'object') {
      const prov = ex.provenance as Record<string, unknown>
      for (const reqP of [
        'source_type',
        'redistribution_permission',
        'training_permission',
        'commercial_permission',
      ]) {
        if (!prov[reqP] || ( reqP !== 'source_type' && !VALID_PERMISSIONS.has(String(prov[reqP])) )) {
          auditIssues.push({
            severity: 'error',
            target: 'examples',
            itemRef: idStr,
            message: `نقص أو خطأ في حقل الترخيص الإلزامي provenance.${reqP} داخل الشاهد.`,
          })
        }
      }
    } else {
      auditIssues.push({
        severity: 'error',
        target: 'examples',
        itemRef: idStr,
        message: 'كائن provenance إلزامي في كل شاهد سياقي.',
      })
    }
  }

  return auditIssues
}

function generatePullRequestMarkdown(params: {
  targetVersion: string
  modifiedCount: number
  addedEntriesCount: number
  addedExamplesCount: number
  totalEntries: number
  totalExamples: number
  appliedIds: string[]
}): string {
  return `## تحديث المعجم الرسمي — الإصدار ${params.targetVersion} (عبر Darija LexReview)

> هذا وصف آلي وليس شهادة اجتياز أو موافقة قانونية. لا تدمج التغييرات قبل إكمال عناصر التحقق أعلاه.

### ملخص الدفعة المعتمدة
- **مداخل معجمية مُحدَّثة ومُدقَّقة**: ${params.modifiedCount}
- **مفردات جديدة مضافة إلى المتن**: ${params.addedEntriesCount}
- **شواهد سياقية جديدة مضافة**: ${params.addedExamplesCount}
- **إجمالي مداخل \`moroccan-darija.json\` بعد الدمج**: ${params.totalEntries}
- **إجمالي شواهد \`context-examples.json\` بعد الدمج**: ${params.totalExamples}

### التحقق والضبط المعياري
- [ ] يجب تشغيل مدقق JSON Schema الرسمي وتوثيق نتيجته قبل الدمج.
- [ ] يجب توثيق مراجعة بشرية مستقلة لكل مدخل وشاهد.
- [ ] يجب التحقق من حقوق المصدر والترخيص؛ القيم غير المعروفة لا تمنح أي إذن.

### معرفات المقترحات المشمولة (${params.appliedIds.length})
${params.appliedIds.length > 0 ? params.appliedIds.map((id) => `- \`${id}\``).join('\n') : '- لا توجد مقترحات مدمجة بعد'}
`
}
