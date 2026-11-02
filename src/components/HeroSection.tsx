import { useState } from 'react'
import { ArrowLeft, BookOpen } from 'lucide-react'
import heroArchivalImg from '../assets/images/hero_moroccan_lexicon_1793533512520.jpg'
import type { DataMode } from '../types/lexicon'

interface HeroSectionProps {
  entriesCount: number
  categoriesCount: number
  examplesCount: number
  dataMode: DataMode
  onStartRapidReview: () => void
  onStartDetailedReview: () => void
}

export function HeroSection({
  entriesCount,
  categoriesCount,
  examplesCount,
  dataMode,
  onStartRapidReview,
  onStartDetailedReview,
}: HeroSectionProps) {
  const [imgFailed, setImgFailed] = useState(false)

  const isRealCorpus = dataMode === 'live' || dataMode === 'cached'
  const displayEntries = isRealCorpus ? entriesCount : 921
  const displayCategories = isRealCorpus ? categoriesCount : 38
  const displayExamples = isRealCorpus && examplesCount > 0 ? examplesCount : 146

  return (
    <section className="mx-auto max-w-[1280px] px-5 pt-10 pb-12 sm:px-8 lg:pt-16 lg:pb-16">
      <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="flex flex-col justify-between lg:col-span-7">
          <div>
            <p className="text-xs font-semibold text-[#0F5C4E] dark:text-[#4FD1C5] dark:tracking-wide">
              مبادرة ArCode Standard للمعايير اللغوية المفتوحة · الإصدار التعاوني
            </p>

            <h1 className="mt-4 font-display text-[clamp(2.25rem,4vw,3.65rem)] font-bold leading-[1.2] tracking-tight text-stone-900 [text-wrap:balance] dark:text-stone-100">
              نوثّق مفردات الدارجة المغربية، شاهدًا بشاهد وبمراجعة بشرية مسؤولة.
            </h1>

            <p className="mt-6 max-w-[65ch] text-base leading-[1.8] text-stone-600 dark:text-stone-300 dark:tracking-[0.01em]">
              شارك في تدقيق المفردات ببطاقات سريعة (نعم / لا / تصحيح فوري مع توليد تلقائي للـ Arabizi)، أو افحص المتن التفصيلي وحكّم المقترحات قبل تصديرها للمستودع الرسمي.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-[#E5DFD3] dark:border-[#2E2B27]">
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={onStartRapidReview}
                className="inline-flex min-h-[44px] items-center justify-center gap-2.5 rounded-lg bg-[#0F5C4E] px-6 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#0B463B] whitespace-nowrap shrink-0 cursor-pointer dark:bg-[#147A67] dark:hover:bg-[#0F5C4E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F5C4E]"
              >
                <span>ابدأ المراجعة السريعة (نعم / لا)</span>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onStartDetailedReview}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#D6CEBE] bg-white px-5 py-2.5 text-sm font-medium text-stone-800 transition-colors duration-150 hover:bg-[#F3EFE6] whitespace-nowrap shrink-0 cursor-pointer dark:border-[#3A3530] dark:bg-[#1C1A18] dark:text-stone-200 dark:hover:bg-[#262320]"
              >
                الفحص التفصيلي للمعجم
              </button>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
              <span>المعجم الأساسي محفوظ في GitHub</span>
              <span aria-hidden="true">·</span>
              <span>المساهمات تُحفظ مقترحاتٍ مستقلة</span>
              <span aria-hidden="true">·</span>
              <span>رخصة المتن CC BY-NC 4.0</span>
            </div>
          </div>
        </div>

        <figure className="flex flex-col lg:col-span-5">
          <div className="relative flex-1 overflow-hidden rounded-xl border border-[#E5DFD3] bg-[#EFECE4] min-h-[260px] dark:border-[#2E2B27] dark:bg-[#1C1A18]">
            {!imgFailed ? (
              <img
                src={heroArchivalImg}
                alt="دفتر أرشيفي وبطاقات فهرسة معجمية على مكتب خشبي تحت إضاءة طبيعية هادئة"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="h-full w-full object-cover lg:h-full"
              />
            ) : (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 p-8 text-center text-stone-600 dark:text-stone-400">
                <BookOpen className="h-8 w-8 text-[#0F5C4E] dark:text-[#4FD1C5]" aria-hidden="true" />
                <p className="font-display text-sm font-semibold text-stone-800 dark:text-stone-200">
                  أرشيف الفهرسة المعجمية للدارجة المغربية
                </p>
                <p className="max-w-xs text-xs leading-relaxed">
                  فصل منهجي بين جمع المقترحات الميدانية وبين اعتماد المتن الرسمي.
                </p>
              </div>
            )}
          </div>
          <figcaption className="mt-2.5 text-xs text-stone-500 dark:text-stone-400">
            شكل ١ — توثيق المفردات المتداولة ومقابلاتها الفصيحة والفرنسية ضمن سياقاتها الأصيلة.
          </figcaption>
        </figure>
      </div>

      <div
        aria-label="مؤشرات المتن المعجمي"
        className="mt-12 grid grid-cols-2 gap-y-6 border-y border-[#E5DFD3] py-7 lg:grid-cols-4 dark:border-[#2E2B27]"
      >
        <div className="pe-4 lg:border-e lg:border-[#E5DFD3] lg:dark:border-[#2E2B27]">
          <dd className="font-mono text-2xl sm:text-3xl font-semibold tabular-nums text-stone-900 dark:text-stone-100">
            {displayEntries.toLocaleString('en-US')}
          </dd>
          <dt className="mt-1 text-xs text-stone-600 dark:text-stone-400">
            مدخل معجمي مفهرس في المتن الرسمي
          </dt>
        </div>

        <div className="ps-4 lg:px-6 lg:border-e lg:border-[#E5DFD3] lg:dark:border-[#2E2B27]">
          <dd className="font-mono text-2xl sm:text-3xl font-semibold tabular-nums text-stone-900 dark:text-stone-100">
            {displayCategories.toLocaleString('en-US')}
          </dd>
          <dt className="mt-1 text-xs text-stone-600 dark:text-stone-400">
            فئة دلالية وتداولية مصنفة
          </dt>
        </div>

        <div className="pe-4 pt-4 border-t border-[#E5DFD3] lg:pt-0 lg:border-t-0 lg:px-6 lg:border-e lg:border-[#E5DFD3] dark:border-[#2E2B27] lg:dark:border-[#2E2B27]">
          <dd className="font-mono text-2xl sm:text-3xl font-semibold tabular-nums text-stone-900 dark:text-stone-100">
            {displayExamples.toLocaleString('en-US')}
          </dd>
          <dt className="mt-1 text-xs text-stone-600 dark:text-stone-400">
            شاهد سياقي مربوط بمدخله المعجمي
          </dt>
        </div>

        <div className="ps-4 pt-4 border-t border-[#E5DFD3] lg:pt-0 lg:border-t-0 lg:ps-6 dark:border-[#2E2B27]">
          <dd className="font-display text-2xl sm:text-3xl font-semibold text-stone-900 dark:text-stone-100">
            اعتماد بشري
          </dd>
          <dt className="mt-1 text-xs text-stone-600 dark:text-stone-400">
            مراجعة محررين مخولين قبل أي دمج في GitHub
          </dt>
        </div>
      </div>
    </section>
  )
}
