import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Bookmark,
  BookMarked,
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Globe2,
  History,
  Link2,
  Plus,
  Quote,
  Sparkles,
  Volume2,
} from 'lucide-react'
import type { EntryAttestationSummary, EtymologyOrigin, LexicalEntry } from '../../types/lexicon'
import {
  formatAccessionCode,
  formatRegisterLabel,
  formatStatusLabel,
} from '../../services/dataset'
import { formatEtymologyLabel } from '../../utils/etymology'
import { buildCleanEntryUrl, buildEmbedEntryUrl } from '../../utils/urlState'
import { downloadShareableLexicalCard } from '../../utils/shareCardGenerator'
import { EntryRevisionHistoryPanel } from './EntryRevisionHistoryPanel'

interface DictionaryReferenceCardProps {
  entry: LexicalEntry
  allEntries: LexicalEntry[]
  corpusVersion: string
  darkMode?: boolean
  isAuthenticated?: boolean
  isBookmarked?: boolean
  onToggleBookmark?: () => void
  attestationSummary?: EntryAttestationSummary
  currentIndex: number
  totalFiltered: number
  hasLocalDraft: boolean
  onPrev: () => void
  onNext: () => void
  onSwitchToWorkshop: (focusAddExample?: boolean) => void
  onSelectEntry: (entry: LexicalEntry) => void
  onSelectCategory: (category: string) => void
  onSelectEtymology?: (origin: EtymologyOrigin) => void
  onOpenContributorProfile?: (slug: string) => void
  onBackToLexiconIndex?: () => void
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  word: 'مفردة',
  expression: 'تعبير اصطلاحي',
  sentence: 'جملة متداولة',
  proverb: 'مَثَل شعبي',
  question: 'صيغة استفهام',
  conversational: 'تعبير تخاطبي',
}

