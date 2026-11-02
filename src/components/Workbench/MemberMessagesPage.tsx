import { useMemo, useState } from 'react'
import {
  Award,
  Ban,
  Bell,
  CheckCheck,
  CheckCircle2,
  HeartHandshake,
  MailOpen,
  Megaphone,
  MessageSquareText,
  Send,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import type { MemberMessageCategory, MemberMessageRecord } from '../../types/lexicon'

interface MemberMessagesPageProps {
  messages: MemberMessageRecord[]
  unreadCount: number
  canAccessEditorialTools: boolean
  onMarkRead: (messageId: string) => void
  onMarkAllRead: () => void
  onAcknowledgeWarning: (messageId: string) => void
  onOpenAdminMembers: () => void
  onStartRapidReview: () => void
}

type InboxFilter = 'all' | 'unread' | 'welcome_thanks' | 'governance' | 'announcements'

const CATEGORY_META: Record<
  MemberMessageCategory,
  {
    label: string
    badgeClass: string
    cardBorderClass: string
    icon: typeof Bell
  }
> = {
  welcome: {
    label: 'رسالة ترحيب',
    badgeClass:
      'border-emerald-400/50 bg-emerald-50 text-emerald-900 dark:border-[#D9FF43]/40 dark:bg-[#D9FF43]/12 dark:text-[#D9FF43]',
    cardBorderClass: 'border-zinc-200 dark:border-white/12',
    icon: Sparkles,
  },
  appreciation: {
    label: 'شكر وتقدير',
    badgeClass:
      'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-950/35 dark:text-emerald-300',
    cardBorderClass: 'border-zinc-200 dark:border-white/12',
    icon: HeartHandshake,
  },
  editorial_note: {
    label: 'ملاحظة تحريرية',
    badgeClass:
      'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/35 dark:bg-sky-950/35 dark:text-sky-300',
    cardBorderClass: 'border-zinc-200 dark:border-white/12',
    icon: MessageSquareText,
  },
  role_update: {
    label: 'تحديث صلاحيات',
    badgeClass:
      'border-emerald-400/50 bg-emerald-50 text-emerald-900 dark:border-[#D9FF43]/45 dark:bg-[#D9FF43]/12 dark:text-[#D9FF43]',
    cardBorderClass: 'border-emerald-300/60 dark:border-[#D9FF43]/30',
    icon: Award,
  },
  warning: {
    label: 'إنذار رسمي',
    badgeClass:
      'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-500/45 dark:bg-amber-950/40 dark:text-amber-300',
    cardBorderClass: 'border-amber-300/80 dark:border-amber-500/45',
    icon: ShieldAlert,
  },
  suspension_notice: {
    label: 'قرار إيقاف / حظر',
    badgeClass:
      'border-red-300 bg-red-50 text-red-800 dark:border-red-500/45 dark:bg-red-950/40 dark:text-red-300',
    cardBorderClass: 'border-red-300/80 dark:border-red-500/45',
    icon: Ban,
  },
  announcement: {
    label: 'إعلان عام للمنصة',
    badgeClass:
      'border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-white/20 dark:bg-white/[0.06] dark:text-zinc-200',
    cardBorderClass: 'border-zinc-200 dark:border-white/15',
    icon: Megaphone,
  },
}

export function MemberMessagesPage({
  messages,
  unreadCount,
  canAccessEditorialTools,
  onMarkRead,
  onMarkAllRead,
  onAcknowledgeWarning,
  onOpenAdminMembers,
  onStartRapidReview,
}: MemberMessagesPageProps) {
  const [filter, setFilter] = useState<InboxFilter>('all')

  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      if (filter === 'unread') return !m.read_at
      if (filter === 'welcome_thanks') {
        return m.category === 'welcome' || m.category === 'appreciation' || m.category === 'editorial_note'
      }
      if (filter === 'governance') {
        return (
          m.category === 'warning' ||
          m.category === 'suspension_notice' ||
          m.category === 'role_update'
        )
      }
      if (filter === 'announcements') return m.is_broadcast || m.category === 'announcement'
      return true
    })
  }, [messages, filter])

  return (
    <section className="space-y-6" aria-labelledby="member-inbox-heading">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#0B0B10]">
        <div
          role="group"
          aria-label="تصنيف الرسائل"
          className="flex flex-wrap items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-white/10 dark:bg-[#07070A]"
        >
          {(
            [
              { id: 'all', label: `كل الرسائل (${messages.length})` },
              { id: 'unread', label: `غير مقروءة (${unreadCount})` },
              { id: 'welcome_thanks', label: 'الترحيب والتوجيه' },
              { id: 'governance', label: 'الإنذارات والرتب' },
              { id: 'announcements', label: 'إعلانات عامة' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`min-h-[32px] rounded-lg px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                filter === tab.id
                  ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                  : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60"
            >
              <CheckCheck className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
              <span>تحديد الكل كمقروء</span>
            </button>
          )}

          {canAccessEditorialTools && (
            <button
              type="button"
              onClick={onOpenAdminMembers}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
            >
              <Send className="h-3.5 w-3.5" />
              <span>إرسال رسالة أو إعلان للأعضاء</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages Feed */}
      <h2 id="member-inbox-heading" className="sr-only">
        صندوق الرسائل والتنبيهات
      </h2>

      {filteredMessages.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center dark:border-white/10 dark:bg-[#0B0B10]">
          <MailOpen className="mx-auto h-8 w-8 text-zinc-400 dark:text-zinc-500" />
          <p className="mt-3 font-display text-base font-bold text-zinc-950 dark:text-white">
            لا توجد رسائل ضمن هذا التصنيف
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            ستظهر هنا رسائل الترحيب، تحديثات الصلاحيات، والملاحظات التحريرية فور ورودها.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredMessages.map((msg) => {
            const meta = CATEGORY_META[msg.category] ?? CATEGORY_META.editorial_note
            const Icon = meta.icon
            const isUnread = !msg.read_at

            return (
              <article
                key={msg.id}
                onClick={() => {
                  if (isUnread) onMarkRead(msg.id)
                }}
                className={`rounded-2xl border bg-white p-5 transition-colors dark:bg-[#0B0B10] ${meta.cardBorderClass} ${
                  isUnread ? 'ring-1 ring-emerald-500/35 dark:ring-[#D9FF43]/35' : ''
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${meta.badgeClass}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                        {isUnread && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white dark:bg-[#D9FF43] dark:text-[#050507]">
                            جديد
                          </span>
                        )}
                        {msg.is_sandbox && (
                          <span className="rounded-md border border-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                            وضع المعاينة
                          </span>
                        )}
                      </div>
                      <h3 className="font-display text-base sm:text-lg font-bold text-zinc-950 dark:text-white">
                        {msg.title}
                      </h3>
                    </div>
                  </div>

                  <div className="text-end text-[11px] text-zinc-500 dark:text-zinc-400">
                    <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                      {msg.sender_label}
                    </p>
                    <p className="mt-0.5 font-mono">
                      {new Date(msg.created_at).toLocaleDateString('ar-MA')}
                    </p>
                  </div>
                </div>

                <p className="mt-3.5 text-xs sm:text-sm leading-7 text-zinc-700 dark:text-zinc-300">
                  {msg.body}
                </p>

                {/* Contextual Footer Actions */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3 dark:border-white/10">
                  <div className="flex flex-wrap items-center gap-2">
                    {msg.category === 'welcome' && (
                      <button
                        type="button"
                        onClick={onStartRapidReview}
                        className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-1 text-xs font-bold text-white hover:bg-zinc-800 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507]"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>ابدأ المراجعة السريعة الآن</span>
                      </button>
                    )}

                    {msg.requires_ack && !msg.acknowledged_at && (
                      <button
                        type="button"
                        onClick={() => onAcknowledgeWarning(msg.id)}
                        className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-amber-600 px-4 py-1 text-xs font-bold text-white hover:bg-amber-700 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507]"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>أقرّ بالاطلاع والالتزام بضوابط المعجم</span>
                      </button>
                    )}

                    {msg.acknowledged_at && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-[#D9FF43]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>
                          تم الإقرار بالاطلاع بتاريخ{' '}
                          {new Date(msg.acknowledged_at).toLocaleString('ar-MA')}
                        </span>
                      </span>
                    )}
                  </div>

                  {isUnread && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onMarkRead(msg.id)
                      }}
                      className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer dark:text-[#D9FF43]"
                    >
                      تحديد كمقروءة
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
