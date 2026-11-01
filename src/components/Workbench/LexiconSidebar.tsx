import { useState, useEffect } from 'react'
import { Search, Shuffle, RotateCcw } from 'lucide-react'
import type { DataMode, ExampleFilter, LexicalEntry, LocalDraft } from '../../types/lexicon'
import { formatAccessionCode, formatStatusLabel } from '../../services/dataset'

interface LexiconSidebarProps {
  entries: LexicalEntry[]
  filteredEntries: LexicalEntry[]
  activeEntry: LexicalEntry
  categories: string[]
  query: string
  selectedCategory: string
  exampleFilter: ExampleFilter
  dataMode: DataMode
  drafts: Record<string, LocalDraft>
  onQueryChange: (q: string) => void
  onCategoryChange: (cat: string) => void
  onExampleFilterChange: (f: ExampleFilter) => void
  onSelectEntry: (entry: LexicalEntry) => void
  onResetFilters: () => void
}

const PAGE_STEP = 60

export function LexiconSidebar({
  entries,
  filteredEntries,
  activeEntry,
  categories,
  query,
  selectedCategory,
  exampleFilter,
  dataMode,
  drafts,
  onQueryChange,
  onCategoryChange,
  onExampleFilterChange,
  onSelectEntry,
  onResetFilters,
}: LexiconSidebarProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP)

  useEffect(() => {
    setVisibleCount(PAGE_STEP)
  }, [query, selectedCategory, exampleFilter])

  const visibleSlice = filteredEntries.slice(0, visibleCount)
  const hasActiveFilters =
    query.trim() !== '' || selectedCategory !== 'all' || exampleFilter !== 'all'

  function handlePickRandom() {
    const pool = filteredEntries.length > 0 ? filteredEntries : entries
    if (pool.length === 0) return
    const randomIndex = Math.floor(Math.random() * pool.length)
    onSelectEntry(pool[randomIndex])
  }

  return (
    <aside
      aria-label="فهرس المفردات"
      className="rounded-xl border border-[#E5DFD3] bg-white p-4 sm:p-5 lg:sticky lg:top-20 dark:border-[#2E2B27] dark:bg-[#1C1A18]"
    >
      <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-[#E5DFD3] dark:border-[#2E2B27]">
        <div>
          <h3 className="font-display text-sm font-bold text-stone-900 dark:text-stone-100">
            فهرس المداخل
          </h3>
          <p className="mt-0.5 text-xs text-stone-500 font-mono tabular-nums dark:text-stone-400">
            {filteredEntries.length.toLocaleString('en-US')} / {entries.length.toLocaleString('en-US')} مدخل
          </p>
        </div>

        <button
          type="button"
          onClick={handlePickRandom}
          title="اختر مدخلاً عشوائياً للفحص"
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-[#EFECE4] transition-colors whitespace-nowrap shrink-0 cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-300 dark:hover:bg-[#262320]"
        >
          <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
          <span>مدخل عشوائي</span>
        </button>
      </div>

      <div className="mt-3.5 space-y-2.5">
        <label className="relative flex items-center">
          <Search
            className="pointer-events-none absolute start-3 h-4 w-4 text-stone-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="بحث صوتي بالعربية أو Arabizi (مثل bzzaf / بزاف)..."
            className="w-full min-h-[40px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] ps-9 pe-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-[#0F5C4E] focus:bg-white focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-100 dark:focus:border-[#4FD1C5]"
          />
        </label>

        <select
          aria-label="تصفية حسب الفئة المعجمية"
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="w-full min-h-[38px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-1.5 text-xs text-stone-800 focus:border-[#0F5C4E] focus:outline-none dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-200"
        >
          <option value="all">جميع الفئات ({categories.length})</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <div
          role="group"
          aria-label="تصفية حسب توفر الشاهد السياقي وأولوية الإثراء"
          className="grid grid-cols-2 gap-1 rounded-lg bg-[#F3EFE6] p-1 dark:bg-[#141312]"
        >
          {(
            [
              ['all', 'الكل'],
              ['with_examples', 'بشاهد سياقي'],
              ['needs_examples', 'بدون شاهد'],
              ['priority_enrichment', 'أولوية الإثراء'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => onExampleFilterChange(val)}
              className={`min-h-[32px] rounded-md px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                exampleFilter === val
                  ? 'bg-white text-stone-900 shadow-2xs dark:bg-[#2A2622] dark:text-stone-100'
                  : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 max-h-[540px] overflow-y-auto pe-1 space-y-1">
        {dataMode === 'loading' ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-[74px] rounded-lg border border-[#E5DFD3] bg-[#FBF9F5] p-3 animate-pulse dark:border-[#2E2B27] dark:bg-[#141312]"
            />
          ))
        ) : visibleSlice.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <p className="text-xs font-medium text-stone-700 dark:text-stone-300">
              لا توجد مداخل مطابقة لشروط البحث الحالية.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={onResetFilters}
                className="mt-3 inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-[#EFECE4] cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-200"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>إعادة ضبط التصفية</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {visibleSlice.map((entry) => {
              const isActive = entry.id === activeEntry.id
              const hasDraft = Boolean(drafts[entry.id])

              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onSelectEntry(entry)}
                  className={`w-full text-start rounded-lg border px-3.5 py-3 transition-colors duration-150 cursor-pointer ${
                    isActive
                      ? 'border-[#B8AE99] bg-[#EFECE4] dark:border-[#4A433B] dark:bg-[#2A2622]'
                      : 'border-transparent hover:border-[#E5DFD3] hover:bg-[#FBF9F5] dark:hover:border-[#2E2B27] dark:hover:bg-[#141312]'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
                      {entry.word}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-stone-400 shrink-0 dark:text-stone-500">
                      {formatAccessionCode(entry.id, entry.numericId)}
                    </span>
                  </div>

                  <p className="mt-1 truncate text-xs text-stone-600 dark:text-stone-300">
                    {entry.meaning}
                  </p>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-stone-500 dark:text-stone-400">
                    <span dir="ltr" className="font-mono">
                      {entry.latin || '—'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{entry.category}</span>
                    {hasDraft ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-[#0F5C4E] dark:text-[#4FD1C5]">
                          مسودة محفوظة
                        </span>
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{formatStatusLabel(entry.status)}</span>
                      </>
                    )}
                  </div>
                </button>
              )
            })}

            {filteredEntries.length > visibleCount && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + PAGE_STEP)}
                  className="w-full min-h-[38px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] py-2 text-xs font-semibold text-stone-700 hover:bg-[#EFECE4] transition-colors cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-300 dark:hover:bg-[#262320]"
                >
                  عرض المزيد ({(filteredEntries.length - visibleCount).toLocaleString('en-US')} متبقٍ)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  )
}
