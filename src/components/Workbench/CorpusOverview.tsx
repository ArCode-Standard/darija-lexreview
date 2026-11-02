import { useMemo } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { LexicalEntry } from '../../types/lexicon'

interface CorpusOverviewProps {
  entries: LexicalEntry[]
  onSelectCategory: (category: string) => void
}

export function CorpusOverview({ entries, onSelectCategory }: CorpusOverviewProps) {
  const categoryStats = useMemo(() => {
    const map = new Map<string, { total: number; withExamples: number }>()
    for (const entry of entries) {
      const cat = entry.category || 'غير مصنف'
      const cur = map.get(cat) ?? { total: 0, withExamples: 0 }
      cur.total += 1
      if (entry.examples.length > 0) cur.withExamples += 1
      map.set(cat, cur)
    }
    return Array.from(map.entries())
      .map(([name, counts]) => ({
        name,
        total: counts.total,
        withExamples: counts.withExamples,
        coveragePct: counts.total > 0 ? Math.round((counts.withExamples / counts.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
  }, [entries])

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-8 dark:border-white/10 dark:bg-[#0C0C10]">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-white/10">
        <div>
          <h3 className="font-display text-xl font-bold text-zinc-950 dark:text-white">
            التوزيع الدلالي لفئات المعجم ({categoryStats.length.toLocaleString('en-US')})
          </h3>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            اختر أي فئة معجمية لعرض مفرداتها ومراجعة المداخل التي تحتاج إلى شواهد سياقية إضافية.
          </p>
        </div>
        <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          إجمالي المداخل: {entries.length.toLocaleString('en-US')}
        </span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-start border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 text-xs font-semibold text-zinc-500 dark:border-white/10 dark:text-zinc-400">
              <th className="py-3 text-start font-medium">الفئة الدلالية</th>
              <th className="py-3 text-end font-medium">عدد المداخل</th>
              <th className="py-3 text-end font-medium">مداخل بشاهد سياقي</th>
              <th className="py-3 text-end font-medium">تغطية الشواهد</th>
              <th className="py-3 text-end font-medium">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 text-xs dark:divide-white/8">
            {categoryStats.map((cat) => (
              <tr
                key={cat.name}
                className="hover:bg-zinc-50 transition-colors dark:hover:bg-white/[0.03]"
              >
                <td className="py-3.5 font-display font-semibold text-zinc-950 dark:text-white">
                  {cat.name}
                </td>
                <td className="py-3.5 text-end font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                  {cat.total.toLocaleString('en-US')}
                </td>
                <td className="py-3.5 text-end font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                  {cat.withExamples.toLocaleString('en-US')}
                </td>
                <td className="py-3.5 text-end font-mono tabular-nums text-zinc-600 dark:text-zinc-400">
                  {cat.coveragePct}%
                </td>
                <td className="py-3.5 text-end">
                  <button
                    type="button"
                    onClick={() => onSelectCategory(cat.name)}
                    className="inline-flex min-h-[32px] items-center gap-1 text-xs font-semibold text-zinc-950 hover:underline whitespace-nowrap cursor-pointer dark:text-[#D9FF43]"
                  >
                    <span>فحص الفئة</span>
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
