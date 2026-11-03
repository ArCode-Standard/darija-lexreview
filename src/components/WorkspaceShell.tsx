import { useState } from 'react'
import {
  AlertTriangle,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  Database,
  Download,
  ExternalLink,
  FilePlus2,
  FolderKanban,
  Home,
  Layers,
  LogIn,
  Menu,
  Moon,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  UserCog,
  UserRound,
  X,
} from 'lucide-react'
import type { DataMode } from '../types/lexicon'
import type { AppPage } from '../utils/urlState'
import { PWAInstallButton } from './PWAInstallButton'
import { Avatar, type AvatarSource } from './Avatar'

interface WorkspaceShellProps {
  activePage: AppPage
  explorerSubView: 'entries' | 'categories'
  isFocusMode: boolean
  onExitFocusMode: () => void
  isAuthenticated: boolean
  userDisplayName: string | null
  userAvatarSource?: AvatarSource | null
  userAvatarPath?: string | null
  userAvatarSeed?: string | null
  userGithubHandle?: string | null
  userRole?: 'reviewer' | 'editor' | 'admin' | null
  canAccessEditorialTools: boolean
  isStaffRole: boolean
  darkMode: boolean
  onToggleDarkMode: () => void
  dataMode: DataMode
  entriesCount: number
  corpusVersion: string
  cachedCorpusAt: string | null
  completedTodayCount: number
  draftsCount: number
  unreadMessagesCount?: number
  onReloadCorpus: () => void
  onOpenCommandPalette: () => void
  onNavigatePage: (page: AppPage, options?: { subView?: 'entries' | 'categories' }) => void
  children: React.ReactNode
}

const PAGE_LABELS: Record<AppPage, string> = {
  home: 'الرئيسية',
  review: 'المراجعة السريعة',
  lexicon: 'تصفح المعجم',
  insights: 'خارطة التغطية وفجوات الإثراء',
  contributors: 'لوحة شرف المساهمين',
  contribute: 'إضافة مفردة جديدة',
  submissions: 'مساهماتي ومسوداتي',
  messages: 'صندوق الرسائل والتنبيهات',
  profile: 'ملفي الشخصي',
  editorial: 'تحكيم المحررين',
  members: 'إدارة الأعضاء والرتب',
  export: 'تصدير المعجم',
  auth: 'دخول / إنشاء حساب',
}

