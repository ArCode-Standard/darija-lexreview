import fs from 'node:fs/promises'
import path from 'node:path'

const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://darija-lexreview.pages.dev'
const LEXICON_URL =
  'https://raw.githubusercontent.com/ArCode-Standard/moroccan-darija-dataset/4b8c0618a11578915360468cb8dc17e230691b18/data/moroccan-darija.json'

const STATIC_ROUTES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/lexicon', priority: '0.9', changefreq: 'daily' },
  { path: '/collections', priority: '0.9', changefreq: 'weekly' },
  { path: '/collections/moroccan-proverbs', priority: '0.85', changefreq: 'weekly' },
  { path: '/collections/moroccan-kitchen-atay', priority: '0.85', changefreq: 'weekly' },
  { path: '/collections/greetings-courtesy', priority: '0.85', changefreq: 'weekly' },
  { path: '/collections/crafts-architecture', priority: '0.85', changefreq: 'weekly' },
  { path: '/collections/amazigh-andalusi-roots', priority: '0.85', changefreq: 'weekly' },
  { path: '/collections/daily-time-motion', priority: '0.85', changefreq: 'weekly' },
  { path: '/review', priority: '0.8', changefreq: 'weekly' },
  { path: '/insights', priority: '0.8', changefreq: 'weekly' },
  { path: '/contributors', priority: '0.8', changefreq: 'weekly' },
  { path: '/contribute', priority: '0.8', changefreq: 'monthly' },
  { path: '/about/', priority: '0.6', changefreq: 'monthly' },
  { path: '/methodology/', priority: '0.7', changefreq: 'monthly' },
  { path: '/privacy/', priority: '0.4', changefreq: 'yearly' },
  { path: '/terms/', priority: '0.4', changefreq: 'yearly' },
  { path: '/reporting/', priority: '0.5', changefreq: 'yearly' },
  { path: '/attribution/', priority: '0.7', changefreq: 'monthly' },
]

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function fetchEntryIds() {
  try {
    const res = await fetch(LEXICON_URL, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const payload = await res.json()
    const rawEntries = Array.isArray(payload?.entries) ? payload.entries : []
    const ids = []
    const seen = new Set()
    for (const item of rawEntries) {
      const id = String(item?.id ?? item?.numeric_id ?? '').trim()
      if (id && !seen.has(id)) {
        seen.add(id)
        ids.push(id)
      }
    }
    return {
      ids,
      lastmod:
        typeof payload?.meta?.created === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(payload.meta.created)
          ? payload.meta.created
          : new Date().toISOString().slice(0, 10),
    }
  } catch (err) {
    console.warn('[generate-sitemap] Remote corpus unreachable, using fallback entry IDs:', err?.message)
    return {
      ids: ['1', '2', '3', '4', '5'],
      lastmod: new Date().toISOString().slice(0, 10),
    }
  }
}

async function main() {
  const { ids, lastmod } = await fetchEntryIds()
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ]

  for (const route of STATIC_ROUTES) {
    lines.push(
      `  <url><loc>${escapeXml(`${SITE_ORIGIN}${route.path}`)}</loc><lastmod>${escapeXml(lastmod)}</lastmod><changefreq>${route.changefreq}</changefreq><priority>${route.priority}</priority></url>`,
    )
  }

  for (const entryId of ids) {
    const encodedId = encodeURIComponent(entryId)
    lines.push(
      `  <url><loc>${escapeXml(`${SITE_ORIGIN}/lexicon/${encodedId}`)}</loc><lastmod>${escapeXml(lastmod)}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`,
    )
  }

  lines.push('</urlset>', '')

  const outPath = path.resolve(process.cwd(), 'public/sitemap.xml')
  await fs.writeFile(outPath, lines.join('\n'), 'utf8')
  console.log(`[generate-sitemap] Wrote ${STATIC_ROUTES.length + ids.length} URLs to public/sitemap.xml`)
}

main()
