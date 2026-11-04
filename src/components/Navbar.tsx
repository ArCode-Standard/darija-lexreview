import { useState } from 'react'
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  ChevronLeft,
  FilePlus2,
  FolderKanban,
  LogIn,
  Menu,
  Moon,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  UserCog,
  UserRound,
  X,
} from 'lucide-react'
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
  darkMode?: boolean
  onToggleDarkMode?: () => void
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
  darkMode = true,
  onToggleDarkMode,
  onExitFocusMode,
  onOpenAuth,
  onOpenCommandPalette,
  onSelectWorkbenchTab,
  onNavigatePage,
}: NavbarProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  const handleNav = (page: AppPage, fallbackTab?: WorkbenchTab) => {
    setMobileDrawerOpen(false)
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
    <>
      <header
        className={`sticky top-0 z-30 border-b border-zinc-200 bg-[#FAFAFC]/90 backdrop-blur-md dark:border-white/10 dark:bg-[#050507]/90 ${
          isFocusMode ? 'h-12' : 'h-16'
        }`}
      >
        <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          {/* Zone 1 (Start): Mobile/Tablet Drawer Trigger + Brand Identity */}
          <div className="flex items-center gap-3 min-w-0">
            {!isFocusMode && (
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                aria-label="فتح قائمة التنقل"
                aria-expanded={mobileDrawerOpen}
                className="inline-flex xl:hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer dark:border-white/12 dark:bg-[#0C0C10] dark:text-zinc-200 dark:hover:bg-white/10"
              >
                <Menu className="h-4 w-4" />
              </button>
            )}

            <a
              href="/"
              onClick={(e) => {
                e.preventDefault()
                setMobileDrawerOpen(false)
                if (isFocusMode && onExitFocusMode) {
                  onExitFocusMode()
                }
                if (onNavigatePage) {
                  onNavigatePage('home')
                }
              }}
              className="inline-flex items-center gap-2 font-display text-sm sm:text-base lg:text-lg font-bold tracking-tight text-zinc-950 whitespace-nowrap shrink-0 dark:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D9FF43]"
            >
              <img
                src="/assets/darija-lexreview-emblem.png"
                alt=""
                aria-hidden="true"
                className="h-7 sm:h-8 w-auto object-contain select-none"
              />
              <span dir="ltr" className="tracking-wide">
                Darija <span className="text-emerald-700 dark:text-[#D9FF43]">LexReview</span>
              </span>
            </a>
          </div>

          {/* Zone 2 (Center): Clean Inline Typography Links on Wide Desktop (>=1280px) — Zero Overlap */}
          {!isFocusMode && (
            <nav
              aria-label="التنقل الرئيسي"
              className="hidden xl:flex items-center justify-center gap-5 2xl:gap-6 text-[13px] font-medium text-zinc-600 dark:text-zinc-400 min-w-0"
            >
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
                href="/collections"
                onClick={(e) => {
                  e.preventDefault()
                  handleNav('collections')
                }}
                className="whitespace-nowrap shrink-0 py-1 hover:text-zinc-950 hover:underline hover:underline-offset-8 transition-colors duration-150 dark:hover:text-white"
              >
                المجموعات الموضوعاتية
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
                  className="whitespace-nowrap shrink-0 py-1 font-semibold text-emerald-700 hover:text-emerald-900 hover:underline hover:underline-offset-8 transition-colors duration-150 dark:text-[#D9FF43] dark:hover:text-[#e5ff73]"
                >
                  {userRole === 'admin' ? 'إدارة الأعضاء' : 'لوحة الإشراف'}
                </a>
              )}
            </nav>
          )}

          {/* Zone 3 (End): Compact Action Cluster */}
          <div className="flex items-center gap-2 shrink-0">
            {!isFocusMode && (
              <div className="hidden sm:block">
                <PWAInstallButton variant="compact" />
              </div>
            )}

            {/* Quick Search & Jump (⌘K) — Strictly Registered Members Only */}
            {!isFocusMode && isAuthenticated && onOpenCommandPalette && (
              <button
                type="button"
                onClick={onOpenCommandPalette}
                aria-label="بحث وتنقل سريع بين الصفحات (⌘K)"
                title="بحث وتنقل سريع (⌘K)"
                className="inline-flex h-9 sm:h-10 items-center justify-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 sm:px-3.5 text-xs text-zinc-600 hover:border-zinc-400 hover:text-zinc-950 shrink-0 whitespace-nowrap transition-colors cursor-pointer dark:border-white/12 dark:bg-[#0C0C10] dark:text-zinc-300 dark:hover:border-[#D9FF43]/60 dark:hover:text-white"
              >
                <Search className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-[#D9FF43]" />
                <span className="hidden md:inline xl:hidden 2xl:inline">بحث سريع</span>
                <kbd
                  dir="ltr"
                  className="hidden sm:inline font-mono text-[10px] text-zinc-400 dark:text-zinc-500"
                >
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
                className="relative inline-flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 hover:text-zinc-950 transition-colors cursor-pointer dark:border-white/12 dark:bg-[#0C0C10] dark:text-zinc-200 dark:hover:border-[#D9FF43]/50 dark:hover:text-white"
              >
                <Bell className="h-4 w-4" />
                {unreadMessagesCount > 0 && (
                  <span className="absolute -top-1 -end-1 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-emerald-600 px-1 font-mono text-[10px] font-bold text-white dark:bg-[#D9FF43] dark:text-[#050507]">
                    {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                  </span>
                )}
              </a>
            )}

            {/* Theme Mode Toggle — Positioned Consistently in Header Utility Cluster */}
            {onToggleDarkMode && (
              <button
                type="button"
                onClick={onToggleDarkMode}
                aria-label={darkMode ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
                title={darkMode ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
                className="inline-flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 hover:text-emerald-700 transition-colors cursor-pointer dark:border-white/12 dark:bg-[#0C0C10] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60 dark:hover:text-[#D9FF43]"
              >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            )}

            <a
              href={isAuthenticated ? '/profile' : '/auth'}
              onClick={(e) => {
                e.preventDefault()
                setMobileDrawerOpen(false)
                if (onNavigatePage) {
                  onNavigatePage(isAuthenticated ? 'profile' : 'auth')
                } else if (isAuthenticated) {
                  onSelectWorkbenchTab('profile')
                } else {
                  onOpenAuth()
                }
              }}
              className={`inline-flex items-center gap-2 rounded-full border border-zinc-950 bg-zinc-950 px-3.5 sm:px-4.5 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer dark:border-[#D9FF43]/75 dark:bg-[#D9FF43]/10 dark:text-white dark:hover:bg-[#D9FF43] dark:hover:text-[#050507] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9FF43] ${
                isFocusMode ? 'min-h-[34px] py-1.5' : 'min-h-[38px] sm:min-h-[40px] py-1.5 sm:py-2'
              }`}
            >
              {isAuthenticated ? (
                <>
                  <Avatar
                    source={userAvatarSource}
                    path={userAvatarPath}
                    seed={userAvatarSeed}
                    githubHandle={userGithubHandle}
                    displayName={userDisplayName}
                    size={24}
                    className="border border-white/20"
                  />
                  <span className="max-w-[96px] sm:max-w-[120px] truncate">
                    {userDisplayName || 'حسابي'}
                  </span>
                </>
              ) : (
                <>
                  <span className="sm:hidden">دخول</span>
                  <span className="hidden sm:inline">دخول / إنشاء حساب</span>
                  <ChevronLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </>
              )}
            </a>
          </div>
        </div>
      </header>

      {/* Responsive Mobile & Tablet Navigation Drawer (<1280px) */}
      {mobileDrawerOpen && !isFocusMode && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="قائمة التنقل الرئيسية"
          className="fixed inset-0 z-50 flex xl:hidden bg-black/70 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileDrawerOpen(false)
          }}
        >
          <div className="relative flex h-full w-72 max-w-[85vw] flex-col justify-between border-e border-zinc-200 bg-white p-4 dark:border-white/12 dark:bg-[#09090D]">
            <div className="space-y-5 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-3.5 dark:border-white/10">
                <span className="font-display text-sm font-bold text-zinc-950 dark:text-white">
                  أقسام المنصة
                </span>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  aria-label="إغلاق القائمة"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 cursor-pointer dark:text-zinc-400 dark:hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-1">
                <p className="px-3 pb-1.5 font-mono text-[10px] tracking-[0.14em] uppercase text-zinc-400 dark:text-zinc-500">
                  الاستكشاف والتدقيق العام
                </p>
                <a
                  href="/lexicon"
                  onClick={(e) => {
                    e.preventDefault()
                    handleNav('lexicon', 'explorer')
                  }}
                  className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
                >
                  <BookOpen className="h-4 w-4 shrink-0 text-emerald-700 dark:text-[#D9FF43]" />
                  <span>تصفح المعجم</span>
                </a>
                <a
                  href="/collections"
                  onClick={(e) => {
                    e.preventDefault()
                    handleNav('collections')
                  }}
                  className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
                >
                  <BookOpen className="h-4 w-4 shrink-0 text-emerald-700 dark:text-[#D9FF43]" />
                  <span>المجموعات الموضوعاتية (معاجم مصغّرة)</span>
                </a>
                <a
                  href="/review"
                  onClick={(e) => {
                    e.preventDefault()
                    handleNav('review', 'rapid_review')
                  }}
                  className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
                >
                  <Sparkles className="h-4 w-4 shrink-0 text-emerald-700 dark:text-[#D9FF43]" />
                  <span>المراجعة السريعة</span>
                </a>
                <a
                  href="/insights"
                  onClick={(e) => {
                    e.preventDefault()
                    handleNav('insights')
                  }}
                  className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
                >
                  <BarChart3 className="h-4 w-4 shrink-0 text-emerald-700 dark:text-[#D9FF43]" />
                  <span>خارطة التغطية وفجوات الإثراء</span>
                </a>
                <a
                  href="/contributors"
                  onClick={(e) => {
                    e.preventDefault()
                    handleNav('contributors')
                  }}
                  className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
                >
                  <Award className="h-4 w-4 shrink-0 text-emerald-700 dark:text-[#D9FF43]" />
                  <span>لوحة شرف المساهمين</span>
                </a>
              </div>

              {isAuthenticated ? (
                <div className="space-y-1 border-t border-zinc-200 pt-3.5 dark:border-white/10">
                  <p className="px-3 pb-1.5 font-mono text-[10px] tracking-[0.14em] uppercase text-zinc-400 dark:text-zinc-500">
                    حساب المساهم
                  </p>
                  <a
                    href="/contribute"
                    onClick={(e) => {
                      e.preventDefault()
                      handleNav('contribute', 'new_entry')
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
                  >
                    <FilePlus2 className="h-4 w-4 shrink-0 text-emerald-700 dark:text-[#D9FF43]" />
                    <span>إضافة مفردة جديدة</span>
                  </a>
                  <a
                    href="/submissions"
                    onClick={(e) => {
                      e.preventDefault()
                      handleNav('submissions', 'submissions')
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
                  >
                    <FolderKanban className="h-4 w-4 shrink-0 text-emerald-700 dark:text-[#D9FF43]" />
                    <span>مساهماتي ومسوداتي</span>
                  </a>
                  <a
                    href="/messages"
                    onClick={(e) => {
                      e.preventDefault()
                      handleNav('messages')
                    }}
                    className="flex items-center justify-between gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
                  >
                    <span className="flex items-center gap-2.5">
                      <Bell className="h-4 w-4 shrink-0 text-emerald-700 dark:text-[#D9FF43]" />
                      <span>صندوق الرسائل</span>
                    </span>
                    {unreadMessagesCount > 0 && (
                      <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white dark:bg-[#D9FF43] dark:text-[#050507]">
                        {unreadMessagesCount}
                      </span>
                    )}
                  </a>
                  <a
                    href="/profile"
                    onClick={(e) => {
                      e.preventDefault()
                      handleNav('profile', 'profile')
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
                  >
                    <UserRound className="h-4 w-4 shrink-0 text-emerald-700 dark:text-[#D9FF43]" />
                    <span>ملفي وربط الحسابات</span>
                  </a>
                </div>
              ) : (
                <div className="space-y-1 border-t border-zinc-200 pt-3.5 dark:border-white/10">
                  <p className="px-3 pb-1.5 font-mono text-[10px] tracking-[0.14em] uppercase text-zinc-400 dark:text-zinc-500">
                    انضم للمجتمع
                  </p>
                  <a
                    href="/auth"
                    onClick={(e) => {
                      e.preventDefault()
                      handleNav('auth')
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
                  >
                    <LogIn className="h-4 w-4 shrink-0 text-emerald-700 dark:text-[#D9FF43]" />
                    <span>دخول / إنشاء حساب مساهم</span>
                  </a>
                  <a
                    href="/contribute"
                    onClick={(e) => {
                      e.preventDefault()
                      handleNav('contribute', 'new_entry')
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
                  >
                    <FilePlus2 className="h-4 w-4 shrink-0 text-emerald-700 dark:text-[#D9FF43]" />
                    <span>اقترح مفردة (مسودة زائر)</span>
                  </a>
                </div>
              )}

              {isAuthenticated && canAccessEditorialTools && (
                <div className="space-y-1 border-t border-zinc-200 pt-3.5 dark:border-white/10">
                  <p className="px-3 pb-1.5 font-mono text-[10px] tracking-[0.14em] uppercase text-emerald-700 dark:text-[#D9FF43]">
                    {userRole === 'admin' ? 'الإدارة والحوكمة' : 'الإشراف والتحكيم'}
                  </p>
                  <a
                    href="/editorial"
                    onClick={(e) => {
                      e.preventDefault()
                      handleNav('editorial', 'moderation')
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
                  >
                    <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700 dark:text-[#D9FF43]" />
                    <span>تحكيم المحررين</span>
                  </a>
                  <a
                    href="/members"
                    onClick={(e) => {
                      e.preventDefault()
                      handleNav('members')
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
                  >
                    <UserCog className="h-4 w-4 shrink-0 text-emerald-700 dark:text-[#D9FF43]" />
                    <span>
                      {userRole === 'admin' ? 'إدارة الأعضاء والرتب' : 'بلاغات الإشراف للأعضاء'}
                    </span>
                  </a>
                </div>
              )}
            </div>

            <div className="space-y-2 border-t border-zinc-200 pt-3 dark:border-white/10">
              {onToggleDarkMode && (
                <button
                  type="button"
                  onClick={onToggleDarkMode}
                  className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer dark:border-white/10 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:bg-white/[0.06]"
                >
                  <span>المظهر اللوني</span>
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-[#D9FF43]">
                    {darkMode ? (
                      <>
                        <Sun className="h-3.5 w-3.5" />
                        <span>التبديل للنهاري</span>
                      </>
                    ) : (
                      <>
                        <Moon className="h-3.5 w-3.5" />
                        <span>التبديل لليلي</span>
                      </>
                    )}
                  </span>
                </button>
              )}
              <PWAInstallButton variant="sidebar" />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
