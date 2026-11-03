import { Moon, Sun } from 'lucide-react'

interface FooterProps {
  darkMode: boolean
  onToggleDarkMode: () => void
  onOpenContributors?: () => void
}

export function Footer({
  darkMode,
  onToggleDarkMode,
  onOpenContributors,
}: FooterProps) {
  return (
    <footer className="border-t border-zinc-200 bg-zinc-50/70 dark:border-white/10 dark:bg-[#050507]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-display text-sm font-bold text-zinc-950 dark:text-white">
            ArCode Standard · <span className="text-emerald-700 dark:text-[#D9FF43]">Darija LexReview</span>
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            كود المنصة مرخص بموجب MIT؛ يخضع المتن المعجمي لرخصة مستودع البيانات الرسمي CC BY-NC 4.0.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-600 dark:text-zinc-400 shrink-0">
          <a
            href="/contributors"
            onClick={(e) => {
              if (onOpenContributors) {
                e.preventDefault()
                onOpenContributors()
              }
            }}
            className="font-medium text-emerald-800 hover:text-zinc-950 hover:underline whitespace-nowrap dark:text-[#D9FF43] dark:hover:text-white"
          >
            لوحة المساهمين
          </a>
          <span aria-hidden="true">·</span>
          <a href="https://github.com/ArCode-Standard/moroccan-darija-dataset" target="_blank" rel="noreferrer" className="hover:text-zinc-950 hover:underline whitespace-nowrap dark:hover:text-white">المعجم الرسمي</a>
          <span aria-hidden="true">·</span>
          <a href="/about/" className="hover:text-zinc-950 hover:underline whitespace-nowrap dark:hover:text-white">عن المنصة</a>
          <span aria-hidden="true">·</span>
          <a href="/methodology/" className="hover:text-zinc-950 hover:underline whitespace-nowrap dark:hover:text-white">المنهجية</a>
          <span aria-hidden="true">·</span>
          <a href="/privacy/" className="hover:text-zinc-950 hover:underline whitespace-nowrap dark:hover:text-white">الخصوصية</a>
          <span aria-hidden="true">·</span>
          <a href="/terms/" className="hover:text-zinc-950 hover:underline whitespace-nowrap dark:hover:text-white">الشروط</a>
          <span aria-hidden="true">·</span>
          <a href="/reporting/" className="hover:text-zinc-950 hover:underline whitespace-nowrap dark:hover:text-white">الإبلاغ</a>
          <span aria-hidden="true">·</span>
          <a href="/attribution/" className="hover:text-zinc-950 hover:underline whitespace-nowrap dark:hover:text-white">الإسناد والترخيص</a>
          <span aria-hidden="true">·</span>
          <a href="https://github.com/ArCode-Standard/darija-lexreview" target="_blank" rel="noreferrer" className="hover:text-zinc-950 hover:underline whitespace-nowrap dark:hover:text-white">مستودع المنصة</a>
          <span aria-hidden="true">·</span>
          <button type="button" onClick={onToggleDarkMode} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer dark:border-white/15 dark:bg-[#0C0C10] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60">
            {darkMode ? <><Sun className="h-3.5 w-3.5" aria-hidden="true" /><span>الوضع النهاري</span></> : <><Moon className="h-3.5 w-3.5" aria-hidden="true" /><span>الوضع الليلي</span></>}
          </button>
        </div>
      </div>
    </footer>
  )
}
