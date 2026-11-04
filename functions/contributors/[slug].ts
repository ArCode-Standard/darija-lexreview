/**
 * Cloudflare Pages Edge Function for `/contributors/:slug`
 * Injects contributor Honor Roll OpenGraph & Twitter Card metadata at the edge
 * for clean social sharing on WhatsApp, Telegram, LinkedIn, and X/Twitter.
 */

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function injectContributorOpenGraphHtml(
  baseHtml: string,
  slug: string,
  siteOrigin: string,
): string {
  const canonicalUrl = `${siteOrigin}/contributors/${encodeURIComponent(slug)}`
  const ogImageUrl = `${siteOrigin}/assets/og-social-card.jpg`
  const title = `بطاقة الهوية المعجمية للمساهم الموثق | Darija LexReview`
  const description =
    'استعرض بطاقة الهوية المعجمية، أختام الاستحقاق العلمي، وسجل المساهمات المعتمدة في المعجم المغربي المفتوح Darija LexReview.'

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
      `<meta property="og:type" content="profile" />`,
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

export const onRequestGet = async (context: {
  request: Request
  params: { slug?: string | string[] }
  env: { ASSETS: { fetch: (req: Request | URL | string) => Promise<Response> } }
}): Promise<Response> => {
  const url = new URL(context.request.url)
  const assetUrl = new URL('/index.html', url.origin)
  const assetResponse = await context.env.ASSETS.fetch(assetUrl.toString())

  const rawParam = Array.isArray(context.params.slug)
    ? context.params.slug[0]
    : context.params.slug
  let slug = ''
  try {
    slug = decodeURIComponent(rawParam || '').trim()
  } catch {
    slug = (rawParam || '').trim()
  }

  if (!slug || slug.length > 96) {
    return assetResponse
  }

  try {
    const baseHtml = await assetResponse.text()
    const rewrittenHtml = injectContributorOpenGraphHtml(baseHtml, slug, url.origin)
    const headers = new Headers(assetResponse.headers)
    headers.set('content-type', 'text/html; charset=utf-8')
    return new Response(rewrittenHtml, { status: 200, headers })
  } catch {
    return assetResponse
  }
}
