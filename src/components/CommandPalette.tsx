import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Compass,
  Download,
  FilePlus2,
  FolderKanban,
  Home,
  Layers,
  LogIn,
  Search,
  ShieldCheck,
  Sparkles,
  UserCog,
  UserRound,
  X,
} from 'lucide-react'
import type { LexicalEntry } from '../types/lexicon'
import { matchesDarijaQuery } from '../utils/phoneticSearch'
import type { AppPage } from '../utils/urlState'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  entries: LexicalEntry[]
  isAuthenticated: boolean
  canAccessEditorialTools: boolean
  draftsCount?: number
  onNavigatePage: (page: AppPage, options?: { subView?: 'entries' | 'categories' }) => void
  onSelectEntry: (entry: LexicalEntry) => void
  onQuickAddWord: (word: string) => void
}

export function CommandPalette({
  open,
  onClose,
  entries,
  isAuthenticated,
  canAccessEditorialTools,
  draftsCount = 0,
  onNavigatePage,
  onSelectEntry,
  onQuickAddWord,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      const t = window.setTimeout(() => inputRef.current?.focus(), 20)
      return () => window.clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const pages = useMemo(
    () => [
      {
        id: 'home' as const,
        label: 'الصفحة الرئيسية والبحث',
        hint: '/',
        icon: Home,
        action: () => onNavigatePage('home'),
      },
      {
        id: 'lexicon' as const,
        label: 'تصفح مفردات المعجم',
        hint: '/lexicon',
        icon: BookOpen,
        action: () => onNavigatePage('lexicon', { subView: 'entries' }),
      },
      {
        id: 'categories' as const,
        label: 'الفئات الدلالية للمعجم',
        hint: '/lexicon?view=categories',
        icon: Layers,
        action: () => onNavigatePage('lexicon', { subView: 'categories' }),
      },
      {
        id: 'collections' as const,
        label: 'المجموعات الموضوعاتية والمعاجم المصغّرة',
        hint: '/collections',
        icon: Compass,
        action: () => onNavigatePage('collections'),
      },
      {
        id: 'review' as const,
        label: 'المراجعة السريعة بالبطاقات',
        hint: '/review',
        icon: Sparkles,
        action: () => onNavigatePage('review'),
      },
      {
        id: 'insights' as const,
        label: 'خارطة تغطية المعجم وفجوات الإثراء',
        hint: '/insights',
        icon: BarChart3,
        action: () => onNavigatePage('insights'),
      },
      {
        id: 'contributors' as const,
        label: 'لوحة شرف المساهمين والهيئة العلمية',
        hint: '/contributors',
        icon: Award,
        action: () => onNavigatePage('contributors'),
      },
      {
        id: 'contribute' as const,
        label: 'إضافة مفردة أو شاهد جديد',
        hint: '/contribute',
        icon: FilePlus2,
        action: () => onNavigatePage('contribute'),
      },
      ...(isAuthenticated
        ? [
            {
              id: 'submissions' as const,
              label:
                draftsCount > 0
                  ? `مساهماتي ومسوداتي المحفوظة (${draftsCount})`
                  : 'مساهماتي ومسوداتي المحفوظة',
              hint: '/submissions',
              icon: FolderKanban,
              action: () => onNavigatePage('submissions'),
            },
            {
              id: 'messages' as const,
              label: 'صندوق رسائل الأعضاء والتنبيهات',
              hint: '/messages',
              icon: Bell,
              action: () => onNavigatePage('messages'),
            },
            {
              id: 'profile' as const,
              label: 'ملفي الشخصي وربط GitHub / Google',
              hint: '/profile',
              icon: UserRound,
              action: () => onNavigatePage('profile'),
            },
          ]
        : [
            ...(draftsCount > 0
              ? [
                  {
                    id: 'submissions' as const,
                    label: `مسوداتي المحفوظة بالمتصفح (${draftsCount})`,
                    hint: '/submissions',
                    icon: FolderKanban,
                    action: () => onNavigatePage('submissions'),
                  },
                ]
              : []),
            {
              id: 'auth' as const,
              label: 'تسجيل الدخول أو إنشاء حساب مساهم',
              hint: '/auth',
              icon: LogIn,
              action: () => onNavigatePage('auth'),
            },
          ]),
      ...(isAuthenticated && canAccessEditorialTools
        ? [
            {
              id: 'editorial' as const,
              label: 'تحكيم المحررين وحوكمة الأدوار',
              hint: '/editorial',
              icon: ShieldCheck,
              action: () => onNavigatePage('editorial'),
            },
            {
              id: 'members' as const,
              label: 'إدارة الأعضاء والترقية والطرد',
              hint: '/members',
              icon: UserCog,
              action: () => onNavigatePage('members'),
            },
            {
              id: 'export' as const,
              label: 'تصدير حزم المعجم الرسمية',
              hint: '/export',
              icon: Download,
              action: () => onNavigatePage('export'),
            },
          ]
        : []),
    ],
    [isAuthenticated, canAccessEditorialTools, draftsCount, onNavigatePage],
  )

  const trimmed = query.trim()

  const filteredPages = useMemo(() => {
    if (!trimmed) return pages
    const lower = trimmed.toLowerCase()
    return pages.filter(
      (p) => p.label.toLowerCase().includes(lower) || p.hint.toLowerCase().includes(lower),
    )
  }, [pages, trimmed])

  const matchedEntries = useMemo(() => {
    if (!trimmed) return entries.slice(0, 5)
    return entries.filter((e) => matchesDarijaQuery(e, trimmed)).slice(0, 8)
  }, [entries, trimmed])

  if (!open || !isAuthenticated) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="البحث والتنقل السريع بين الصفحات"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 px-4 pt-14 sm:pt-20 pb-6 backdrop-blur-md overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-white/15 dark:bg-[#0B0B10]">
        {/* Search Input Header */}
        <div className="relative flex items-center gap-2.5 border-b border-zinc-200 px-4 dark:border-white/10">
          <Search className="h-4 w-4 shrink-0 text-zinc-400 dark:text-[#D9FF43]" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن مفردة دارجة (بالعربية أو Arabizi) أو انتقل لأي قسم عام..."
            className="min-w-0 flex-1 min-h-[54px] bg-transparent py-2 text-sm text-zinc-950 placeholder:text-zinc-400 focus:outline-none dark:text-white dark:placeholder:text-zinc-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="مسح البحث"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer dark:hover:bg-white/10 dark:hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق البحث السريع"
            className="inline-flex h-7 shrink-0 items-center justify-center rounded-lg border border-zinc-200 px-2 font-mono text-[10px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer dark:border-white/12 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            ESC
          </button>
        </div>

        <div className="max-h-[68vh] overflow-y-auto divide-y divide-zinc-200 dark:divide-white/10">
          {/* Pages Section */}
          {filteredPages.length > 0 && (
            <div className="p-3">
              <p className="px-2.5 pb-2 font-mono text-[10px] tracking-[0.14em] uppercase text-zinc-500 dark:text-zinc-400">
                الصفحات المستقلة
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {filteredPages.map((p) => {
                  const Icon = p.icon
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        p.action()
                        onClose()
                      }}
                      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-start text-xs font-medium text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer dark:text-zinc-200 dark:hover:bg-white/[0.06]"
                    >
                      <span className="flex items-center gap-2.5 min-w-0 flex-1">
                        <Icon className="h-4 w-4 shrink-0 text-emerald-700 dark:text-[#D9FF43]" />
                        <span className="truncate font-semibold">{p.label}</span>
                      </span>
                      <span
                        dir="ltr"
                        className="shrink-0 font-mono text-[10px] text-zinc-400 dark:text-zinc-500"
                      >
                        {p.hint}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Lexical Entries Section */}
          <div className="p-3">
            <p className="px-2.5 pb-2 font-mono text-[10px] tracking-[0.14em] uppercase text-zinc-500 dark:text-zinc-400">
              {trimmed ? `نتائج المعجم (${matchedEntries.length})` : 'مفردات مختارة من المعجم'}
            </p>
            {matchedEntries.length > 0 ? (
              <div className="space-y-1">
                {matchedEntries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => {
                      onSelectEntry(entry)
                      onClose()
                    }}
                    className="w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-start hover:bg-zinc-100 transition-colors cursor-pointer dark:hover:bg-white/[0.06]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-display text-sm font-bold text-zinc-950 dark:text-white">
                          {entry.word}
                        </span>
                        {entry.latin && (
                          <span dir="ltr" className="font-mono text-xs text-emerald-700 dark:text-[#D9FF43]">
                            {entry.latin}
                          </span>
                        )}
                        <span className="text-xs text-zinc-400">·</span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">{entry.category}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-zinc-600 dark:text-zinc-300">
                        {entry.meaning}
                      </p>
                    </div>
                    <ArrowLeft className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-zinc-50 p-4 text-xs dark:bg-[#07070A]">
                <span className="text-zinc-600 dark:text-zinc-300">
                  لا توجد مفردة مطابقة لـ <strong className="text-zinc-950 dark:text-white">«{trimmed}»</strong>.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onQuickAddWord(trimmed)
                    onClose()
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-1.5 font-semibold text-white hover:bg-zinc-800 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507]"
                >
                  <Compass className="h-3.5 w-3.5" />
                  <span>اقترح إضافتها الآن</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50/80 px-4 py-2 text-[11px] text-zinc-500 dark:border-white/10 dark:bg-[#07070A] dark:text-zinc-400">
          <span>تنقّل فوري بين الصفحات المستقلة بدون إعادة تحميل</span>
          <span className="font-mono">ESC للإغلاق</span>
        </div>
      </div>
    </div>
  )
}
