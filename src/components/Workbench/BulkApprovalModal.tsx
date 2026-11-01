import { useEffect, useMemo, useState } from 'react'
import {
  X,
  CheckSquare,
  AlertTriangle,
  AlertCircle,
  FileCheck2,
} from 'lucide-react'
import type { LexicalEntry, SubmissionRecord } from '../../types/lexicon'
import { formatAccessionCode, formatStatusLabel } from '../../services/dataset'
import { isNewEntrySubmission } from '../../services/exporter'
import { findSimilarCorpusEntries } from '../../utils/validation'

interface BulkApprovalModalProps {
  open: boolean
  selectedSubmissions: SubmissionRecord[]
  entries: LexicalEntry[]
  currentEditorId?: string | null
  editorLabel: string
  queueSource: 'live' | 'sandbox'
  busy: boolean
  errorMessage: string | null
  onClose: () => void
  onConfirmBulkApprove: (params: {
    eligibleIds: string[]
    justificationComment: string
  }) => void
}

const MIN_JUSTIFICATION_LENGTH = 10
const MAX_JUSTIFICATION_LENGTH = 4000

export function BulkApprovalModal({
  open,
  selectedSubmissions,
  entries,
  currentEditorId,
  editorLabel,
  queueSource,
  busy,
  errorMessage,
  onClose,
  onConfirmBulkApprove,
}: BulkApprovalModalProps) {
  const [justification, setJustification] = useState('')
  const [signedOff, setSignedOff] = useState(false)
  const [localValidationError, setLocalValidationError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setJustification('')
      setSignedOff(false)
      setLocalValidationError(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, busy, onClose])

  const entryById = useMemo(() => {
    const map = new Map<string, LexicalEntry>()
    for (const e of entries) map.set(e.id, e)
    return map
  }, [entries])

  // Partition selected submissions into eligible vs schema-blocked + detect batch overlaps
  const batchAudit = useMemo(() => {
    const eligible: Array<{ sub: SubmissionRecord; title: string; code: string; isNew: boolean }> =
      []
    const blocked: Array<{ sub: SubmissionRecord; title: string; reason: string }> = []
    const warnings: string[] = []
    const seenEntryTargets = new Map<string, number>()

    for (const sub of selectedSubmissions) {
      const isNew = isNewEntrySubmission(sub)
      const p = sub.proposed_data ?? {}
      const canonical = entryById.get(sub.entry_id)
      const title = isNew
        ? p.word_ar?.trim() || 'مفردة جديدة غير معنونة'
        : canonical?.word || `مدخل #${sub.entry_id}`
      const code = isNew
        ? 'NEW'
        : formatAccessionCode(sub.entry_id, canonical?.numericId ?? null)

      if (sub.status === 'accepted') {
        blocked.push({
          sub,
          title,
          reason: 'هذا المقترح معتمد مسبقاً في السجل.',
        })
        continue
      }

      if (queueSource === 'live' && sub.status !== 'pending' && sub.status !== 'needs_changes') {
        blocked.push({
          sub,
          title,
          reason: 'لا يُسمح في السجل الحي إلا بتحويل المقترحات المعلقة أو المطلوب تعديلها.',
        })
        continue
      }

      if (
        queueSource === 'live' &&
        currentEditorId &&
        sub.reviewer_id &&
        sub.reviewer_id === currentEditorId
      ) {
        blocked.push({
          sub,
          title,
          reason: 'لا يُسمح للمحرر بتحكيم واعتماد مقترحه الشخصي بموجب قواعد الحوكمة.',
        })
        continue
      }

      if (isNew) {
        const hasRequiredFive =
          Boolean(p.word_ar?.trim()) &&
          Boolean(p.arabizi?.trim()) &&
          Boolean(p.category?.trim()) &&
          Boolean(p.msa_translation?.trim() || p.meaning?.trim()) &&
          Boolean(p.french_translation?.trim())

        if (!hasRequiredFive) {
          blocked.push({
            sub,
            title,
            reason:
              'ينقصه أحد الحقول الخمسة الإلزامية في schema.json (الدارجة، Arabizi، الفئة، الفصحى، الفرنسية).',
          })
          continue
        }

        const matches = findSimilarCorpusEntries(entries, p.word_ar ?? '', p.arabizi ?? '')
        if (matches.length > 0) {
          warnings.push(
            `المفردة الجديدة «${title}» تتشابه إملائياً مع المدخل القائم (${formatAccessionCode(matches[0].id, matches[0].numericId)} — ${matches[0].word}).`,
          )
        }
      } else {
        if (!canonical) {
          blocked.push({
            sub,
            title,
            reason: `المدخل الأساسي #${sub.entry_id} غير موجود في نسخة المعجم المحمّلة.`,
          })
          continue
        }
        const prevCount = seenEntryTargets.get(sub.entry_id) ?? 0
        seenEntryTargets.set(sub.entry_id, prevCount + 1)
      }

      if (p.example_darija?.trim() && !p.example_arabizi?.trim()) {
        warnings.push(
          `المقترح (${title}) يتضمن شاهداً بالدارجة دون كتابته بـ Arabizi؛ سيُحدَّث المدخل دون إدراج الشاهد في context-examples.json.`,
        )
      }

      eligible.push({ sub, title, code, isNew })
    }

    for (const [entryId, count] of seenEntryTargets.entries()) {
      if (count > 1) {
        warnings.push(
          `تنبيه تعارض: تضم الدفعة المحددة (${count}) مقترحات تستهدف نفس المدخل (#${entryId}). المقترحات المتعارضة على المدخل نفسه تُوقف من التصدير حتى تسويتها.`,
        )
      }
    }

    return { eligible, blocked, warnings }
  }, [selectedSubmissions, entryById, entries, queueSource, currentEditorId])

  if (!open) return null

  const trimmedJustification = justification.trim()
  const isJustificationValid =
    trimmedJustification.length >= MIN_JUSTIFICATION_LENGTH &&
    trimmedJustification.length <= MAX_JUSTIFICATION_LENGTH
  const canConfirm =
    !busy &&
    batchAudit.eligible.length > 0 &&
    isJustificationValid &&
    signedOff

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (batchAudit.eligible.length === 0) {
      setLocalValidationError('لا توجد مقترحات مستوفية للشروط ضمن الدفعة المحددة.')
      return
    }
    if (trimmedJustification.length < MIN_JUSTIFICATION_LENGTH) {
      setLocalValidationError(
        `يرجى كتابة تعليق تسبيب واضح لا يقل عن ${MIN_JUSTIFICATION_LENGTH} أحرف لتوثيق الاعتماد الجماعي.`,
      )
      return
    }
    if (!signedOff) {
      setLocalValidationError('يرجى تفعيل مربع إقرار التوقيع التحريري المسؤول قبل المتابعة.')
      return
    }
    setLocalValidationError(null)
    onConfirmBulkApprove({
      eligibleIds: batchAudit.eligible.map((item) => item.sub.id),
      justificationComment: trimmedJustification,
    })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-approval-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-[#E5DFD3] bg-[#FBF9F5] shadow-xl dark:border-[#2E2B27] dark:bg-[#1C1A18]">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#E5DFD3] px-6 py-5 dark:border-[#2E2B27]">
          <div>
            <p className="text-xs font-semibold text-[#0F5C4E] dark:text-[#4FD1C5]">
              توقيع تحكيمي جماعي · {queueSource === 'live' ? 'سجل Supabase الحي' : 'طابور المحاكاة المحلي'}
            </p>
            <h3
              id="bulk-approval-modal-title"
              className="mt-1 font-display text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100"
            >
              تأكيد الاعتماد الجماعي للمقترحات ({batchAudit.eligible.length})
            </h3>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label="إغلاق نافذة التأكيد"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-200/60 hover:text-stone-900 disabled:opacity-40 transition-colors cursor-pointer dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Acting Editor Summary */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-b border-[#E5DFD3] pb-4 text-xs dark:border-[#2E2B27]">
            <div>
              <dt className="text-stone-500 dark:text-stone-400">المحرر الموقِّع بالاعتماد</dt>
              <dd className="mt-1 font-semibold text-stone-900 dark:text-stone-100">
                {editorLabel}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500 dark:text-stone-400">ملخص الفحص التلقائي للدفعة</dt>
              <dd className="mt-1 font-mono tabular-nums text-stone-800 dark:text-stone-200">
                جاهز: {batchAudit.eligible.length} · مستبعد: {batchAudit.blocked.length}
              </dd>
            </div>
          </dl>

          {/* Eligible Items List */}
          <div>
            <h4 className="text-xs font-semibold text-stone-800 mb-2.5 dark:text-stone-200">
              المقترحات المشمولة بالاعتماد ({batchAudit.eligible.length})
            </h4>
            {batchAudit.eligible.length === 0 ? (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                لا توجد مقترحات صالحة للاعتماد ضمن العناصر المحددة حالياً.
              </p>
            ) : (
              <ul className="max-h-[168px] overflow-y-auto divide-y divide-[#E5DFD3] rounded-lg border border-[#E5DFD3] bg-white px-3.5 dark:divide-[#2E2B27] dark:border-[#2E2B27] dark:bg-[#141312]">
                {batchAudit.eligible.map(({ sub, title, code, isNew }) => (
                  <li
                    key={sub.id}
                    className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <FileCheck2
                        className="h-3.5 w-3.5 shrink-0 text-[#0F5C4E] dark:text-[#4FD1C5]"
                        aria-hidden="true"
                      />
                      <span className="font-display font-bold text-stone-900 dark:text-stone-100">
                        {title}
                      </span>
                      <span className="text-stone-400" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-stone-600 dark:text-stone-400">
                        {isNew ? 'مفردة جديدة' : 'تعديل مدخل قائم'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums text-stone-500 dark:text-stone-400">
                      <span>{code}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatStatusLabel(sub.status)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Excluded Items (if any) */}
          {batchAudit.blocked.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50/80 p-3.5 space-y-1.5 text-xs text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="font-semibold">
                تم استبعاد {batchAudit.blocked.length} عنصر تلقائياً لمنع إدخال سجلات ناقصة:
              </p>
              <ul className="list-disc ps-5 space-y-1">
                {batchAudit.blocked.map(({ sub, title, reason }) => (
                  <li key={sub.id}>
                    <strong>{title}:</strong> {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Batch Overlap / Example Warnings */}
          {batchAudit.warnings.length > 0 && (
            <div className="rounded-lg border border-[#D6CEBE] bg-white p-3.5 space-y-1.5 text-xs text-stone-700 dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-300">
              {batchAudit.warnings.map((w, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Mandatory Justification Comment */}
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <label
                htmlFor="bulk-justification-input"
                className="block text-xs font-semibold text-stone-900 dark:text-stone-100"
              >
                مذكرة تسبيب الاعتماد الجماعي والتوقيع التحريري *
              </label>
              <span
                className={`font-mono text-[11px] tabular-nums ${
                  trimmedJustification.length >= MIN_JUSTIFICATION_LENGTH
                    ? 'text-[#0F5C4E] dark:text-[#4FD1C5]'
                    : 'text-stone-500 dark:text-stone-400'
                }`}
              >
                {trimmedJustification.length} / {MIN_JUSTIFICATION_LENGTH}+ حرفاً
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-stone-500 dark:text-stone-400">
              يُحفظ هذا التسبيب في حقل مذكرة المحرر (editor_note) لجميع مقترحات الدفعة توثيقاً لمستند القبول.
            </p>
            <textarea
              id="bulk-justification-input"
              rows={3}
              required
              maxLength={MAX_JUSTIFICATION_LENGTH}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="مثال: تمت مراجعة الشواهد السياقية المرفقة والتحقق من سلامة الضبط بالدارجة وArabizi ومطابقة الفئات المعجمية..."
              className="mt-2 w-full rounded-lg border border-[#D6CEBE] bg-white p-3 text-xs leading-relaxed text-stone-900 placeholder:text-stone-400 focus:border-[#0F5C4E] focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100 dark:focus:border-[#4FD1C5]"
            />
          </div>

          {/* Explicit Sign-Off Checkbox */}
          <label className="flex items-start gap-3 rounded-lg border border-[#E5DFD3] bg-white p-3.5 cursor-pointer dark:border-[#2E2B27] dark:bg-[#141312]">
            <input
              type="checkbox"
              checked={signedOff}
              onChange={(e) => setSignedOff(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#0F5C4E] shrink-0"
            />
            <span className="text-xs leading-relaxed text-stone-700 dark:text-stone-300">
              أوقّع بصفتي محرراً مخولاً على صحة المراجعة البشرية لهذه الدفعة ({batchAudit.eligible.length}{' '}
              مقترحات)، وأؤكد استيفاءها لمعايير التداول المغربي ورخصة المتن قبل نقلها إلى حزمة التصدير.
            </span>
          </label>

          {(localValidationError || errorMessage) && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{localValidationError || errorMessage}</span>
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-[#E5DFD3] dark:border-[#2E2B27]">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="min-h-[40px] rounded-lg border border-[#D6CEBE] bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-[#EFECE4] disabled:opacity-50 whitespace-nowrap cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-300 dark:hover:bg-[#262320]"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={!canConfirm}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#0F5C4E] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0B463B] disabled:opacity-45 whitespace-nowrap cursor-pointer dark:bg-[#147A67] dark:hover:bg-[#0F5C4E]"
            >
              <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {busy
                  ? 'جارٍ تطبيق الاعتماد الجماعي...'
                  : `توقيع واعتماد الدفعة (${batchAudit.eligible.length})`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
