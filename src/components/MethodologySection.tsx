import { ArrowLeft, ChevronLeft, ExternalLink } from 'lucide-react'
import type { WorkbenchTab } from '../types/lexicon'

interface MethodologySectionProps {
  isAuthenticated?: boolean
  onOpenContributors?: () => void
  onSelectWorkbenchTab?: (tab: WorkbenchTab) => void
}

const METHODOLOGY_STEPS: Array<{
  index: string
  title: string
  description: string
  targetTab: WorkbenchTab
  glyph: 'radial' | 'matrix' | 'nodes' | 'rings'
}> = [
  {
    index: '01',
    title: 'رصد الشاهد اليومي',
    description:
      'جمع مفردات وعبارات حقيقية من التخاطب اليومي والمدونات المفتوحة عبر مختلف مناطق المغرب.',
    targetTab: 'new_entry',
    glyph: 'radial',
  },
  {
    index: '02',
    title: 'ضبط الدلالة والسياق',
    description:
      'تحديد المعنى الفصيح الدقيق والمقابل الفرنسي وربط الكلمة بجملة سياقية تكشف استعمالها الفعلي.',
    targetTab: 'explorer',
    glyph: 'matrix',
  },
  {
    index: '03',
    title: 'التثبّت المجتمعي السريع',
    description:
      'مراجعة بشرية متقاطعة تتحقق من صحة الرسم والنطق والانتشار اللهجي للمفردة أو الشاهد.',
    targetTab: 'rapid_review',
    glyph: 'nodes',
  },
  {
    index: '04',
    title: 'الاعتماد والنشر المفتوح',
    description:
      'تحكيم المحررين المعتمدين ودمج التحديثات الموقعة رقمياً في مستودع المعجم المفتوح.',
    targetTab: 'submissions',
    glyph: 'rings',
  },
]

function StepGlyph({ kind }: { kind: 'radial' | 'matrix' | 'nodes' | 'rings' }) {
  if (kind === 'radial') {
    return (
      <svg width="46" height="46" viewBox="0 0 46 46" className="text-zinc-900 dark:text-white" aria-hidden="true">
        <circle cx="23" cy="23" r="3" className="fill-emerald-600 dark:fill-[#D9FF43]" />
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180
          const x1 = 23 + Math.cos(angle) * 10
          const y1 = 23 + Math.sin(angle) * 10
          const x2 = 23 + Math.cos(angle) * 18
          const y2 = 23 + Math.sin(angle) * 18
          return (
            <g key={i}>
              <circle cx={x1} cy={y1} r="1.3" fill="currentColor" fillOpacity="0.85" />
              <circle cx={x2} cy={y2} r="1.1" fill="currentColor" fillOpacity="0.45" />
            </g>
          )
        })}
      </svg>
    )
  }

  if (kind === 'matrix') {
    return (
      <svg width="46" height="46" viewBox="0 0 46 46" className="text-zinc-900 dark:text-white" aria-hidden="true">
        {[9, 16, 23, 30, 37].map((y, ry) =>
          [9, 16, 23, 30, 37].map((x, cx) => {
            const isAccent = (ry === 0 && cx === 4) || (ry === 2 && cx === 2)
            return (
              <circle
                key={`${ry}-${cx}`}
                cx={x}
                cy={y}
                r={isAccent ? 2.1 : 1.4}
                className={
                  isAccent
                    ? 'fill-emerald-600 dark:fill-[#D9FF43]'
                    : cx > 2 && ry > 2
                      ? 'fill-current opacity-35'
                      : 'fill-current opacity-90'
                }
              />
            )
          }),
        )}
      </svg>
    )
  }

  if (kind === 'nodes') {
    const outer = [
      [23, 7],
      [37, 15],
      [37, 31],
      [23, 39],
      [9, 31],
      [9, 15],
    ]
    return (
      <svg width="46" height="46" viewBox="0 0 46 46" className="text-zinc-900 dark:text-white" aria-hidden="true">
        {outer.map(([x, y], idx) => (
          <line
            key={idx}
            x1="23"
            y1="23"
            x2={x}
            y2={y}
            stroke="currentColor"
            strokeOpacity="0.55"
            strokeWidth="1.2"
          />
        ))}
        {outer.map(([x, y], idx) => (
          <circle key={`c-${idx}`} cx={x} cy={y} r="2.2" fill="currentColor" />
        ))}
        <circle cx="23" cy="23" r="3" className="fill-emerald-600 dark:fill-[#D9FF43]" />
      </svg>
    )
  }

  return (
    <svg width="46" height="46" viewBox="0 0 46 46" className="text-zinc-900 dark:text-white" aria-hidden="true">
      <circle cx="23" cy="23" r="18" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.2" />
      <circle cx="23" cy="23" r="11" fill="none" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.3" />
      <circle cx="23" cy="23" r="3.2" className="fill-emerald-600 dark:fill-[#D9FF43]" />
    </svg>
  )
}

