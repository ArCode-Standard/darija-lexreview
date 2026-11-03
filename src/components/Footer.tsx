interface FooterProps {
  onOpenContributors?: () => void
}

export function Footer({ onOpenContributors }: FooterProps) {
  return (
    <footer className="border-t border-zinc-200 bg-zinc-100/70 transition-colors dark:border-white/10 dark:bg-[#050507]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-5 px-5 py-10 sm:px-8 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="font-display text-sm font-bold text-zinc-950 dark:text-white">
            ArCode Standard ·{' '}
            <span className="text-emerald-700 dark:text-[#D9FF43]">Darija LexReview</span>
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            كود المنصة مرخص بموجب MIT؛ يخضع المتن المعجمي لرخصة مستودع البيانات الرسمي CC BY-NC 4.0.
          </p>
        </div>

        <nav
          aria-label="روابط تعريفية وقانونية"
          className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-zinc-600 dark:text-zinc-400"
        >
          <a
            href="/contributors"
            onClick={(e) => {
              if (onOpenContributors) {
                e.preventDefault()
                onOpenContributors()
              }
            }}
            className="font-semibold text-emerald-700 hover:text-emerald-900 hover:underline underline-offset-4 whitespace-nowrap transition-colors dark:text-[#D9FF43] dark:hover:text-white"
          >
            لوحة المساهمين
          </a>
          <span aria-hidden="true" className="text-zinc-300 dark:text-white/20">
            ·
          </span>
          <a
            href="/about/"
            className="hover:text-emerald-700 hover:underline underline-offset-4 whitespace-nowrap transition-colors dark:hover:text-[#D9FF43]"
          >
            عن المنصة
          </a>
          <span aria-hidden="true" className="text-zinc-300 dark:text-white/20">
            ·
          </span>
          <a
            href="/methodology/"
            className="hover:text-emerald-700 hover:underline underline-offset-4 whitespace-nowrap transition-colors dark:hover:text-[#D9FF43]"
          >
            المنهجية
          </a>
          <span aria-hidden="true" className="text-zinc-300 dark:text-white/20">
            ·
          </span>
          <a
            href="/privacy/"
            className="hover:text-emerald-700 hover:underline underline-offset-4 whitespace-nowrap transition-colors dark:hover:text-[#D9FF43]"
          >
            الخصوصية
          </a>
          <span aria-hidden="true" className="text-zinc-300 dark:text-white/20">
            ·
          </span>
          <a
            href="/terms/"
            className="hover:text-emerald-700 hover:underline underline-offset-4 whitespace-nowrap transition-colors dark:hover:text-[#D9FF43]"
          >
            الشروط
          </a>
          <span aria-hidden="true" className="text-zinc-300 dark:text-white/20">
            ·
          </span>
          <a
            href="/reporting/"
            className="hover:text-emerald-700 hover:underline underline-offset-4 whitespace-nowrap transition-colors dark:hover:text-[#D9FF43]"
          >
            الإبلاغ
          </a>
          <span aria-hidden="true" className="text-zinc-300 dark:text-white/20">
            ·
          </span>
          <a
            href="/attribution/"
            className="hover:text-emerald-700 hover:underline underline-offset-4 whitespace-nowrap transition-colors dark:hover:text-[#D9FF43]"
          >
            الإسناد والترخيص
          </a>
          <span aria-hidden="true" className="text-zinc-300 dark:text-white/20">
            ·
          </span>
          <a
            href="https://github.com/ArCode-Standard/moroccan-darija-dataset"
            target="_blank"
            rel="noreferrer"
            className="hover:text-emerald-700 hover:underline underline-offset-4 whitespace-nowrap transition-colors dark:hover:text-[#D9FF43]"
          >
            المعجم الرسمي ↗
          </a>
          <span aria-hidden="true" className="text-zinc-300 dark:text-white/20">
            ·
          </span>
          <a
            href="https://github.com/ArCode-Standard/darija-lexreview"
            target="_blank"
            rel="noreferrer"
            className="hover:text-emerald-700 hover:underline underline-offset-4 whitespace-nowrap transition-colors dark:hover:text-[#D9FF43]"
          >
            مستودع المنصة ↗
          </a>
        </nav>
      </div>
    </footer>
  )
}
