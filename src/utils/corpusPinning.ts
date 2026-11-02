import type { LexicalEntry, RawOfficialCorpus, SubmissionRecord } from '../types/lexicon'

const DEFAULT_CORPUS_VERSION = '1.5.0'

function normalizeToken(value: string | undefined | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Extracts the semantic version of the loaded canonical dataset.
 */
export function extractCorpusVersion(rawCorpus: RawOfficialCorpus | null | undefined): string {
  if (!rawCorpus?.lexiconMeta) return DEFAULT_CORPUS_VERSION
  const rawVer = rawCorpus.lexiconMeta.version
  const candidate =
    typeof rawVer === 'string' && rawVer.trim().length > 0
      ? rawVer.trim()
      : DEFAULT_CORPUS_VERSION
  return candidate.replace(/^v/i, '')
}

/**
 * Computes a compact deterministic fingerprint of an entry's baseline lexical core
 * so editors can immediately spot if a submission was authored against an older definition.
 */
export function computeEntryFingerprint(
  entry: Pick<LexicalEntry, 'word' | 'latin' | 'meaning'>,
): string {
  const w = normalizeToken(entry.word)
  const l = normalizeToken(entry.latin)
  const m = normalizeToken(entry.meaning)
  return `${w}::${l}::${m}`
}

export interface CorpusDriftCheckResult {
  drifted: boolean
  submittedVersion: string | null
  reason?: string
}

/**
 * Checks whether a submission was authored against an entry state
 * that has since changed in the currently loaded canonical dataset.
 */
export function checkSubmissionCorpusDrift(
  sub: SubmissionRecord,
  canonicalEntry: LexicalEntry | undefined,
  currentCorpusVersion: string,
): CorpusDriftCheckResult {
  const submittedVersion =
    sub.corpus_version || sub.proposed_data?.corpus_version || null

  const isNewEntry =
    sub.entry_id === 'NEW' ||
    sub.entry_id.startsWith('NEW:') ||
    sub.proposed_data?.submission_kind === 'new_entry'

  if (isNewEntry) {
    if (canonicalEntry) {
      return {
        drifted: true,
        submittedVersion,
        reason:
          'أُدرجت مفردة بنفس الرسم الإملائي ضمن هذه الفئة في المتن الحالي بعد إرسال هذا المقترح؛ يرجى التحقق من عدم ازدواجية المدخل.',
      }
    }
    return { drifted: false, submittedVersion }
  }

  if (!canonicalEntry) {
    return {
      drifted: true,
      submittedVersion,
      reason:
        'لم تعد المفردة الأصلية موجودة بنفس الرقم أو الاسم في نسخة المعجم الحالية.',
    }
  }

  const submittedFingerprint =
    sub.baseline_fingerprint || sub.proposed_data?.baseline_fingerprint || null

  if (submittedFingerprint) {
    const liveFingerprint = computeEntryFingerprint(canonicalEntry)
    if (submittedFingerprint !== liveFingerprint) {
      return {
        drifted: true,
        submittedVersion,
        reason:
          'تغيّر تعريف المفردة أو تهجئتها في المتن الرسمي بعد كتابة هذه الملاحظة؛ يرجى مقارنة الحقول بعناية قبل الاعتماد.',
      }
    }
  } else if (
    submittedVersion &&
    submittedVersion.replace(/^v/i, '') !== currentCorpusVersion.replace(/^v/i, '')
  ) {
    return {
      drifted: true,
      submittedVersion,
      reason: `أُرسل هذا المقترح على الإصدار v${submittedVersion.replace(/^v/i, '')} بينما يعمل المعجم حالياً على v${currentCorpusVersion.replace(/^v/i, '')}.`,
    }
  }

  return { drifted: false, submittedVersion }
}
