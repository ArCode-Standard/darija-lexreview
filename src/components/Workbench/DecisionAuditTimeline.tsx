import { useCallback, useEffect, useState } from 'react'
import { History, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { ReviewDecisionEvent, SubmissionStatus } from '../../types/lexicon'
import { formatStatusLabel } from '../../services/dataset'

interface DecisionAuditTimelineProps {
  submissionId: string
  queueSource: 'live' | 'sandbox'
  sandboxEvents: ReviewDecisionEvent[]
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
  const fromLabel = ev.previous_status ? formatStatusLabel(ev.previous_status) : 'غير محدد'
  const toLabel = formatStatusLabel(ev.new_status)
  if (ev.previous_status === 'accepted' && ev.new_status !== 'accepted') {
    return `سحب الاعتماد وإعادة الفتح: ${fromLabel} ← ${toLabel}`
  }
  return `قرار تحكيمي: ${fromLabel} ← ${toLabel}`
}

export function DecisionAuditTimeline({
  submissionId,
  queueSource,
  sandboxEvents,
  editorNamesMap,
  refreshKey,
}: DecisionAuditTimelineProps) {
  const [liveEvents, setLiveEvents] = useState<ReviewDecisionEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchLiveAuditEvents = useCallback(async () => {
    if (queueSource !== 'live' || !supabase || !submissionId) {
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
      setErrorMsg(error.message)
      return
    }
    setLiveEvents(
      ((data ?? []) as Array<{
        id: number
        submission_id: string
        actor_id: string | null
        event_type: 'baseline' | 'submitted' | 'decision'
        previous_status: SubmissionStatus | null
        new_status: SubmissionStatus
        editor_note: string | null
        occurred_at: string
      }>).map((row) => ({
        ...row,
        actor_display_name: row.actor_id ? editorNamesMap[row.actor_id] ?? null : null,
      })),
    )
  }, [queueSource, submissionId, editorNamesMap])

  useEffect(() => {
    if (queueSource === 'live') {
      fetchLiveAuditEvents()
    }
  }, [queueSource, fetchLiveAuditEvents, refreshKey])

  const events: ReviewDecisionEvent[] =
    queueSource === 'live'
      ? liveEvents
      : sandboxEvents
          .filter((e) => e.submission_id === submissionId)
          .sort(
            (a, b) =>
              new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
          )

  return (
    <div className="pt-4 border-t border-[#E5DFD3] space-y-3 dark:border-[#2E2B27]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[#0F5C4E] dark:text-[#4FD1C5]" aria-hidden="true" />
          <h5 className="text-xs font-semibold text-stone-800 dark:text-stone-200">
            سجل التدقيق غير القابل للتعديل (review_decision_events)
          </h5>
        </div>

        {queueSource === 'live' && (
          <button
            type="button"
            onClick={fetchLiveAuditEvents}
            disabled={loading}
            className="inline-flex items-center gap-1 text-[11px] text-stone-500 hover:text-stone-800 cursor-pointer dark:text-stone-400 dark:hover:text-stone-200"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث السجل</span>
          </button>
        )}
      </div>

      {loading && queueSource === 'live' ? (
        <p className="text-xs text-stone-500 dark:text-stone-400">
          جارٍ جلب التسلسل الزمني للقرارات...
        </p>
      ) : errorMsg && queueSource === 'live' ? (
        <p className="text-xs text-stone-500 dark:text-stone-400">
          تعذر عرض سجل القرارات التفصيلي ({errorMsg}).
        </p>
      ) : events.length === 0 ? (
        <p className="text-xs text-stone-500 dark:text-stone-400">
          لا توجد أحداث تدقيق مسجلة لهذا المقترح بعد.
        </p>
      ) : (
        <ol className="relative ms-2 border-s border-[#D6CEBE] space-y-3 ps-4 dark:border-[#3A3530]">
          {events.map((ev) => {
            const actorLabel =
              ev.actor_display_name ||
              (ev.actor_id ? editorNamesMap[ev.actor_id] || `معرف ${ev.actor_id.slice(0, 8)}` : 'النظام / المساهم')

            return (
              <li key={String(ev.id)} className="relative text-xs">
                <span
                  aria-hidden="true"
                  className="absolute -start-[21px] top-1.5 h-2.5 w-2.5 rounded-full border border-white bg-[#0F5C4E] dark:border-[#1C1A18] dark:bg-[#4FD1C5]"
                />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-stone-900 dark:text-stone-100">
                    {formatEventTitle(ev)}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-stone-500 dark:text-stone-400">
                    {new Date(ev.occurred_at).toLocaleString('ar-MA')}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-stone-500 dark:text-stone-400">
                  الفاعل المسجل: {actorLabel}
                </p>
                {ev.editor_note && (
                  <p className="mt-1 rounded-md border border-[#E5DFD3] bg-[#FBF9F5] px-2.5 py-1.5 text-xs leading-relaxed text-stone-700 dark:border-[#2E2B27] dark:bg-[#141312] dark:text-stone-300">
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
