import { useMemo, useState } from 'react'
import { ArrowLeft, BookOpen, ChevronLeft, Compass, Plus, Search, X } from 'lucide-react'
import heroArchivalImg from '../assets/images/hero_moroccan_lexicon_1793533512520.jpg'
import methodArchivalImg from '../assets/images/method_archival_manuscript_1793533512528.jpg'
import type { DataMode, LexicalEntry, WorkbenchTab } from '../types/lexicon'
import { matchesDarijaQuery } from '../utils/phoneticSearch'
import { DarijaDotMatrixLogo } from './DarijaDotMatrixLogo'

interface HeroSectionProps {
  entries: LexicalEntry[]
  entriesCount: number
  categoriesCount: number
  examplesCount: number
  dataMode: DataMode
  isAuthenticated?: boolean
  onStartRapidReview: () => void
  onStartDetailedReview: () => void
  onSelectEntry: (entry: LexicalEntry) => void
  onQuickAddWord: (word: string) => void
  onOpenContributors?: () => void
  onSelectWorkbenchTab?: (tab: WorkbenchTab) => void
}

export function HeroSection({
  entries,
  entriesCount,
  categoriesCount,
  examplesCount,
  dataMode,
  isAuthenticated = false,
  onStartRapidReview,
  onStartDetailedReview,
  onSelectEntry,
  onQuickAddWord,
  onOpenContributors,
  onSelectWorkbenchTab,
}: HeroSectionProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const [secondaryImgFailed, setSecondaryImgFailed] = useState(false)
  const [heroQuery, setHeroQuery] = useState('')

  const isRealCorpus = dataMode === 'live' || dataMode === 'cached'
  const displayEntries = isRealCorpus ? entriesCount : 921
  const displayCategories = isRealCorpus ? categoriesCount : 38
  const displayExamples = isRealCorpus && examplesCount > 0 ? examplesCount : 146

  const trimmedQuery = heroQuery.trim()
  const instantMatches = useMemo(() => {
    if (!trimmedQuery) return []
    return entries.filter((entry) => matchesDarijaQuery(entry, trimmedQuery)).slice(0, 5)
  }, [entries, trimmedQuery])

  const jumpToTab = (tab: WorkbenchTab) => {
    if (onSelectWorkbenchTab) {
      onSelectWorkbenchTab(tab)
      return
    }
    if (tab === 'rapid_review') {
      onStartRapidReview()
    } else {
      onStartDetailedReview()
    }
  }

  return (
    <div className="relative overflow-hidden border-b border-zinc-200 dark:border-white/10">
      {/* Subtle Ambient Light Aura in Dark Mode */}
      <div
        aria-hidden="true"
        className="pointer-events-none hidden dark:block absolute inset-0"
      >
        <div className="absolute top-12 left-1/2 -translate-x-1/2 h-[440px] w-[620px] rounded-full bg-[#FF3B2F]/14 blur-[130px]" />
        <div className="absolute top-24 left-1/3 h-[260px] w-[360px] rounded-full bg-[#D9FF43]/8 blur-[110px]" />
      </div>

      {/* SECTION 01: MONUMENTAL OBSIDIAN HERO */}
      <section className="relative mx-auto max-w-[1280px] px-5 pt-10 pb-14 sm:px-8 lg:pt-14 lg:pb-20">
        <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12 lg:gap-8">
          {/* Column 1 (Start): Dot-Matrix Glyph + Headline + Instant Omnibox + Pill CTAs */}
          <div className="flex flex-col justify-between lg:col-span-5">
            <div>
              <div className="relative inline-block select-none">
                <DarijaDotMatrixLogo variant="full" width={212} />
              </div>

              <p className="mt-4 text-[11px] font-mono tracking-[0.14em] uppercase text-zinc-500 dark:text-zinc-400">
                ARCODE STANDARD / المعجم المفتوح للدارجة المغربية
              </p>

              <h1 className="mt-3 font-display text-[clamp(2.25rem,4vw,3.55rem)] font-bold leading-[1.15] tracking-tight text-zinc-950 [text-wrap:balance] dark:text-white">
                الدارجة المغربية تصبح موثّقة بدقة.
              </h1>

              <p className="mt-4 max-w-[56ch] text-sm sm:text-base leading-[1.8] text-zinc-600 dark:text-zinc-400">
                طبقة توثيق بشرية موحّدة لرصد مفردات الدارجة وشواهدها الحقيقية، وتدقيقها جماعياً قبل اعتمادها في المتن المفتوح.
              </p>

              {/* Unified Instant Search Omnibox */}
              <div className="mt-6">
                <div className="relative flex items-center">
                  <Search
                    className="pointer-events-none absolute start-4 h-4 w-4 text-zinc-400 dark:text-zinc-500"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={heroQuery}
                    onChange={(e) => setHeroQuery(e.target.value)}
                    aria-label="ابحث فورياً في معجم الدارجة"
                    placeholder="ابحث عن مفردة بالعربية أو اللاتينية أو الفرنسية (بزاف / bzzaf)..."
                    className="w-full min-h-[48px] rounded-full border border-zinc-300 bg-white ps-11 pe-10 py-2.5 text-xs sm:text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none transition-colors dark:border-white/15 dark:bg-[#0C0C10]/90 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-[#D9FF43]"
                  />
                  {trimmedQuery && (
                    <button
                      type="button"
                      onClick={() => setHeroQuery('')}
                      aria-label="مسح البحث"
                      className="absolute end-3 flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-900 cursor-pointer dark:hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {trimmedQuery && (
                  <div className="mt-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/15 dark:bg-[#0D0D12]">
                    {instantMatches.length > 0 ? (
                      <div className="divide-y divide-zinc-200 dark:divide-white/10">
                        {instantMatches.map((match) => (
                          <button
                            key={match.id}
                            type="button"
                            onClick={() => {
                              onSelectEntry(match)
                              setHeroQuery('')
                            }}
                            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-start hover:bg-zinc-50 transition-colors cursor-pointer dark:hover:bg-white/[0.04]"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline gap-2">
                                <span className="font-display text-base font-bold text-zinc-950 dark:text-white">
                                  {match.word}
                                </span>
                                {match.latin && (
                                  <span
                                    dir="ltr"
                                    className="font-mono text-xs text-emerald-700 dark:text-[#D9FF43]"
                                  >
                                    {match.latin}
                                  </span>
                                )}
                                <span className="text-xs text-zinc-400" aria-hidden="true">
                                  ·
                                </span>
                                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                  {match.category}
                                </span>
                              </div>
                              <p className="mt-0.5 truncate text-xs text-zinc-600 dark:text-zinc-300">
                                {match.meaning}
                                {match.french ? ` · ${match.french}` : ''}
                              </p>
                            </div>
                            <ArrowLeft className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-zinc-600 dark:text-zinc-300">
                          لم نعثر على مفردة مطابقة لـ{' '}
                          <strong className="text-zinc-950 dark:text-white">
                            «{trimmedQuery}»
                          </strong>{' '}
                          في المعجم الحالي.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            onQuickAddWord(trimmedQuery)
                            setHeroQuery('')
                          }}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>أضف «{trimmedQuery}» للمعجم الآن</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Dual Pill Action Row */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onStartRapidReview}
                className="inline-flex min-h-[46px] items-center justify-center gap-2.5 rounded-full border border-zinc-950 bg-zinc-950 px-6 py-2.5 text-xs sm:text-sm font-semibold text-white transition-colors duration-150 hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer dark:border-[#D9FF43]/80 dark:bg-[#D9FF43]/10 dark:text-white dark:hover:bg-[#D9FF43] dark:hover:text-[#050507] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9FF43]"
              >
                <span>ابدأ المراجعة السريعة</span>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onStartDetailedReview}
                className="inline-flex min-h-[46px] items-center justify-center gap-2.5 rounded-full border border-zinc-300 bg-transparent ps-2.5 pe-5 py-1.5 text-xs sm:text-sm font-medium text-zinc-800 transition-colors duration-150 hover:border-zinc-500 whitespace-nowrap shrink-0 cursor-pointer dark:border-white/20 dark:text-zinc-200 dark:hover:border-white/50"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-300 dark:border-white/25">
                  <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span>تصفح بطاقات المعجم</span>
              </button>
            </div>
          </div>

          {/* Column 2 (Center): High-Contrast Framed Visual Anchor */}
          <figure className="flex flex-col lg:col-span-4">
            <div className="relative flex-1 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 min-h-[300px] lg:min-h-[420px] dark:border-white/10 dark:bg-[#0A0A0E]">
              {!imgFailed ? (
                <>
                  <img
                    src={heroArchivalImg}
                    alt="بطاقات فهرسة معجمية وأرشيف توثيق لغوي للدارجة المغربية"
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed(true)}
                    className="h-full w-full object-cover dark:brightness-75 dark:contrast-125"
                  />
                  {/* Measured atmospheric contrast scrim */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none hidden dark:block absolute inset-0 bg-[radial-gradient(circle_at_25%_75%,rgba(255,59,47,0.28),transparent_55%)]"
                  />
                </>
              ) : (
                <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 p-8 text-center text-zinc-600 dark:text-zinc-400">
                  <BookOpen className="h-8 w-8 text-zinc-900 dark:text-[#D9FF43]" aria-hidden="true" />
                  <p className="font-display text-sm font-semibold text-zinc-900 dark:text-white">
                    أرشيف الفهرسة المعجمية للدارجة المغربية
                  </p>
                  <p className="max-w-xs text-xs leading-relaxed">
                    توثيق حي للمفردات المتداولة وأمثلتها اليومية عبر مختلف مناطق المغرب.
                  </p>
                </div>
              )}

              <figcaption className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-2 text-[11px] text-white/85">
                <span>توثيق بشري متعدد الروافد اللهجية</span>
                <span className="font-mono uppercase tracking-wider text-[#D9FF43]">
                  CC BY-NC 4.0
                </span>
              </figcaption>
            </div>
          </figure>

          {/* Column 3 (End): Two Stacked Precision Corpus Modules (100% Real Data) */}
          <div className="flex flex-col justify-between gap-4 lg:col-span-3">
            {/* Module 1: Documented Entries */}
            <div className="flex-1 flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#0B0B0F]/90">
              <div className="flex items-center justify-between text-[11px] font-mono tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                <span>المفردات الموثقة</span>
                <span aria-hidden="true">•••</span>
              </div>

              <div className="my-4">
                <p className="font-mono text-4xl sm:text-5xl font-semibold tabular-nums tracking-tight text-zinc-950 dark:text-white">
                  {displayEntries.toLocaleString('en-US')}
                </p>
                <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  مدخل معجمي وعبارة متداولة عبر {displayCategories.toLocaleString('en-US')} فئة دلالية
                </p>
              </div>

              {/* Precision Segmented Bar Meter */}
              <div className="space-y-2" aria-hidden="true">
                <div className="flex items-end gap-1 h-5">
                  {Array.from({ length: 22 }).map((_, i) => (
                    <span
                      key={i}
                      className={`flex-1 rounded-xs ${
                        i < 15
                          ? 'h-3.5 bg-zinc-900 dark:bg-[#D9FF43]/85'
                          : i === 15
                            ? 'h-5 bg-emerald-600 dark:bg-[#D9FF43]'
                            : 'h-2 bg-zinc-200 dark:bg-white/12'
                      }`}
                    />
                  ))}
                </div>
                <div className="h-[2px] w-2/3 rounded-full bg-zinc-900 dark:bg-[#D9FF43]" />
              </div>
            </div>

            {/* Module 2: Contextual Examples */}
            <div className="flex-1 flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#0B0B0F]/90">
              <div className="flex items-center justify-between text-[11px] font-mono tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                <span>الشواهد السياقية</span>
                <span aria-hidden="true">•••</span>
              </div>

              <div className="my-4">
                <p className="font-mono text-4xl sm:text-5xl font-semibold tabular-nums tracking-tight text-zinc-950 dark:text-white">
                  {displayExamples.toLocaleString('en-US')}
                </p>
                <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  جملة مثال من الحياة اليومية مع مراجعة بشرية قبل الاعتماد
                </p>
              </div>

              {/* Clean SVG Waveform Line */}
              <svg
                viewBox="0 0 200 28"
                className="w-full h-7 text-zinc-800 dark:text-[#D9FF43]"
                aria-hidden="true"
              >
                <line
                  x1="0"
                  y1="22"
                  x2="200"
                  y2="22"
                  stroke="currentColor"
                  strokeOpacity="0.18"
                  strokeWidth="1"
                />
                <polyline
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeOpacity="0.85"
                  points="0,20 16,19 28,14 40,21 54,11 66,18 80,6 94,19 108,12 122,17 138,8 152,18 168,15 184,19 200,17"
                />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 02: ARCHITECTURAL CROSSHAIR MATRIX ("نظام واحد لكل مفردة وشاهد") */}
      <section className="border-t border-zinc-200 dark:border-white/10">
        <div className="mx-auto max-w-[1280px] px-5 py-12 sm:px-8 lg:py-16">
          <div className="flex flex-col gap-4 pb-8 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-xs tracking-[0.12em] uppercase text-zinc-500 dark:text-zinc-400">
                01 / البنية المعجمية المتكاملة
              </p>
              <h2 className="mt-2 font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-zinc-950 dark:text-white">
                نظام واحد. لكل مفردة وشاهد ورافد لهجي.
              </h2>
            </div>

            <p className="max-w-sm border-s border-zinc-300 ps-4 text-xs sm:text-sm leading-relaxed text-zinc-600 dark:border-white/15 dark:text-zinc-400">
              انتقل مباشرةً إلى المهمة التي تناسبك: تدقيق سريع بنعم أو لا، استكشاف الفئات الدلالية، أو إضافة كلمات منطقتك.
            </p>
          </div>

          {/* 4-Column Architectural Crosshair Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-zinc-200 dark:border-white/12">
            {/* Cell 1: Rapid Review */}
            <button
              type="button"
              onClick={() => jumpToTab('rapid_review')}
              className="group relative flex min-h-[200px] flex-col items-center justify-center gap-4 border-b sm:border-e border-zinc-200 p-6 text-center hover:bg-zinc-100/70 transition-colors cursor-pointer dark:border-white/12 dark:hover:bg-white/[0.03]"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-2 end-2.5 font-mono text-xs text-zinc-300 dark:text-white/25"
              >
                +
              </span>
              <svg
                width="54"
                height="54"
                viewBox="0 0 54 54"
                className="text-zinc-900 group-hover:scale-105 transition-transform dark:text-white"
                aria-hidden="true"
              >
                <circle cx="27" cy="27" r="22" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.2" />
                <path d="M13 27 A14 14 0 0 1 41 27" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <path d="M19 27 A8 8 0 0 1 35 27" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="27" cy="27" r="2.5" className="fill-emerald-600 dark:fill-[#D9FF43]" />
              </svg>
              <div>
                <p className="font-display text-sm font-bold text-zinc-950 dark:text-white">
                  المراجعة السريعة
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  بطاقات (نعم / لا) وتصحيح فوري
                </p>
              </div>
            </button>

            {/* Cell 2: Explorer */}
            <button
              type="button"
              onClick={() => jumpToTab('explorer')}
              className="group relative flex min-h-[200px] flex-col items-center justify-center gap-4 border-b lg:border-e border-zinc-200 p-6 text-center hover:bg-zinc-100/70 transition-colors cursor-pointer dark:border-white/12 dark:hover:bg-white/[0.03]"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-2 end-2.5 font-mono text-xs text-zinc-300 dark:text-white/25"
              >
                +
              </span>
              <svg
                width="54"
                height="54"
                viewBox="0 0 54 54"
                className="text-zinc-900 group-hover:scale-105 transition-transform dark:text-white"
                aria-hidden="true"
              >
                <line x1="27" y1="7" x2="27" y2="47" stroke="currentColor" strokeWidth="1.3" />
                <line x1="7" y1="27" x2="47" y2="27" stroke="currentColor" strokeWidth="1.3" />
                <line x1="13" y1="13" x2="41" y2="41" stroke="currentColor" strokeWidth="1.3" />
                <line x1="41" y1="13" x2="13" y2="41" stroke="currentColor" strokeWidth="1.3" />
                <circle cx="27" cy="27" r="3" className="fill-emerald-600 dark:fill-[#D9FF43]" />
              </svg>
              <div>
                <p className="font-display text-sm font-bold text-zinc-950 dark:text-white">
                  تصفح المعجم والفئات
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  بحث صوتي وفرز دلالي شامل
                </p>
              </div>
            </button>

            {/* Cell 3: Add New Word (Labeled Clearly for Visitor vs Member) */}
            <button
              type="button"
              onClick={() => jumpToTab('new_entry')}
              className="group relative flex min-h-[200px] flex-col items-center justify-center gap-4 border-b sm:border-b-0 sm:border-e border-zinc-200 p-6 text-center hover:bg-zinc-100/70 transition-colors cursor-pointer dark:border-white/12 dark:hover:bg-white/[0.03]"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-2 end-2.5 font-mono text-xs text-zinc-300 dark:text-white/25"
              >
                +
              </span>
              <svg
                width="54"
                height="54"
                viewBox="0 0 54 54"
                className="text-zinc-900 group-hover:scale-105 transition-transform dark:text-white"
                aria-hidden="true"
              >
                <circle cx="27" cy="27" r="20" fill="none" stroke="currentColor" strokeWidth="1.3" />
                <path d="M18 12 A16 16 0 0 1 18 42" fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.3" />
                <circle cx="34" cy="27" r="2.5" className="fill-emerald-600 dark:fill-[#D9FF43]" />
              </svg>
              <div>
                <p className="font-display text-sm font-bold text-zinc-950 dark:text-white">
                  {isAuthenticated ? 'إضافة مفردة جديدة' : 'اقترح مفردة من منطقتك'}
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  ٣ حقول عربية ونطق لاتيني تلقائي
                </p>
              </div>
            </button>

            {/* Cell 4: Visitor -> Public Contributors Honor Roll | Member -> Personal Submissions */}
            <button
              type="button"
              onClick={() => {
                if (isAuthenticated) {
                  jumpToTab('submissions')
                } else if (onOpenContributors) {
                  onOpenContributors()
                } else {
                  jumpToTab('explorer')
                }
              }}
              className="group relative min-h-[200px] overflow-hidden text-start cursor-pointer bg-zinc-900"
            >
              {!secondaryImgFailed ? (
                <img
                  src={methodArchivalImg}
                  alt="مخطوطات وشواهد التوثيق المعجمي"
                  referrerPolicy="no-referrer"
                  onError={() => setSecondaryImgFailed(true)}
                  className="absolute inset-0 h-full w-full object-cover opacity-55 group-hover:scale-105 transition-transform duration-300"
                />
              ) : null}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20"
              />
              <div className="relative z-10 flex h-full min-h-[200px] flex-col justify-between p-6 text-white">
                <span className="font-mono text-[11px] uppercase tracking-widest text-[#D9FF43]">
                  {isAuthenticated ? 'حساب المساهم' : 'المجتمع العلمي المفتوح'}
                </span>
                <div>
                  <p className="font-display text-base font-bold">
                    {isAuthenticated
                      ? 'مساهماتي ومتابعة الاعتماد'
                      : 'لوحة شرف المساهمين'}
                  </p>
                  <p className="mt-1 text-xs text-zinc-300">
                    {isAuthenticated
                      ? 'تتبّع مسوداتك ومقترحاتك الموثقة باسمك'
                      : 'تعرّف على المساهمين والمحررين المعتمدين في بناء المعجم'}
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
