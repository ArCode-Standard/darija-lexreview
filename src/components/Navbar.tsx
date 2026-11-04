import {
  Search,
} from 'lucide-react'
import type { UserRole, WorkbenchTab } from '../types/lexicon'
import type { AppPage } from '../utils/urlState'
import type { AvatarSource } from './Avatar'

interface NavbarProps {
  isAuthenticated: boolean
  userDisplayName?: string | null
  userAvatarSource?: AvatarSource | null
  userAvatarPath?: string | null
  userAvatarSeed?: string | null
  userGithubHandle?: string | null
  userRole?: UserRole | null
  canAccessEditorialTools: boolean
  unreadMessagesCount?: number
  isFocusMode?: boolean
  darkMode?: boolean
  onToggleDarkMode?: () => void
  onExitFocusMode?: () => void
  onOpenAuth: () => void
  onOpenCommandPalette?: () => void
  onSelectWorkbenchTab: (tab: WorkbenchTab) => void
  onNavigatePage?: (page: AppPage, options?: { subView?: 'entries' | 'categories' }) => void
}

export function Navbar({ isFocusMode = false, onOpenCommandPalette, onNavigatePage }: NavbarProps) {
  return (
    <header
      className={`sticky top-0 z-30 border-b border-zinc-200 bg-[#FAFAFC]/90 backdrop-blur-md dark:border-white/10 dark:bg-[#050507]/90 ${
        isFocusMode ? 'h-12' : 'h-16'
      }`}
    >
      <div className="mx-auto flex h-full max-w-[1280px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <a
          href="/"
          onClick={(event) => {
            if (onNavigatePage) {
              event.preventDefault()
              onNavigatePage('home')
            }
          }}
          aria-label="Darija LexReview — الصفحة الرئيسية"
          className="inline-flex shrink-0 items-center gap-2 font-display text-sm font-bold tracking-tight text-zinc-950 dark:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D9FF43]"
        >
          <img
            src="/assets/darija-lexreview-emblem.png"
            alt=""
            aria-hidden="true"
            className="h-7 w-auto select-none object-contain sm:h-8"
          />
          <span dir="ltr" className="hidden whitespace-nowrap tracking-wide sm:inline">
            Darija <span className="text-emerald-700 dark:text-[#D9FF43]">LexReview</span>
          </span>
        </a>

        <div className="flex min-w-0 flex-1 justify-center">
          {onOpenCommandPalette && !isFocusMode && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              aria-label="البحث في المعجم والصفحات"
              title="البحث في المعجم والصفحات"
              className="inline-flex h-9 w-full max-w-[680px] min-w-0 items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-600 shadow-sm transition-colors hover:border-zinc-400 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:h-10 sm:px-4 sm:text-sm dark:border-white/12 dark:bg-[#0C0C10] dark:text-zinc-300 dark:hover:border-[#D9FF43]/60 dark:hover:text-white dark:focus-visible:outline-[#D9FF43]"
            >
              <Search className="h-4 w-4 shrink-0 text-emerald-700 dark:text-[#D9FF43]" />
              <span className="truncate sm:hidden">بحث</span>
              <span className="hidden truncate sm:inline">بحث في المعجم والصفحات</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
