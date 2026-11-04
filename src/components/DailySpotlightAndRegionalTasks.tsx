import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Bookmark,
  Check,
  Download,
  Globe2,
  MapPin,
  Plus,
  Volume2,
} from 'lucide-react'
import type { LexicalEntry } from '../types/lexicon'
import { formatAccessionCode } from '../services/dataset'
import {
  selectDailyLexiconSpotlight,
  selectRegionalMemberTasks,
} from '../utils/dailySpotlight'
import { downloadShareableLexicalCard } from '../utils/shareCardGenerator'

interface DailySpotlightAndRegionalTasksProps {
  entries: LexicalEntry[]
  corpusVersion: string
  darkMode: boolean
  isAuthenticated: boolean
  memberDialectRegion?: string | null
  userVerdictsByEntryId?: Record<string, unknown>
  isBookmarked?: (entryId: string) => boolean
  onToggleBookmark?: (entryId: string) => void
  onSelectEntry: (entry: LexicalEntry) => void
  onEnrichEntry: (entry: LexicalEntry) => void
  onOpenProfileSettings: () => void
  dateSeed?: Date | string
}

export function DailySpotlightAndRegionalTasks({
  entries,
  corpusVersion,
  darkMode,
  isAuthenticated,
  memberDialectRegion,
  userVerdictsByEntryId,
  isBookmarked,
  onToggleBookmark,
  onSelectEntry,
  onEnrichEntry,
  onOpenProfileSettings,
  dateSeed,
}: DailySpotlightAndRegionalTasksProps) {
  const [spotlightTab, setSpotlightTab] = useState<'word' | 'proverb'>('word')
  const [downloadedId, setDownloadedId] = useState<string | null>(null)

  const spotlight = useMemo(
    () => selectDailyLexiconSpotlight(entries, dateSeed),
    [entries, dateSeed],
  )

  const regionalTasks = useMemo(() => {
    if (!isAuthenticated) return []
    return selectRegionalMemberTasks({
      entries,
      memberRegion: memberDialectRegion,
      userVerdictsByEntryId,
      limit: 4,
    })
  }, [isAuthenticated, entries, memberDialectRegion, userVerdictsByEntryId])

  const activeSpotlightEntry =
    spotlightTab === 'proverb' && spotlight.proverbOrExpressionOfTheDay
      ? spotlight.proverbOrExpressionOfTheDay
      : spotlight.wordOfTheDay

  if (!activeSpotlightEntry) return null

  const primaryExample = activeSpotlightEntry.examples[0]
  const accessionCode = formatAccessionCode(
    activeSpotlightEntry.id,
    activeSpotlightEntry.numericId,
  )
  const savedInBookmarks = Boolean(isBookmarked?.(activeSpotlightEntry.id))

  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

  function handleSpeak(word: string) {
    if (!canSpeak) return
    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(word)
      utterance.lang = 'ar-MA'
      utterance.rate = 0.88
      window.speechSynthesis.speak(utterance)
    } catch {
      // Ignore synthesis error on unsupported browsers
    }
  }

  function handleDownloadCard(entry: LexicalEntry) {
    const ok = downloadShareableLexicalCard(entry, {
      corpusVersion,
      theme: darkMode ? 'dark' : 'light',
    })
    if (ok) {
      setDownloadedId(entry.id)
      window.setTimeout(() => {
        setDownloadedId((prev) => (prev === entry.id ? null : prev))
      }, 2200)
    }
  }

  const hasSpecificRegion = Boolean(
    memberDialectRegion &&
      memberDialectRegion.trim() &&
      memberDialectRegion.trim() !== 'مشترك عام',
  )

  return (
    <section
      aria-label="إضاءة اليوم المعجمية ومهام الإثراء الجهوي"
      className="border-b border-zinc-200 bg-[#FAFAFC] dark:border-white/10 dark:bg-[#050507]"
    >
      <div className="mx-auto max-w-[1280px] px-5 py-12 sm:px-8 lg:py-16 space-y-12">
        {/* 1. Daily Word / Moroccan Proverb Spotlight (For Visitors & Members) */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 dark:border-white/12 dark:bg-[#0B0B10]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-white/10">
            <div>
              <p className="font-mono text-xs text-emerald-700 dark:text-[#D9FF43]">
                02. إضاءة اليوم من المتن الموثق · {spotlight.dateKey}
              </p>
              <h2 className="mt-1 font-display text-xl sm:text-2xl font-bold tracking-tight text-zinc-950 [text-wrap:balance] dark:text-white">
                {spotlightTab === 'word'
                  ? 'مفردة اليوم الموثّقة'
                  : 'مَثَل أو تعبير مغربي مختار'}
              </h2>
            </div>

            {spotlight.proverbOrExpressionOfTheDay &&
              spotlight.proverbOrExpressionOfTheDay.id !== spotlight.wordOfTheDay?.id && (
                <div
                  role="group"
                  aria-label="اختيار زاوية اليوم"
                  className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-white/10 dark:bg-[#07070A]"
                >
                  <button
                    type="button"
                    onClick={() => setSpotlightTab('word')}
                    className={`min-h-[34px] rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      spotlightTab === 'word'
                        ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                        : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                    }`}
                  >
                    مفردة اليوم
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpotlightTab('proverb')}
                    className={`min-h-[34px] rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      spotlightTab === 'proverb'
                        ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                        : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                    }`}
                  >
                    مَثَل أو تعبير مختار
                  </button>
                </div>
              )}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
            <div className="space-y-4 lg:col-span-7">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950 dark:text-white">
                  {activeSpotlightEntry.word}
                </h3>
                {activeSpotlightEntry.latin && (
                  <span
                    dir="ltr"
                    className="font-mono text-base sm:text-lg font-semibold text-emerald-700 dark:text-[#D9FF43]"
                  >
                    /{activeSpotlightEntry.latin}/
                  </span>
                )}
                {canSpeak && (
                  <button
                    type="button"
                    onClick={() => handleSpeak(activeSpotlightEntry.word)}
                    aria-label="الاستماع لنطق المفردة"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 hover:border-zinc-950 hover:text-zinc-950 transition-colors cursor-pointer dark:border-white/15 dark:text-zinc-300 dark:hover:border-[#D9FF43] dark:hover:text-[#D9FF43]"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span>{activeSpotlightEntry.category}</span>
                <span aria-hidden="true">·</span>
                <span dir="ltr" className="font-mono tabular-nums">
                  {accessionCode}
                </span>
                {activeSpotlightEntry.region && activeSpotlightEntry.region.length > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{activeSpotlightEntry.region.join('، ')}</span>
                  </>
                )}
              </div>

              <p className="text-base sm:text-lg font-semibold leading-8 text-zinc-900 dark:text-zinc-100">
                {activeSpotlightEntry.meaning}
                {activeSpotlightEntry.french ? (
                  <span className="ms-2 font-normal text-sm text-zinc-500 dark:text-zinc-400" dir="ltr">
                    ({activeSpotlightEntry.french})
                  </span>
                ) : null}
              </p>

              <div className="flex flex-wrap items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => onSelectEntry(activeSpotlightEntry)}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-zinc-950 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition-colors cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
                >
                  <span>فتح البطاقة القاموسية</span>
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadCard(activeSpotlightEntry)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 hover:border-zinc-950 transition-colors cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60"
                >
                  {downloadedId === activeSpotlightEntry.id ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
                      <span>تم تنزيل البطاقة</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5" />
                      <span>بطاقة مصوّرة للمشاركة</span>
                    </>
                  )}
                </button>

                {onToggleBookmark && (
                  <button
                    type="button"
                    onClick={() => onToggleBookmark(activeSpotlightEntry.id)}
                    aria-pressed={savedInBookmarks}
                    className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                      savedInBookmarks
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-[#D9FF43] dark:bg-[#D9FF43]/15 dark:text-[#D9FF43]'
                        : 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-950 dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:border-white/40'
                    }`}
                  >
                    <Bookmark
                      className={`h-3.5 w-3.5 ${savedInBookmarks ? 'fill-current' : ''}`}
                    />
                    <span>
                      {isAuthenticated
                        ? savedInBookmarks
                          ? 'محفوظة في مفضلتي'
                          : 'حفظ في مفضلتي'
                        : savedInBookmarks
                          ? 'محفوظة بالمتصفح'
                          : 'حفظ مؤقت بالمتصفح'}
                    </span>
                  </button>
                )}
              </div>
            </div>

            <div className="border-t border-zinc-200 pt-5 lg:col-span-5 lg:border-t-0 lg:border-s lg:pt-0 lg:ps-8 dark:border-white/10">
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                الشاهد السياقي من الاستعمال اليومي
              </p>
              {primaryExample ? (
                <div className="mt-3 space-y-2.5">
                  <p className="font-display text-lg sm:text-xl font-bold leading-9 text-zinc-950 dark:text-white">
                    «{primaryExample.darijaAr}»
                  </p>
                  {primaryExample.darijaLatin && (
                    <p
                      dir="ltr"
                      className="text-start font-mono text-xs text-emerald-700 dark:text-[#D9FF43]"
                    >
                      {primaryExample.darijaLatin}
                    </p>
                  )}
                  {primaryExample.meaningAr && (
                    <p className="text-xs sm:text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                      الفصحى: {primaryExample.meaningAr}
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    هذه المفردة بانتظار أول شاهد سياقي موثّق من التداول المغربي اليومي.
                  </p>
                  <button
                    type="button"
                    onClick={() => onEnrichEntry(activeSpotlightEntry)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline cursor-pointer dark:text-[#D9FF43]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>أضف شاهداً لهذه المفردة</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. Personalized Regional Documentation Tasks (Strictly Registered Members Only) */}
        {isAuthenticated && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 dark:border-white/12 dark:bg-[#0B0B10]">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-white/10">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-[#D9FF43]">
                  <Globe2 className="h-3.5 w-3.5" />
                  <span>مهام موجهة للأعضاء المسجّلين</span>
                </p>
                <h2 className="mt-1 font-display text-xl sm:text-2xl font-bold tracking-tight text-zinc-950 [text-wrap:balance] dark:text-white">
                  {hasSpecificRegion
                    ? `مطلوب توثيقها في منطقتك (${memberDialectRegion})`
                    : 'مفردات تنتظر توثيق منطقتك اللهجية'}
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
                  {hasSpecificRegion
                    ? 'اخترنا لك مفردات تنقصها شواهد سياقية أو تأكيد تداول من جهتك الجغرافية لرفع تمثيلها في الخارطة.'
                    : 'حدّد منطقتك اللهجية في ملفك الشخصي لنقترح عليك المفردات التي تحتاج شواهد وتأكيدات من جهتك تحديداً.'}
                </p>
              </div>

              <button
                type="button"
                onClick={onOpenProfileSettings}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-50 px-4 py-1.5 text-xs font-semibold text-zinc-800 hover:border-zinc-950 cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60"
              >
                <MapPin className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
                <span>
                  {hasSpecificRegion ? 'تغيير المنطقة في ملفي' : 'تحديد منطقتي اللهجية الآن'}
                </span>
              </button>
            </div>

            {hasSpecificRegion && regionalTasks.length > 0 ? (
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {regionalTasks.map(({ entry, reasonLabel }) => (
                  <div
                    key={entry.id}
                    className="flex flex-col justify-between border-b border-zinc-200 pb-4 sm:border-b-0 sm:border-e sm:pb-0 sm:pe-4 last:border-0 dark:border-white/10"
                  >
                    <div>
                      <div className="flex items-baseline justify-between gap-2">
                        <strong className="font-display text-lg font-bold text-zinc-950 dark:text-white">
                          {entry.word}
                        </strong>
                        {entry.latin && (
                          <span dir="ltr" className="font-mono text-xs text-zinc-500">
                            {entry.latin}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                        {entry.meaning}
                      </p>
                      <p className="mt-2 text-[11px] text-emerald-700 dark:text-[#D9FF43]">
                        {reasonLabel}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onEnrichEntry(entry)}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-zinc-900 hover:underline cursor-pointer dark:text-white"
                    >
                      <span>وثّقها الآن</span>
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                <span>
                  {hasSpecificRegion
                    ? 'رائع! راجعتَ أبرز الأولويات الحالية لمنطقتك؛ يمكنك دائماً إضافة مفردات جديدة متداولة في جهتك.'
                    : 'اختر منطقتك (مثل: فاس ومكناس، الشمال وجبالة، سوس والجنوب، الدار البيضاء والوسط...) لعرض المهام المخصصة لك فوراً.'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
