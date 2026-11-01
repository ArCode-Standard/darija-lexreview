import { Moon, Sun } from 'lucide-react'

interface FooterProps {
  darkMode: boolean
  onToggleDarkMode: () => void
  isStaffRole: boolean
  editorialPreviewMode: boolean
  onToggleEditorialPreview: () => void
}

export function Footer({
  darkMode,
  onToggleDarkMode,
  isStaffRole,
  editorialPreviewMode,
  onToggleEditorialPreview,
}: FooterProps) {
  return (
    <footer className="border-t border-[#E5DFD3] bg-[#F3EFE6]/60 dark:border-[#2E2B27] dark:bg-[#141312]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-display text-sm font-bold text-stone-900 dark:text-stone-100">
            ArCode Standard · Darija LexReview
          </p>
          <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
            البنية التحتية المعيارية المفتوحة لتدقيق وتوثيق معجم الدارجة المغربية. كود المنصة مرخص بموجب MIT؛ يخضع المتن المعجمي لرخصة مستودع البيانات الرسمي.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600 dark:text-stone-400 shrink-0">
          <a
            href="https://github.com/ArCode-Standard/moroccan-darija-dataset"
            target="_blank"
            rel="noreferrer"
            className="hover:text-stone-900 hover:underline whitespace-nowrap dark:hover:text-stone-100"
          >
            المعجم الرسمي
          </a>
          <span aria-hidden="true">·</span>
          <a
            href="https://github.com/ArCode-Standard/darija-lexreview"
            target="_blank"
            rel="noreferrer"
            className="hover:text-stone-900 hover:underline whitespace-nowrap dark:hover:text-stone-100"
          >
            مستودع المنصة
          </a>
          {!isStaffRole && (
            <>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={onToggleEditorialPreview}
                className={`hover:underline whitespace-nowrap cursor-pointer ${
                  editorialPreviewMode
                    ? 'font-semibold text-[#0F5C4E] dark:text-[#4FD1C5]'
                    : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
                }`}
              >
                {editorialPreviewMode ? 'إغلاق معاينة بيئة المحررين' : 'معاينة بيئة المحررين'}
              </button>
            </>
          )}
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#D6CEBE] bg-white px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-[#FBF9F5] transition-colors whitespace-nowrap shrink-0 cursor-pointer dark:border-[#3A3530] dark:bg-[#1C1A18] dark:text-stone-200 dark:hover:bg-[#262320]"
          >
            {darkMode ? (
              <>
                <Sun className="h-3.5 w-3.5" aria-hidden="true" />
                <span>الوضع النهاري</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>الوضع الليلي</span>
              </>
            )}
          </button>
        </div>
      </div>
    </footer>
  )
}
