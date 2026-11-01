import type { WorkbenchTab } from '../types/lexicon'

interface NavbarProps {
  isAuthenticated: boolean
  onOpenAuth: () => void
  onSelectWorkbenchTab: (tab: WorkbenchTab) => void
}

export function Navbar({
  isAuthenticated,
  onOpenAuth,
  onSelectWorkbenchTab,
}: NavbarProps) {
  const handleJumpToTab = (tab: WorkbenchTab) => {
    onSelectWorkbenchTab(tab)
    const el = document.getElementById('workspace')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-[#E5DFD3] bg-[#FBF9F5]/95 backdrop-blur-md dark:border-[#2E2B27] dark:bg-[#141312]/95">
      <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-8 px-5 sm:px-8">
        <a
          href="#"
          className="font-display text-lg font-bold tracking-tight text-stone-900 whitespace-nowrap shrink-0 dark:text-stone-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0F5C4E]"
        >
          Darija LexReview
        </a>

        <nav
          aria-label="التنقل الرئيسي"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600 dark:text-stone-400"
        >
          <a
            href="#workspace"
            onClick={(e) => {
              e.preventDefault()
              handleJumpToTab('explorer')
            }}
            className="whitespace-nowrap shrink-0 py-1 hover:text-stone-900 hover:underline hover:underline-offset-8 transition-colors duration-150 dark:hover:text-stone-100"
          >
            فحص المفردات
          </a>
          <a
            href="#workspace"
            onClick={(e) => {
              e.preventDefault()
              handleJumpToTab('new_entry')
            }}
            className="whitespace-nowrap shrink-0 py-1 hover:text-stone-900 hover:underline hover:underline-offset-8 transition-colors duration-150 dark:hover:text-stone-100"
          >
            اقتراح مفردة
          </a>
          <a
            href="#workspace"
            onClick={(e) => {
              e.preventDefault()
              handleJumpToTab('moderation')
            }}
            className="whitespace-nowrap shrink-0 py-1 hover:text-stone-900 hover:underline hover:underline-offset-8 transition-colors duration-150 dark:hover:text-stone-100"
          >
            تحكيم المحررين
          </a>
          <a
            href="#workspace"
            onClick={(e) => {
              e.preventDefault()
              handleJumpToTab('exporter')
            }}
            className="whitespace-nowrap shrink-0 py-1 hover:text-stone-900 hover:underline hover:underline-offset-8 transition-colors duration-150 dark:hover:text-stone-100"
          >
            تصدير المعجم
          </a>
          <a
            href="#method"
            className="whitespace-nowrap shrink-0 py-1 hover:text-stone-900 hover:underline hover:underline-offset-8 transition-colors duration-150 dark:hover:text-stone-100"
          >
            منهجية التوثيق
          </a>
        </nav>

        <button
          type="button"
          onClick={onOpenAuth}
          className="min-h-[40px] px-4 py-2 text-xs font-semibold rounded-lg bg-[#0F5C4E] text-white hover:bg-[#0B463B] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer dark:bg-[#147A67] dark:hover:bg-[#0F5C4E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F5C4E]"
        >
          {isAuthenticated ? 'حساب المراجع' : 'دخول / إنشاء حساب'}
        </button>
      </div>
    </header>
  )
}
