import { ExternalLink, Volume2 } from 'lucide-react'
import type { LexicalEntry } from '../types/lexicon'
import { formatAccessionCode } from '../services/dataset'
import { formatEtymologyLabel } from '../utils/etymology'
import { buildCleanEntryUrl } from '../utils/urlState'

interface EmbeddedWordWidgetViewProps {
  entry: LexicalEntry
  corpusVersion: string
  themeMode: 'light' | 'dark'
  compact?: boolean
}

export function EmbeddedWordWidgetView({
  entry,
  corpusVersion,
  themeMode,
  compact = false,
}: EmbeddedWordWidgetViewProps) {
  const isDark = themeMode === 'dark'
  const accessionCode = formatAccessionCode(entry.id, entry.numericId)
  const fullEntryUrl = buildCleanEntryUrl(entry.id)
  const primaryExample = entry.examples[0] ?? null
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

  function handleSpeak() {
    if (!canSpeak) return
    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(entry.word)
      utterance.lang = 'ar-MA'
      utterance.rate = 0.88
      window.speechSynthesis.speak(utterance)
    } catch {
      // Ignore synthesis error
    }
  }

  return (
    <div
      dir="rtl"
      className={
        isDark
          ? 'min-h-screen bg-[#050507] p-3 text-zinc-100 font-sans'
          : 'min-h-screen bg-[#FAFAFC] p-3 text-zinc-950 font-sans'
      }
    >
      <article
        aria-label={`بطاقة المفردة المضمّنة: ${entry.word}`}
        className={
          isDark
            ? 'mx-auto max-w-2xl rounded-2xl border border-white/15 bg-[#0B0B10] p-5 space-y-4'
            : 'mx-auto max-w-2xl rounded-2xl border border-zinc-200 bg-white p-5 space-y-4'
        }
      >
        {/* Top Metadata Line (Clean Unboxed Text) */}
        <div
          className={`flex flex-wrap items-center justify-between gap-2 text-xs ${
            isDark ? 'text-zinc-400' : 'text-zinc-500'
          }`}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={isDark ? 'font-semibold text-[#D9FF43]' : 'font-semibold text-emerald-700'}>
              {entry.category}
            </span>
            {entry.etymology && entry.etymology !== 'unspecified' && (
              <>
                <span aria-hidden="true">·</span>
                <span>{formatEtymologyLabel(entry.etymology)}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span dir="ltr" className="font-mono text-[11px]">
              {accessionCode}
            </span>
          </div>

          <a
            href={fullEntryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 font-semibold hover:underline ${
              isDark ? 'text-[#D9FF43]' : 'text-emerald-700'
            }`}
          >
            <span>فتح في المعجم</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Headword + Transcription */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1
              className={`font-display text-3xl font-bold tracking-tight ${
                isDark ? 'text-white' : 'text-zinc-950'
              }`}
            >
              {entry.word}
            </h1>
            {entry.latin && (
              <span
                dir="ltr"
                className={`font-mono text-base font-semibold ${
                  isDark ? 'text-[#D9FF43]' : 'text-emerald-700'
                }`}
              >
                /{entry.latin}/
              </span>
            )}
          </div>

          {canSpeak && (
            <button
              type="button"
              onClick={handleSpeak}
              aria-label="نطق المفردة"
              title="استمع للنطق"
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors cursor-pointer ${
                isDark
                  ? 'border-white/15 bg-[#07070A] text-zinc-300 hover:border-[#D9FF43] hover:text-[#D9FF43]'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-950 hover:text-zinc-950'
              }`}
            >
              <Volume2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Definitions */}
        <div
          className={`grid grid-cols-1 gap-3 border-t pt-3.5 sm:grid-cols-2 ${
            isDark ? 'border-white/10' : 'border-zinc-200'
          }`}
        >
          <div>
            <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              المعنى العربي الفصيح
            </p>
            <p className={`mt-0.5 text-sm font-semibold leading-6 ${isDark ? 'text-white' : 'text-zinc-950'}`}>
              {entry.meaning}
            </p>
          </div>
          {entry.french && entry.french !== '—' && (
            <div>
              <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                المقابل الفرنسي (FR)
              </p>
              <p
                dir="ltr"
                className={`mt-0.5 text-start text-sm font-medium leading-6 ${
                  isDark ? 'text-zinc-200' : 'text-zinc-800'
                }`}
              >
                {entry.french}
              </p>
            </div>
          )}
        </div>

        {/* Contextual Example (when not compact) */}
        {!compact && primaryExample && (
          <div
            className={`border-t pt-3.5 space-y-1 ${
              isDark ? 'border-white/10' : 'border-zinc-200'
            }`}
          >
            <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              شاهد سياقي من التداول المغربي
            </p>
            <p className={`text-sm font-bold leading-7 ${isDark ? 'text-white' : 'text-zinc-950'}`}>
              «{primaryExample.darijaAr}»
            </p>
            {primaryExample.meaningAr && (
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {primaryExample.meaningAr}
              </p>
            )}
          </div>
        )}

        {/* Attribution Footer Backlink */}
        <footer
          className={`flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-[11px] ${
            isDark ? 'border-white/10 text-zinc-400' : 'border-zinc-200 text-zinc-500'
          }`}
        >
          <a
            href={fullEntryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`font-semibold hover:underline ${
              isDark ? 'text-zinc-200 hover:text-white' : 'text-zinc-800 hover:text-zinc-950'
            }`}
          >
            Darija LexReview — المعجم المغربي المفتوح
          </a>
          <span dir="ltr" className="font-mono text-[10px]">
            v{corpusVersion} · CC BY-NC 4.0
          </span>
        </footer>
      </article>
    </div>
  )
}