export function DictionaryReferenceCard({
  entry,
  allEntries,
  corpusVersion,
  darkMode = true,
  isAuthenticated = false,
  isBookmarked = false,
  onToggleBookmark,
  attestationSummary,
  currentIndex,
  totalFiltered,
  hasLocalDraft,
  onPrev,
  onNext,
  onSwitchToWorkshop,
  onSelectEntry,
  onSelectCategory,
  onSelectEtymology,
  onOpenContributorProfile,
  onBackToLexiconIndex,
}: DictionaryReferenceCardProps) {
  const [copiedShare, setCopiedShare] = useState(false)
  const [downloadedCard, setDownloadedCard] = useState(false)
  const [showCitationBox, setShowCitationBox] = useState(false)
  const [citationFormat, setCitationFormat] = useState<'apa' | 'bibtex'>('apa')
  const [copiedCitation, setCopiedCitation] = useState(false)

  const [showEmbedBox, setShowEmbedBox] = useState(false)
  const [embedTheme, setEmbedTheme] = useState<'auto' | 'light' | 'dark'>('auto')
  const [embedCompact, setEmbedCompact] = useState(false)
  const [embedFormat, setEmbedFormat] = useState<'iframe' | 'html_card'>('iframe')
  const [copiedEmbed, setCopiedEmbed] = useState(false)

  const [activeInnerTab, setActiveInnerTab] = useState<'reference' | 'history'>('reference')

  useEffect(() => {
    setActiveInnerTab('reference')
  }, [entry.id])

  const accessionCode = formatAccessionCode(entry.id, entry.numericId)
  const shareUrl = useMemo(() => buildCleanEntryUrl(entry.id), [entry.id])
  const currentYear = new Date().getFullYear()
  const todayIso = new Date().toISOString().slice(0, 10)

  const apaCitation = useMemo(() => {
    const latinPart = entry.latin ? ` [${entry.latin}]` : ''
    return `ArCode Standard. (${currentYear}). مدخل «${entry.word}»${latinPart} (${accessionCode}) — المعجم المغربي المفتوح (الإصدار v${corpusVersion}). مسترجع بتاريخ ${todayIso} من ${shareUrl}`
  }, [entry.word, entry.latin, accessionCode, corpusVersion, currentYear, todayIso, shareUrl])

  const bibtexCitation = useMemo(() => {
    const safeKey = (entry.latin || entry.id).replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || entry.id
    return `@misc{arcode_darija_${safeKey}_${entry.id},
  author       = {{ArCode Standard}},
  title        = {{${entry.word}${entry.latin ? ` (${entry.latin})` : ''} — Moroccan Darija Lexicon (${accessionCode})}},
  howpublished = {Darija LexReview, Corpus v${corpusVersion}},
  year         = {${currentYear}},
  note         = {License: CC BY-NC 4.0. Accessed: ${todayIso}},
  url          = {${shareUrl}}
}`
  }, [entry.id, entry.word, entry.latin, accessionCode, corpusVersion, currentYear, todayIso, shareUrl])

  const embedIframeUrl = useMemo(
    () => buildEmbedEntryUrl(entry.id, { theme: embedTheme, compact: embedCompact }),
    [entry.id, embedTheme, embedCompact],
  )

  const iframeEmbedSnippet = useMemo(() => {
    const heightPx = embedCompact ? 235 : 320
    return `<iframe src="${embedIframeUrl}" title="معنى «${entry.word}» في الدارجة المغربية — Darija LexReview" width="100%" height="${heightPx}" style="border:0;max-width:640px;border-radius:16px;overflow:hidden;" loading="lazy"></iframe>\n<p style="font-size:12px;margin-top:6px;">المصدر: <a href="${shareUrl}" target="_blank" rel="noopener">مدخل «${entry.word}» في المعجم المغربي المفتوح Darija LexReview</a></p>`
  }, [embedIframeUrl, embedCompact, entry.word, shareUrl])

  const seoHtmlCardSnippet = useMemo(() => {
    const latinText = entry.latin ? ` (/${entry.latin}/)` : ''
    const exText =
      !embedCompact && entry.examples[0]?.darijaAr
        ? `<p style="margin:8px 0 0;color:#52525b;">شاهد سياقي: «${entry.examples[0].darijaAr}»</p>`
        : ''
    return `<blockquote dir="rtl" cite="${shareUrl}" style="border:1px solid #e4e4e7;border-radius:14px;padding:16px;max-width:600px;font-family:system-ui,sans-serif;">\n  <strong>${entry.word}${latinText}</strong> — ${entry.meaning}${exText}\n  <footer style="margin-top:10px;font-size:12px;"><a href="${shareUrl}" target="_blank" rel="noopener">توثيق المفردة في المعجم المغربي المفتوح (Darija LexReview · CC BY-NC 4.0)</a></footer>\n</blockquote>`
  }, [entry.word, entry.latin, entry.meaning, entry.examples, embedCompact, shareUrl])

  const relatedEntries = useMemo(() => {
    return allEntries
      .filter((candidate) => candidate.id !== entry.id && candidate.category === entry.category)
      .slice(0, 6)
  }, [allEntries, entry.id, entry.category])

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
      // Ignore synthesis error on unsupported browsers
    }
  }

  async function handleCopyShare() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopiedShare(true)
      window.setTimeout(() => setCopiedShare(false), 2000)
    } catch {
      // Clipboard unavailable
    }
  }

  function handleDownloadVisualCard() {
    const ok = downloadShareableLexicalCard(entry, {
      corpusVersion,
      theme: darkMode ? 'dark' : 'light',
    })
    if (ok) {
      setDownloadedCard(true)
      window.setTimeout(() => setDownloadedCard(false), 2200)
    }
  }

  async function handleCopyCitation() {
    const text = citationFormat === 'apa' ? apaCitation : bibtexCitation
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCitation(true)
      window.setTimeout(() => setCopiedCitation(false), 2000)
    } catch {
      // Clipboard unavailable
    }
  }

  async function handleCopyEmbedSnippet() {
    const code = embedFormat === 'iframe' ? iframeEmbedSnippet : seoHtmlCardSnippet
    try {
      await navigator.clipboard.writeText(code)
      setCopiedEmbed(true)
      window.setTimeout(() => setCopiedEmbed(false), 2000)
    } catch {
      // Clipboard unavailable
    }
  }

  const regions = entry.region && entry.region.length > 0 ? entry.region : ['تداول مغربي عام']
  const entryTypeLabel = entry.entryType ? ENTRY_TYPE_LABELS[entry.entryType] : null

  return (
    <article
      aria-labelledby="dictionary-headword"
      className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/12 dark:bg-[#0B0B10]"
    >
      {/* Top Precision Reference Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50/70 px-5 py-3.5 sm:px-7 dark:border-white/10 dark:bg-[#07070A]">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          {onBackToLexiconIndex && (
            <>
              <button
                type="button"
                onClick={onBackToLexiconIndex}
                className="font-semibold text-zinc-700 hover:text-zinc-950 hover:underline cursor-pointer dark:text-zinc-300 dark:hover:text-white"
              >
                فهرس المعجم
              </button>
              <span aria-hidden="true">/</span>
            </>
          )}
          <button
            type="button"
            onClick={() => onSelectCategory(entry.category)}
            className="font-semibold text-emerald-700 hover:underline cursor-pointer dark:text-[#D9FF43]"
          >
            {entry.category}
          </button>
          <span aria-hidden="true">·</span>
          <span dir="ltr" className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            {accessionCode}
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-[11px]">{formatStatusLabel(entry.status)}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAuthenticated && onToggleBookmark && (
            <button
              type="button"
              onClick={onToggleBookmark}
              aria-pressed={isBookmarked}
              title={isBookmarked ? 'إزالة المفردة من المفضلة' : 'حفظ المفردة في مفضلتي'}
              className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                isBookmarked
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-[#D9FF43] dark:bg-[#D9FF43]/15 dark:text-[#D9FF43]'
                  : 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-950 hover:text-zinc-950 dark:border-white/15 dark:bg-[#0C0C10] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60'
              }`}
            >
              <Bookmark className={`h-3.5 w-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
              <span>{isBookmarked ? 'محفوظة' : 'حفظ'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyShare}
            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3.5 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-950 hover:text-zinc-950 transition-colors cursor-pointer dark:border-white/15 dark:bg-[#0C0C10] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60 dark:hover:text-white"
          >
            {copiedShare ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
                <span>تم نسخ الرابط</span>
              </>
            ) : (
              <>
                <Link2 className="h-3.5 w-3.5" />
                <span>رابط المفردة</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadVisualCard}
            title="تنزيل بطاقة بصرية للمفردة جاهزة للمشاركة (PNG)"
            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3.5 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-950 hover:text-zinc-950 transition-colors cursor-pointer dark:border-white/15 dark:bg-[#0C0C10] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60 dark:hover:text-white"
          >
            {downloadedCard ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
                <span>تم تنزيل البطاقة</span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                <span>بطاقة مصوّرة</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setShowCitationBox((prev) => !prev)
              setShowEmbedBox(false)
            }}
            aria-expanded={showCitationBox}
            className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
              showCitationBox
                ? 'border-zinc-950 bg-zinc-950 text-white dark:border-[#D9FF43] dark:bg-[#D9FF43] dark:text-[#050507]'
                : 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-950 hover:text-zinc-950 dark:border-white/15 dark:bg-[#0C0C10] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60'
            }`}
          >
            <Quote className="h-3.5 w-3.5" />
            <span>اقتباس علمي</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowEmbedBox((prev) => !prev)
              setShowCitationBox(false)
            }}
            aria-expanded={showEmbedBox}
            title="كود تضمين بطاقة المفردة في المدونات والمقالات الصحفية والمواقع الأكاديمية"
            className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
              showEmbedBox
                ? 'border-zinc-950 bg-zinc-950 text-white dark:border-[#D9FF43] dark:bg-[#D9FF43] dark:text-[#050507]'
                : 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-950 hover:text-zinc-950 dark:border-white/15 dark:bg-[#0C0C10] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60'
            }`}
          >
            <Code2 className="h-3.5 w-3.5" />
            <span>تضمين للمقالات</span>
          </button>

          <button
            type="button"
            onClick={() => onSwitchToWorkshop(false)}
            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-1 text-xs font-bold text-white hover:bg-zinc-800 transition-colors cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>{hasLocalDraft ? 'متابعة مسودة التعديل' : 'التدقيق واقتراح تعديل'}</span>
          </button>

          {totalFiltered > 1 && (
            <div className="flex items-center gap-1 ps-2 border-s border-zinc-200 dark:border-white/10">
              <button
                type="button"
                onClick={onPrev}
                disabled={currentIndex <= 0}
                aria-label="المفردة السابقة"
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:opacity-35 cursor-pointer dark:border-white/15 dark:bg-[#0C0C10] dark:text-zinc-200"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={currentIndex < 0 || currentIndex >= totalFiltered - 1}
                aria-label="المفردة التالية"
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:opacity-35 cursor-pointer dark:border-white/15 dark:bg-[#0C0C10] dark:text-zinc-200"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expandable Academic Citation Box (APA & BibTeX) */}
      {showCitationBox && (
        <div className="border-b border-zinc-200 bg-zinc-50 px-5 py-4 sm:px-7 dark:border-white/10 dark:bg-[#08080C]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookMarked className="h-4 w-4 text-emerald-700 dark:text-[#D9FF43]" />
              <span className="text-xs font-bold text-zinc-950 dark:text-white">
                توثيق وإحالة مرجعية للباحثين
              </span>
              <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-white/10 dark:bg-[#0C0C10]">
                <button
                  type="button"
                  onClick={() => setCitationFormat('apa')}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-mono font-semibold cursor-pointer ${
                    citationFormat === 'apa'
                      ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                      : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  APA
                </button>
                <button
                  type="button"
                  onClick={() => setCitationFormat('bibtex')}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-mono font-semibold cursor-pointer ${
                    citationFormat === 'bibtex'
                      ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                      : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  BibTeX
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyCitation}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3.5 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 cursor-pointer dark:border-white/15 dark:bg-[#0C0C10] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60"
            >
              {copiedCitation ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
                  <span>تم نسخ التوثيق</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>نسخ {citationFormat === 'apa' ? 'APA' : 'BibTeX'}</span>
                </>
              )}
            </button>
          </div>

          <pre
            dir={citationFormat === 'bibtex' ? 'ltr' : 'rtl'}
            className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white p-3.5 text-xs leading-6 text-zinc-800 font-mono whitespace-pre-wrap dark:border-white/10 dark:bg-[#050507] dark:text-zinc-200"
          >
            {citationFormat === 'apa' ? apaCitation : bibtexCitation}
          </pre>
        </div>
      )}

      {/* Expandable Embed Widget Code Drawer for Journalists, Bloggers & Researchers */}
      {showEmbedBox && (
        <div className="border-b border-zinc-200 bg-zinc-50 px-5 py-4 sm:px-7 dark:border-white/10 dark:bg-[#08080C] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <Code2 className="h-4 w-4 text-emerald-700 dark:text-[#D9FF43]" />
              <span className="text-xs font-bold text-zinc-950 dark:text-white">
                تضمين بطاقة «{entry.word}» في المدونات والمقالات
              </span>

              <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-white/10 dark:bg-[#0C0C10]">
                <button
                  type="button"
                  onClick={() => setEmbedFormat('iframe')}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                    embedFormat === 'iframe'
                      ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                      : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  بطاقة تفاعلية (iframe)
                </button>
                <button
                  type="button"
                  onClick={() => setEmbedFormat('html_card')}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                    embedFormat === 'html_card'
                      ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                      : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  اقتباس HTML خفيف
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {embedFormat === 'iframe' && (
                <select
                  aria-label="مظهر بطاقة التضمين"
                  value={embedTheme}
                  onChange={(e) => setEmbedTheme(e.target.value as 'auto' | 'light' | 'dark')}
                  className="min-h-[32px] rounded-lg border border-zinc-300 bg-white px-2.5 text-xs text-zinc-800 dark:border-white/15 dark:bg-[#0C0C10] dark:text-zinc-200"
                >
                  <option value="auto">المظهر: تلقائي</option>
                  <option value="light">المظهر: فاتح</option>
                  <option value="dark">المظهر: داكن</option>
                </select>
              )}

              <label className="inline-flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={embedCompact}
                  onChange={(e) => setEmbedCompact(e.target.checked)}
                  className="h-3.5 w-3.5 rounded accent-emerald-600"
                />
                <span>وضع مختصر بدون الشاهد</span>
              </label>

              <button
                type="button"
                onClick={() => void handleCopyEmbedSnippet()}
                className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full bg-zinc-950 px-3.5 py-1 text-xs font-bold text-white hover:bg-zinc-800 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507]"
              >
                {copiedEmbed ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>تم نسخ الكود</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>نسخ كود التضمين</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <pre
            dir="ltr"
            className="overflow-x-auto rounded-xl border border-zinc-200 bg-white p-3.5 text-start text-[11px] leading-6 text-zinc-800 font-mono whitespace-pre-wrap dark:border-white/10 dark:bg-[#050507] dark:text-zinc-200"
          >
            {embedFormat === 'iframe' ? iframeEmbedSnippet : seoHtmlCardSnippet}
          </pre>
        </div>
      )}

      {/* Encyclopedic View Tabs: Reference Card vs Transparent Word Revision History */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-2.5 sm:px-7 dark:border-white/10">
        <div
          role="tablist"
          aria-label="أقسام بطاقة المفردة"
          className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-white/10 dark:bg-[#07070A]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeInnerTab === 'reference'}
            onClick={() => setActiveInnerTab('reference')}
            className={`min-h-[30px] rounded-lg px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
              activeInnerTab === 'reference'
                ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            البطاقة المرجعية والشواهد
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeInnerTab === 'history'}
            onClick={() => setActiveInnerTab('history')}
            className={`inline-flex min-h-[30px] items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
              activeInnerTab === 'history'
                ? 'bg-zinc-950 text-white dark:bg-[#D9FF43] dark:text-[#050507]'
                : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>سجل تاريخ المفردة</span>
          </button>
        </div>
      </div>

      {/* Main Lexicographical Reference Body or Transparent Revision History */}
      {activeInnerTab === 'history' ? (
        <div className="p-6 sm:p-8">
          <EntryRevisionHistoryPanel
            entry={entry}
            corpusVersion={corpusVersion}
            attestationSummary={attestationSummary}
            onOpenContributorProfile={onOpenContributorProfile}
          />
        </div>
      ) : (
      <div className="p-6 sm:p-8 space-y-8">
        {/* Headword + Phonetic Transcription + Dialect Metadata */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between border-b border-zinc-200 pb-7 dark:border-white/10">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3.5">
              <h2
                id="dictionary-headword"
                className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-zinc-950 dark:text-white"
              >
                {entry.word}
              </h2>

              {entry.latin && (
                <span
                  dir="ltr"
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-1.5 font-mono text-base sm:text-lg font-semibold text-emerald-700 dark:border-white/12 dark:bg-[#07070A] dark:text-[#D9FF43]"
                >
                  /{entry.latin}/
                </span>
              )}

              {canSpeak && (
                <button
                  type="button"
                  onClick={handleSpeak}
                  title="استمع لنطق تقريبي للمفردة"
                  aria-label="نطق المفردة"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-950 hover:text-zinc-950 transition-colors cursor-pointer dark:border-white/12 dark:bg-[#07070A] dark:text-zinc-300 dark:hover:border-[#D9FF43] dark:hover:text-[#D9FF43]"
                >
                  <Volume2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-600 dark:text-zinc-400">
              {entryTypeLabel && (
                <span>
                  النوع: <strong className="text-zinc-900 dark:text-zinc-200">{entryTypeLabel}</strong>
                </span>
              )}
              {entry.register && entry.register !== 'unknown' && (
                <span>
                  المستوى التداولي:{' '}
                  <strong className="text-zinc-900 dark:text-zinc-200">
                    {formatRegisterLabel(entry.register)}
                  </strong>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Globe2 className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" />
                <span>الانتشار:</span>
                <strong className="text-zinc-900 dark:text-zinc-200">{regions.join('، ')}</strong>
              </span>
              {entry.etymology && entry.etymology !== 'unspecified' && (
                <span>
                  الجذر والتأصيل:{' '}
                  {onSelectEtymology ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (entry.etymology) onSelectEtymology(entry.etymology)
                      }}
                      title="تصفية المعجم حسب هذا الجذر التاريخي"
                      className="font-semibold text-emerald-700 hover:underline cursor-pointer dark:text-[#D9FF43]"
                    >
                      {formatEtymologyLabel(entry.etymology)}
                    </button>
                  ) : (
                    <strong className="text-zinc-900 dark:text-zinc-200">
                      {formatEtymologyLabel(entry.etymology)}
                    </strong>
                  )}
                </span>
              )}
            </div>
          </div>

          {attestationSummary && attestationSummary.accurateCount > 0 && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/70 px-4 py-2.5 text-xs dark:border-[#D9FF43]/25 dark:bg-[#D9FF43]/8">
              <p className="font-mono text-[10px] tracking-[0.12em] uppercase text-emerald-800 dark:text-[#D9FF43]">
                COMMUNITY ATTESTED
              </p>
              <p className="mt-0.5 font-semibold text-zinc-900 dark:text-white">
                {attestationSummary.accurateCount} تصديق مجتمعي موثق
              </p>
            </div>
          )}
        </div>

        {/* Bilingual Semantic Definition Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 dark:border-white/10 dark:bg-[#07070A]">
            <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-emerald-700 dark:text-[#D9FF43]">
              01 · المعنى العربي الفصيح
            </p>
            <p className="mt-2.5 text-base sm:text-lg font-semibold leading-8 text-zinc-950 dark:text-white">
              {entry.meaning || 'لم يُحدد المعنى الفصيح بعد'}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 dark:border-white/10 dark:bg-[#07070A]">
            <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-zinc-500 dark:text-zinc-400">
              02 · المقابل الفرنسي (FR)
            </p>
            <p
              dir="ltr"
              className="mt-2.5 text-start text-base sm:text-lg font-medium leading-8 text-zinc-900 dark:text-zinc-100"
            >
              {entry.french || '— لم يُوثّق مقابل فرنسي بعد'}
            </p>
          </div>
        </div>

        {entry.etymologyNote && (
          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 px-4 py-3 text-xs leading-6 text-zinc-700 dark:border-white/10 dark:bg-white/[0.02] dark:text-zinc-300">
            <strong className="text-emerald-800 dark:text-[#D9FF43]">
              إضاءة التأصيل التاريخي ({formatEtymologyLabel(entry.etymology)}):{' '}
            </strong>
            {entry.etymologyNote}
          </div>
        )}

        {entry.reviewNotes && (
          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/40 px-4 py-3 text-xs leading-6 text-zinc-600 dark:border-white/10 dark:bg-white/[0.02] dark:text-zinc-400">
            <strong className="text-zinc-900 dark:text-zinc-200">ملاحظة معجمية: </strong>
            {entry.reviewNotes}
          </div>
        )}

        {/* Contextual Examples Section */}
        <section aria-labelledby="reference-examples-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-zinc-500 dark:text-zinc-400">
                03 · CONTEXTUAL ATTESTATIONS
              </p>
              <h3
                id="reference-examples-heading"
                className="mt-0.5 font-display text-lg font-bold text-zinc-950 dark:text-white"
              >
                الشواهد والأمثلة السياقية ({entry.examples.length})
              </h3>
            </div>

            <button
              type="button"
              onClick={() => onSwitchToWorkshop(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline cursor-pointer dark:text-[#D9FF43]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>أضف شاهداً سياقياً جديداً</span>
            </button>
          </div>

          {entry.examples.length > 0 ? (
            <div className="space-y-3">
              {entry.examples.map((ex, idx) => (
                <div
                  key={ex.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 dark:border-white/10 dark:bg-[#07070A] dark:hover:border-white/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-base sm:text-lg font-bold leading-8 text-zinc-950 dark:text-white">
                      «{ex.darijaAr}»
                    </p>
                    <span className="font-mono text-[11px] text-zinc-400 shrink-0">
                      #{String(idx + 1).padStart(2, '0')}
                    </span>
                  </div>

                  {ex.darijaLatin && (
                    <p
                      dir="ltr"
                      className="mt-1 text-start font-mono text-xs text-emerald-700 dark:text-[#D9FF43]"
                    >
                      {ex.darijaLatin}
                    </p>
                  )}

                  <div className="mt-3 grid grid-cols-1 gap-2 border-t border-zinc-100 pt-3 text-xs sm:grid-cols-2 dark:border-white/8">
                    {ex.meaningAr && (
                      <p className="text-zinc-700 dark:text-zinc-300">
                        <span className="text-zinc-400">الفصحى: </span>
                        {ex.meaningAr}
                      </p>
                    )}
                    {ex.meaningFr && (
                      <p dir="ltr" className="text-start text-zinc-600 dark:text-zinc-400">
                        <span className="text-zinc-400">FR: </span>
                        {ex.meaningFr}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 p-5 dark:border-white/15 dark:bg-[#07070A]">
              <div className="space-y-1">
                <p className="text-sm font-bold text-zinc-900 dark:text-white">
                  تحتاج هذه المفردة إلى شاهد سياقي موثق
                </p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  ساهم بجملة طبيعية من التداول المغربي اليومي لتوضيح سياق استعمال «{entry.word}».
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSwitchToWorkshop(true)}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-1.5 text-xs font-bold text-white hover:bg-zinc-800 shrink-0 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>إضافة أول شاهد الآن</span>
              </button>
            </div>
          )}
        </section>

        {/* Related Entries in the Same Semantic Field */}
        {relatedEntries.length > 0 && (
          <section
            aria-labelledby="related-entries-heading"
            className="border-t border-zinc-200 pt-6 space-y-3.5 dark:border-white/10"
          >
            <div className="flex items-center justify-between gap-2">
              <h3
                id="related-entries-heading"
                className="font-display text-sm font-bold text-zinc-900 dark:text-white"
              >
                مفردات قريبة ضمن حقل «{entry.category}»
              </h3>
              <button
                type="button"
                onClick={() => onSelectCategory(entry.category)}
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-950 cursor-pointer dark:text-zinc-400 dark:hover:text-white"
              >
                <span>استعراض كل الحقل</span>
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {relatedEntries.map((rel) => (
                <a
                  key={rel.id}
                  href={`/lexicon/${encodeURIComponent(rel.id)}`}
                  onClick={(e) => {
                    e.preventDefault()
                    onSelectEntry(rel)
                  }}
                  className="group flex flex-col justify-between rounded-xl border border-zinc-200 bg-zinc-50/50 p-3.5 transition-colors hover:border-zinc-950 dark:border-white/10 dark:bg-[#07070A] dark:hover:border-[#D9FF43]/60"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-sm font-bold text-zinc-950 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-[#D9FF43]">
                      {rel.word}
                    </span>
                    {rel.latin && (
                      <span dir="ltr" className="font-mono text-[11px] text-zinc-500">
                        {rel.latin}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-zinc-600 dark:text-zinc-400">
                    {rel.meaning}
                  </p>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Quiet Provenance & Open License Strip */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-5 text-[11px] text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          <span>
            المصدر: <strong className="text-zinc-700 dark:text-zinc-300">{entry.provenance.sourceName}</strong> · الرخصة:{' '}
            <span className="font-mono">{entry.provenance.license}</span> · إصدار المتن:{' '}
            <span className="font-mono">v{corpusVersion}</span>
          </span>
          <a
            href="/attribution/"
            className="inline-flex items-center gap-1 hover:text-zinc-950 hover:underline dark:hover:text-white"
          >
            <span>شروط الإسناد الأكاديمي</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </footer>
      </div>
      )}
    </article>
  )
}
