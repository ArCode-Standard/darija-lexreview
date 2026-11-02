import { useEffect, useState } from 'react'
import { RotateCcw, Search, Shuffle, SlidersHorizontal } from 'lucide-react'
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
  selectedEntryType: string
  selectedRegister: string
  selectedRegion: string
  regions: string[]
  dataMode: DataMode
  drafts: Record<string, LocalDraft>
  onQueryChange: (q: string) => void
  onCategoryChange: (cat: string) => void
  onExampleFilterChange: (f: ExampleFilter) => void
  onEntryTypeChange: (value: string) => void
  onRegisterChange: (value: string) => void
  onRegionChange: (value: string) => void
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
  selectedEntryType,
  selectedRegister,
  selectedRegion,
  regions,
  dataMode,
  drafts,
  onQueryChange,
  onCategoryChange,
  onExampleFilterChange,
  onEntryTypeChange,
  onRegisterChange,
  onRegionChange,
  onSelectEntry,
  onResetFilters,
}: LexiconSidebarProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP)
  const hasAdvancedActive =
    selectedEntryType !== 'all' || selectedRegister !== 'all' || selectedRegion !== 'all'
  const [advancedOpen, setAdvancedOpen] = useState(hasAdvancedActive)

  useEffect(() => {
    setVisibleCount(PAGE_STEP)
  }, [query, selectedCategory, exampleFilter, selectedEntryType, selectedRegister, selectedRegion])

  useEffect(() => {
    if (hasAdvancedActive) setAdvancedOpen(true)
  }, [hasAdvancedActive])

  const visibleSlice = filteredEntries.slice(0, visibleCount)
  const hasActiveFilters =
    query.trim() !== '' ||
    selectedCategory !== 'all' ||
    exampleFilter !== 'all' ||
    hasAdvancedActive

  function handlePickRandom() {
    const pool = filteredEntries.length > 0 ? filteredEntries : entries
    if (pool.length === 0) return
    const randomIndex = Math.floor(Math.random() * pool.length)
    onSelectEntry(pool[randomIndex])
  }

  return (
    <aside
      aria-label="فهرس المفردات"
      className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 lg:sticky lg:top-20 dark:border-white/12 dark:bg-[#0B0B10]"
    >
      <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-zinc-200 dark:border-white/10">
        <div>
          <h3 className="font-display text-sm font-bold text-zinc-950 dark:text-white">
            فهرس المداخل
          </h3>
          <p
            aria-live="polite"
            aria-atomic="true"
            className="mt-0.5 font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400"
          >
            {filteredEntries.length.toLocaleString('en-US')} / {entries.length.toLocaleString('en-US')} مدخل
          </p>
        </div>

        <button
          type="button"
          onClick={handlePickRandom}
          title="اختر مدخلاً عشوائياً للفحص"
          className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-50 px-3.5 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-950 hover:text-zinc-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60 dark:hover:text-white"
        >
          <Shuffle className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" aria-hidden="true" />
          <span>عشوائي</span>
        </button>
      </div>

      <div className="mt-3.5 space-y-2.5">
        <label className="relative flex items-center">
          <Search
            className="pointer-events-none absolute start-3 h-4 w-4 text-zinc-400 dark:text-zinc-500"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="بحث بالعربية أو Arabizi (بزاف / bzzaf)..."
            className="w-full min-h-[40px] rounded-xl border border-zinc-300 bg-zinc-50 ps-9 pe-3 py-2 text-xs text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-[#D9FF43]"
          />
        </label>

        <select
          aria-label="تصفية حسب الفئة المعجمية"
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="w-full min-h-[38px] rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-800 focus:border-zinc-950 focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200 dark:focus:border-[#D9FF43]"
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
          className="grid grid-cols-2 gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-white/10 dark:bg-[#07070A]"
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
              aria-pressed={exampleFilter === val}
              className={`min-h-[32px] rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                exampleFilter === val
                  ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                  : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <button
            type="button"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((open) => !open)}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-600 hover:text-zinc-950 cursor-pointer dark:text-zinc-400 dark:hover:text-white"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
            <span>تصفية لغوية وجهوية متقدمة</span>
            <span className="font-mono">{advancedOpen ? '−' : '+'}</span>
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline cursor-pointer dark:text-[#D9FF43]"
            >
              <RotateCcw className="h-3 w-3" />
              <span>إعادة ضبط</span>
            </button>
          )}
        </div>

        {advancedOpen && (
          <div className="grid gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-2 dark:border-white/10 dark:bg-[#07070A]">
            <label className="space-y-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
              <span>نوع المدخل</span>
              <select
                value={selectedEntryType}
                onChange={(e) => onEntryTypeChange(e.target.value)}
                className="min-h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 text-xs text-zinc-900 dark:border-white/15 dark:bg-[#0C0C10] dark:text-zinc-200"
              >
                <option value="all">جميع الأنواع</option>
                <option value="word">كلمة</option>
                <option value="expression">تعبير</option>
                <option value="sentence">جملة</option>
                <option value="proverb">مثل</option>
                <option value="question">سؤال</option>
                <option value="conversational">تعبير محادثة</option>
                <option value="unknown">غير محدد</option>
              </select>
            </label>

            <label className="space-y-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
              <span>سجل الاستعمال</span>
              <select
                value={selectedRegister}
                onChange={(e) => onRegisterChange(e.target.value)}
                className="min-h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 text-xs text-zinc-900 dark:border-white/15 dark:bg-[#0C0C10] dark:text-zinc-200"
              >
                <option value="all">جميع السجلات</option>
                <option value="neutral">محايد</option>
                <option value="formal">رسمي</option>
                <option value="informal">دارج / غير رسمي</option>
                <option value="vulgar">فج / مبتذل</option>
                <option value="literary">أدبي</option>
                <option value="religious">ديني</option>
                <option value="unknown">غير محدد</option>
              </select>
            </label>

            <label className="space-y-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 sm:col-span-2">
              <span>المنطقة اللهجية</span>
              <select
                value={selectedRegion}
                onChange={(e) => onRegionChange(e.target.value)}
                className="min-h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 text-xs text-zinc-900 dark:border-white/15 dark:bg-[#0C0C10] dark:text-zinc-200"
              >
                <option value="all">جميع المناطق</option>
                {regions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      <div className="mt-4 max-h-[540px] overflow-y-auto pe-1 space-y-1">
        {dataMode === 'loading' ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-[74px] rounded-xl border border-zinc-200 bg-zinc-50 p-3 animate-pulse dark:border-white/10 dark:bg-[#07070A]"
            />
          ))
        ) : visibleSlice.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              لا توجد مداخل مطابقة لشروط البحث الحالية.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={onResetFilters}
                className="mt-3 inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-50 px-4 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200"
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
                  aria-current={isActive ? 'true' : undefined}
                  className={`w-full text-start rounded-xl border px-3.5 py-3 transition-colors duration-150 cursor-pointer ${
                    isActive
                      ? 'border-zinc-950 bg-zinc-100/90 dark:border-[#D9FF43]/60 dark:bg-[#D9FF43]/8'
                      : 'border-transparent hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-white/10 dark:hover:bg-[#07070A]'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-base font-bold text-zinc-950 dark:text-white">
                      {entry.word}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-zinc-400 shrink-0 dark:text-zinc-500">
                      {formatAccessionCode(entry.id, entry.numericId)}
                    </span>
                  </div>

                  <p className="mt-1 truncate text-xs text-zinc-600 dark:text-zinc-300">
                    {entry.meaning}
                  </p>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span dir="ltr" className="font-mono text-emerald-700 dark:text-[#D9FF43]">
                      {entry.latin || '—'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{entry.category}</span>
                    {hasDraft ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-emerald-700 dark:text-[#D9FF43]">
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
                  className="w-full min-h-[38px] rounded-full border border-zinc-300 bg-zinc-50 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:border-[#D9FF43]/50"
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
