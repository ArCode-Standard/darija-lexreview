import { useMemo, useState } from 'react'
import {
  CloudUpload,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  X,
} from 'lucide-react'
import type { LexicalEntry, LocalDraft } from '../types/lexicon'
import { auditDraftForSync, syncLocalDraftsToAccount } from '../utils/draftSync'

interface LocalDraftSyncBannerProps {
  isAuthenticated: boolean
  userEmail: string | null
  corpusVersion: string
  draftsList: LocalDraft[]
  entries: LexicalEntry[]
  onRemoveSyncedDrafts: (entryIds: string[]) => void
  onResumeDraft: (entryId: string) => void
  onSyncedSuccess: () => void
}

export function LocalDraftSyncBanner({
  isAuthenticated,
  userEmail,
  corpusVersion,
  draftsList,
  entries,
  onRemoveSyncedDrafts,
  onResumeDraft,
  onSyncedSuccess,
}: LocalDraftSyncBannerProps) {
  const [dismissedCount, setDismissedCount] = useState<number | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncReport, setSyncReport] = useState<{
    type: 'success' | 'warning' | 'error'
    text: string
  } | null>(null)

  const audits = useMemo(
    () => draftsList.map((draft) => auditDraftForSync(draft, entries)),
    [draftsList, entries],
  )

  const readyCount = useMemo(() => audits.filter((a) => a.ready).length, [audits])
  const incompleteCount = audits.length - readyCount

  if (!isAuthenticated || (draftsList.length === 0 && !syncReport)) {
    return null
  }

  if (dismissedCount === draftsList.length && !syncReport) {
    return null
  }

  async function handleSyncReadyDrafts() {
    setSyncing(true)
    setSyncReport(null)

    const result = await syncLocalDraftsToAccount(draftsList, entries, corpusVersion)
    setSyncing(false)

    if (result.error && result.syncedEntryIds.length === 0) {
      setSyncReport({
        type: 'error',
        text: result.error,
      })
      setExpanded(true)
      return
    }

    if (result.syncedEntryIds.length > 0) {
      onRemoveSyncedDrafts(result.syncedEntryIds)
      onSyncedSuccess()
    }

    if (result.skippedAudits.length > 0) {
      setSyncReport({
        type: 'warning',
        text: `تم إرسال ${result.syncedEntryIds.length} مسودات جاهزة إلى حسابك (${userEmail})، وبقيت ${result.skippedAudits.length} مسودات محلياً لاستكمال حقولها الناقصة دون ضياع أي بيانات.`,
      })
      setExpanded(true)
    } else {
      setSyncReport({
        type: 'success',
        text: `تمت مزامنة وإرسال جميع المسودات المحلية (${result.syncedEntryIds.length}) إلى حسابك في سجل المراجعة بنجاح.`,
      })
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 dark:border-white/15 dark:bg-[#0D0D12]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3 max-w-[74ch]">
          <CloudUpload
            className="h-5 w-5 shrink-0 mt-0.5 text-zinc-900 dark:text-[#D9FF43]"
            aria-hidden="true"
          />
          <div>
            <h3 className="font-display text-sm font-bold text-zinc-950 dark:text-white">
              {draftsList.length > 0
                ? `مزامنة المسودات المحلية مع حسابك (${draftsList.length.toLocaleString('en-US')})`
                : 'اكتملت مزامنة المسودات المحلية'}
            </h3>
            {draftsList.length > 0 && (
              <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                رصدت المنصة مسودات محفوظة في متصفحك قبل الدخول ({' '}
                <span className="font-semibold text-zinc-950 dark:text-[#D9FF43]">
                  {readyCount.toLocaleString('en-US')} جاهزة للإرسال المباشر
                </span>
                {incompleteCount > 0
                  ? ` · ${incompleteCount.toLocaleString('en-US')} قيد الاستكمال`
                  : ''}
                ). يمكنك ترحيل المسودات المكتملة دفعةً واحدة إلى سجل المراجعة المرتبط بحسابك.
              </p>
            )}

            {syncReport && (
              <div
                role="status"
                className={`mt-2.5 flex items-start gap-2 rounded-xl border p-2.5 text-xs leading-relaxed ${
                  syncReport.type === 'error'
                    ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-200'
                    : syncReport.type === 'warning'
                      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200'
                }`}
              >
                {syncReport.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-700 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
                )}
                <span>{syncReport.text}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {draftsList.length > 0 && readyCount > 0 && (
            <button
              type="button"
              disabled={syncing}
              onClick={handleSyncReadyDrafts}
              className="inline-flex min-h-[38px] items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 whitespace-nowrap cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
            >
              <CloudUpload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {syncing
                  ? 'جارٍ ترحيل المسودات...'
                  : `إرسال المسودات الجاهزة (${readyCount})`}
              </span>
            </button>
          )}

          {draftsList.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 whitespace-nowrap cursor-pointer dark:border-white/15 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/[0.08]"
            >
              <span>{expanded ? 'إخفاء التفاصيل' : 'معاينة الجاهزية'}</span>
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setSyncReport(null)
              setDismissedCount(draftsList.length)
            }}
            aria-label="إغلاق تنبيه مزامنة المسودات"
            className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && audits.length > 0 && (
        <div className="mt-4 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-zinc-50 px-4 dark:divide-white/10 dark:border-white/10 dark:bg-[#08080B]">
          {audits.map((item) => (
            <div
              key={item.draft.entryId}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display font-bold text-zinc-950 dark:text-white">
                    {item.draft.headword}
                  </span>
                  <span className="text-zinc-400" aria-hidden="true">·</span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {item.draft.entryId.startsWith('NEW')
                      ? 'مفردة جديدة'
                      : 'تعديل مفردة قائمة'}
                  </span>
                  <span className="text-zinc-400" aria-hidden="true">·</span>
                  {item.ready ? (
                    <span className="font-semibold text-emerald-700 dark:text-[#D9FF43]">
                      مكتملة وجاهزة للمزامنة
                    </span>
                  ) : (
                    <span className="font-semibold text-amber-800 dark:text-amber-400">
                      تحتاج استكمالاً: {item.reason}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onResumeDraft(item.draft.entryId)}
                className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3.5 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 whitespace-nowrap shrink-0 cursor-pointer dark:border-white/15 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.1]"
              >
                <span>{item.ready ? 'مراجعة المسودة' : 'استكمال الحقول'}</span>
                <ArrowLeft className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
