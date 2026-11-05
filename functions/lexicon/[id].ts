/**
 * Cloudflare Pages Edge Function for `/lexicon/:id`
 * Injects word-specific OpenGraph, Twitter Card, <title>, and canonical metadata
 * at the edge so social crawlers (WhatsApp, Telegram, X/Twitter, Facebook, LinkedIn)
 * receive rich Moroccan Darija word previews without executing client-side JavaScript.
 */

interface RawLexiconRecord {
  id?: string | number
  numeric_id?: string | number
  darija_ar?: string
  darija_latin?: string
  fusha_ar?: string
  fr?: string
  category?: string
}

interface EdgeCorpusCache {
  fetchedAt: number
  byId: Map<string, RawLexiconRecord>
}

const DATASET_REPO = 'ArCode-Standard/moroccan-darija-dataset'
const DATASET_COMMIT = '4b8c0618a11578915360468cb8dc17e230691b18'
const CORPUS_LEXICON_URL = `https://raw.githubusercontent.com/${DATASET_REPO}/${DATASET_COMMIT}/data/moroccan-darija.json`
const CACHE_TTL_MS = 15 * 60 * 1000

let memoryCache: EdgeCorpusCache | null = null

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function normalizeLexiconId(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null
  }

  const candidate = String(value).trim()
  return candidate.length > 0 ? candidate : null
}

export function extractLexiconRows(payload: unknown): RawLexiconRecord[] {
  if (Array.isArray(payload)) {
    return payload as RawLexiconRecord[]
  }

  if (payload && typeof payload === 'object') {
    const record = payload as { entries?: unknown[]; rawEntries?: unknown[] }
    if (Array.isArray(record.entries)) {
      return record.entries as RawLexiconRecord[]
    }
    if (Array.isArray(record.rawEntries)) {
      return record.rawEntries as RawLexiconRecord[]
    }
  }

  return []
}

export function injectWordOpenGraphHtml(
  baseHtml: string,
  word: {
    id: string
    darijaAr: string
    darijaLatin?: string
    meaningAr: string
    french?: string
  },
  siteOrigin: string,
): string {
  const latinPart = word.darijaLatin ? ` (${word.darijaLatin})` : ''
  const title = `معنى «${word.darijaAr}»${latinPart} بالدارجة المغربية | Darija LexReview`
  const description = `معنى كلمة «${word.darijaAr}» في الدارجة المغربية: ${word.meaningAr}${
    word.french ? ` · بالفرنسية: ${word.french}` : ''
  }. استعرض التأصيل والشواهد السياقية في المعجم المغربي المفتوح.`.slice(0, 180)
  const canonicalUrl = `${siteOrigin}/lexicon/${encodeURIComponent(word.id)}`
  const ogImageUrl = `${siteOrigin}/assets/og-social-card.jpg`

  const safeTitle = escapeHtmlAttr(title)
  const safeDesc = escapeHtmlAttr(description)
  const safeUrl = escapeHtmlAttr(canonicalUrl)
  const safeImg = escapeHtmlAttr(ogImageUrl)

  return baseHtml
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${safeDesc}" />`,
    )
    .replace(
      /<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:type" content="article" />`,
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:title" content="${safeTitle}" />`,
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:description" content="${safeDesc}" />`,
    )
    .replace(
      /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:url" content="${safeUrl}" />`,
    )
    .replace(
      /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:image" content="${safeImg}" />`,
    )
    .replace(
      /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:title" content="${safeTitle}" />`,
    )
    .replace(
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:description" content="${safeDesc}" />`,
    )
    .replace(
      /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:image" content="${safeImg}" />`,
    )
    .replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
      `<link rel="canonical" href="${safeUrl}" />`,
    )
}

async function getLexiconById(): Promise<Map<string, RawLexiconRecord>> {
  const now = Date.now()
  if (memoryCache && now - memoryCache.fetchedAt < CACHE_TTL_MS) {
    return memoryCache.byId
  }

  const res = await fetch(CORPUS_LEXICON_URL, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    return memoryCache?.byId ?? new Map()
  }

  const payload = (await res.json()) as unknown
  const rows = extractLexiconRows(payload)

  const byId = new Map<string, RawLexiconRecord>()
  for (const row of rows) {
    const idCandidate = normalizeLexiconId(row.id ?? row.numeric_id)
    if (!idCandidate) {
      continue
    }
    byId.set(idCandidate, row)
  }

  memoryCache = { fetchedAt: now, byId }
  return byId
}

export const onRequestGet = async (context: {
  request: Request
  params: { id?: string | string[] }
  env: { ASSETS: { fetch: (req: Request | URL | string) => Promise<Response> } }
}): Promise<Response> => {
  const url = new URL(context.request.url)
  const assetUrl = new URL('/index.html', url.origin)
  const assetResponse = await context.env.ASSETS.fetch(assetUrl.toString())

  const rawParam = Array.isArray(context.params.id)
    ? context.params.id[0]
    : context.params.id
  let entryId = ''
  try {
    entryId = decodeURIComponent(rawParam || '').trim()
  } catch {
    entryId = (rawParam || '').trim()
  }

  if (!entryId || entryId.length > 64) {
    return assetResponse
  }

  try {
    const byId = await getLexiconById()
    const match = byId.get(entryId)
    if (!match || !match.darija_ar) {
      return assetResponse
    }

    const baseHtml = await assetResponse.text()
    const rewrittenHtml = injectWordOpenGraphHtml(
      baseHtml,
      {
        id: entryId,
        darijaAr: match.darija_ar,
        darijaLatin: match.darija_latin,
        meaningAr: match.fusha_ar || 'مفردة موثقة في الدارجة المغربية',
        french: match.fr,
      },
      url.origin,
    )

    const headers = new Headers(assetResponse.headers)
    headers.set('content-type', 'text/html; charset=utf-8')
    return new Response(rewrittenHtml, {
      status: 200,
      headers,
    })
  } catch {
    return assetResponse
  }
}