export function MethodologySection({
  isAuthenticated = false,
  onOpenContributors,
  onSelectWorkbenchTab,
}: MethodologySectionProps) {
  const handleJump = (tab: WorkbenchTab) => {
    if (tab === 'submissions' && !isAuthenticated && onOpenContributors) {
      onOpenContributors()
      return
    }
    onSelectWorkbenchTab?.(tab)
  }

  return (
    <section
      id="method"
      className="relative overflow-hidden border-t border-zinc-200 dark:border-white/10"
    >
      {/* Subtle Ambient Coral & Chartreuse Light Ribbons (Dark Mode) */}
      <div
        aria-hidden="true"
        className="pointer-events-none hidden dark:block absolute inset-0"
      >
        <div className="absolute -bottom-24 left-1/4 h-[380px] w-[680px] -rotate-12 rounded-full bg-[#FF3B2F]/16 blur-[130px]" />
        <div className="absolute top-12 right-12 h-[220px] w-[360px] rounded-full bg-[#D9FF43]/8 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-[1280px] px-5 py-16 sm:px-8 lg:py-24">
        {/* Section Heading */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs tracking-[0.12em] uppercase text-zinc-500 dark:text-zinc-400">
              03 / طبقات التحقق والحوكمة
            </p>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-zinc-950 [text-wrap:balance] dark:text-white">
              من الشاهد المتداول إلى الاعتماد المعياري.
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <a
              href="https://github.com/ArCode-Standard/moroccan-darija-dataset"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-zinc-800 hover:underline whitespace-nowrap dark:text-[#D9FF43]"
            >
              <span>مستودع البيانات المفتوح</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <span className="text-zinc-300 dark:text-white/20" aria-hidden="true">·</span>
            <a
              href="https://github.com/ArCode-Standard/darija-lexreview"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-zinc-600 hover:text-zinc-950 hover:underline whitespace-nowrap dark:text-zinc-400 dark:hover:text-white"
            >
              <span>شفرة المنصة</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>

        {/* 4 Translucent Glassmorphic Cards */}
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {METHODOLOGY_STEPS.map((step) => (
            <article
              key={step.index}
              className="group flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white/90 p-6 backdrop-blur-md transition-colors hover:border-zinc-400 dark:border-white/12 dark:bg-[#101016]/80 dark:hover:border-white/30"
            >
              <div>
                <span className="font-mono text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
                  {step.index}
                </span>

                <div className="mt-5">
                  <StepGlyph kind={step.glyph} />
                </div>

                <h3 className="mt-6 font-display text-lg font-bold text-zinc-950 dark:text-white">
                  {step.title}
                </h3>
                <p className="mt-2.5 text-xs sm:text-sm leading-[1.75] text-zinc-600 dark:text-zinc-400">
                  {step.description}
                </p>
              </div>

              <div className="mt-7 pt-2">
                <button
                  type="button"
                  onClick={() => handleJump(step.targetTab)}
                  aria-label={`انتقل إلى ${step.title}`}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 text-zinc-700 transition-colors hover:border-zinc-950 hover:bg-zinc-950 hover:text-white cursor-pointer dark:border-white/25 dark:text-white dark:hover:border-[#D9FF43] dark:hover:bg-[#D9FF43] dark:hover:text-[#050507]"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>

        {/* Bottom Conversion Callout Band (Signal Coral Pill CTA) */}
        <div className="mt-16 flex flex-col items-start justify-between gap-6 border-t border-zinc-200 pt-12 sm:flex-row sm:items-center dark:border-white/10">
          <div>
            <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 [text-wrap:balance] dark:text-white">
              ابنِ معنا مرجعاً مفتوحاً وحيّاً للدارجة المغربية.
            </h3>
            <p className="mt-1.5 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
              مساهمة واحدة في الدقيقة تحفظ مفردة متداولة وتوثقها للأجيال والباحثين.
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleJump('rapid_review')}
            className="inline-flex min-h-[48px] items-center gap-2.5 rounded-full bg-[#FF3B2F] px-7 py-3 text-xs sm:text-sm font-bold text-white transition-colors hover:bg-[#ff5247] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF3B2F]"
          >
            <span>ابدأ التدقيق السريع الآن</span>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}