export function WorkspaceShell({
  activePage,
  explorerSubView,
  isFocusMode,
  onExitFocusMode,
  isAuthenticated,
  userDisplayName,
  userAvatarSource,
  userAvatarPath,
  userAvatarSeed,
  userGithubHandle,
  userRole,
  canAccessEditorialTools,
  isStaffRole,
  darkMode,
  onToggleDarkMode,
  dataMode,
  entriesCount,
  corpusVersion,
  completedTodayCount,
  draftsCount,
  unreadMessagesCount = 0,
  onReloadCorpus,
  onOpenCommandPalette,
  onNavigatePage,
  children,
}: WorkspaceShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const currentBreadcrumb =
    activePage === 'lexicon' && explorerSubView === 'categories'
      ? 'الفئات الدلالية'
      : PAGE_LABELS[activePage]

  const navLinkClass = (isActive: boolean) =>
    `group flex w-full items-center justify-between gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
      isActive
        ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/[0.05] dark:hover:text-white'
    }`

  const renderSidebarContent = (closeMobileAfterClick: boolean) => {
    const go = (page: AppPage, subView?: 'entries' | 'categories') => {
      onNavigatePage(page, subView ? { subView } : undefined)
      if (closeMobileAfterClick) setMobileMenuOpen(false)
    }

    return (
      <div className="flex h-full flex-col justify-between gap-6 p-4">
        <div className="space-y-5">
          {/* Primary Exploration Group */}
          <div>
            <p className="px-3 pb-2 font-mono text-[10px] tracking-[0.14em] uppercase text-zinc-400 dark:text-zinc-500">
              الاستكشاف والتدقيق
            </p>
            <div className="space-y-1">
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault()
                  go('home')
                }}
                className={navLinkClass(false)}
              >
                <span className="flex items-center gap-2.5">
                  <Home className="h-4 w-4 shrink-0" />
                  <span>الصفحة الرئيسية</span>
                </span>
              </a>

              <a
                href="/review"
                onClick={(e) => {
                  e.preventDefault()
                  go('review')
                }}
                className={navLinkClass(activePage === 'review')}
              >
                <span className="flex items-center gap-2.5">
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span>المراجعة السريعة</span>
                </span>
                {completedTodayCount > 0 && (
                  <span className="font-mono text-[11px] tabular-nums opacity-80">
                    {completedTodayCount}
                  </span>
                )}
              </a>

              <a
                href="/lexicon"
                onClick={(e) => {
                  e.preventDefault()
                  go('lexicon', 'entries')
                }}
                className={navLinkClass(activePage === 'lexicon' && explorerSubView === 'entries')}
              >
                <span className="flex items-center gap-2.5">
                  <BookOpen className="h-4 w-4 shrink-0" />
                  <span>تصفح المفردات</span>
                </span>
                <span className="font-mono text-[10px] tabular-nums opacity-70">
                  {entriesCount.toLocaleString('en-US')}
                </span>
              </a>

              <a
                href="/lexicon?view=categories"
                onClick={(e) => {
                  e.preventDefault()
                  go('lexicon', 'categories')
                }}
                className={navLinkClass(activePage === 'lexicon' && explorerSubView === 'categories')}
              >
                <span className="flex items-center gap-2.5">
                  <Layers className="h-4 w-4 shrink-0" />
                  <span>الفئات الدلالية</span>
                </span>
              </a>

              <a
                href="/insights"
                onClick={(e) => {
                  e.preventDefault()
                  go('insights')
                }}
                className={navLinkClass(activePage === 'insights')}
              >
                <span className="flex items-center gap-2.5">
                  <BarChart3 className="h-4 w-4 shrink-0" />
                  <span>خارطة التغطية والإثراء</span>
                </span>
              </a>

              <a
                href="/contributors"
                onClick={(e) => {
                  e.preventDefault()
                  go('contributors')
                }}
                className={navLinkClass(activePage === 'contributors')}
              >
                <span className="flex items-center gap-2.5">
                  <Award className="h-4 w-4 shrink-0" />
                  <span>لوحة شرف المساهمين</span>
                </span>
              </a>
            </div>
          </div>

          {/* Audience-Specific Group: Strictly Separated Between Visitors vs Registered Members */}
          {isAuthenticated ? (
            <div>
              <p className="px-3 pb-2 font-mono text-[10px] tracking-[0.14em] uppercase text-zinc-400 dark:text-zinc-500">
                حساب المساهم
              </p>
              <div className="space-y-1">
                <a
                  href="/contribute"
                  onClick={(e) => {
                    e.preventDefault()
                    go('contribute')
                  }}
                  className={navLinkClass(activePage === 'contribute')}
                >
                  <span className="flex items-center gap-2.5">
                    <FilePlus2 className="h-4 w-4 shrink-0" />
                    <span>إضافة مفردة جديدة</span>
                  </span>
                </a>

                <a
                  href="/submissions"
                  onClick={(e) => {
                    e.preventDefault()
                    go('submissions')
                  }}
                  className={navLinkClass(activePage === 'submissions')}
                >
                  <span className="flex items-center gap-2.5">
                    <FolderKanban className="h-4 w-4 shrink-0" />
                    <span>مساهماتي ومسوداتي</span>
                  </span>
                  {draftsCount > 0 && (
                    <span className="font-mono text-[11px] tabular-nums opacity-85">
                      {draftsCount}
                    </span>
                  )}
                </a>

                <a
                  href="/messages"
                  onClick={(e) => {
                    e.preventDefault()
                    go('messages')
                  }}
                  className={navLinkClass(activePage === 'messages')}
                >
                  <span className="flex items-center gap-2.5">
                    <Bell className="h-4 w-4 shrink-0" />
                    <span>صندوق الرسائل</span>
                  </span>
                  {unreadMessagesCount > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums ${
                        activePage === 'messages'
                          ? 'bg-white/20 text-current dark:bg-black/20'
                          : 'bg-emerald-600 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                      }`}
                    >
                      {unreadMessagesCount}
                    </span>
                  )}
                </a>

                <a
                  href="/profile"
                  onClick={(e) => {
                    e.preventDefault()
                    go('profile')
                  }}
                  className={navLinkClass(activePage === 'profile')}
                >
                  <span className="flex items-center gap-2.5">
                    <UserRound className="h-4 w-4 shrink-0" />
                    <span>ملفي وربط الحسابات</span>
                  </span>
                </a>
              </div>
            </div>
          ) : (
            <div>
              <p className="px-3 pb-2 font-mono text-[10px] tracking-[0.14em] uppercase text-zinc-400 dark:text-zinc-500">
                انضم للمجتمع
              </p>
              <div className="space-y-1">
                <a
                  href="/auth"
                  onClick={(e) => {
                    e.preventDefault()
                    go('auth')
                  }}
                  className={navLinkClass(activePage === 'auth')}
                >
                  <span className="flex items-center gap-2.5">
                    <LogIn className="h-4 w-4 shrink-0" />
                    <span>دخول / إنشاء حساب</span>
                  </span>
                </a>

                <a
                  href="/contribute"
                  onClick={(e) => {
                    e.preventDefault()
                    go('contribute')
                  }}
                  className={navLinkClass(activePage === 'contribute')}
                >
                  <span className="flex items-center gap-2.5">
                    <FilePlus2 className="h-4 w-4 shrink-0" />
                    <span>اقترح مفردة (مسودة زائر)</span>
                  </span>
                </a>

                {draftsCount > 0 && (
                  <a
                    href="/submissions"
                    onClick={(e) => {
                      e.preventDefault()
                      go('submissions')
                    }}
                    className={navLinkClass(activePage === 'submissions')}
                  >
                    <span className="flex items-center gap-2.5">
                      <FolderKanban className="h-4 w-4 shrink-0" />
                      <span>مسودات المتصفح المحفوظة</span>
                    </span>
                    <span className="font-mono text-[11px] tabular-nums opacity-85">
                      {draftsCount}
                    </span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Editorial & Admin Governance Group (Authorized Staff Only) */}
          {canAccessEditorialTools && (
            <div>
              <p className="px-3 pb-2 font-mono text-[10px] tracking-[0.14em] uppercase text-emerald-700 dark:text-[#D9FF43]">
                {userRole === 'admin' ? 'الإدارة والحوكمة' : 'الإشراف والتحكيم'}
              </p>
              <div className="space-y-1">
                <a
                  href="/editorial"
                  onClick={(e) => {
                    e.preventDefault()
                    go('editorial')
                  }}
                  className={navLinkClass(activePage === 'editorial')}
                >
                  <span className="flex items-center gap-2.5">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span>تحكيم المحررين</span>
                  </span>
                </a>

                <a
                  href="/members"
                  onClick={(e) => {
                    e.preventDefault()
                    go('members')
                  }}
                  className={navLinkClass(activePage === 'members')}
                >
                  <span className="flex items-center gap-2.5">
                    <UserCog className="h-4 w-4 shrink-0" />
                    <span>
                      {userRole === 'editor' && isStaffRole
                        ? 'بلاغات الإشراف للأعضاء'
                        : 'إدارة الأعضاء والرتب'}
                    </span>
                  </span>
                </a>

                <a
                  href="/export"
                  onClick={(e) => {
                    e.preventDefault()
                    go('export')
                  }}
                  className={navLinkClass(activePage === 'export')}
                >
                  <span className="flex items-center gap-2.5">
                    <Download className="h-4 w-4 shrink-0" />
                    <span>تصدير المعجم</span>
                  </span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Institutional Links and PWA Install */}
        <div className="space-y-2.5 border-t border-zinc-200 pt-4 text-xs dark:border-white/10">
          <PWAInstallButton variant="sidebar" />

          {/* Corpus Status Indicator */}
          <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-[11px] dark:border-white/10 dark:bg-[#07070A]">
            <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
              {dataMode === 'live' ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-[#D9FF43]" />
              ) : dataMode === 'cached' ? (
                <Database className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-[#D9FF43]" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              )}
              <span>المتن الرسمي</span>
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-zinc-900 dark:text-white">v{corpusVersion}</span>
              {dataMode !== 'live' && (
                <button
                  type="button"
                  onClick={onReloadCorpus}
                  title="مزامنة المتن الرسمي"
                  className="text-emerald-700 hover:underline cursor-pointer dark:text-[#D9FF43]"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            <a href="/about/" className="hover:text-zinc-950 hover:underline dark:hover:text-white">
              عن المنصة
            </a>
            <span>·</span>
            <a href="/methodology/" className="hover:text-zinc-950 hover:underline dark:hover:text-white">
              المنهجية
            </a>
            <span>·</span>
            <a href="/privacy/" className="hover:text-zinc-950 hover:underline dark:hover:text-white">
              الخصوصية
            </a>
            <span>·</span>
            <a
              href="https://github.com/ArCode-Standard/moroccan-darija-dataset"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 hover:text-zinc-950 hover:underline dark:hover:text-white"
            >
              <span>المعجم</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFC] text-zinc-950 dark:bg-[#050507] dark:text-zinc-100">
      {/* Sticky Precision Workspace Top Bar */}
      <header className="sticky top-0 z-30 h-14 border-b border-zinc-200 bg-[#FAFAFC]/90 backdrop-blur-md dark:border-white/10 dark:bg-[#050507]/90">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            {!isFocusMode && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="فتح قائمة الصفحات"
                className="inline-flex lg:hidden h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-100 cursor-pointer dark:border-white/12 dark:text-zinc-200 dark:hover:bg-white/10"
              >
                <Menu className="h-4 w-4" />
              </button>
            )}

            <a
              href="/"
              onClick={(e) => {
                e.preventDefault()
                if (isFocusMode) onExitFocusMode()
                onNavigatePage('home')
              }}
              className="inline-flex items-center gap-2 font-display text-sm sm:text-base font-bold tracking-tight text-zinc-950 whitespace-nowrap shrink-0 dark:text-white"
            >
              <img
                src="/assets/darija-lexreview-emblem.png"
                alt=""
                aria-hidden="true"
                className="h-7 w-auto object-contain select-none"
              />
              <span dir="ltr" className="hidden sm:inline">
                Darija <span className="text-emerald-700 dark:text-[#D9FF43]">LexReview</span>
              </span>
            </a>

            <ChevronLeft className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-600" aria-hidden="true" />

            <span className="truncate text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              {currentBreadcrumb}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {!isFocusMode && <PWAInstallButton variant="compact" />}

            {isFocusMode ? (
              <button
                type="button"
                onClick={onExitFocusMode}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-50 px-3.5 py-1 text-xs font-semibold text-emerald-800 cursor-pointer dark:border-[#D9FF43]/50 dark:bg-[#D9FF43]/10 dark:text-[#D9FF43]"
              >
                <span>إنهاء وضع التركيز</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenCommandPalette}
                className="inline-flex min-h-[36px] items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 sm:px-4 py-1.5 text-xs text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 transition-colors cursor-pointer dark:border-white/12 dark:bg-[#0C0C10] dark:text-zinc-400 dark:hover:border-[#D9FF43]/50 dark:hover:text-white"
              >
                <Search className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
                <span className="hidden md:inline">بحث أو انتقال سريع...</span>
                <kbd className="hidden sm:inline font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                  ⌘K
                </kbd>
              </button>
            )}

            {/* Member Inbox Bell — Strictly Hidden from Unauthenticated Visitors */}
            {!isFocusMode && (isAuthenticated || editorialPreviewMode) && (
              <a
                href="/messages"
                onClick={(e) => {
                  e.preventDefault()
                  onNavigatePage('messages')
                }}
                aria-label={
                  unreadMessagesCount > 0
                    ? `صندوق الرسائل (${unreadMessagesCount} غير مقروءة)`
                    : 'صندوق الرسائل والتنبيهات'
                }
                title="صندوق رسائل الأعضاء والتنبيهات"
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer dark:border-white/12 dark:bg-[#0C0C10] dark:text-zinc-200 dark:hover:border-[#D9FF43]/50"
              >
                <Bell className="h-4 w-4" />
                {unreadMessagesCount > 0 && (
                  <span className="absolute -top-1 -end-1 inline-flex min-w-[17px] h-[17px] items-center justify-center rounded-full bg-emerald-600 px-1 font-mono text-[10px] font-bold text-white dark:bg-[#D9FF43] dark:text-[#050507]">
                    {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                  </span>
                )}
              </a>
            )}

            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label={darkMode ? 'التبديل للوضع النهاري' : 'التبديل للوضع الليلي'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer dark:border-white/12 dark:bg-[#0C0C10] dark:text-zinc-200 dark:hover:border-[#D9FF43]/50"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <a
              href={isAuthenticated ? '/profile' : '/auth'}
              onClick={(e) => {
                e.preventDefault()
                onNavigatePage(isAuthenticated ? 'profile' : 'auth')
              }}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-zinc-950 bg-zinc-950 px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors whitespace-nowrap cursor-pointer dark:border-[#D9FF43]/75 dark:bg-[#D9FF43]/10 dark:text-white dark:hover:bg-[#D9FF43] dark:hover:text-[#050507]"
            >
              {isAuthenticated ? (
                <>
                  <Avatar source={userAvatarSource} path={userAvatarPath} seed={userAvatarSeed} githubHandle={userGithubHandle} displayName={userDisplayName} size={25} />
                  <span className="max-w-[116px] truncate">{userDisplayName || 'حسابي'}</span>
                </>
              ) : (
                <span>دخول / تسجيل</span>
              )}
            </a>
          </div>
        </div>
      </header>

      {/* Mobile Slide-Over Navigation Drawer */}
      {mobileMenuOpen && !isFocusMode && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="قائمة صفحات المنصة"
          className="fixed inset-0 z-50 flex lg:hidden bg-black/70 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false)
          }}
        >
          <div className="relative h-full w-72 max-w-[85vw] border-e border-zinc-200 bg-white dark:border-white/12 dark:bg-[#09090D]">
            <div className="flex h-14 items-center justify-between border-b border-zinc-200 px-4 dark:border-white/10">
              <span className="font-display text-sm font-bold text-zinc-950 dark:text-white">
                صفحات المنصة
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="إغلاق القائمة"
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="h-[calc(100%-3.5rem)] overflow-y-auto">
              {renderSidebarContent(true)}
            </div>
          </div>
        </div>
      )}

      {/* Workspace Body: Fixed Desktop Sidebar Rail + Independent Page Canvas */}
      <div className="mx-auto flex w-full max-w-[1440px] flex-1">
        {!isFocusMode && (
          <aside
            aria-label="التنقل بين أدوات المنصة"
            className="hidden lg:block w-64 shrink-0 border-e border-zinc-200 bg-white/50 dark:border-white/10 dark:bg-[#08080C]/60"
          >
            <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
              {renderSidebarContent(false)}
            </div>
          </aside>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1120px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
