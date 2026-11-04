import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, History, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type {
  EntryAttestationSummary,
  EntryPublicHistoryItem,
  LexicalEntry,
} from '../../types/lexicon'
import { formatAccessionCode, formatStatusLabel } from '../../services/dataset'
import { formatEtymologyLabel } from '../../utils/etymology'

interface EntryRevisionHistoryPanelProps {
  entry: LexicalEntry
  corpusVersion: string
  attestationSummary?: EntryAttestationSummary
  onOpenContributorProfile?: (slug: string) => void
}

function summarizeRevisionChanges(item: EntryPublicHistoryItem): string {
  const parts: string[] = []
  if (item.submission_kind === 'new_entry') {
    parts.push('اقتراح إدراج المفردة كمدخل جديد في المتن')
  } else {
    if (item.has_meaning_update) parts.push('تنقيح الدلالة العربية أو المقابل الفرنسي')
    if (item.has_new_example) parts.push('إضافة شاهد سياقي موثق من التداول الحي')
    if (item.has_etymology) parts.push('توثيق الجذر والتأصيل التاريخي')
    if (parts.length === 0) parts.push('مراجعة وتدقيق البيانات المعجمية للمفردة')
  }
  return parts.join(' · ')
}

export function EntryRevisionHistoryPanel({
  entry,
  corpusVersion,
  attestationSummary,
  onOpenContributorProfile,
}: EntryRevisionHistoryPanelProps) {
  const [revisions, setRevisions] = useState<EntryPublicHistoryItem[]>([])
  const [loading, setLoading] = useState(false)

  const accessionCode = formatAccessionCode(entry.id, entry.numericId)

  const loadHistory = useCallback(async () => {
    const client = supabase
    if (!client) {
      setRevisions([])
      return
    }
    setLoading(true)
    const { data, error } = await client.rpc('get_entry_public_history', {
      p_entry_id: entry.id,
    })
    setLoading(false)
    if (!error && Array.isArray(data)) {
      setRevisions(data as EntryPublicHistoryItem[])
    } else {
      setRevisions([])
    }
  }, [entry.id])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const totalCommunityAttestations = attestationSummary
    ? attestationSummary.accurateCount + attestationSummary.regionalCount
    : 0

  return (
    <section
      aria-labelledby="entry-revision-history-heading"
      className="space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-white/10">
        <div>
          <h3
            id="entry-revision-history-heading"
            className="font-display text-lg font-bold text-zinc-950 dark:text-white"
          >
            السجل الموسوعي الشفاف لتطور «{entry.word}»
          </h3>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            يوثق هذا السجل مراحل إدراج المفردة وإغناء شواهدها واعتمادها التحريري حفظاً للحق الأدبي والعلمي للمساهمين.
          </p>
        </div>

        {supabase && (
          <button
            type="button"
            onClick={() => void loadHistory()}
            disabled={loading}
            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3.5 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-950 transition-colors cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث السجل</span>
          </button>
        )}
      </div>

      {/* Provenance & Literary Credit Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 border-b border-zinc-200 pb-5 text-xs dark:border-white/10">
        <div>
          <p className="text-zinc-500 dark:text-zinc-400">الرمز المرجعي الثابت</p>
          <p dir="ltr" className="mt-1 text-start font-mono text-sm font-bold text-zinc-950 dark:text-white">
            {accessionCode}
          </p>
        </div>
        <div>
          <p className="text-zinc-500 dark:text-zinc-400">المصدر التأسيسي والترخيص</p>
          <p className="mt-1 font-semibold text-zinc-900 dark:text-zinc-200">
            {entry.provenance.sourceName} · {entry.provenance.license}
          </p>
        </div>
        <div>
          <p className="text-zinc-500 dark:text-zinc-400">حالة الاعتماد الحالية</p>
          <p className="mt-1 font-semibold text-emerald-700 dark:text-[#D9FF43]">
            {formatStatusLabel(entry.status)} · المتن v{corpusVersion}
          </p>
        </div>
      </div>

      {/* Chronological Encyclopedic Milestones */}
      <ol className="relative ms-3 border-s border-zinc-300 space-y-6 ps-5 dark:border-white/15">
        {/* Stage 1: Canonical Inclusion in Official Corpus */}
        <li className="relative">
          <span
            aria-hidden="true"
            className="absolute -start-[25px] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-zinc-300 bg-white dark:border-white/25 dark:bg-[#0B0B10]"
          >
            <History className="h-2.5 w-2.5 text-zinc-600 dark:text-zinc-300" />
          </span>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-sm font-bold text-zinc-950 dark:text-white">
              إدراج المدخل التأسيسي في المتن المعجمي المفتوح
            </h4>
            <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
              Corpus v{corpusVersion}
            </span>
          </div>
          <p className="mt-1 text-xs leading-6 text-zinc-600 dark:text-zinc-400">
            توثيق الكلمة الرأسية «{entry.word}»{entry.latin ? ` (${entry.latin})` : ''} ضمن حقل «{entry.category}»
            {entry.etymology && entry.etymology !== 'unspecified'
              ? ` · التأصيل: ${formatEtymologyLabel(entry.etymology)}`
              : ''}
            {entry.examples.length > 0
              ? ` · مرفقة بـ ${entry.examples.length.toLocaleString('en-US')} شاهد سياقي في المتن المرجعي.`
              : ' · مسجلة للإغناء بالشواهد السياقية.'}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            الجهة الموثقة: {entry.provenance.rightsHolder} ({entry.provenance.sourceName})
          </p>
        </li>

        {/* Stage 2..N: Accepted & Merged Community Contributions from Audit Ledger */}
        {loading ? (
          <li className="relative text-xs text-zinc-500 dark:text-zinc-400">
            جارٍ استرجاع سجل المراجعات المجتمعية المعتمدة…
          </li>
        ) : (
          revisions.map((rev, idx) => (
            <li key={rev.revision_id} className="relative">
              <span
                aria-hidden="true"
                className="absolute -start-[25px] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-emerald-600 bg-emerald-50 dark:border-[#D9FF43] dark:bg-[#0B0B10]"
              >
                <CheckCircle2 className="h-2.5 w-2.5 text-emerald-700 dark:text-[#D9FF43]" />
              </span>

              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="text-sm font-bold text-zinc-950 dark:text-white">
                  مراجعة مجتمعية معتمدة #{(idx + 1).toLocaleString('en-US')}
                  {rev.exported_in_version ? ` · دُمجت في الإصدار v${rev.exported_in_version}` : ''}
                </h4>
                <time
                  dateTime={rev.decided_at}
                  className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400"
                >
                  {new Date(rev.decided_at).toLocaleDateString('ar-MA', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </time>
              </div>

              <p className="mt-1 text-xs leading-6 text-zinc-700 dark:text-zinc-300">
                {summarizeRevisionChanges(rev)}
              </p>

              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span>
                  المساهم:{' '}
                  {rev.contributor_slug && onOpenContributorProfile ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (rev.contributor_slug) onOpenContributorProfile(rev.contributor_slug)
                      }}
                      className="font-semibold text-emerald-700 hover:underline cursor-pointer dark:text-[#D9FF43]"
                    >
                      {rev.contributor_name}
                    </button>
                  ) : (
                    <strong className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {rev.contributor_name}
                    </strong>
                  )}
                </span>

                {rev.editor_name && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
                      <span>اعتماد التحرير: {rev.editor_name}</span>
                    </span>
                  </>
                )}
              </div>
            </li>
          ))
        )}

        {/* Stage Final: Field Community Attestation Milestone */}
        {totalCommunityAttestations > 0 && attestationSummary && (
          <li className="relative">
            <span
              aria-hidden="true"
              className="absolute -start-[25px] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-emerald-600 bg-white dark:border-[#D9FF43] dark:bg-[#0B0B10]"
            >
              <Users className="h-2.5 w-2.5 text-emerald-700 dark:text-[#D9FF43]" />
            </span>
            <h4 className="text-sm font-bold text-zinc-950 dark:text-white">
              التصديق الميداني للتداول اللهجي
            </h4>
            <p className="mt-1 text-xs leading-6 text-zinc-600 dark:text-zinc-400">
              حظيت المفردة بـ{' '}
              <strong className="font-mono font-bold text-zinc-950 dark:text-white">
                {totalCommunityAttestations.toLocaleString('en-US')}
              </strong>{' '}
              تصديق مجتمعي على دقة المعنى والاستعمال
              {attestationSummary.regions.length > 0
                ? ` عبر المناطق: ${attestationSummary.regions.join('، ')}.`
                : '.'}
            </p>
          </li>
        )}
      </ol>
    </section>
  )
}
