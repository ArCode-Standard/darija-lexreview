import { Bell, ChevronLeft, Search } from 'lucide-react'
import { Avatar, type AvatarSource } from './Avatar'
import type { UserRole, WorkbenchTab } from '../types/lexicon'
import type { AppPage } from '../utils/urlState'
import { PWAInstallButton } from './PWAInstallButton'

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
  onExitFocusMode?: () => void
  onOpenAuth: () => void
  onOpenCommandPalette?: () => void
  onSelectWorkbenchTab: (tab: WorkbenchTab) => void
  onNavigatePage?: (page: AppPage, options?: { subView?: 'entries' | 'categories' }) => void
}

export function Navbar({
  isAuthenticated,
  userDisplayName,
  userAvatarSource,
  userAvatarPath,
  userAvatarSeed,
  userGithubHandle,
  userRole,
  canAccessEditorialTools,
  unreadMessagesCount = 0,
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
              className="hidden md:flex items-center gap-5 lg:gap-6 text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400"
            >
              {/* Public Exploration Links (Visible to Everyone) */}
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
                href="/insights"
                onClick={(e) => {
                  e.preventDefault()
                  handleNav('insights')
                }}
                className="whitespace-nowrap shrink-0 py-1 hover:text-zinc-950 hover:underline hover:underline-offset-8 transition-colors duration-150 dark:hover:text-white"
              >
                خارطة التغطية
              </a>
              <a
                href="/contributors"
                onClick={(e) => {
                  e.preventDefault()
                  handleNav('contributors')
                }}
                className="whitespace-nowrap shrink-0 py-1 hover:text-zinc-950 hover:underline hover:underline-offset-8 transition-colors duration-150 dark:hover:text-white"
              >
                لوحة المساهمين
              </a>

              {/* Registered Member Links (Only for Logged-In Users) */}
              {isAuthenticated && (
                <>
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
                </>
              )}

              {/* Staff Governance Links (Only for Editors / Admins) */}
              {isAuthenticated && canAccessEditorialTools && (
                <a
                  href={userRole === 'admin' ? '/members' : '/editorial'}
                  onClick={(e) => {
                    e.preventDefault()
                    handleNav(
                      userRole === 'admin' ? 'members' : 'editorial',
                      'moderation',
                    )
                  }}
                  className="whitespace-nowrap shrink-0 py-1 text-emerald-700 hover:text-emerald-900 hover:underline hover:underline-offset-8 transition-colors duration-150 dark:text-[#D9FF43] dark:hover:text-[#e5ff73]"
                >
                  {userRole === 'admin' ? 'إدارة الأعضاء' : 'لوحة الإشراف'}
                </a>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {!isFocusMode && <PWAInstallButton variant="compact" />}

          {!isFocusMode && onOpenCommandPalette && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              aria-label="بحث وتنقل سريع بين الصفحات"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 text-xs text-zinc-500 hover:border-zinc-400 hover:text-zinc-950 transition-colors cursor-pointer dark:border-white/12 dark:bg-[#0C0C10] dark:text-zinc-400 dark:hover:border-[#D9FF43]/60 dark:hover:text-white"
            >
              <Search className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
              <span className="hidden lg:inline">بحث سريع</span>
              <kbd className="hidden sm:inline font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                ⌘K
              </kbd>
            </button>
          )}

          {/* Member Inbox Bell — Strictly Hidden from Unauthenticated Visitors */}
          {!isFocusMode && isAuthenticated && (
            <a
              href="/messages"
              onClick={(e) => {
                e.preventDefault()
                handleNav('messages')
              }}
              aria-label={
                unreadMessagesCount > 0
                  ? `صندوق الرسائل (${unreadMessagesCount} غير مقروءة)`
                  : 'صندوق الرسائل والتنبيهات'
              }
              title="صندوق رسائل الأعضاء والتنبيهات"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 hover:text-zinc-950 transition-colors cursor-pointer dark:border-white/12 dark:bg-[#0C0C10] dark:text-zinc-200 dark:hover:border-[#D9FF43]/50 dark:hover:text-white"
            >
              <Bell className="h-4 w-4" />
              {unreadMessagesCount > 0 && (
                <span className="absolute -top-1 -end-1 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-emerald-600 px-1 font-mono text-[10px] font-bold text-white dark:bg-[#D9FF43] dark:text-[#050507]">
                  {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                </span>
              )}
            </a>
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
            {isAuthenticated ? (
              <>
                <Avatar source={userAvatarSource} path={userAvatarPath} seed={userAvatarSeed} githubHandle={userGithubHandle} displayName={userDisplayName} size={25} className="border border-white/20" />
                <span className="max-w-[120px] truncate">{userDisplayName || 'حسابي'}</span>
              </>
            ) : (
              <>
                <span>دخول / إنشاء حساب</span>
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </>
            )}
          </a>
        </div>
      </div>
    </header>
  )
}
