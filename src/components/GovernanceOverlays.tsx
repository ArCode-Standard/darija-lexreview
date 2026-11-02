import { AlertTriangle, Ban, CheckCircle2, Megaphone, ShieldAlert, X } from 'lucide-react'
import type { AccountStatus, MemberMessageRecord } from '../types/lexicon'

interface GlobalAnnouncementBannerProps {
  announcements: MemberMessageRecord[]
  canOpenInbox?: boolean
  onDismiss: (id: string) => void
  onOpenMessages?: () => void
}

export function GlobalAnnouncementBanner({
  announcements,
  canOpenInbox = false,
  onDismiss,
  onOpenMessages,
}: GlobalAnnouncementBannerProps) {
  const top = announcements[0]
  if (!top) return null

  return (
    <div
      role="region"
      aria-label="إعلان عام من إدارة المنصة"
      className="border-b border-emerald-500/30 bg-emerald-50/90 px-4 py-2.5 text-xs text-zinc-900 dark:border-[#D9FF43]/30 dark:bg-[#0C0F06] dark:text-zinc-100"
    >
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white dark:bg-[#D9FF43] dark:text-[#050507]">
            <Megaphone className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <strong className="font-bold text-zinc-950 dark:text-[#D9FF43]">{top.title}:</strong>{' '}
            <span className="text-zinc-700 dark:text-zinc-200">{top.body}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canOpenInbox && onOpenMessages && (
            <button
              type="button"
              onClick={onOpenMessages}
              className="rounded-lg px-2.5 py-1 font-semibold text-emerald-800 hover:underline cursor-pointer dark:text-[#D9FF43]"
            >
              صندوق الرسائل
            </button>
          )}
          <button
            type="button"
            onClick={() => onDismiss(top.id)}
            aria-label="إخفاء الإعلان العام"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-black/5 hover:text-zinc-900 cursor-pointer dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

interface MandatoryWarningModalProps {
  warning: MemberMessageRecord | null
  onAcknowledge: (messageId: string) => void
}

export function MandatoryWarningModal({ warning, onAcknowledge }: MandatoryWarningModalProps) {
  if (!warning) return null

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="mandatory-warning-title"
      aria-describedby="mandatory-warning-desc"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-md"
      dir="rtl"
    >
      <div className="w-full max-w-lg rounded-2xl border border-amber-400/80 bg-white p-6 sm:p-7 shadow-2xl dark:border-amber-500/50 dark:bg-[#0B0B10]">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <p className="font-mono text-[11px] tracking-[0.14em] uppercase text-amber-700 dark:text-amber-400">
              OFFICIAL GOVERNANCE WARNING / إنذار رسمي
            </p>
            <h2
              id="mandatory-warning-title"
              className="mt-0.5 font-display text-lg sm:text-xl font-bold text-zinc-950 dark:text-white"
            >
              {warning.title}
            </h2>
          </div>
        </div>

        <div
          id="mandatory-warning-desc"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm leading-7 text-zinc-800 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-zinc-200"
        >
          {warning.body}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span>جهة الإصدار: {warning.sender_label}</span>
          <span>{new Date(warning.created_at).toLocaleString('ar-MA')}</span>
        </div>

        <p className="mt-4 text-xs leading-6 text-zinc-600 dark:text-zinc-400">
          يتطلب الاستمرار في استخدام أدوات المساهمة الإقرار بقراءة هذا التنبيه والالتزام بالضوابط المنهجية والعلمية للمتن. يُحفظ تاريخ إقرارك في سجل الحوكمة.
        </p>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => onAcknowledge(warning.id)}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-zinc-800 transition-colors cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>اطّلعت على التنبيه وألتزم بضوابط المساهمة المعجمية</span>
          </button>
        </div>
      </div>
    </div>
  )
}

interface AccountStandingBannerProps {
  status?: AccountStatus
  reason?: string | null
  suspendedUntil?: string | null
}

export function AccountStandingBanner({
  status,
  reason,
  suspendedUntil,
}: AccountStandingBannerProps) {
  if (!status || status === 'active') return null

  if (status === 'warned') {
    return (
      <div
        role="status"
        className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-300/80 bg-amber-50/80 p-4 text-xs text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="space-y-1">
          <p className="font-bold">تنبيه مسجّل على الحساب — يرجى مراعاة ضوابط التوثيق العلمي</p>
          {reason && <p className="text-amber-900/90 dark:text-amber-200/85">{reason}</p>}
        </div>
      </div>
    )
  }

  return (
    <div
      role="alert"
      className="mb-5 flex items-start gap-3 rounded-2xl border border-red-300/80 bg-red-50/90 p-4 text-xs text-red-950 dark:border-red-800/60 dark:bg-red-950/35 dark:text-red-200"
    >
      <Ban className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
      <div className="space-y-1">
        <p className="font-bold">
          {status === 'banned'
            ? 'تم إيقاف صلاحية النشر والمساهمة لهذا الحساب نهائياً بقرار إداري'
            : 'تم تجميد صلاحية إرسال المساهمات لهذا الحساب مؤقتاً'}
        </p>
        {reason && <p>{reason}</p>}
        {status === 'suspended' && suspendedUntil && (
          <p className="font-mono text-[11px] opacity-85">
            ينتهي التجميد بتاريخ: {new Date(suspendedUntil).toLocaleDateString('ar-MA')}
          </p>
        )}
      </div>
    </div>
  )
}
