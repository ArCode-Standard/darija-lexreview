import { useCallback, useEffect, useState } from 'react'
import { History, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { ReviewDecisionEvent, SubmissionStatus } from '../../types/lexicon'
import { formatStatusLabel } from '../../services/dataset'
import { humanizeSystemError } from '../../utils/humanizeError'

interface DecisionAuditTimelineProps {
  submissionId: string
  editorNamesMap: Record<string, string>
  refreshKey?: string | number
}

function formatEventTitle(ev: ReviewDecisionEvent): string {
  if (ev.event_type === 'submitted') {
    return 'إيداع المقترح في سجل المراجعة'
  }
  if (ev.event_type === 'baseline') {
    return `توثيق الحالة المرجعية (${formatStatusLabel(ev.new_status)})`
  }
  if (ev.event_type === 'withdrawn' || ev.new_status === 'withdrawn') {
    return 'سحب المقترح من قِبل المساهم قبل التحكيم'
  }
  if (ev.event_type === 'superseded' || ev.new_status === 'superseded') {
    return 'استبدال المقترح تلقائياً بنسخة منقحة أحدث'
  }
  const fromLabel = ev.previous_status ? formatStatusLabel(ev.previous_status) : 'غير محدد'
  const toLabel = formatStatusLabel(ev.new_status)
  if (ev.new_status === 'merged') {
    return `أرشفة ودمج في الإصدار الرسمي: ${fromLabel} ← ${toLabel}`
  }
  if (ev.previous_status === 'accepted' && ev.new_status !== 'accepted') {
    return `سحب الاعتماد وإعادة الفتح: ${fromLabel} ← ${toLabel}`
  }
  return `قرار تحكيمي: ${fromLabel} ← ${toLabel}`
}

export function DecisionAuditTimeline({
  submissionId,
  editorNamesMap,
  refreshKey,
}: DecisionAuditTimelineProps) {
  const [liveEvents, setLiveEvents] = useState<ReviewDecisionEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchLiveAuditEvents = useCallback(async () => {
    if (!supabase || !submissionId) {
      setLiveEvents([])
      return
    }
    setLoading(true)
    setErrorMsg(null)
    const { data, error } = await supabase
      .from('review_decision_events')
      .select(
        'id, submission_id, actor_id, event_type, previous_status, new_status, editor_note, occurred_at',
      )
      .eq('submission_id', submissionId)
      .order('occurred_at', { ascending: true })

    setLoading(false)
    if (error) {
      setErrorMsg(humanizeSystemError(error, 'تعذر عرض سجل القرارات التفصيلي حالياً.'))
      return
    }
    setLiveEvents(
      ((data ?? []) as Array<{
        id: number
        submission_id: string
        actor_id: string | null
        event_type: ReviewDecisionEvent['event_type']
        previous_status: SubmissionStatus | null
        new_status: SubmissionStatus
        editor_note: string | null
        occurred_at: string
      }>).map((row) => ({
        ...row,
        actor_display_name: row.actor_id ? editorNamesMap[row.actor_id] ?? null : null,
      })),
    )
  }, [submissionId, editorNamesMap])

  useEffect(() => {
    fetchLiveAuditEvents()
  }, [fetchLiveAuditEvents, refreshKey])

  const events = liveEvents

  return (
    <div className="pt-4 border-t border-zinc-200 space-y-3 dark:border-white/10">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-emerald-700 dark:text-[#D9FF43]" aria-hidden="true" />
          <h5 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
            سجل التدقيق الزمني غير القابل للتعديل
          </h5>
        </div>

        {(
          <button
            type="button"
            onClick={fetchLiveAuditEvents}
            disabled={loading}
            className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-900 cursor-pointer dark:text-zinc-400 dark:hover:text-white"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث السجل</span>
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          جارٍ جلب التسلسل الزمني للقرارات...
        </p>
      ) : errorMsg ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {errorMsg}
        </p>
      ) : events.length === 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          لا توجد أحداث تدقيق مسجلة لهذا المقترح بعد.
        </p>
      ) : (
        <ol className="relative ms-2 border-s border-zinc-300 space-y-3 ps-4 dark:border-white/15">
          {events.map((ev) => {
            const actorLabel =
              ev.actor_display_name ||
              (ev.actor_id ? editorNamesMap[ev.actor_id] || `معرف ${ev.actor_id.slice(0, 8)}` : 'النظام / المساهم')

            return (
              <li key={String(ev.id)} className="relative text-xs">
                <span
                  aria-hidden="true"
                  className="absolute -start-[21px] top-1.5 h-2.5 w-2.5 rounded-full border border-white bg-emerald-700 dark:border-[#0C0C10] dark:bg-[#D9FF43]"
                />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-zinc-950 dark:text-[#F5F5F7]">
                    {formatEventTitle(ev)}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                    {new Date(ev.occurred_at).toLocaleString('ar-MA')}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  الفاعل المسجل: {actorLabel}
                </p>
                {ev.editor_note && (
                  <p className="mt-1 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs leading-relaxed text-zinc-700 dark:border-white/10 dark:bg-[#07070A] dark:text-zinc-300">
                    {ev.editor_note}
                  </p>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
