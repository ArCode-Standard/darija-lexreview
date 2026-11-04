import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Award,
  Ban,
  Bell,
  BookOpen,
  CheckCheck,
  CheckCircle2,
  HeartHandshake,
  MailOpen,
  Megaphone,
  MessageSquareText,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import type { MemberMessageCategory, MemberMessageRecord } from '../../types/lexicon'

export interface OpenSubmissionFromMessageParams {
  submissionId: string | null
  entryId: string | null
  decisionStatus?: MemberMessageRecord['decision_status']
  openEditorDirectly?: boolean
}

interface MemberMessagesPageProps {
  messages: MemberMessageRecord[]
  unreadCount: number
  canAccessEditorialTools: boolean
  onMarkRead: (messageId: string) => void
  onMarkAllRead: () => void
  onAcknowledgeWarning: (messageId: string) => void
  onOpenAdminMembers: () => void
  onStartRapidReview: () => void
  onOpenSubmissionFromMessage?: (params: OpenSubmissionFromMessageParams) => void
}

type InboxFilter =
  | 'all'
  | 'unread'
  | 'decisions'
  | 'welcome_thanks'
  | 'governance'
  | 'announcements'

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
    label: 'اعتماد وشكر',
    badgeClass:
      'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-950/35 dark:text-emerald-300',
    cardBorderClass: 'border-zinc-200 dark:border-white/12',
    icon: HeartHandshake,
  },
  editorial_note: {
    label: 'قرار وملاحظة تحريرية',
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

function formatDecisionLabel(status?: MemberMessageRecord['decision_status']): string | null {
  switch (status) {
    case 'accepted':
      return 'اعتُمدت في المعجم'
    case 'merged':
      return 'أُدرجت في إصدار رسمي'
    case 'needs_changes':
      return 'تحتاج تعديلاً بسيطاً'
    case 'rejected':
      return 'لم تُعتمد بصيغتها الحالية'
    default:
      return null
  }
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
  onOpenSubmissionFromMessage,
}: MemberMessagesPageProps) {
  const [filter, setFilter] = useState<InboxFilter>('all')

  const decisionsCount = useMemo(
    () =>
      messages.filter((m) => Boolean(m.related_submission_id || m.decision_status)).length,
    [messages],
  )

  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      if (filter === 'unread') return !m.read_at
      if (filter === 'decisions') {
        return Boolean(m.related_submission_id || m.decision_status)
      }
      if (filter === 'welcome_thanks') {
        return (
          m.category === 'welcome' ||
          m.category === 'appreciation' ||
          m.category === 'editorial_note'
        )
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
              { id: 'decisions', label: `قرارات المساهمات (${decisionsCount})` },
              { id: 'welcome_thanks', label: 'الترحيب والتوجيه' },
              { id: 'governance', label: 'الإنذارات والرتب' },
              { id: 'announcements', label: 'إعلانات عامة' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`min-h-[32px] rounded-lg px-3 py-1 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
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
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 whitespace-nowrap shrink-0 cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60"
            >
              <CheckCheck className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
              <span>تحديد الكل كمقروء</span>
            </button>
          )}

          {canAccessEditorialTools && (
            <button
              type="button"
              onClick={onOpenAdminMembers}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
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
            ستظهر هنا إشعارات تحكيم مقترحاتك، رسائل الترحيب، وتحديثات الصلاحيات فور ورودها.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredMessages.map((msg) => {
            const meta = CATEGORY_META[msg.category] ?? CATEGORY_META.editorial_note
            const Icon = meta.icon
            const isUnread = !msg.read_at
            const hasLinkedSubmission = Boolean(
              msg.related_submission_id || msg.related_entry_id,
            )
            const decisionLabel = formatDecisionLabel(msg.decision_status)
            const canReviseSubmission =
              msg.decision_status === 'needs_changes' || msg.decision_status === 'rejected'

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
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-200">
                          {meta.label}
                        </span>
                        {decisionLabel && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span
                              className={`font-semibold ${
                                msg.decision_status === 'accepted' ||
                                msg.decision_status === 'merged'
                                  ? 'text-emerald-700 dark:text-[#D9FF43]'
                                  : msg.decision_status === 'needs_changes'
                                    ? 'text-amber-700 dark:text-amber-400'
                                    : 'text-red-700 dark:text-red-400'
                              }`}
                            >
                              {decisionLabel}
                            </span>
                          </>
                        )}
                        {isUnread && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-bold text-emerald-700 dark:text-[#D9FF43]">
                              غير مقروءة
                            </span>
                          </>
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
                    <p className="mt-0.5 font-mono tabular-nums">
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
                    {hasLinkedSubmission && onOpenSubmissionFromMessage && (
                      <>
                        {canReviseSubmission ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (isUnread) onMarkRead(msg.id)
                                onOpenSubmissionFromMessage({
                                  submissionId: msg.related_submission_id ?? null,
                                  entryId: msg.related_entry_id ?? null,
                                  decisionStatus: msg.decision_status,
                                  openEditorDirectly: true,
                                })
                              }}
                              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
                            >
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>
                                {msg.decision_status === 'needs_changes'
                                  ? 'تعديل المقترح وإعادة إرساله'
                                  : 'مراجعة المقترح وتقديم نسخة منقحة'}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (isUnread) onMarkRead(msg.id)
                                onOpenSubmissionFromMessage({
                                  submissionId: msg.related_submission_id ?? null,
                                  entryId: msg.related_entry_id ?? null,
                                  decisionStatus: msg.decision_status,
                                  openEditorDirectly: false,
                                })
                              }}
                              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 whitespace-nowrap shrink-0 cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:border-white/35"
                            >
                              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>عرض في سجل مساهماتي</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (isUnread) onMarkRead(msg.id)
                              onOpenSubmissionFromMessage({
                                submissionId: msg.related_submission_id ?? null,
                                entryId: msg.related_entry_id ?? null,
                                decisionStatus: msg.decision_status,
                                openEditorDirectly: false,
                              })
                            }}
                            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
                          >
                            <span>انتقل إلى مقترحك المعتمد</span>
                            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </>
                    )}

                    {msg.category === 'welcome' && (
                      <button
                        type="button"
                        onClick={onStartRapidReview}
                        className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-1 text-xs font-bold text-white hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507]"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>ابدأ المراجعة السريعة الآن</span>
                      </button>
                    )}

                    {msg.requires_ack && !msg.acknowledged_at && (
                      <button
                        type="button"
                        onClick={() => onAcknowledgeWarning(msg.id)}
                        className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-amber-600 px-4 py-1 text-xs font-bold text-white hover:bg-amber-700 whitespace-nowrap shrink-0 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507]"
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
                      className="text-xs font-semibold text-emerald-700 hover:underline whitespace-nowrap shrink-0 cursor-pointer dark:text-[#D9FF43]"
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
