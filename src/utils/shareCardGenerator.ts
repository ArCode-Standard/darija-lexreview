import type { LexicalEntry } from '../types/lexicon'
import { formatAccessionCode, formatRegisterLabel } from '../services/dataset'
import { buildCleanEntryUrl } from './urlState'

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  const lines: string[] = []
  let current = words[0]

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate
    } else {
      lines.push(current)
      current = words[i]
      if (lines.length >= maxLines - 1) {
        const remaining = [current, ...words.slice(i + 1)].join(' ')
        let truncated = remaining
        while (truncated.length > 1 && ctx.measureText(`${truncated}…`).width > maxWidth) {
          truncated = truncated.slice(0, -1).trimEnd()
        }
        lines.push(truncated === remaining ? remaining : `${truncated}…`)
        return lines
      }
    }
  }

  lines.push(current)
  return lines.slice(0, maxLines)
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

export interface ShareCardRenderOptions {
  corpusVersion: string
  theme?: 'dark' | 'light'
  currentHref?: string
}

/**
 * Generates a crisp 1200x675 (16:9 social & academic card) PNG data URL
 * for any lexical entry with headword, Latin transcription, meaning, example,
 * dialect metadata, and ArCode Standard attribution.
 */
export function renderShareableLexicalCardDataUrl(
  entry: LexicalEntry,
  options: ShareCardRenderOptions,
): string | null {
  if (typeof document === 'undefined') return null

  const width = 1200
  const height = 675
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const isDark = (options.theme ?? 'dark') === 'dark'
  const bg = isDark ? '#050507' : '#FAFAFC'
  const surface = isDark ? '#0B0B10' : '#FFFFFF'
  const border = isDark ? 'rgba(255,255,255,0.14)' : '#E4E4E7'
  const textPrimary = isDark ? '#FFFFFF' : '#09090B'
  const textSecondary = isDark ? '#A1A1AA' : '#52525B'
  const accent = isDark ? '#D9FF43' : '#047857'
  const exampleSurface = isDark ? '#07070A' : '#F4F4F5'

  // 1. Base Canvas Fill
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  // Subtle architectural corner crosshairs
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(9,9,11,0.07)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(42, 0)
  ctx.lineTo(42, height)
  ctx.moveTo(width - 42, 0)
  ctx.lineTo(width - 42, height)
  ctx.moveTo(0, 42)
  ctx.lineTo(width, 42)
  ctx.moveTo(0, height - 42)
  ctx.lineTo(width, height - 42)
  ctx.stroke()

  // 2. Main Editorial Card Frame
  const cardX = 56
  const cardY = 52
  const cardW = width - 112
  const cardH = height - 104

  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 24)
  ctx.fillStyle = surface
  ctx.fill()
  ctx.strokeStyle = border
  ctx.lineWidth = 1.5
  ctx.stroke()

  const rightEdge = cardX + cardW - 52
  const leftEdge = cardX + 52
  const innerWidth = cardW - 104

  // 3. Top Header Strip (Brand + Accession Code)
  const accessionCode = formatAccessionCode(entry.id, entry.numericId)
  ctx.direction = 'ltr'
  ctx.textAlign = 'left'
  ctx.fillStyle = accent
  ctx.font = '600 15px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillText(`ARCODE STANDARD · ${accessionCode}`, leftEdge, cardY + 50)

  ctx.direction = 'rtl'
  ctx.textAlign = 'right'
  ctx.fillStyle = textSecondary
  ctx.font = '600 16px system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif'
  const regions = entry.region && entry.region.length > 0 ? entry.region.join('، ') : 'تداول مغربي عام'
  const registerText =
    entry.register && entry.register !== 'unknown' ? ` · ${formatRegisterLabel(entry.register)}` : ''
  ctx.fillText(`${entry.category} · ${regions}${registerText}`, rightEdge, cardY + 50)

  // Hairline divider under header
  ctx.strokeStyle = border
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(leftEdge, cardY + 74)
  ctx.lineTo(rightEdge, cardY + 74)
  ctx.stroke()

  // 4. Headword + Latin Transcription
  ctx.direction = 'rtl'
  ctx.textAlign = 'right'
  ctx.fillStyle = textPrimary
  const headwordSize = entry.word.length > 18 ? 52 : entry.word.length > 10 ? 64 : 76
  ctx.font = `700 ${headwordSize}px system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif`
  ctx.fillText(entry.word, rightEdge, cardY + 168)

  if (entry.latin) {
    ctx.direction = 'ltr'
    ctx.textAlign = 'left'
    ctx.fillStyle = accent
    ctx.font = '600 26px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillText(`/${entry.latin}/`, leftEdge, cardY + 160)
  }

  // 5. Arabic Meaning & French Equivalent
  let cursorY = cardY + 232
  ctx.direction = 'rtl'
  ctx.textAlign = 'right'
  ctx.fillStyle = textPrimary
  ctx.font = '600 28px system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif'
  const meaningLines = wrapCanvasText(
    ctx,
    entry.meaning || 'مدخل معجمي موثق في المتن المغربي المفتوح',
    innerWidth,
    2,
  )
  for (const line of meaningLines) {
    ctx.fillText(line, rightEdge, cursorY)
    cursorY += 40
  }

  if (entry.french) {
    ctx.direction = 'ltr'
    ctx.textAlign = 'left'
    ctx.fillStyle = textSecondary
    ctx.font = '500 20px system-ui, -apple-system, "Segoe UI", sans-serif'
    const frLines = wrapCanvasText(ctx, `FR — ${entry.french}`, innerWidth, 1)
    if (frLines[0]) {
      ctx.fillText(frLines[0], leftEdge, cursorY + 4)
      cursorY += 34
    }
  }

  // 6. Contextual Example Box (if available)
  const primaryEx = entry.examples[0]
  if (primaryEx?.darijaAr) {
    const boxY = Math.max(cursorY + 18, cardY + 345)
    const boxH = 132
    drawRoundedRect(ctx, leftEdge, boxY, innerWidth, boxH, 16)
    ctx.fillStyle = exampleSurface
    ctx.fill()
    ctx.strokeStyle = border
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.direction = 'rtl'
    ctx.textAlign = 'right'
    ctx.fillStyle = accent
    ctx.font = '600 14px system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif'
    ctx.fillText('شاهد سياقي موثّق', rightEdge - 24, boxY + 32)

    ctx.fillStyle = textPrimary
    ctx.font = '700 24px system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif'
    const exLines = wrapCanvasText(ctx, `«${primaryEx.darijaAr}»`, innerWidth - 48, 1)
    if (exLines[0]) {
      ctx.fillText(exLines[0], rightEdge - 24, boxY + 72)
    }

    if (primaryEx.meaningAr) {
      ctx.fillStyle = textSecondary
      ctx.font = '400 17px system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif'
      const trLines = wrapCanvasText(ctx, primaryEx.meaningAr, innerWidth - 48, 1)
      if (trLines[0]) {
        ctx.fillText(trLines[0], rightEdge - 24, boxY + 106)
      }
    }
  }

  // 7. Bottom Attribution Footer
  const footerY = cardY + cardH - 32
  ctx.strokeStyle = border
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(leftEdge, footerY - 30)
  ctx.lineTo(rightEdge, footerY - 30)
  ctx.stroke()

  ctx.direction = 'rtl'
  ctx.textAlign = 'right'
  ctx.fillStyle = textSecondary
  ctx.font = '500 15px system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif'
  ctx.fillText(`المعجم المغربي المفتوح · Darija LexReview v${options.corpusVersion}`, rightEdge, footerY)

  const cleanUrl = buildCleanEntryUrl(entry.id, options.currentHref)
    .replace(/^https?:\/\//, '')
  ctx.direction = 'ltr'
  ctx.textAlign = 'left'
  ctx.fillStyle = textSecondary
  ctx.font = '500 14px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillText(`CC BY-NC 4.0 · ${cleanUrl}`, leftEdge, footerY)

  return canvas.toDataURL('image/png')
}

export function downloadShareableLexicalCard(
  entry: LexicalEntry,
  options: ShareCardRenderOptions,
): boolean {
  const dataUrl = renderShareableLexicalCardDataUrl(entry, options)
  if (!dataUrl || typeof document === 'undefined') return false

  const safeSlug =
    (entry.latin || entry.id)
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || entry.id

  const anchor = document.createElement('a')
  anchor.href = dataUrl
  anchor.download = `darija-lexreview-${safeSlug}.png`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  return true
}
