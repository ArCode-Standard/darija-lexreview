import { ChevronLeft, Search } from 'lucide-react'
import type { WorkbenchTab } from '../types/lexicon'
import type { AppPage } from '../utils/urlState'

interface NavbarProps {
  isAuthenticated: boolean
  canAccessEditorialTools: boolean
  isFocusMode?: boolean
  onExitFocusMode?: () => void
  onOpenAuth: () => void
  onOpenCommandPalette?: () => void
  onSelectWorkbenchTab: (tab: WorkbenchTab) => void
  onNavigatePage?: (page: AppPage, options?: { subView?: 'entries' | 'categories' }) => void
}

export function Navbar({
  isAuthenticated,
  canAccessEditorialTools,
  isFocusMode = false,
  onExitFocusMode,
  onOpenAuth,
  onOpenCommandPalette,
  onSelectWorkbenchTab,
  onNavigatePage,
}: NavbarProps) {
  const handleNav = (page: AppPage, fallbackTab?: WorkbenchTab) => {
    if (isFocusMode && onExitFocusMode && page !== 'review') {
      onExitFocusMode()
    }
    if (onNavigatePage) {
      onNavigatePage(page)
      return
    }
    if (fallbackTab) {
      onSelectWorkbenchTab(fallbackTab)
    }
  }

  return (
    <header
      className={`sticky top-0 z-30 border-b border-zinc-200 bg-[#FAFAFC]/90 backdrop-blur-md dark:border-white/10 dark:bg-[#050507]/90 ${
        isFocusMode ? 'h-12' : 'h-16'
      }`}
    >
      <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-4 sm:gap-6 px-5 sm:px-8">
        <div className="flex items-center gap-6">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault()
              if (isFocusMode && onExitFocusMode) {
                onExitFocusMode()
              }
              if (onNavigatePage) {
                onNavigatePage('home')
              }
            }}
            className="inline-flex items-center gap-2.5 font-display text-base sm:text-lg font-bold tracking-tight text-zinc-950 whitespace-nowrap shrink-0 dark:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D9FF43]"
          >
            <img
              src="/assets/darija-lexreview-emblem.png"
              alt=""
              aria-hidden="true"
              className="h-8 w-auto object-contain select-none"
            />
            <span dir="ltr" className="tracking-wide">
              Darija <span className="text-emerald-700 dark:text-[#D9FF43]">LexReview</span>
            </span>
          </a>

          {!isFocusMode && (
            <span
              aria-hidden="true"
              className="hidden md:inline-block h-5 w-px bg-zinc-200 dark:bg-white/15"
            />
          )}

          {!isFocusMode && (
            <nav
              aria-label="التنقل الرئيسي"
              className="hidden md:flex items-center gap-6 lg:gap-7 text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400"
            >
              <a
                href="/review"
                onClick={(e) => {
                  e.preventDefault()
                  handleNav('review', 'rapid_review')
                }}
                className="whitespace-nowrap shrink-0 py-1 hover:text-zinc-950 hover:underline hover:underline-offset-8 transition-colors duration-150 dark:hover:text-white"
              >
                المراجعة السريعة
              </a>
              <a
                href="/lexicon"
                onClick={(e) => {
                  e.preventDefault()
                  handleNav('lexicon', 'explorer')
                }}
                className="whitespace-nowrap shrink-0 py-1 hover:text-zinc-950 hover:underline hover:underline-offset-8 transition-colors duration-150 dark:hover:text-white"
              >
                تصفح المعجم
              </a>
              <a
                href="/contribute"
                onClick={(e) => {
                  e.preventDefault()
                  handleNav('contribute', 'new_entry')
                }}
                className="whitespace-nowrap shrink-0 py-1 hover:text-zinc-950 hover:underline hover:underline-offset-8 transition-colors duration-150 dark:hover:text-white"
              >
                إضافة مفردة
              </a>
              <a
                href="/submissions"
                onClick={(e) => {
                  e.preventDefault()
                  handleNav('submissions', 'submissions')
                }}
                className="whitespace-nowrap shrink-0 py-1 hover:text-zinc-950 hover:underline hover:underline-offset-8 transition-colors duration-150 dark:hover:text-white"
              >
                مساهماتي
              </a>
              {canAccessEditorialTools && (
                <a
                  href="/editorial"
                  onClick={(e) => {
                    e.preventDefault()
                    handleNav('editorial', 'moderation')
                  }}
                  className="whitespace-nowrap shrink-0 py-1 text-emerald-700 hover:text-emerald-900 hover:underline hover:underline-offset-8 transition-colors duration-150 dark:text-[#D9FF43] dark:hover:text-[#e5ff73]"
                >
                  تحكيم المحررين
                </a>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {!isFocusMode && onOpenCommandPalette && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              aria-label="بحث وتنقل سريع بين الصفحات"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 text-xs text-zinc-500 hover:border-zinc-400 hover:text-zinc-950 transition-colors cursor-pointer dark:border-white/12 dark:bg-[#0C0C10] dark:text-zinc-400 dark:hover:border-[#D9FF43]/60 dark:hover:text-white"
            >
              <Search className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
              <span className="hidden lg:inline">انتقال سريع</span>
              <kbd className="hidden sm:inline font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                ⌘K
              </kbd>
            </button>
          )}

          <a
            href={isAuthenticated ? '/profile' : '/auth'}
            onClick={(e) => {
              e.preventDefault()
              if (onNavigatePage) {
                onNavigatePage(isAuthenticated ? 'profile' : 'auth')
              } else if (isAuthenticated) {
                onSelectWorkbenchTab('profile')
              } else {
                onOpenAuth()
              }
            }}
            className={`inline-flex items-center gap-2 rounded-full border border-zinc-950 bg-zinc-950 px-5 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer dark:border-[#D9FF43]/75 dark:bg-[#D9FF43]/10 dark:text-white dark:hover:bg-[#D9FF43] dark:hover:text-[#050507] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9FF43] ${
              isFocusMode ? 'min-h-[34px] py-1.5' : 'min-h-[40px] py-2'
            }`}
          >
            <span>{isAuthenticated ? 'حسابي' : 'دخول / إنشاء حساب'}</span>
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </header>
  )
}
