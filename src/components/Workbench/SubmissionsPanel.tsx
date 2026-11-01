import { useEffect, useState } from 'react'
import { Download, Trash2, ArrowLeft, RefreshCw, LogIn } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { LocalDraft, SubmissionRecord } from '../../types/lexicon'
import { formatStatusLabel } from '../../services/dataset'

interface SubmissionsPanelProps {
  draftsList: LocalDraft[]
  userEmail: string | null
  refreshTrigger: number
  onResumeDraft: (entryId: string) => void
  onDeleteDraft: (entryId: string) => void
  onOpenAuth: () => void
}

export function SubmissionsPanel({
  draftsList,
  userEmail,
  refreshTrigger,
  onResumeDraft,
  onDeleteDraft,
  onOpenAuth,
}: SubmissionsPanelProps) {
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function loadSubmissions() {
    if (!supabase || !userEmail) {
      setSubmissions([])
      return
    }
    setLoading(true)
    setErrorMsg(null)
    const { data, error } = await supabase
      .from('review_submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    setLoading(false)
    if (error) {
      setErrorMsg(error.message)
      return
    }
    setSubmissions((data ?? []) as SubmissionRecord[])
  }

  useEffect(() => {
    loadSubmissions()
  }, [userEmail, refreshTrigger])

  function handleExportDraftsJson() {
    if (draftsList.length === 0) return
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        source: 'Darija LexReview Local Drafts',
        count: draftsList.length,
        drafts: draftsList,
      },
      null,
      2,
    )
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `darija-lexreview-drafts-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-xl border border-[#E5DFD3] bg-white p-5 sm:p-8 space-y-10 dark:border-[#2E2B27] dark:bg-[#1C1A18]">
      {/* Section 1: Local Browser Drafts */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E5DFD3] dark:border-[#2E2B27]">
          <div>
            <h3 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
              المسودات المحفوظة محلياً ({draftsList.length.toLocaleString('en-US')})
            </h3>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
              تُحفظ هذه المسودات في متصفحك الحالي لتتمكن من استكمال البحث عن الشواهد قبل الإرسال النهائي.
            </p>
          </div>

          {draftsList.length > 0 && (
            <button
              type="button"
              onClick={handleExportDraftsJson}
              className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-[#EFECE4] whitespace-nowrap shrink-0 cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-200"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>تصدير بصيغة JSON</span>
            </button>
          )}
        </div>

        {draftsList.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-xs text-stone-500 dark:text-stone-400">
              لا توجد مسودات محفوظة في المتصفح حالياً. يمكنك استخدام زر «حفظ مسودة محلية» أثناء فحص أي مدخل.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E5DFD3] dark:divide-[#2E2B27]">
            {draftsList.map((draft) => {
              const modifiedKeys = Object.entries(draft.proposedData).filter(
                ([, val]) => typeof val === 'string' && val.trim() !== '',
              )
              return (
                <div
                  key={draft.entryId}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
                        {draft.headword}
                      </span>
                      <span className="text-xs text-stone-400" aria-hidden="true">·</span>
                      <span className="font-mono text-xs tabular-nums text-stone-500 dark:text-stone-400">
                        {draft.entryId.startsWith('NEW') ? 'مفردة جديدة' : `#${draft.entryId}`}
                      </span>
                      <span className="text-xs text-stone-400" aria-hidden="true">·</span>
                      <span className="text-xs text-stone-600 dark:text-stone-400">
                        {draft.category}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
                      {modifiedKeys.length} حقول معدلة · {draft.evidence.length} روابط شواهد · آخر تحديث{' '}
                      <span className="font-mono tabular-nums">
                        {new Date(draft.updatedAt).toLocaleDateString('ar-MA')}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onResumeDraft(draft.entryId)}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#0F5C4E] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0B463B] whitespace-nowrap cursor-pointer dark:bg-[#147A67]"
                    >
                      <span>متابعة التحرير</span>
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteDraft(draft.entryId)}
                      aria-label="حذف المسودة"
                      className="flex h-[36px] w-[36px] items-center justify-center rounded-lg border border-[#D6CEBE] text-stone-500 hover:text-red-700 hover:border-red-300 cursor-pointer dark:border-[#3A3530] dark:text-stone-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Section 2: Submitted Reviews in Supabase */}
      <div className="pt-8 border-t border-[#E5DFD3] dark:border-[#2E2B27]">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E5DFD3] dark:border-[#2E2B27]">
          <div>
            <h3 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
              المقترحات المرسلة إلى سجل المراجعة
            </h3>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
              سجل المساهمات المرتبطة بحسابك في قاعدة بيانات المراجعة وحالة التحكيم لكل مقترح.
            </p>
          </div>

          {userEmail && (
            <button
              type="button"
              onClick={loadSubmissions}
              disabled={loading}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-[#EFECE4] cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-300"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>تحديث السجل</span>
            </button>
          )}
        </div>

        {!userEmail ? (
          <div className="py-10 text-center">
            <p className="text-xs text-stone-600 dark:text-stone-400">
              سجّل الدخول بحساب مراجع لعرض المقترحات التي أرسلتها ومتابعة قرارات المحررين بشأنها.
            </p>
            <button
              type="button"
              onClick={onOpenAuth}
              className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#0F5C4E] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0B463B] cursor-pointer dark:bg-[#147A67]"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>دخول المراجعين</span>
            </button>
          </div>
        ) : loading ? (
          <div className="py-8 space-y-2">
            <div className="h-14 rounded-lg bg-[#FBF9F5] animate-pulse dark:bg-[#141312]" />
            <div className="h-14 rounded-lg bg-[#FBF9F5] animate-pulse dark:bg-[#141312]" />
          </div>
        ) : errorMsg ? (
          <p className="py-6 text-xs text-red-700 dark:text-red-400">
            تعذر جلب سجل المساهمات: {errorMsg}
          </p>
        ) : submissions.length === 0 ? (
          <p className="py-8 text-center text-xs text-stone-500 dark:text-stone-400">
            لم ترسل أي مقترحات مسجلة بعد من هذا الحساب.
          </p>
        ) : (
          <div className="divide-y divide-[#E5DFD3] dark:divide-[#2E2B27]">
            {submissions.map((sub) => (
              <div key={sub.id} className="py-4 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold tabular-nums text-stone-900 dark:text-stone-100">
                      مدخل #{sub.entry_id}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-[#0F5C4E] dark:text-[#4FD1C5]">
                      {formatStatusLabel(sub.status)}
                    </span>
                  </div>
                  <span className="font-mono tabular-nums text-stone-500 dark:text-stone-400">
                    {new Date(sub.created_at).toLocaleDateString('ar-MA')}
                  </span>
                </div>
                {sub.reviewer_note && (
                  <p className="text-xs leading-relaxed text-stone-700 dark:text-stone-300">
                    ملاحظة المراجع: {sub.reviewer_note}
                  </p>
                )}
                {sub.editor_note && (
                  <p className="text-xs leading-relaxed text-stone-600 dark:text-stone-400">
                    رد المحرر: {sub.editor_note}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
