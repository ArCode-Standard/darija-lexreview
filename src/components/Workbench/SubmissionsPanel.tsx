import { useEffect, useMemo, useState } from 'react'
import {
  Download,
  Trash2,
  ArrowLeft,
  RefreshCw,
  LogIn,
  CloudUpload,
  GitBranch,
  RotateCcw,
  Award,
  XCircle,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { LexicalEntry, LocalDraft, SubmissionRecord } from '../../types/lexicon'
import { formatAccessionCode, formatStatusLabel } from '../../services/dataset'
import { isNewEntrySubmission } from '../../services/exporter'
import { auditDraftForSync, syncLocalDraftsToAccount } from '../../utils/draftSync'
import { humanizeSystemError } from '../../utils/humanizeError'

interface SubmissionsPanelProps {
  draftsList: LocalDraft[]
  entries: LexicalEntry[]
  corpusVersion: string
  canAccessEditorialTools: boolean
  totalAttestationsCount: number
  sandboxItems: SubmissionRecord[]
  userEmail: string | null
  refreshTrigger: number
  onResumeDraft: (entryId: string) => void
  onStartRevision: (submission: SubmissionRecord) => void
  onWithdrawSandboxSubmission: (id: string) => void
  onDeleteDraft: (entryId: string) => void
  onRemoveMultipleDrafts: (entryIds: string[]) => void
  onOpenAuth: () => void
}

export function SubmissionsPanel({
  draftsList,
  entries,
  corpusVersion,
  canAccessEditorialTools,
  totalAttestationsCount,
  sandboxItems,
  userEmail,
  refreshTrigger,
  onResumeDraft,
  onStartRevision,
  onWithdrawSandboxSubmission,
  onDeleteDraft,
  onRemoveMultipleDrafts,
  onOpenAuth,
}: SubmissionsPanelProps) {
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [confirmWithdrawId, setConfirmWithdrawId] = useState<string | null>(null)
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  )

  const readyDraftsCount = useMemo(
    () => draftsList.filter((d) => auditDraftForSync(d, entries).ready).length,
    [draftsList, entries],
  )

  const entryById = useMemo(() => {
    const m = new Map<string, LexicalEntry>()
    for (const e of entries) m.set(e.id, e)
    return m
  }, [entries])

  async function loadSubmissions() {
    if (!supabase || !userEmail) {
      setSubmissions([])
      return
    }
    setLoading(true)
    setErrorMsg(null)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      setSubmissions([])
      return
    }

    const { data, error } = await supabase
      .from('review_submissions')
      .select('*')
      .eq('reviewer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    setLoading(false)
    if (error) {
      setErrorMsg(humanizeSystemError(error, 'تعذر جلب سجل المساهمات في الوقت الحالي.'))
      return
    }
    setSubmissions((data ?? []) as SubmissionRecord[])
  }

  useEffect(() => {
    loadSubmissions()
  }, [userEmail, refreshTrigger])

  const impactMetrics = useMemo(() => {
    const acceptedCount = submissions.filter((s) => s.status === 'accepted').length
    const mergedCount = submissions.filter((s) => s.status === 'merged').length
    const pendingCount = submissions.filter((s) => s.status === 'pending').length
    return {
      acceptedCount,
      mergedCount,
      pendingCount,
      approvedTotal: acceptedCount + mergedCount,
    }
  }, [submissions])

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

  async function handleSyncReadyDrafts() {
    setSyncing(true)
    setSyncMsg(null)
    const res = await syncLocalDraftsToAccount(draftsList, entries, corpusVersion)
    setSyncing(false)

    if (res.error && res.syncedEntryIds.length === 0) {
      setSyncMsg({ type: 'error', text: res.error })
      return
    }
    if (res.syncedEntryIds.length > 0) {
      onRemoveMultipleDrafts(res.syncedEntryIds)
      await loadSubmissions()
    }
    setSyncMsg({
      type: 'success',
      text:
        res.skippedAudits.length > 0
          ? `تم إرسال ${res.syncedEntryIds.length} مسودات مكتملة إلى حسابك، وبقيت ${res.skippedAudits.length} مسودات لاستكمال حقولها.`
          : `تمت مزامنة وإرسال جميع المسودات الجاهزة (${res.syncedEntryIds.length}) إلى حسابك بنجاح.`,
    })
  }

  async function handleConfirmWithdraw(sub: SubmissionRecord) {
    setSyncMsg(null)
    if (sub.is_sandbox) {
      onWithdrawSandboxSubmission(sub.id)
      setConfirmWithdrawId(null)
      setSyncMsg({
        type: 'success',
        text: 'تم سحب المقترح من طابور المراجعة قبل صدور قرار تحكيمي.',
      })
      return
    }
    if (!supabase) return
    setWithdrawingId(sub.id)
    const { error } = await supabase.rpc('withdraw_own_submission', {
      p_submission_id: sub.id,
    })
    setWithdrawingId(null)
    setConfirmWithdrawId(null)
    if (error) {
      setSyncMsg({
        type: 'error',
        text: humanizeSystemError(
          error,
          'تعذر سحب المقترح حالياً (قد يكون قد دخل مرحلة التحكيم بالفعل).',
        ),
      })
      return
    }
    await loadSubmissions()
    setSyncMsg({
      type: 'success',
      text: 'تم سحب مقترحك بنجاح مع توثيق السحب في سجل التدقيق.',
    })
  }

  function renderSubmissionRow(sub: SubmissionRecord) {
    const isNew = isNewEntrySubmission(sub)
    const target = entryById.get(sub.entry_id)
    const titleLabel = isNew
      ? `${sub.proposed_data?.word_ar || 'مفردة جديدة'} (مفردة جديدة)`
      : `${target?.word ?? `مدخل رقم ${sub.entry_id}`} (${formatAccessionCode(sub.entry_id, target?.numericId ?? null)})`
    const canRevise = sub.status === 'needs_changes' || sub.status === 'rejected'
    const canWithdraw = sub.status === 'pending'
    const isConfirmingWithdraw = confirmWithdrawId === sub.id

    return (
      <div
        key={sub.id}
        className="py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
      >
        <div className="space-y-1.5 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-display text-sm font-bold text-stone-900 dark:text-stone-100">
              {titleLabel}
            </span>
            <span aria-hidden="true" className="text-stone-300 dark:text-stone-600">
              ·
            </span>
            <span
              className={`font-semibold ${
                sub.status === 'merged' || sub.status === 'accepted'
                  ? 'text-[#0F5C4E] dark:text-[#4FD1C5]'
                  : sub.status === 'needs_changes'
                    ? 'text-amber-700 dark:text-amber-400'
                    : sub.status === 'rejected'
                      ? 'text-red-700 dark:text-red-400'
                      : sub.status === 'withdrawn' || sub.status === 'superseded'
                        ? 'text-stone-500 dark:text-stone-500'
                        : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              {sub.status === 'merged' && sub.exported_in_version
                ? `مدمج في الإصدار v${sub.exported_in_version.replace(/^v/i, '')}`
                : formatStatusLabel(sub.status)}
            </span>
            {sub.supersedes_id && (
              <>
                <span aria-hidden="true" className="text-stone-300 dark:text-stone-600">
                  ·
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-stone-600 dark:text-stone-400">
                  <GitBranch className="h-3 w-3" aria-hidden="true" />
                  <span>نسخة منقحة لمقترح سابق</span>
                </span>
              </>
            )}
            <span aria-hidden="true" className="text-stone-300 dark:text-stone-600">
              ·
            </span>
            <span className="font-mono tabular-nums text-stone-500 dark:text-stone-400">
              {new Date(sub.created_at).toLocaleDateString('ar-MA')}
            </span>
          </div>

          {sub.reviewer_note && (
            <p className="text-xs leading-relaxed text-stone-700 dark:text-stone-300">
              ملاحظتك: {sub.reviewer_note}
            </p>
          )}
          {sub.editor_note && (
            <p className="rounded-md border border-[#E5DFD3] bg-[#FBF9F5] px-3 py-2 text-xs leading-relaxed text-stone-700 dark:border-[#2E2B27] dark:bg-[#141312] dark:text-stone-300">
              <strong className="font-semibold">ملاحظة اللجنة التحريرية:</strong> {sub.editor_note}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canRevise && (
            <button
              type="button"
              onClick={() => onStartRevision(sub)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#0F5C4E] bg-[#FBF9F5] px-3.5 py-1.5 text-xs font-semibold text-[#0F5C4E] hover:bg-[#EFECE4] whitespace-nowrap cursor-pointer dark:border-[#4FD1C5]/60 dark:bg-[#141312] dark:text-[#4FD1C5]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>تقديم نسخة منقحة</span>
            </button>
          )}

          {canWithdraw && !isConfirmingWithdraw && (
            <button
              type="button"
              onClick={() => setConfirmWithdrawId(sub.id)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-red-300 hover:text-red-700 whitespace-nowrap cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-300 dark:hover:text-red-400"
            >
              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>سحب المقترح</span>
            </button>
          )}

          {canWithdraw && isConfirmingWithdraw && (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/80 p-1 dark:border-red-900/50 dark:bg-red-950/30">
              <button
                type="button"
                disabled={withdrawingId === sub.id}
                onClick={() => handleConfirmWithdraw(sub)}
                className="min-h-[30px] rounded-md bg-red-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                {withdrawingId === sub.id ? 'جارٍ السحب...' : 'تأكيد السحب'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmWithdrawId(null)}
                className="min-h-[30px] rounded-md px-2 py-1 text-xs font-medium text-stone-700 hover:text-stone-900 whitespace-nowrap cursor-pointer dark:text-stone-300"
              >
                تراجع
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const sandboxRevisableOrRecent = useMemo(
    () =>
      sandboxItems.filter(
        (s) =>
          s.status === 'pending' ||
          s.status === 'needs_changes' ||
          s.status === 'rejected' ||
          s.status === 'superseded' ||
          s.status === 'withdrawn' ||
          Boolean(s.supersedes_id),
      ),
    [sandboxItems],
  )

  return (
    <div className="rounded-xl border border-[#E5DFD3] bg-white p-5 sm:p-8 space-y-10 dark:border-[#2E2B27] dark:bg-[#1C1A18]">
      {/* Contributor Impact & Celebration Summary */}
      <div className="rounded-xl border border-[#E5DFD3] bg-[#FBF9F5] p-4 sm:p-5 space-y-4 dark:border-[#2E2B27] dark:bg-[#141312]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
              أثر مساهماتك في توثيق المعجم المغربي
            </h3>
            <p className="mt-0.5 text-xs text-stone-600 dark:text-stone-400">
              كل تأكيد أو مثال سياقي يساهم مباشرةً في بناء مرجع لغوي مفتوح ودقيق للدارجة المغربية.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#E5DFD3] sm:grid-cols-4 dark:border-[#2E2B27]">
          <div>
            <p className="text-xs text-stone-500 dark:text-stone-400">تأكيدات المراجعة السريعة</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-stone-900 dark:text-stone-100">
              {totalAttestationsCount.toLocaleString('en-US')}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500 dark:text-stone-400">مسودات قيد الاستكمال</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-stone-900 dark:text-stone-100">
              {draftsList.length.toLocaleString('en-US')}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500 dark:text-stone-400">مقترحات معتمدة</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#0F5C4E] dark:text-[#4FD1C5]">
              {impactMetrics.approvedTotal.toLocaleString('en-US')}
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500 dark:text-stone-400">مدمجة في إصدار رسمي</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#0F5C4E] dark:text-[#4FD1C5]">
              {impactMetrics.mergedCount.toLocaleString('en-US')}
            </p>
          </div>
        </div>

        {impactMetrics.approvedTotal > 0 && (
          <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3.5 py-2.5 text-xs text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
            <Award className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <p className="leading-relaxed">
              <strong className="font-semibold">تقدير للمساهمة المعجمية:</strong> اعتمد المحررون{' '}
              <span className="font-mono font-semibold tabular-nums">
                {impactMetrics.approvedTotal}
              </span>{' '}
              من مساهماتك لإدراجها ضمن المتن الرسمي لمعجم الدارجة المغربية. شكراً لإثرائك المحتوى العربي المفتوح.
            </p>
          </div>
        )}
      </div>

      {/* Section 1: Local Browser Drafts */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E5DFD3] dark:border-[#2E2B27]">
          <div>
            <h3 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
              المسودات المحفوظة على هذا الجهاز ({draftsList.length.toLocaleString('en-US')})
            </h3>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
              تُحفظ مسوداتك تلقائياً في متصفحك لتتمكن من إتمامها أو إرسالها متى شئت.
            </p>
          </div>

          {draftsList.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {userEmail && readyDraftsCount > 0 && (
                <button
                  type="button"
                  disabled={syncing}
                  onClick={handleSyncReadyDrafts}
                  className="inline-flex min-h-[38px] items-center gap-2 rounded-lg bg-[#0F5C4E] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0B463B] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer dark:bg-[#147A67]"
                >
                  <CloudUpload className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {syncing ? 'جارٍ الإرسال...' : `إرسال المسودات المكتملة (${readyDraftsCount})`}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={handleExportDraftsJson}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-[#EFECE4] whitespace-nowrap shrink-0 cursor-pointer dark:border-[#3A3530] dark:bg-[#141312] dark:text-stone-200"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>تنزيل نسخة احتياطية</span>
              </button>
            </div>
          )}
        </div>

        {syncMsg && (
          <div
            role="status"
            className={`mt-4 rounded-lg border p-3 text-xs leading-relaxed ${
              syncMsg.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200'
                : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200'
            }`}
          >
            {syncMsg.text}
          </div>
        )}

        {draftsList.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-xs text-stone-500 dark:text-stone-400">
              لا توجد مسودات محلية حالياً. يمكنك حفظ أي تعديل أو مفردة كمسودة والعودة إليها لاحقاً.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E5DFD3] dark:divide-[#2E2B27]">
            {draftsList.map((draft) => {
              const modifiedKeys = Object.entries(draft.proposedData).filter(
                ([k, val]) =>
                  k !== 'submission_kind' &&
                  k !== 'corpus_version' &&
                  k !== 'baseline_fingerprint' &&
                  typeof val === 'string' &&
                  val.trim() !== '',
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
                      <span className="text-xs text-stone-600 dark:text-stone-400">
                        {draft.category}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
                      {modifiedKeys.length} حقول محررة · {draft.evidence.length} روابط شواهد · آخر تحديث{' '}
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

      {/* Section 2: Account Submitted Contributions */}
      <div className="pt-8 border-t border-[#E5DFD3] dark:border-[#2E2B27]">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E5DFD3] dark:border-[#2E2B27]">
          <div>
            <h3 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
              المقترحات المرسلة من حسابك
            </h3>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
              تابع حالة مقترحاتك وملاحظات المحررين، وقدّم نسخة منقحة عند طلب استكمال أي شاهد أو حقل.
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
              <span>تحديث</span>
            </button>
          )}
        </div>

        {!userEmail ? (
          <div className="py-8 text-center">
            <p className="text-xs text-stone-600 dark:text-stone-400">
              سجّل الدخول أو أنشئ حساباً مجانياً لحفظ مساهماتك باسمك ومتابعة اعتمادها في إصدارات المعجم.
            </p>
            <button
              type="button"
              onClick={onOpenAuth}
              className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#0F5C4E] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0B463B] cursor-pointer dark:bg-[#147A67]"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>دخول / إنشاء حساب</span>
            </button>
          </div>
        ) : loading ? (
          <div className="py-8 space-y-2">
            <div className="h-14 rounded-lg bg-[#FBF9F5] animate-pulse dark:bg-[#141312]" />
            <div className="h-14 rounded-lg bg-[#FBF9F5] animate-pulse dark:bg-[#141312]" />
          </div>
        ) : errorMsg ? (
          <p className="py-6 text-xs text-red-700 dark:text-red-400">{errorMsg}</p>
        ) : submissions.length === 0 ? (
          <p className="py-8 text-center text-xs text-stone-500 dark:text-stone-400">
            لم ترسل مقترحات تحريرية مسجلة بعد من هذا الحساب.
          </p>
        ) : (
          <div className="divide-y divide-[#E5DFD3] dark:divide-[#2E2B27]">
            {submissions.map((sub) => renderSubmissionRow(sub))}
          </div>
        )}
      </div>

      {/* Section 3: Sandbox Revisions Shortcut — Strictly Gated to Editorial Preview / Staff */}
      {canAccessEditorialTools && sandboxRevisableOrRecent.length > 0 && (
        <div className="pt-8 border-t border-[#E5DFD3] dark:border-[#2E2B27]">
          <div className="pb-3 border-b border-[#E5DFD3] dark:border-[#2E2B27]">
            <h4 className="font-display text-sm font-bold text-stone-900 dark:text-stone-100">
              مقترحات بيئة المحاكاة التحريرية ({sandboxRevisableOrRecent.length})
            </h4>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              تظهر هذه القائمة فقط أثناء تفعيل معاينة أدوات المحررين:
            </p>
          </div>
          <div className="divide-y divide-[#E5DFD3] dark:divide-[#2E2B27]">
            {sandboxRevisableOrRecent.map((sub) => renderSubmissionRow(sub))}
          </div>
        </div>
      )}
    </div>
  )
}
