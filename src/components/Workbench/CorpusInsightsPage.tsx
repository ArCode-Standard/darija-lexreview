import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Compass,
  Globe2,
  Layers,
  Sparkles,
} from 'lucide-react'
import type { LexicalEntry } from '../../types/lexicon'
import { formatAccessionCode } from '../../services/dataset'

interface CorpusInsightsPageProps {
  entries: LexicalEntry[]
  totalExamplesCount: number
  corpusVersion: string
  onEnrichEntry: (entry: LexicalEntry) => void
  onSelectCategoryInLexicon: (category: string) => void
  onSelectRegionInLexicon: (region: string) => void
  onStartRapidReview: () => void
}

type GapTab = 'missing_examples' | 'missing_french' | 'missing_region'

export function CorpusInsightsPage({
  entries,
  totalExamplesCount,
  corpusVersion,
  onEnrichEntry,
  onSelectCategoryInLexicon,
  onSelectRegionInLexicon,
  onStartRapidReview,
}: CorpusInsightsPageProps) {
  const [activeGapTab, setActiveGapTab] = useState<GapTab>('missing_examples')
  const [categorySort, setCategorySort] = useState<'gaps' | 'total'>('gaps')

  const stats = useMemo(() => {
    const total = entries.length || 1
    let withExamples = 0
    let withFrench = 0
    let withRegion = 0

    const missingExamplesList: LexicalEntry[] = []
    const missingFrenchList: LexicalEntry[] = []
    const missingRegionList: LexicalEntry[] = []

    const regionCounts = new Map<string, number>()
    const categoryStats = new Map<string, { total: number; withExamples: number }>()

    for (const entry of entries) {
      const hasEx = entry.examples.length > 0
      const hasFr = Boolean(entry.french && entry.french.trim().length > 0)
      const hasReg = Boolean(entry.region && entry.region.length > 0)

      if (hasEx) withExamples++
      else missingExamplesList.push(entry)

      if (hasFr) withFrench++
      else missingFrenchList.push(entry)

      if (hasReg) {
        withRegion++
        for (const r of entry.region ?? []) {
          regionCounts.set(r, (regionCounts.get(r) ?? 0) + 1)
        }
      } else {
        missingRegionList.push(entry)
      }

      const cat = entry.category || 'غير مصنف'
      const cur = categoryStats.get(cat) ?? { total: 0, withExamples: 0 }
      cur.total += 1
      if (hasEx) cur.withExamples += 1
      categoryStats.set(cat, cur)
    }

    const sortedRegions = Array.from(regionCounts.entries())
      .map(([region, count]) => ({
        region,
        count,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)

    const categoriesArray = Array.from(categoryStats.entries()).map(([category, val]) => {
      const missing = val.total - val.withExamples
      const coveragePct = val.total > 0 ? Math.round((val.withExamples / val.total) * 100) : 0
      return {
        category,
        total: val.total,
        withExamples: val.withExamples,
        missing,
        coveragePct,
      }
    })

    return {
      totalEntries: entries.length,
      withExamples,
      withFrench,
      withRegion,
      examplesPct: Math.round((withExamples / total) * 100),
      frenchPct: Math.round((withFrench / total) * 100),
      regionPct: Math.round((withRegion / total) * 100),
      missingExamplesList,
      missingFrenchList,
      missingRegionList,
      sortedRegions,
      categoriesArray,
    }
  }, [entries])

  const sortedCategories = useMemo(() => {
    const copy = [...stats.categoriesArray]
    if (categorySort === 'gaps') {
      copy.sort((a, b) => b.missing - a.missing || b.total - a.total)
    } else {
      copy.sort((a, b) => b.total - a.total)
    }
    return copy.slice(0, 14)
  }, [stats.categoriesArray, categorySort])

  const activeQueue = useMemo(() => {
    if (activeGapTab === 'missing_examples') return stats.missingExamplesList.slice(0, 18)
    if (activeGapTab === 'missing_french') return stats.missingFrenchList.slice(0, 18)
    return stats.missingRegionList.slice(0, 18)
  }, [activeGapTab, stats])

  return (
    <div className="space-y-8">
      {/* 1. Architectural Telemetry Matrix */}
      <section aria-label="مؤشرات تغطية المعجم" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/12 dark:bg-[#0B0B10]">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-zinc-500 dark:text-zinc-400">
            CORPUS VOLUME · v{corpusVersion}
          </p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-zinc-950 dark:text-white">
            {stats.totalEntries.toLocaleString('en-US')}
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            مدخل معجمي منشور · {totalExamplesCount.toLocaleString('en-US')} شاهد سياقي
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/12 dark:bg-[#0B0B10]">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-emerald-700 dark:text-[#D9FF43]">
            CONTEXTUAL EXAMPLES
          </p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-emerald-700 dark:text-[#D9FF43]">
            {stats.examplesPct}%
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            {stats.withExamples.toLocaleString('en-US')} مفردة موثقة بشواهد ·{' '}
            {stats.missingExamplesList.length.toLocaleString('en-US')} بانتظار الإثراء
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/12 dark:bg-[#0B0B10]">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-zinc-500 dark:text-zinc-400">
            BILINGUAL GLOSS (AR / FR)
          </p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-zinc-950 dark:text-white">
            {stats.frenchPct}%
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            تغطية المقابل الفرنسي الدقيق ({stats.withFrench.toLocaleString('en-US')} مدخل)
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/12 dark:bg-[#0B0B10]">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-zinc-500 dark:text-zinc-400">
            REGIONAL DIALECT MAP
          </p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-zinc-950 dark:text-white">
            {stats.regionPct}%
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            محددة التوزيع اللهجي الجهوي ({stats.withRegion.toLocaleString('en-US')} مدخل)
          </p>
        </div>
      </section>

      {/* 2. Two-Column Coverage Map: Moroccan Regions & Semantic Categories */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
        {/* Regional Dialect Distribution */}
        <section
          aria-labelledby="regional-coverage-heading"
          className="min-w-0 xl:col-span-5 rounded-2xl border border-zinc-200 bg-white p-6 space-y-5 dark:border-white/12 dark:bg-[#0B0B10]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-emerald-700 dark:text-[#D9FF43]">
                01 · REGIONAL DISTRIBUTION
              </p>
              <h2
                id="regional-coverage-heading"
                className="mt-1 font-display text-lg font-bold text-zinc-950 dark:text-white"
              >
                التوزيع اللهجي عبر جهات المغرب
              </h2>
            </div>
            <Globe2 className="h-5 w-5 text-emerald-700 dark:text-[#D9FF43]" />
          </div>

          {stats.sortedRegions.length > 0 ? (
            <div className="space-y-3">
              {stats.sortedRegions.map((item) => (
                <button
                  key={item.region}
                  type="button"
                  onClick={() => onSelectRegionInLexicon(item.region)}
                  className="group w-full text-start rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3 hover:border-zinc-950 transition-colors cursor-pointer dark:border-white/10 dark:bg-[#07070A] dark:hover:border-[#D9FF43]/60"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-900 group-hover:text-emerald-700 dark:text-zinc-100 dark:group-hover:text-[#D9FF43]">
                      {item.region}
                    </span>
                    <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                      {item.count.toLocaleString('en-US')} مفردة ({item.pct}%)
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-emerald-600 dark:bg-[#D9FF43]"
                      style={{ width: `${Math.max(4, Math.min(100, item.pct))}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-5 text-xs leading-6 text-zinc-600 dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-400">
              معظم مداخل النسخة الحالية مصنفة كتداول مغربي مشترك، وتنتظر التحديد الجهوي الدقيق من المراجعين عبر جلسات التدقيق السريع.
              <div className="mt-3">
                <button
                  type="button"
                  onClick={onStartRapidReview}
                  className="inline-flex items-center gap-1.5 font-bold text-emerald-700 hover:underline cursor-pointer dark:text-[#D9FF43]"
                >
                  <span>ساهم في وسم الانتشار الجهوي</span>
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {stats.missingRegionList.length > 0 && (
            <p className="border-t border-zinc-200 pt-3 text-[11px] text-zinc-500 dark:border-white/10 dark:text-zinc-400">
              توجد <strong className="font-mono text-zinc-900 dark:text-white">{stats.missingRegionList.length.toLocaleString('en-US')}</strong> مفردة بدون وسم جهوي تفصيلي بعد — يمكنك اختيارها من قائمة الأولويات أدناه.
            </p>
          )}
        </section>

        {/* Semantic Category Example Completeness */}
        <section
          aria-labelledby="category-completeness-heading"
          className="min-w-0 xl:col-span-7 rounded-2xl border border-zinc-200 bg-white p-6 space-y-5 dark:border-white/12 dark:bg-[#0B0B10]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-emerald-700 dark:text-[#D9FF43]">
                02 · SEMANTIC FIELD COMPLETENESS
              </p>
              <h2
                id="category-completeness-heading"
                className="mt-1 font-display text-lg font-bold text-zinc-950 dark:text-white"
              >
                اكتمال الشواهد السياقية حسب الحقول الدلالية
              </h2>
            </div>

            <div className="inline-flex rounded-xl border border-zinc-200 bg-zinc-100 p-1 text-xs dark:border-white/10 dark:bg-[#07070A]">
              <button
                type="button"
                onClick={() => setCategorySort('gaps')}
                className={`rounded-lg px-3 py-1 font-semibold cursor-pointer ${
                  categorySort === 'gaps'
                    ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                الأكثر حاجةً للشواهد
              </button>
              <button
                type="button"
                onClick={() => setCategorySort('total')}
                className={`rounded-lg px-3 py-1 font-semibold cursor-pointer ${
                  categorySort === 'total'
                    ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                الأكبر حجماً
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {sortedCategories.map((cat) => (
              <button
                key={cat.category}
                type="button"
                onClick={() => onSelectCategoryInLexicon(cat.category)}
                className="group flex flex-col justify-between rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5 text-start hover:border-zinc-950 transition-colors cursor-pointer dark:border-white/10 dark:bg-[#07070A] dark:hover:border-[#D9FF43]/60"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-display text-xs font-bold text-zinc-900 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-[#D9FF43]">
                    {cat.category}
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-[#D9FF43]">
                    {cat.coveragePct}%
                  </span>
                </div>

                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-600 dark:bg-[#D9FF43]"
                    style={{ width: `${Math.max(3, cat.coveragePct)}%` }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span>
                    <strong className="font-mono text-zinc-800 dark:text-zinc-200">{cat.withExamples}</strong> /{' '}
                    <span className="font-mono">{cat.total}</span> بشاهد
                  </span>
                  {cat.missing > 0 ? (
                    <span className="text-amber-700 dark:text-amber-300">
                      ينقص {cat.missing}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-[#D9FF43]">
                      <CheckCircle2 className="h-3 w-3" /> مكتمل
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* 3. Actionable Priority Enrichment Queue */}
      <section
        aria-labelledby="priority-queue-heading"
        className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-7 space-y-5 dark:border-white/12 dark:bg-[#0B0B10]"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-zinc-200 pb-5 dark:border-white/10">
          <div>
            <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-emerald-700 dark:text-[#D9FF43]">
              03 · ACTIONABLE ENRICHMENT QUEUE
            </p>
            <h2
              id="priority-queue-heading"
              className="mt-1 font-display text-xl font-bold text-zinc-950 dark:text-white"
            >
              أولويات الإثراء المباشر — اختر مفردة وأكمل توثيقها بضغطة واحدة
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
              تُستخرج هذه القائمة آلياً من المتن العام المنشور لتوجيه جهد المساهمين نحو الفجوات المعجمية الأعلى أثراً.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="نوع فجوة التوثيق"
            className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 text-xs dark:border-white/10 dark:bg-[#07070A]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeGapTab === 'missing_examples'}
              onClick={() => setActiveGapTab('missing_examples')}
              className={`rounded-lg px-3 py-1.5 font-semibold cursor-pointer ${
                activeGapTab === 'missing_examples'
                  ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              بلا شواهد ({stats.missingExamplesList.length.toLocaleString('en-US')})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeGapTab === 'missing_french'}
              onClick={() => setActiveGapTab('missing_french')}
              className={`rounded-lg px-3 py-1.5 font-semibold cursor-pointer ${
                activeGapTab === 'missing_french'
                  ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              بلا مقابل فرنسي ({stats.missingFrenchList.length.toLocaleString('en-US')})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeGapTab === 'missing_region'}
              onClick={() => setActiveGapTab('missing_region')}
              className={`rounded-lg px-3 py-1.5 font-semibold cursor-pointer ${
                activeGapTab === 'missing_region'
                  ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              بلا تحديد جهوي ({stats.missingRegionList.length.toLocaleString('en-US')})
            </button>
          </div>
        </div>

        {activeQueue.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {activeQueue.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 transition-colors hover:border-zinc-400 dark:border-white/10 dark:bg-[#07070A] dark:hover:border-white/25"
              >
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-lg font-bold text-zinc-950 dark:text-white">
                      {entry.word}
                    </span>
                    <span dir="ltr" className="font-mono text-[11px] text-zinc-400">
                      {formatAccessionCode(entry.id, entry.numericId)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {entry.latin && (
                      <span dir="ltr" className="font-mono text-emerald-700 dark:text-[#D9FF43]">
                        {entry.latin}
                      </span>
                    )}
                    <span className="text-zinc-300 dark:text-white/20">·</span>
                    <span className="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                      <Layers className="h-3 w-3" />
                      {entry.category}
                    </span>
                  </div>

                  <p className="line-clamp-2 text-xs leading-6 text-zinc-600 dark:text-zinc-300">
                    {entry.meaning || 'بانتظار توثيق المعنى'}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-zinc-200/80 pt-3 dark:border-white/8">
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
                    <Compass className="h-3 w-3" />
                    {activeGapTab === 'missing_examples'
                      ? 'ينقصها شاهد سياقي'
                      : activeGapTab === 'missing_french'
                        ? 'ينقصها المقابل الفرنسي'
                        : 'ينقصها التحديد الجهوي'}
                  </span>

                  <button
                    type="button"
                    onClick={() => onEnrichEntry(entry)}
                    className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full bg-zinc-950 px-3.5 py-1 text-xs font-bold text-white hover:bg-zinc-800 transition-colors cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>أثرِ المفردة</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-50/60 p-5 text-xs text-emerald-950 dark:border-[#D9FF43]/30 dark:bg-[#D9FF43]/10 dark:text-[#D9FF43]">
            <BookOpen className="h-5 w-5 shrink-0" />
            <span>جميع مفردات المتن الحالي مكتملة في هذا المحور!</span>
          </div>
        )}
      </section>
    </div>
  )
}
