import { useMemo, useState } from 'react'
import { Globe2, MapPin, Search, TrendingUp } from 'lucide-react'
import type { LexicalEntry } from '../types/lexicon'
import { MOROCCAN_REGIONS } from '../utils/validation'

interface DialectRegionHeatmapProps {
  entries: LexicalEntry[]
  onSelectRegionFilter?: (region: string) => void
  darkMode?: boolean
}

export function DialectRegionHeatmap({
  entries,
  onSelectRegionFilter,
}: DialectRegionHeatmapProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const regionStats = useMemo(() => {
    const statsMap = new Map<string, { count: number; categories: Set<string>; sampleWords: string[] }>()

    for (const r of MOROCCAN_REGIONS) {
      statsMap.set(r, { count: 0, categories: new Set(), sampleWords: [] })
    }
    // Also include general fallback
    statsMap.set('تداول مغربي عام', { count: 0, categories: new Set(), sampleWords: [] })

    for (const entry of entries) {
      const regions = entry.region && entry.region.length > 0 ? entry.region : ['تداول مغربي عام']
      for (const reg of regions) {
        const existing = statsMap.get(reg) || { count: 0, categories: new Set(), sampleWords: [] }
        existing.count += 1
        if (entry.category) existing.categories.add(entry.category)
        if (existing.sampleWords.length < 5 && entry.word) {
          existing.sampleWords.push(entry.word)
        }
        statsMap.set(reg, existing)
      }
    }

    const list = Array.from(statsMap.entries()).map(([region, data]) => ({
      region,
      count: data.count,
      categoriesCount: data.categories.size,
      sampleWords: data.sampleWords,
    }))

    const maxCount = Math.max(1, ...list.map((item) => item.count))

    return list
      .map((item) => ({
        ...item,
        percentage: Math.round((item.count / maxCount) * 100),
      }))
      .sort((a, b) => b.count - a.count)
  }, [entries])

  const filteredRegions = useMemo(() => {
    if (!searchTerm.trim()) return regionStats
    const q = searchTerm.trim().toLowerCase()
    return regionStats.filter(
      (item) =>
        item.region.toLowerCase().includes(q) ||
        item.sampleWords.some((w) => w.toLowerCase().includes(q)),
    )
  }, [regionStats, searchTerm])

  const totalIndexed = useMemo(() => entries.length, [entries.length])

  return (
    <section
      aria-label="خريطة التوزيع الجغرافي للهجات المغربية"
      className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-7 shadow-xs dark:border-white/10 dark:bg-[#0B0B10]"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-5 dark:border-white/8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-600/25 bg-emerald-50 text-emerald-700 dark:border-[#D9FF43]/30 dark:bg-[#D9FF43]/10 dark:text-[#D9FF43]">
            <Globe2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base sm:text-lg font-bold text-zinc-950 dark:text-white">
                خريطة التوزيع الجغرافي للهجات وجهات المغرب
              </h3>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-900 dark:bg-[#D9FF43]/20 dark:text-[#D9FF43]">
                تحليل الكثافة التوثيقية ({totalIndexed} مدخل)
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              توزيع المفردات والشواهد المعجمية بحسب الجهات والمناطق الثقافية في المتن المفتوح
            </p>
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث عن جهة أو مفردة مكانية..."
            className="w-full min-h-[38px] rounded-xl border border-zinc-200 bg-zinc-50 pe-3 ps-9 text-xs text-zinc-900 focus:border-zinc-950 focus:outline-hidden dark:border-white/12 dark:bg-[#07070A] dark:text-zinc-100"
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredRegions.map((item) => (
          <div
            key={item.region}
            onClick={() => onSelectRegionFilter?.(item.region)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelectRegionFilter?.(item.region)
              }
            }}
            className={`group flex flex-col justify-between rounded-xl border p-4 transition-all hover:border-emerald-600 hover:shadow-sm cursor-pointer ${
              item.percentage > 70 
                ? 'bg-emerald-500/10 border-emerald-500/20 dark:bg-emerald-400/15 dark:border-emerald-400/30'
                : item.percentage > 30
                  ? 'bg-amber-500/5 border-amber-500/15 dark:bg-amber-400/10 dark:border-amber-400/25'
                  : 'bg-zinc-50/60 border-zinc-200 dark:bg-[#07070A] dark:border-white/10'
            } dark:hover:border-[#D9FF43]/60`}
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-700 dark:text-[#D9FF43]" />
                  <h4 className="font-display text-sm font-bold text-zinc-950 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-[#D9FF43]">
                    {item.region}
                  </h4>
                </div>
                <span className="font-mono text-xs font-bold text-emerald-800 dark:text-[#D9FF43]">
                  {item.count} مدخل
                </span>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                  <span>نسبة التوثيق الإقليمي</span>
                  <span className="font-mono font-semibold">{item.percentage}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all dark:bg-[#D9FF43]"
                    style={{ width: `${Math.max(8, item.percentage)}%` }}
                  ></div>
                </div>
              </div>

              {item.sampleWords.length > 0 && (
                <div className="mt-3.5 flex flex-wrap items-center gap-1.5 pt-3 border-t border-zinc-200/60 dark:border-white/8">
                  <span className="text-[10.5px] text-zinc-400">نماذج:</span>
                  {item.sampleWords.slice(0, 4).map((w) => (
                    <span
                      key={w}
                      className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 font-display text-[11px] font-semibold text-zinc-800 dark:border-white/10 dark:bg-[#0C0C10] dark:text-zinc-200"
                    >
                      {w}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                <span>{item.categoriesCount} حقول دلالية</span>
              </span>
              <span className="text-emerald-700 group-hover:underline font-semibold dark:text-[#D9FF43]">
                استعراض الجهة ←
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
