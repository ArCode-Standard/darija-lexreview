import { useState } from 'react'
import { ExternalLink, FileText } from 'lucide-react'
import methodArchivalImg from '../assets/images/method_archival_manuscript_1793533512528.jpg'

const METHODOLOGY_STEPS = [
  {
    index: '01',
    title: 'رصد الشاهد الأولي',
    description:
      'جمع شواهد حقيقية من مدونات أو محادثات أو تسجيلات عامة، دون التعامل مع مجرد ظهور الكلمة في محرك البحث بوصفه حجة لغوية كافية.',
  },
  {
    index: '02',
    title: 'تحليل التركيب والسياق',
    description:
      'قراءة الجملة كاملة لتعيين المعنى المقصود بدقة، والتمييز بين المشترك اللفظي والتعابير الاصطلاحية ومستويات التخاطب.',
  },
  {
    index: '03',
    title: 'التثبت من التداول المغربي',
    description:
      'التحقق من كون اللفظ أو التركيب مستعملاً فعلاً في اللسان الدارج المغربي، لا مجرد تشابه رسم كتابي مع لهجة أخرى أو ترجمة حرفية.',
  },
  {
    index: '04',
    title: 'التحكيم البشري والدمج المعياري',
    description:
      'تُحفظ كل مساهمة في سجل المراجعة بحالة قيد التدقيق، ولا تنتقل إلى مستودع البيانات الرسمي إلا بعد فحص محرر مخوّل عبر طلب دمج موثق.',
  },
]

export function MethodologySection() {
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <section
      id="method"
      className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 lg:py-24 border-t border-[#E5DFD3] dark:border-[#2E2B27]"
    >
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12 items-start">
        <div className="lg:col-span-5">
          <p className="text-xs font-semibold text-[#0F5C4E] dark:text-[#4FD1C5]">
            معيار التحقق اللغوي · الحوكمة التحريرية
          </p>
          <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-stone-900 [text-wrap:balance] dark:text-stone-100">
            نفصل بين العثور على الكلمة وبين إثبات دلالتها واستعمالها.
          </h2>
          <p className="mt-4 max-w-[60ch] text-sm leading-[1.85] text-stone-600 dark:text-stone-300">
            صُممت منصة Darija LexReview لتكون طبقة تدقيق مستقلة تحمي المعجم الرسمي من التعديلات الآلية المتسرعة، مع تيسير المشاركة العلمية المفتوحة دون اشتراط التعامل المباشر مع أوامر Git.
          </p>

          <figure className="mt-8">
            <div className="overflow-hidden rounded-xl border border-[#E5DFD3] bg-[#EFECE4] aspect-video dark:border-[#2E2B27] dark:bg-[#1C1A18]">
              {!imgFailed ? (
                <img
                  src={methodArchivalImg}
                  alt="مجلد مرجعي وعدسة فحص بصرية وأوراق أرشيفية على سطح حجري فاتح"
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center text-stone-600 dark:text-stone-400">
                  <FileText className="h-6 w-6 text-[#0F5C4E] dark:text-[#4FD1C5]" aria-hidden="true" />
                  <span className="text-xs font-medium">سلسلة التوثيق والمراجعة المعيارية</span>
                </div>
              )}
            </div>
            <figcaption className="mt-2.5 text-xs text-stone-500 dark:text-stone-400">
              شكل ٢ — دورة الفحص الأربع: من جمع الشاهد المستقل إلى الاعتماد التحريري.
            </figcaption>
          </figure>
        </div>

        <div className="lg:col-span-7">
          <div className="divide-y divide-[#E5DFD3] border-y border-[#E5DFD3] dark:divide-[#2E2B27] dark:border-[#2E2B27]">
            {METHODOLOGY_STEPS.map((step) => (
              <article key={step.index} className="py-6 sm:py-7 flex gap-5 items-start">
                <span className="font-mono text-sm font-semibold tabular-nums text-[#0F5C4E] pt-0.5 shrink-0 dark:text-[#4FD1C5]">
                  {step.index}.
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold text-stone-900 dark:text-stone-100">
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-[65ch] text-sm leading-[1.8] text-stone-600 dark:text-stone-300">
                    {step.description}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#E5DFD3] bg-white p-5 dark:border-[#2E2B27] dark:bg-[#1C1A18]">
            <div>
              <h4 className="font-display text-sm font-semibold text-stone-900 dark:text-stone-100">
                المعجم الرسمي يظل المصدر الوحيد للحقيقة
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
                قاعدة بيانات المراجعات تستقبل المقترحات فقط، بينما تُنشر النسخ المعتمدة في مستودع البيانات المفتوح.
              </p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <a
                href="https://github.com/ArCode-Standard/moroccan-darija-dataset"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F5C4E] hover:underline whitespace-nowrap shrink-0 dark:text-[#4FD1C5]"
              >
                <span>مستودع البيانات</span>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              <span className="text-stone-300 dark:text-stone-700" aria-hidden="true">·</span>
              <a
                href="https://github.com/ArCode-Standard/darija-lexreview"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 hover:underline whitespace-nowrap shrink-0 dark:text-stone-300 dark:hover:text-stone-100"
              >
                <span>شفرة المنصة</span>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
