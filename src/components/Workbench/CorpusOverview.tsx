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
    <div className="rounded-xl border border-[#E5DFD3] bg-white p-5 sm:p-8 dark:border-[#2E2B27] dark:bg-[#1C1A18]">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-[#E5DFD3] dark:border-[#2E2B27]">
        <div>
          <h3 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
            التوزيع الدلالي لفئات المعجم ({categoryStats.length.toLocaleString('en-US')})
          </h3>
          <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
            اختر أي فئة معجمية لعرض مفرداتها ومراجعة المداخل التي تحتاج إلى شواهد سياقية إضافية.
          </p>
        </div>
        <span className="font-mono text-xs tabular-nums text-stone-500 dark:text-stone-400">
          إجمالي المداخل: {entries.length.toLocaleString('en-US')}
        </span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-start border-collapse">
          <thead>
            <tr className="border-b border-[#E5DFD3] text-xs font-semibold text-stone-500 dark:border-[#2E2B27] dark:text-stone-400">
              <th className="py-3 text-start font-medium">الفئة الدلالية</th>
              <th className="py-3 text-end font-medium">عدد المداخل</th>
              <th className="py-3 text-end font-medium">مداخل بشاهد سياقي</th>
              <th className="py-3 text-end font-medium">تغطية الشواهد</th>
              <th className="py-3 text-end font-medium">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5DFD3] text-xs dark:divide-[#2E2B27]">
            {categoryStats.map((cat) => (
              <tr
                key={cat.name}
                className="hover:bg-[#FBF9F5] transition-colors dark:hover:bg-[#141312]"
              >
                <td className="py-3.5 font-display font-semibold text-stone-900 dark:text-stone-100">
                  {cat.name}
                </td>
                <td className="py-3.5 text-end font-mono tabular-nums text-stone-700 dark:text-stone-300">
                  {cat.total.toLocaleString('en-US')}
                </td>
                <td className="py-3.5 text-end font-mono tabular-nums text-stone-700 dark:text-stone-300">
                  {cat.withExamples.toLocaleString('en-US')}
                </td>
                <td className="py-3.5 text-end font-mono tabular-nums text-stone-600 dark:text-stone-400">
                  {cat.coveragePct}%
                </td>
                <td className="py-3.5 text-end">
                  <button
                    type="button"
                    onClick={() => onSelectCategory(cat.name)}
                    className="inline-flex min-h-[32px] items-center gap-1 text-xs font-semibold text-[#0F5C4E] hover:underline whitespace-nowrap cursor-pointer dark:text-[#4FD1C5]"
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
