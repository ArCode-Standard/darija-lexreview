import type { WorkbenchTab } from '../types/lexicon'

interface NavbarProps {
  isAuthenticated: boolean
  canAccessEditorialTools: boolean
  isFocusMode?: boolean
  onExitFocusMode?: () => void
  onOpenAuth: () => void
  onSelectWorkbenchTab: (tab: WorkbenchTab) => void
}

export function Navbar({
  isAuthenticated,
  canAccessEditorialTools,
  isFocusMode = false,
  onExitFocusMode,
  onOpenAuth,
  onSelectWorkbenchTab,
}: NavbarProps) {
  const handleJumpToTab = (tab: WorkbenchTab) => {
    if (isFocusMode && onExitFocusMode && tab !== 'rapid_review') {
      onExitFocusMode()
    }
    onSelectWorkbenchTab(tab)
    const el = document.getElementById('workspace')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <header
      className={`sticky top-0 z-30 border-b border-[#E5DFD3] bg-[#FBF9F5]/95 backdrop-blur-md dark:border-[#2E2B27] dark:bg-[#141312]/95 ${
        isFocusMode ? 'h-12' : 'h-16'
      }`}
    >
      <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-8 px-5 sm:px-8">
        <a
          href="#"
          onClick={(e) => {
            if (isFocusMode && onExitFocusMode) {
              e.preventDefault()
              onExitFocusMode()
            }
          }}
          className="font-display text-lg font-bold tracking-tight text-stone-900 whitespace-nowrap shrink-0 dark:text-stone-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0F5C4E]"
        >
          Darija LexReview
        </a>

        {!isFocusMode ? (
          <nav
            aria-label="التنقل الرئيسي"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-600 dark:text-stone-400"
          >
            <a
              href="#workspace"
              onClick={(e) => {
                e.preventDefault()
                handleJumpToTab('rapid_review')
              }}
              className="whitespace-nowrap shrink-0 py-1 hover:text-stone-900 hover:underline hover:underline-offset-8 transition-colors duration-150 dark:hover:text-stone-100"
            >
              المراجعة السريعة
            </a>
            <a
              href="#workspace"
              onClick={(e) => {
                e.preventDefault()
                handleJumpToTab('explorer')
              }}
              className="whitespace-nowrap shrink-0 py-1 hover:text-stone-900 hover:underline hover:underline-offset-8 transition-colors duration-150 dark:hover:text-stone-100"
            >
              تصفح المعجم
            </a>
            <a
              href="#workspace"
              onClick={(e) => {
                e.preventDefault()
                handleJumpToTab('new_entry')
              }}
              className="whitespace-nowrap shrink-0 py-1 hover:text-stone-900 hover:underline hover:underline-offset-8 transition-colors duration-150 dark:hover:text-stone-100"
            >
              إضافة مفردة
            </a>
            <a
              href="#workspace"
              onClick={(e) => {
                e.preventDefault()
                handleJumpToTab('submissions')
              }}
              className="whitespace-nowrap shrink-0 py-1 hover:text-stone-900 hover:underline hover:underline-offset-8 transition-colors duration-150 dark:hover:text-stone-100"
            >
              مساهماتي
            </a>
            {canAccessEditorialTools && (
              <a
                href="#workspace"
                onClick={(e) => {
                  e.preventDefault()
                  handleJumpToTab('moderation')
                }}
                className="whitespace-nowrap shrink-0 py-1 text-[#0F5C4E] hover:text-[#0B463B] hover:underline hover:underline-offset-8 transition-colors duration-150 dark:text-[#4FD1C5] dark:hover:text-teal-200"
              >
                تحكيم المحررين
              </a>
            )}
          </nav>
        ) : (
          <div className="flex items-center gap-3 text-xs text-stone-600 dark:text-stone-400">
            <span className="hidden sm:inline">وضع التركيز مفعل للمراجعة السريعة</span>
            {onExitFocusMode && (
              <button
                type="button"
                onClick={onExitFocusMode}
                className="font-semibold text-[#0F5C4E] hover:underline cursor-pointer dark:text-[#4FD1C5]"
              >
                العودة للواجهة الكاملة
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => isAuthenticated ? onSelectWorkbenchTab('profile') : onOpenAuth()}
          className={`px-4 text-xs font-semibold rounded-lg bg-[#0F5C4E] text-white hover:bg-[#0B463B] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer dark:bg-[#147A67] dark:hover:bg-[#0F5C4E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F5C4E] ${
            isFocusMode ? 'min-h-[34px] py-1.5' : 'min-h-[40px] py-2'
          }`}
        >
          {isAuthenticated ? 'حسابي' : 'دخول / إنشاء حساب'}
        </button>
      </div>
    </header>
  )
}
