import { useEffect, useMemo, useState } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { SubmissionRecord } from '../../types/lexicon'
import { isNewEntrySubmission } from '../../services/exporter'

interface ModerationAnalyticsDashboardProps {
  submissions: SubmissionRecord[]
  editorNamesMap: Record<string, string>
  queueSource: 'live' | 'sandbox'
}

type RangeFilter = 'all' | '7d' | '30d'

function formatDurationArabic(hours: number | null): string {
  if (hours === null || Number.isNaN(hours)) return '—'
  if (hours < 1) {
    const mins = Math.max(1, Math.round(hours * 60))
    return `${mins} دقيقة`
  }
  return `${hours.toFixed(1)} ساعة`
}

export function ModerationAnalyticsDashboard({
  submissions,
  editorNamesMap,
  queueSource,
}: ModerationAnalyticsDashboardProps) {
  const [range, setRange] = useState<RangeFilter>('all')
  const [collapsed, setCollapsed] = useState(false)
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined'
      ? document.documentElement.classList.contains('dark')
      : false,
  )

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains('dark'))
    })
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // Reference anchor timestamp: use max timestamp in dataset so relative 7d/30d filters work accurately
  const referenceTimestamp = useMemo(() => {
    let maxTs = Date.now()
    for (const s of submissions) {
      const t = new Date(s.created_at).getTime()
      if (!Number.isNaN(t) && t > maxTs) maxTs = t
    }
    // If all items are older than current wall clock (e.g. sandbox fixtures), anchor to latest item
    if (submissions.length > 0) {
      const latestItemTs = Math.max(
        ...submissions
          .map((s) => Math.max(new Date(s.created_at).getTime(), new Date(s.updated_at).getTime()))
          .filter((n) => !Number.isNaN(n)),
      )
      if (Number.isFinite(latestItemTs)) {
        maxTs = latestItemTs
      }
    }
    return maxTs
  }, [submissions])

  const filteredSubmissions = useMemo(() => {
    if (range === 'all') return submissions
    const windowMs = (range === '7d' ? 7 : 30) * 24 * 60 * 60 * 1000
    return submissions.filter((s) => {
      const created = new Date(s.created_at).getTime()
      return !Number.isNaN(created) && referenceTimestamp - created <= windowMs
    })
  }, [submissions, range, referenceTimestamp])

  const analytics = useMemo(() => {
    let total = 0
    let newEntriesProposed = 0
    let existingEditsProposed = 0
    let accepted = 0
    let merged = 0
    let pending = 0
    let needsChanges = 0
    let rejected = 0

    const responseHoursList: number[] = []
    const timelineMap = new Map<
      string,
      { dateKey: string; label: string; proposed: number; accepted: number; decided: number }
    >()

    const kindBreakdown = {
      edit: { name: 'تعديل مدخل', accepted: 0, pending: 0, needsChanges: 0, rejected: 0 },
      newEntry: { name: 'مفردة جديدة', accepted: 0, pending: 0, needsChanges: 0, rejected: 0 },
    }

    const editorMap = new Map<
      string,
      {
        editorKey: string
        editorName: string
        decidedCount: number
        acceptedCount: number
        returnedOrRejectedCount: number
        totalResponseHours: number
        timedCount: number
      }
    >()

    for (const sub of filteredSubmissions) {
      total += 1
      const isNew = isNewEntrySubmission(sub)
      if (isNew) newEntriesProposed += 1
      else existingEditsProposed += 1

      const targetBucket = isNew ? kindBreakdown.newEntry : kindBreakdown.edit

      if (sub.status === 'accepted' || sub.status === 'merged') {
        accepted += 1
        if (sub.status === 'merged') merged += 1
        targetBucket.accepted += 1
      } else if (sub.status === 'pending') {
        pending += 1
        targetBucket.pending += 1
      } else if (sub.status === 'needs_changes') {
        needsChanges += 1
        targetBucket.needsChanges += 1
      } else if (sub.status === 'rejected') {
        rejected += 1
        targetBucket.rejected += 1
      }

      // Daily timeline aggregation by created_at & updated_at
      const createdDate = new Date(sub.created_at)
      if (!Number.isNaN(createdDate.getTime())) {
        const cKey = createdDate.toISOString().slice(0, 10)
        const cur = timelineMap.get(cKey) ?? {
          dateKey: cKey,
          label: cKey.slice(5),
          proposed: 0,
          accepted: 0,
          decided: 0,
        }
        cur.proposed += 1
        timelineMap.set(cKey, cur)
      }

      if (sub.status !== 'pending') {
        const createdMs = new Date(sub.created_at).getTime()
        const updatedMs = new Date(sub.updated_at).getTime()
        let deltaHours: number | null = null

        if (!Number.isNaN(createdMs) && !Number.isNaN(updatedMs) && updatedMs >= createdMs) {
          deltaHours = (updatedMs - createdMs) / (1000 * 60 * 60)
          responseHoursList.push(deltaHours)
        }

        const updatedDate = new Date(sub.updated_at)
        if (!Number.isNaN(updatedDate.getTime())) {
          const uKey = updatedDate.toISOString().slice(0, 10)
          const uCur = timelineMap.get(uKey) ?? {
            dateKey: uKey,
            label: uKey.slice(5),
            proposed: 0,
            accepted: 0,
            decided: 0,
          }
          uCur.decided += 1
          if (sub.status === 'accepted' || sub.status === 'merged') uCur.accepted += 1
          timelineMap.set(uKey, uCur)
        }

        const rawEditorId = sub.editor_id || 'unassigned-editor'
        const resolvedName =
          sub.editor_display_name?.trim() ||
          editorNamesMap[rawEditorId] ||
          (rawEditorId === 'unassigned-editor'
            ? 'محرر غير مسمى'
            : `محرر #${rawEditorId.slice(0, 6)}`)

        const edStat = editorMap.get(rawEditorId) ?? {
          editorKey: rawEditorId,
          editorName: resolvedName,
          decidedCount: 0,
          acceptedCount: 0,
          returnedOrRejectedCount: 0,
          totalResponseHours: 0,
          timedCount: 0,
        }
        edStat.decidedCount += 1
        if (sub.status === 'accepted' || sub.status === 'merged') edStat.acceptedCount += 1
        else edStat.returnedOrRejectedCount += 1

        if (deltaHours !== null) {
          edStat.totalResponseHours += deltaHours
          edStat.timedCount += 1
        }
        editorMap.set(rawEditorId, edStat)
      }
    }

    const decidedTotal = accepted + needsChanges + rejected
    const acceptanceRate =
      decidedTotal > 0 ? Math.round((accepted / decidedTotal) * 100) : 0

    const avgResponseHours =
      responseHoursList.length > 0
        ? responseHoursList.reduce((acc, h) => acc + h, 0) / responseHoursList.length
        : null

    const sortedHours = [...responseHoursList].sort((a, b) => a - b)
    const medianResponseHours =
      sortedHours.length > 0
        ? sortedHours[Math.floor(sortedHours.length / 2)]
        : null

    const timelineData = Array.from(timelineMap.values()).sort((a, b) =>
      a.dateKey.localeCompare(b.dateKey),
    )

    const editorLeaderboard = Array.from(editorMap.values())
      .map((ed) => ({
        ...ed,
        avgHours: ed.timedCount > 0 ? ed.totalResponseHours / ed.timedCount : null,
      }))
      .sort((a, b) => b.decidedCount - a.decidedCount)

    return {
      total,
      newEntriesProposed,
      existingEditsProposed,
      accepted,
      merged,
      pending,
      needsChanges,
      rejected,
      decidedTotal,
      acceptanceRate,
      avgResponseHours,
      medianResponseHours,
      timelineData,
      kindChartData: [kindBreakdown.edit, kindBreakdown.newEntry],
      editorLeaderboard,
    }
  }, [filteredSubmissions, editorNamesMap])

  const axisColor = isDark ? '#A8A29E' : '#57534E'
  const gridColor = isDark ? '#2E2B27' : '#E5DFD3'
  const tealColor = isDark ? '#2DD4BF' : '#0F5C4E'
  const stoneBarColor = isDark ? '#78716C' : '#8C8273'
  const amberColor = isDark ? '#F59E0B' : '#B45309'
  const redColor = isDark ? '#F87171' : '#B91C1C'

  return (
    <section
      aria-label="لوحة إحصائيات نشاط المحررين"
      className="rounded-xl border border-[#E5DFD3] bg-white p-5 sm:p-6 dark:border-[#2E2B27] dark:bg-[#1C1A18]"
    >
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#E5DFD3] dark:border-[#2E2B27]">
        <div>
          <p className="text-xs font-semibold text-[#0F5C4E] dark:text-[#4FD1C5]">
            مؤشرات الأداء التحريري · {queueSource === 'live' ? 'سجل Supabase الحي' : 'بيئة المحاكاة التحريرية'}
          </p>
          <h4 className="mt-1 font-display text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100">
            لوحة إحصائيات التحكيم وزمن استجابة المحررين
          </h4>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="النطاق الزمني للإحصائيات"
            className="inline-flex items-center gap-1 rounded-lg border border-[#E5DFD3] bg-[#F3EFE6] p-1 dark:border-[#2E2B27] dark:bg-[#141312]"
          >
            {(
              [
                ['all', 'كل الفترات'],
                ['30d', 'آخر ٣٠ يوماً'],
                ['7d', 'آخر ٧ أيام'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setRange(val)}
                className={`min-h-[30px] rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  range === val
                    ? 'bg-white text-stone-900 shadow-2xs dark:bg-[#2A2622] dark:text-stone-100'
                    : 'text-stone-600 hover:text-stone-900 dark:text-stone-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-[#EFECE4] whitespace-nowrap shrink-0 cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-300"
          >
            {collapsed ? (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                <span>عرض الرسوم البيانية</span>
              </>
            ) : (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                <span>طي الرسوم</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4-Column Operational KPI Strip */}
      <dl className="grid grid-cols-2 gap-y-5 py-5 lg:grid-cols-4 border-b border-[#E5DFD3] dark:border-[#2E2B27]">
        <div className="pe-4 lg:border-e lg:border-[#E5DFD3] lg:dark:border-[#2E2B27]">
          <dt className="text-xs text-stone-500 dark:text-stone-400">
            إجمالي المداخل المقترحة
          </dt>
          <dd className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-stone-900 dark:text-stone-100">
            {analytics.total.toLocaleString('en-US')}
          </dd>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
            تعديل: <span className="font-mono tabular-nums">{analytics.existingEditsProposed}</span> · جديدة:{' '}
            <span className="font-mono tabular-nums">{analytics.newEntriesProposed}</span>
          </p>
        </div>

        <div className="ps-4 lg:px-6 lg:border-e lg:border-[#E5DFD3] lg:dark:border-[#2E2B27]">
          <dt className="text-xs text-stone-500 dark:text-stone-400">
            المداخل المعتمدة للدمج
          </dt>
          <dd className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-[#0F5C4E] dark:text-[#4FD1C5]">
            {analytics.accepted.toLocaleString('en-US')}
          </dd>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
            معدل الاعتماد:{' '}
            <span className="font-mono tabular-nums">{analytics.acceptanceRate}%</span>
            {analytics.merged > 0 ? (
              <>
                {' '}· مدمج رسمياً:{' '}
                <span className="font-mono tabular-nums">{analytics.merged}</span>
              </>
            ) : (
              ' من المحسوم'
            )}
          </p>
        </div>

        <div className="pe-4 pt-4 border-t border-[#E5DFD3] lg:pt-0 lg:border-t-0 lg:px-6 lg:border-e lg:border-[#E5DFD3] dark:border-[#2E2B27] lg:dark:border-[#2E2B27]">
          <dt className="text-xs text-stone-500 dark:text-stone-400">
            بانتظار التحكيم أو التعديل
          </dt>
          <dd className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-stone-900 dark:text-stone-100">
            {analytics.pending.toLocaleString('en-US')}
          </dd>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
            للتعديل: <span className="font-mono tabular-nums">{analytics.needsChanges}</span> · مرفوض:{' '}
            <span className="font-mono tabular-nums">{analytics.rejected}</span>
          </p>
        </div>

        <div className="ps-4 pt-4 border-t border-[#E5DFD3] lg:pt-0 lg:border-t-0 lg:ps-6 dark:border-[#2E2B27]">
          <dt className="text-xs text-stone-500 dark:text-stone-400">
            متوسط زمن استجابة المحررين
          </dt>
          <dd className="mt-1.5 font-display text-2xl font-bold tabular-nums text-stone-900 dark:text-stone-100">
            {formatDurationArabic(analytics.avgResponseHours)}
          </dd>
          <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-400">
            الوسيط الزمني: {formatDurationArabic(analytics.medianResponseHours)}
          </p>
        </div>
      </dl>

      {/* Recharts Visual Panels */}
      {!collapsed && (
        <div className="pt-6 space-y-8">
          {filteredSubmissions.length === 0 ? (
            <div className="py-10 text-center text-xs text-stone-500 dark:text-stone-400">
              لا توجد بيانات مقترحات مسجلة ضمن النطاق الزمني المحدد لعرض الرسوم البيانية.
            </div>
          ) : (
            <>
              {/* Row 1: Timeline AreaChart + Kind Breakdown BarChart */}
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                <div className="lg:col-span-7 min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                    <h5 className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                      التدفق اليومي للمقترحات مقابل الاعتمادات
                    </h5>
                    <div className="flex items-center gap-3 text-[11px] text-stone-500 dark:text-stone-400">
                      <span>المقترحات الواردة</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-[#0F5C4E] dark:text-[#4FD1C5]">
                        المداخل المعتمدة
                      </span>
                    </div>
                  </div>

                  <div dir="ltr" className="h-[230px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={analytics.timelineData}
                        margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="tealFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={tealColor} stopOpacity={0.28} />
                            <stop offset="95%" stopColor={tealColor} stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="stoneFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={stoneBarColor} stopOpacity={0.22} />
                            <stop offset="95%" stopColor={stoneBarColor} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: axisColor, fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                          axisLine={{ stroke: gridColor }}
                          tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: axisColor, fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || payload.length === 0) return null
                            const row = payload[0]?.payload as {
                              dateKey: string
                              proposed: number
                              accepted: number
                              decided: number
                            }
                            return (
                              <div
                                dir="rtl"
                                className="rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-2 text-xs shadow-sm dark:border-[#3A3530] dark:bg-[#141312]"
                              >
                                <p className="font-mono font-semibold text-stone-900 dark:text-stone-100">
                                  {row.dateKey}
                                </p>
                                <p className="mt-1 text-stone-600 dark:text-stone-300">
                                  مقترحات واردة:{' '}
                                  <span className="font-mono font-semibold tabular-nums">
                                    {row.proposed}
                                  </span>
                                </p>
                                <p className="text-[#0F5C4E] dark:text-[#4FD1C5]">
                                  مداخل معتمدة:{' '}
                                  <span className="font-mono font-semibold tabular-nums">
                                    {row.accepted}
                                  </span>
                                </p>
                                <p className="text-stone-500 dark:text-stone-400">
                                  إجمالي المحسوم:{' '}
                                  <span className="font-mono tabular-nums">{row.decided}</span>
                                </p>
                              </div>
                            )
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="proposed"
                          name="المقترحات"
                          stroke={stoneBarColor}
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#stoneFill)"
                        />
                        <Area
                          type="monotone"
                          dataKey="accepted"
                          name="المعتمد"
                          stroke={tealColor}
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#tealFill)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="lg:col-span-5 min-w-0 lg:border-s lg:border-[#E5DFD3] lg:ps-8 lg:dark:border-[#2E2B27]">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                    <h5 className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                      حالات التحكيم حسب نوع المساهمة
                    </h5>
                    <span className="text-[11px] text-stone-500 dark:text-stone-400">
                      تعديل مدخل مقابل مفردة جديدة
                    </span>
                  </div>

                  <div dir="ltr" className="h-[230px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={analytics.kindChartData}
                        margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{
                            fill: axisColor,
                            fontSize: 11,
                            fontFamily: 'IBM Plex Sans Arabic',
                          }}
                          axisLine={{ stroke: gridColor }}
                          tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: axisColor, fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: isDark ? '#262320' : '#F3EFE6' }}
                          content={({ active, payload }) => {
                            if (!active || !payload || payload.length === 0) return null
                            const row = payload[0]?.payload as {
                              name: string
                              accepted: number
                              pending: number
                              needsChanges: number
                              rejected: number
                            }
                            return (
                              <div
                                dir="rtl"
                                className="rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-2 text-xs shadow-sm space-y-0.5 dark:border-[#3A3530] dark:bg-[#141312]"
                              >
                                <p className="font-display font-bold text-stone-900 dark:text-stone-100">
                                  {row.name}
                                </p>
                                <p className="text-[#0F5C4E] dark:text-[#4FD1C5]">
                                  معتمد: <span className="font-mono tabular-nums">{row.accepted}</span>
                                </p>
                                <p className="text-amber-800 dark:text-amber-300">
                                  قيد المراجعة:{' '}
                                  <span className="font-mono tabular-nums">{row.pending}</span>
                                </p>
                                <p className="text-stone-600 dark:text-stone-400">
                                  يحتاج تعديلاً:{' '}
                                  <span className="font-mono tabular-nums">{row.needsChanges}</span>
                                </p>
                                <p className="text-red-800 dark:text-red-300">
                                  مرفوض: <span className="font-mono tabular-nums">{row.rejected}</span>
                                </p>
                              </div>
                            )
                          }}
                        />
                        <Bar
                          dataKey="accepted"
                          name="معتمد"
                          fill={tealColor}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={28}
                        />
                        <Bar
                          dataKey="pending"
                          name="معلق"
                          fill={amberColor}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={28}
                        />
                        <Bar
                          dataKey="needsChanges"
                          name="للتعديل"
                          fill={stoneBarColor}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={28}
                        />
                        <Bar
                          dataKey="rejected"
                          name="مرفوض"
                          fill={redColor}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={28}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Row 2: Editor Activity Chart + Response Time Table */}
              <div className="pt-6 border-t border-[#E5DFD3] grid grid-cols-1 gap-8 lg:grid-cols-12 items-start dark:border-[#2E2B27]">
                <div className="lg:col-span-6 min-w-0">
                  <h5 className="text-xs font-semibold text-stone-800 mb-3 dark:text-stone-200">
                    حجم القرارات التحكيمية لكل محرر
                  </h5>

                  {analytics.editorLeaderboard.length === 0 ? (
                    <p className="py-8 text-xs text-stone-500 dark:text-stone-400">
                      لم تُحسم أي مقترحات بعد لاحتساب نشاط المحررين؛ اعتمد أو راجع مقترحاً من القائمة أدناه لتحديث المؤشر فوراً.
                    </p>
                  ) : (
                    <div dir="ltr" className="h-[210px] w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={analytics.editorLeaderboard}
                          margin={{ top: 4, right: 16, left: 12, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                          <XAxis
                            type="number"
                            allowDecimals={false}
                            tick={{ fill: axisColor, fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                            axisLine={{ stroke: gridColor }}
                            tickLine={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="editorName"
                            width={130}
                            tick={{
                              fill: axisColor,
                              fontSize: 11,
                              fontFamily: 'IBM Plex Sans Arabic',
                            }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            cursor={{ fill: isDark ? '#262320' : '#F3EFE6' }}
                            content={({ active, payload }) => {
                              if (!active || !payload || payload.length === 0) return null
                              const ed = payload[0]?.payload as {
                                editorName: string
                                acceptedCount: number
                                returnedOrRejectedCount: number
                                avgHours: number | null
                              }
                              return (
                                <div
                                  dir="rtl"
                                  className="rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-2 text-xs shadow-sm space-y-0.5 dark:border-[#3A3530] dark:bg-[#141312]"
                                >
                                  <p className="font-display font-bold text-stone-900 dark:text-stone-100">
                                    {ed.editorName}
                                  </p>
                                  <p className="text-[#0F5C4E] dark:text-[#4FD1C5]">
                                    مداخل معتمدة:{' '}
                                    <span className="font-mono tabular-nums">
                                      {ed.acceptedCount}
                                    </span>
                                  </p>
                                  <p className="text-stone-600 dark:text-stone-300">
                                    مرفوض / طلب تعديل:{' '}
                                    <span className="font-mono tabular-nums">
                                      {ed.returnedOrRejectedCount}
                                    </span>
                                  </p>
                                  <p className="text-stone-500 dark:text-stone-400">
                                    متوسط الاستجابة: {formatDurationArabic(ed.avgHours)}
                                  </p>
                                </div>
                              )
                            }}
                          />
                          <Bar
                            dataKey="acceptedCount"
                            stackId="decisions"
                            fill={tealColor}
                            maxBarSize={22}
                          />
                          <Bar
                            dataKey="returnedOrRejectedCount"
                            stackId="decisions"
                            fill={stoneBarColor}
                            radius={[0, 4, 4, 0]}
                            maxBarSize={22}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-6 min-w-0 lg:border-s lg:border-[#E5DFD3] lg:ps-8 lg:dark:border-[#2E2B27]">
                  <h5 className="text-xs font-semibold text-stone-800 mb-3 dark:text-stone-200">
                    سجل سرعة استجابة المحررين
                  </h5>

                  {analytics.editorLeaderboard.length === 0 ? (
                    <p className="py-8 text-xs text-stone-500 dark:text-stone-400">
                      ستظهر هنا أزمنة الاستجابة التفصيلية بمجرد تسجيل أول قرار تحكيمي.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-start border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-[#E5DFD3] text-stone-500 dark:border-[#2E2B27] dark:text-stone-400">
                            <th className="py-2 text-start font-medium">المحرر</th>
                            <th className="py-2 text-end font-medium">المعتمد</th>
                            <th className="py-2 text-end font-medium">المجموع المحسوم</th>
                            <th className="py-2 text-end font-medium">متوسط الاستجابة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5DFD3] dark:divide-[#2E2B27]">
                          {analytics.editorLeaderboard.map((ed) => (
                            <tr key={ed.editorKey}>
                              <td className="py-2.5 font-medium text-stone-900 dark:text-stone-100">
                                {ed.editorName}
                              </td>
                              <td className="py-2.5 text-end font-mono tabular-nums text-[#0F5C4E] dark:text-[#4FD1C5]">
                                {ed.acceptedCount}
                              </td>
                              <td className="py-2.5 text-end font-mono tabular-nums text-stone-700 dark:text-stone-300">
                                {ed.decidedCount}
                              </td>
                              <td className="py-2.5 text-end font-mono tabular-nums text-stone-700 dark:text-stone-300">
                                {formatDurationArabic(ed.avgHours)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}
