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
import type {
  LexicalEntry,
  LocalDraft,
  SubmissionRecord,
  SubmissionStatus,
} from '../../types/lexicon'
import { formatAccessionCode } from '../../services/dataset'
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

function formatContributorStatus(status: SubmissionStatus): string {
  switch (status) {
    case 'pending':
      return 'قيد المراجعة'
    case 'accepted':
      return 'اعتُمدت في المعجم'
    case 'merged':
      return 'مدمجة في المعجم الرسمي'
    case 'needs_changes':
      return 'تحتاج توضيحاً بسيطاً'
    case 'rejected':
      return 'لم تُعتمد بصيغتها الحالية'
    case 'withdrawn':
      return 'تم سحبها'
    case 'superseded':
      return 'تم تحديثها بنسخة أحدث'
    default:
      return 'قيد المراجعة'
  }
}

function summarizeDraftPreview(draft: LocalDraft): string {
  const p = draft.proposedData ?? {}
  if (p.msa_translation || p.meaning) {
    return `المعنى: ${(p.msa_translation || p.meaning || '').trim()}`
  }
  if (p.example_darija) {
    return `مثال: «${p.example_darija.trim()}»`
  }
  if (p.word_ar) {
    return `تصويب الكلمة إلى: «${p.word_ar.trim()}»`
  }
  if (draft.reviewerNote?.trim()) {
    return draft.reviewerNote.trim()
  }
  return 'مسودة جاهزة للاستكمال'
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
          ? `تم إرسال ${res.syncedEntryIds.length} مسودات مكتملة إلى حسابك، وبقيت ${res.skippedAudits.length} مسودات لاستكمال حقولها الأساسية.`
          : `تم إرسال جميع مسوداتك الجاهزة (${res.syncedEntryIds.length}) بنجاح.`,
    })
  }

  async function handleConfirmWithdraw(sub: SubmissionRecord) {
    setSyncMsg(null)
    if (sub.is_sandbox) {
      onWithdrawSandboxSubmission(sub.id)
      setConfirmWithdrawId(null)
      setSyncMsg({
        type: 'success',
        text: 'تم سحب المقترح بنجاح.',
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
          'تعذر سحب المساهمة حالياً (قد تكون قيد الفحص لدى المحررين بالفعل).',
        ),
      })
      return
    }
    await loadSubmissions()
    setSyncMsg({
      type: 'success',
      text: 'تم سحب المساهمة بنجاح.',
    })
  }

  function renderSubmissionRow(sub: SubmissionRecord) {
    const isNew = isNewEntrySubmission(sub)
    const target = entryById.get(sub.entry_id)
    const titleLabel = isNew
      ? `${sub.proposed_data?.word_ar || 'مفردة جديدة'} · إضافة جديدة`
      : canAccessEditorialTools
        ? `${target?.word ?? sub.entry_id} (${formatAccessionCode(sub.entry_id, target?.numericId ?? null)})`
        : target?.word ?? 'مفردة في المعجم'

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
            <span className="font-display text-sm font-bold text-zinc-950 dark:text-[#F5F5F7]">
              {titleLabel}
            </span>
            <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-600">
              ·
            </span>
            <span
              className={`font-semibold ${
                sub.status === 'merged' || sub.status === 'accepted'
                  ? 'text-emerald-700 dark:text-[#D9FF43]'
                  : sub.status === 'needs_changes'
                    ? 'text-amber-700 dark:text-amber-400'
                    : sub.status === 'rejected'
                      ? 'text-red-700 dark:text-[#FF3B2F]'
                      : sub.status === 'withdrawn' || sub.status === 'superseded'
                        ? 'text-zinc-500 dark:text-zinc-500'
                        : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {formatContributorStatus(sub.status)}
            </span>
            {sub.supersedes_id && (
              <>
                <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-600">
                  ·
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                  <GitBranch className="h-3 w-3" aria-hidden="true" />
                  <span>نسخة معدّلة</span>
                </span>
              </>
            )}
            <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-600">
              ·
            </span>
            <span className="font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
              {new Date(sub.created_at).toLocaleDateString('ar-MA')}
            </span>
          </div>

          {sub.proposed_data?.msa_translation && (
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              المعنى المقترح: {sub.proposed_data.msa_translation}
            </p>
          )}
          {sub.proposed_data?.example_darija && (
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              المثال: «{sub.proposed_data.example_darija}»
            </p>
          )}

          {sub.editor_note && (
            <div className="mt-1 rounded-xl border border-amber-300/80 bg-amber-50/70 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <strong className="font-semibold">رد المحرر اللغوي:</strong> {sub.editor_note}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canRevise && (
            <button
              type="button"
              onClick={() => onStartRevision(sub)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 whitespace-nowrap cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>تعديل وإعادة إرسال</span>
            </button>
          )}

          {canWithdraw && !isConfirmingWithdraw && (
            <button
              type="button"
              onClick={() => setConfirmWithdrawId(sub.id)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-50 px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:border-red-300 hover:text-red-700 whitespace-nowrap cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-300 dark:hover:border-[#FF3B2F]/40 dark:hover:text-[#FF3B2F]"
            >
              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>سحب</span>
            </button>
          )}

          {canWithdraw && isConfirmingWithdraw && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50/80 p-1 dark:border-[#FF3B2F]/40 dark:bg-[#FF3B2F]/10">
              <button
                type="button"
                disabled={withdrawingId === sub.id}
                onClick={() => handleConfirmWithdraw(sub)}
                className="min-h-[30px] rounded-full bg-red-700 px-3 py-1 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50 whitespace-nowrap cursor-pointer dark:bg-[#FF3B2F] dark:hover:bg-[#ff5247]"
              >
                {withdrawingId === sub.id ? 'جارٍ السحب...' : 'تأكيد السحب'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmWithdrawId(null)}
                className="min-h-[30px] rounded-full px-2.5 py-1 text-xs font-medium text-zinc-700 hover:text-zinc-950 whitespace-nowrap cursor-pointer dark:text-zinc-300 dark:hover:text-white"
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
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-8 space-y-10 dark:border-white/10 dark:bg-[#0C0C10]">
      {/* Contributor Impact Summary */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5 space-y-4 dark:border-white/10 dark:bg-[#07070A]">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-[#D9FF43]">
            01 / سجل الأثر المعجمي
          </p>
          <h3 className="mt-1 font-display text-base font-bold text-zinc-950 dark:text-[#F5F5F7]">
            أثرك في إثراء معجم الدارجة المغربية
          </h3>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
            كل كلمة تراجعها أو تضيفها تساعد في حفظ وتوثيق اللسان المغربي بدقة للأجيال والباحثين.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-zinc-200 sm:grid-cols-4 dark:border-white/10">
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">مفردات راجعتها</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-zinc-950 dark:text-[#F5F5F7]">
              {totalAttestationsCount.toLocaleString('en-US')}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">قيد المراجعة</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-zinc-950 dark:text-[#F5F5F7]">
              {impactMetrics.pendingCount.toLocaleString('en-US')}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">مساهمات معتمدة</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-700 dark:text-[#D9FF43]">
              {impactMetrics.approvedTotal.toLocaleString('en-US')}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">مسودات محفوظة</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-zinc-950 dark:text-[#F5F5F7]">
              {draftsList.length.toLocaleString('en-US')}
            </p>
          </div>
        </div>

        {impactMetrics.approvedTotal > 0 && (
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-300 bg-emerald-50/80 px-3.5 py-2.5 text-xs text-emerald-950 dark:border-[#D9FF43]/40 dark:bg-[#D9FF43]/10 dark:text-[#F5F5F7]">
            <Award
              className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-[#D9FF43]"
              aria-hidden="true"
            />
            <p className="leading-relaxed">
              اعتمد المحررون{' '}
              <strong className="font-mono font-semibold tabular-nums">
                {impactMetrics.approvedTotal}
              </strong>{' '}
              من مساهماتك لإدراجها في المعجم الرسمي. شكراً لمساهمتك القيمة!
            </p>
          </div>
        )}
      </div>

      {/* Section 1: Submitted Contributions */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h3 className="font-display text-lg font-bold text-zinc-950 dark:text-[#F5F5F7]">
              مساهماتي المرسلة
            </h3>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              تابع حالة الكلمات والتعديلات التي أرسلتها، واطّلع على ردود المحررين اللغويين.
            </p>
          </div>

          {userEmail && (
            <button
              type="button"
              onClick={loadSubmissions}
              disabled={loading}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-50 px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-300 dark:hover:bg-white/[0.06]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>تحديث القائمة</span>
            </button>
          )}
        </div>

        {syncMsg && (
          <div
            role="status"
            className={`mt-4 rounded-xl border p-3 text-xs leading-relaxed ${
              syncMsg.type === 'error'
                ? 'border-red-300 bg-red-50 text-red-950 dark:border-[#FF3B2F]/40 dark:bg-[#FF3B2F]/10 dark:text-red-200'
                : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-[#D9FF43]/40 dark:bg-[#D9FF43]/10 dark:text-[#F5F5F7]'
            }`}
          >
            {syncMsg.text}
          </div>
        )}

        {!userEmail ? (
          <div className="py-8 text-center">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              سجّل الدخول أو أنشئ حساباً مجانياً لحفظ مساهماتك باسمك ومتابعة اعتمادها في المعجم.
            </p>
            <button
              type="button"
              onClick={onOpenAuth}
              className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-full bg-zinc-950 px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>دخول / إنشاء حساب</span>
            </button>
          </div>
        ) : loading ? (
          <div className="py-8 space-y-2">
            <div className="h-14 rounded-xl bg-zinc-100 animate-pulse dark:bg-[#07070A]" />
            <div className="h-14 rounded-xl bg-zinc-100 animate-pulse dark:bg-[#07070A]" />
          </div>
        ) : errorMsg ? (
          <p className="py-6 text-xs text-red-700 dark:text-[#FF3B2F]">{errorMsg}</p>
        ) : submissions.length === 0 ? (
          <p className="py-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
            لم ترسل أي مفردات أو تعديلات بعد من هذا الحساب.
          </p>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-white/10">
            {submissions.map((sub) => renderSubmissionRow(sub))}
          </div>
        )}
      </div>

      {/* Section 2: Local Browser Drafts (Shown prominently when drafts exist, or quietly below) */}
      <div className="pt-8 border-t border-zinc-200 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h3 className="font-display text-base font-bold text-zinc-950 dark:text-[#F5F5F7]">
              مسودات محفوظة على هذا الجهاز ({draftsList.length.toLocaleString('en-US')})
            </h3>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              مسودات لم تُرسل بعد ويمكنك متابعة تحريرها أو إرسالها دفعة واحدة.
            </p>
          </div>

          {draftsList.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {userEmail && readyDraftsCount > 0 && (
                <button
                  type="button"
                  disabled={syncing}
                  onClick={handleSyncReadyDrafts}
                  className="inline-flex min-h-[38px] items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
                >
                  <CloudUpload className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {syncing ? 'جارٍ الإرسال...' : `إرسال المسودات الجاهزة (${readyDraftsCount})`}
                  </span>
                </button>
              )}
              {canAccessEditorialTools && (
                <button
                  type="button"
                  onClick={handleExportDraftsJson}
                  className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-zinc-300 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 whitespace-nowrap shrink-0 cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:bg-white/[0.06]"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>تنزيل نسخة احتياطية</span>
                </button>
              )}
            </div>
          )}
        </div>

        {draftsList.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              لا توجد مسودات غير مرسلة على هذا الجهاز حالياً.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-white/10">
            {draftsList.map((draft) => (
              <div
                key={draft.entryId}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-base font-bold text-zinc-950 dark:text-[#F5F5F7]">
                      {draft.headword}
                    </span>
                    <span className="text-xs text-zinc-400" aria-hidden="true">
                      ·
                    </span>
                    <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                      {new Date(draft.updatedAt).toLocaleDateString('ar-MA')}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-zinc-600 dark:text-zinc-400">
                    {summarizeDraftPreview(draft)}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onResumeDraft(draft.entryId)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 whitespace-nowrap cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
                  >
                    <span>متابعة وإرسال</span>
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteDraft(draft.entryId)}
                    aria-label="حذف المسودة"
                    className="flex h-[36px] w-[36px] items-center justify-center rounded-full border border-zinc-300 text-zinc-500 hover:text-red-700 hover:border-red-300 cursor-pointer dark:border-white/15 dark:text-zinc-400 dark:hover:text-[#FF3B2F] dark:hover:border-[#FF3B2F]/40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Staff-Only Test Queue */}
          </div>
  )
}
