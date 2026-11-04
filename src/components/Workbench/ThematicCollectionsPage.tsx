import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, Link2, Search } from 'lucide-react'
import type { EtymologyOrigin, LexicalEntry } from '../../types/lexicon'
import { formatAccessionCode } from '../../services/dataset'
import { ETYMOLOGY_OPTIONS, formatEtymologyLabel } from '../../utils/etymology'
import { matchesDarijaQuery } from '../../utils/phoneticSearch'
import {
  buildThematicCollections,
  findThematicCollectionBySlug,
} from '../../utils/thematicCollections'
import { buildCollectionUrl } from '../../utils/urlState'

interface ThematicCollectionsPageProps {
  entries: LexicalEntry[]
  selectedSlug: string | null
  onSelectCollectionSlug: (slug: string | null) => void
  onOpenEntry: (entry: LexicalEntry) => void
  onFilterByEtymologyInLexicon?: (origin: EtymologyOrigin) => void
}

export function ThematicCollectionsPage({
  entries,
  selectedSlug,
  onSelectCollectionSlug,
  onOpenEntry,
  onFilterByEtymologyInLexicon,
}: ThematicCollectionsPageProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [etymologyFilter, setEtymologyFilter] = useState<string>('all')
  const [copiedLink, setCopiedLink] = useState(false)

  const collections = useMemo(() => buildThematicCollections(entries), [entries])
  const activeCollection = useMemo(
    () => findThematicCollectionBySlug(collections, selectedSlug),
    [collections, selectedSlug],
  )

  const filteredCollectionEntries = useMemo(() => {
    if (!activeCollection) return []
    return activeCollection.entries.filter((entry) => {
      if (etymologyFilter !== 'all' && entry.etymology !== etymologyFilter) return false
      return matchesDarijaQuery(entry, searchQuery)
    })
  }, [activeCollection, etymologyFilter, searchQuery])

  async function handleCopyCollectionLink(slug: string) {
    try {
      await navigator.clipboard.writeText(buildCollectionUrl(slug))
      setCopiedLink(true)
      window.setTimeout(() => setCopiedLink(false), 2000)
    } catch {
      // Ignore clipboard error
    }
  }

  // Dedicated Single Mini-Dictionary View (/collections/:slug)
  if (activeCollection) {
    return (
      <section className="space-y-6" aria-labelledby="active-collection-title">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 dark:border-white/12 dark:bg-[#0B0B10] space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setEtymologyFilter('all')
                onSelectCollectionSlug(null)
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-950 hover:underline cursor-pointer dark:text-zinc-400 dark:hover:text-white"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              <span>جميع المعاجم الموضوعاتية ({collections.length})</span>
            </button>

            <button
              type="button"
              onClick={() => void handleCopyCollectionLink(activeCollection.slug)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-50 px-4 py-1.5 text-xs font-semibold text-zinc-800 hover:border-zinc-950 transition-colors cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60"
            >
              {copiedLink ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
                  <span>تم نسخ رابط المجموعة</span>
                </>
              ) : (
                <>
                  <Link2 className="h-3.5 w-3.5" />
                  <span>مشاركة هذا المعجم المصغّر</span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-2 max-w-3xl">
            <p className="text-xs text-emerald-700 font-semibold dark:text-[#D9FF43]">
              {activeCollection.numberLabel}. {activeCollection.culturalContext}
            </p>
            <h2
              id="active-collection-title"
              className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white"
            >
              {activeCollection.title}
            </h2>
            <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-400">
              {activeCollection.editorialNote}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-200 text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-400">
            <span>
              إجمالي المداخل:{' '}
              <strong className="font-mono font-bold text-zinc-950 dark:text-white">
                {activeCollection.entries.length.toLocaleString('en-US')}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              مداخل مشفوعة بشواهد سياقية:{' '}
              <strong className="font-mono font-bold text-emerald-700 dark:text-[#D9FF43]">
                {activeCollection.withExamplesCount.toLocaleString('en-US')}
              </strong>
            </span>
          </div>

          {/* Search & Etymology Filter Bar */}
          <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-12">
            <label className="relative flex items-center md:col-span-7">
              <Search
                className="pointer-events-none absolute start-3.5 h-4 w-4 text-zinc-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`ابحث داخل «${activeCollection.title}» بالعربية أو Arabizi...`}
                className="min-h-[42px] w-full rounded-xl border border-zinc-300 bg-zinc-50 ps-10 pe-3.5 text-xs sm:text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-white dark:focus:border-[#D9FF43]"
              />
            </label>

            <div className="md:col-span-5">
              <select
                aria-label="تصفية المجموعة حسب التأصيل التاريخي"
                value={etymologyFilter}
                onChange={(e) => setEtymologyFilter(e.target.value)}
                className="min-h-[42px] w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 text-xs sm:text-sm text-zinc-900 focus:border-zinc-950 focus:outline-none dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200 dark:focus:border-[#D9FF43]"
              >
                <option value="all">جميع الروافد والتأصيلات اللغوية</option>
                {ETYMOLOGY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Entries Grid */}
        {filteredCollectionEntries.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center dark:border-white/12 dark:bg-[#0B0B10]">
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              لا توجد مفردات مطابقة لشرط البحث الحالي داخل هذه المجموعة.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setEtymologyFilter('all')
              }}
              className="mt-4 inline-flex min-h-[38px] items-center justify-center rounded-full border border-zinc-300 px-5 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 cursor-pointer dark:border-white/15 dark:text-zinc-200"
            >
              إعادة عرض كل مفردات المجموعة
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredCollectionEntries.slice(0, 80).map((entry) => {
              const ex = entry.examples[0]
              return (
                <article
                  key={entry.id}
                  className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 transition-colors hover:border-zinc-400 dark:border-white/12 dark:bg-[#0B0B10] dark:hover:border-[#D9FF43]/50"
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>{entry.category}</span>
                        {entry.etymology && entry.etymology !== 'unspecified' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{formatEtymologyLabel(entry.etymology)}</span>
                          </>
                        )}
                      </div>
                      <span dir="ltr" className="font-mono text-[11px]">
                        {formatAccessionCode(entry.id, entry.numericId)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-baseline gap-2.5">
                      <h3 className="font-display text-2xl font-bold text-zinc-950 dark:text-white">
                        <a
                          href={`/lexicon/${encodeURIComponent(entry.id)}`}
                          onClick={(e) => {
                            e.preventDefault()
                            onOpenEntry(entry)
                          }}
                          className="hover:text-emerald-700 dark:hover:text-[#D9FF43]"
                        >
                          {entry.word}
                        </a>
                      </h3>
                      {entry.latin && (
                        <span
                          dir="ltr"
                          className="font-mono text-xs font-semibold text-emerald-700 dark:text-[#D9FF43]"
                        >
                          /{entry.latin}/
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-medium leading-7 text-zinc-800 dark:text-zinc-200">
                      {entry.meaning}
                    </p>

                    {ex && (
                      <p className="border-t border-zinc-100 pt-2.5 text-xs leading-6 text-zinc-600 dark:border-white/8 dark:text-zinc-400">
                        <strong className="text-zinc-900 dark:text-zinc-200">شاهد: </strong>«{ex.darijaAr}»
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs dark:border-white/8">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {entry.french && entry.french !== '—' ? entry.french : ''}
                    </span>
                    <a
                      href={`/lexicon/${encodeURIComponent(entry.id)}`}
                      onClick={(e) => {
                        e.preventDefault()
                        onOpenEntry(entry)
                      }}
                      className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline dark:text-[#D9FF43]"
                    >
                      <span>بطاقة المفردة</span>
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    )
  }

  // Overview Directory of All Thematic Collections (/collections)
  return (
    <section className="space-y-8" aria-label="بوابات المعاجم الموضوعاتية">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {collections.map((col) => {
          const sampleWords = col.entries.slice(0, 4).map((e) => e.word)
          return (
            <article
              key={col.slug}
              className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-950 dark:border-white/12 dark:bg-[#0B0B10] dark:hover:border-[#D9FF43]/60"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-semibold text-emerald-700 dark:text-[#D9FF43]">
                    {col.numberLabel}. {col.culturalContext}
                  </span>
                  <span className="font-mono tabular-nums">
                    {col.entries.length.toLocaleString('en-US')} مدخل
                  </span>
                </div>

                <h2 className="font-display text-xl font-bold text-zinc-950 dark:text-white">
                  <a
                    href={`/collections/${encodeURIComponent(col.slug)}`}
                    onClick={(e) => {
                      e.preventDefault()
                      onSelectCollectionSlug(col.slug)
                    }}
                    className="hover:underline"
                  >
                    {col.title}
                  </a>
                </h2>

                <p className="text-xs sm:text-sm leading-7 text-zinc-600 dark:text-zinc-400">
                  {col.subtitle}
                </p>

                {sampleWords.length > 0 && (
                  <p className="pt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    من مفرداته:{' '}
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {sampleWords.join(' · ')}
                    </span>
                  </p>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between dark:border-white/10">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {col.withExamplesCount.toLocaleString('en-US')} بشواهد موثقة
                </span>

                <button
                  type="button"
                  onClick={() => onSelectCollectionSlug(col.slug)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-950 hover:text-emerald-700 cursor-pointer dark:text-[#D9FF43] dark:hover:text-[#e5ff73]"
                >
                  <span>تصفح المعجم المصغّر</span>
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {/* Etymology Quick Explorer Gateway */}
      {onFilterByEtymologyInLexicon && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-7 dark:border-white/12 dark:bg-[#0B0B10] space-y-4">
          <div className="space-y-1">
            <h3 className="font-display text-lg font-bold text-zinc-950 dark:text-white">
              استكشاف المعجم حسب الجذر والتأصيل التاريخي
            </h3>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
              انتقل مباشرة لتصفية جميع مفردات المتن حسب رافدها اللغوي والتاريخي في الدارجة المغربية.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {ETYMOLOGY_OPTIONS.filter((o) => o.value !== 'unspecified').map((opt) => {
              const count = entries.filter((e) => e.etymology === opt.value).length
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onFilterByEtymologyInLexicon(opt.value)}
                  className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 text-start transition-colors hover:border-zinc-950 cursor-pointer dark:border-white/10 dark:bg-[#07070A] dark:hover:border-[#D9FF43]/60"
                >
                  <div>
                    <p className="font-display text-sm font-bold text-zinc-950 dark:text-white">
                      {opt.label}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-zinc-600 dark:text-zinc-400">
                      {opt.description}
                    </p>
                  </div>
                  <p className="mt-3 font-mono text-xs font-semibold tabular-nums text-emerald-700 dark:text-[#D9FF43]">
                    {count.toLocaleString('en-US')} مدخل ←
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

interface HomeThematicCollectionsGatewayProps {
  entries: LexicalEntry[]
  onOpenCollection: (slug?: string | null) => void
}

export function HomeThematicCollectionsGateway({
  entries,
  onOpenCollection,
}: HomeThematicCollectionsGatewayProps) {
  const collections = useMemo(() => buildThematicCollections(entries).slice(0, 4), [entries])

  return (
    <section
      aria-labelledby="home-collections-heading"
      className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-10"
    >
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-emerald-700 dark:text-[#D9FF43]">
            بوابات استكشافية منسّقة للزوار والباحثين
          </p>
          <h2
            id="home-collections-heading"
            className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white"
          >
            المجموعات الموضوعاتية والمعاجم المصغّرة
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
            تصفح مفردات الدارجة المغربية مصنّفة في أبواب ثقافية جاهزة للقراءة الممتعة والبحث السريع.
          </p>
        </div>

        <a
          href="/collections"
          onClick={(e) => {
            e.preventDefault()
            onOpenCollection(null)
          }}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-zinc-300 bg-white px-5 py-2 text-xs font-semibold text-zinc-900 hover:border-zinc-950 transition-colors dark:border-white/15 dark:bg-[#0B0B10] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60"
        >
          <BookOpen className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
          <span>عرض جميع المجموعات (6)</span>
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {collections.map((col) => (
          <a
            key={col.slug}
            href={`/collections/${encodeURIComponent(col.slug)}`}
            onClick={(e) => {
              e.preventDefault()
              onOpenCollection(col.slug)
            }}
            className="group flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-950 dark:border-white/12 dark:bg-[#0B0B10] dark:hover:border-[#D9FF43]/60"
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <span className="font-mono font-semibold text-emerald-700 dark:text-[#D9FF43]">
                  {col.numberLabel}
                </span>
                <span className="font-mono tabular-nums">
                  {col.entries.length.toLocaleString('en-US')} مفردة
                </span>
              </div>
              <h3 className="font-display text-base sm:text-lg font-bold text-zinc-950 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-[#D9FF43]">
                {col.title}
              </h3>
              <p className="text-xs leading-6 text-zinc-600 dark:text-zinc-400">
                {col.subtitle}
              </p>
            </div>

            <span className="mt-4 pt-3 border-t border-zinc-100 inline-flex items-center gap-1 text-xs font-semibold text-zinc-800 group-hover:text-emerald-700 dark:border-white/8 dark:text-zinc-300 dark:group-hover:text-[#D9FF43]">
              <span>افتح المعجم المصغّر</span>
              <ArrowLeft className="h-3.5 w-3.5" />
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}
