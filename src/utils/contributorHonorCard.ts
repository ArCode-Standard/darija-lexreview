import type { PublicContributorRecord, UserRole } from '../types/lexicon'
import type { MeritBadge } from './meritBadges'
import { buildContributorProfileUrl } from './urlState'

const ARCODE_PALETTES = [
  { shell: '#D9FF43', face: '#101014', detail: '#00C896' },
  { shell: '#8BE1D2', face: '#102B35', detail: '#F6C85F' },
  { shell: '#B9A6FF', face: '#211A3B', detail: '#FF8C9D' },
  { shell: '#FFB879', face: '#3B2418', detail: '#83D7FF' },
  { shell: '#8BC5FF', face: '#14243A', detail: '#D9FF43' },
  { shell: '#F2A6D8', face: '#351D32', detail: '#A8E6CF' },
]

const ROLE_AR: Record<UserRole, string> = {
  admin: 'مشرف عام على المتن',
  editor: 'محرر معجمي معتمد',
  reviewer: 'مراجع وموثّق مساهم',
}

const ROLE_EN: Record<UserRole, string> = {
  admin: 'Lead Corpus Administrator',
  editor: 'Certified Lexicon Editor',
  reviewer: 'Verified Lexicon Contributor',
}

export interface ContributorCitationBundle {
  arabic: string
  english: string
  bibtex: string
  apa7: string
  permalink: string
}

export function buildContributorAcademicCitation(
  person: PublicContributorRecord,
  corpusVersion: string,
  currentHref?: string,
  badges?: MeritBadge[],
): ContributorCitationBundle {
  const permalink = buildContributorProfileUrl(person.public_slug, currentHref)
  const wordsCount = person.documented_words_count ?? person.accepted_count
  const examplesCount = person.documented_examples_count ?? person.attestations_count
  const regionAr = person.dialect_region ? ` (${person.dialect_region})` : ''
  const handleEn = person.github_handle ? ` (@${person.github_handle})` : ''
  const regionEn = person.dialect_region ? ` — Dialect focus: ${person.dialect_region}` : ''
  const topSealsAr =
    badges && badges.length > 0
      ? ` الأختام العلمية الممنوحة: ${badges
          .slice(0, 3)
          .map((b) => `${b.sealName} (${b.label})`)
          .join('، ')}.`
      : ''

  const arabic = `${person.display_name}${regionAr} — ${ROLE_AR[person.role]} في المعجم المغربي المفتوح (ArCode Moroccan Darija Lexicon v${corpusVersion}): مساهمة موثقة شملت ${wordsCount} مفردة و${examplesCount} شاهداً وتصديقاً سياقياً منذ ${person.joined_year}.${topSealsAr} السجل المرجعي الدائم: ${permalink}`

  const english = `${person.display_name}${handleEn} — ${ROLE_EN[person.role]}, ArCode Moroccan Darija Lexicon (v${corpusVersion}): Documented ${wordsCount} lexical entries and ${examplesCount} contextual attestations (joined ${person.joined_year})${regionEn}. Verified profile: ${permalink}`

  // Standard BibTeX citation
  const citeKey = `arcode_lexicon_${person.public_slug.replace(/[^a-zA-Z0-9]/g, '_')}_${person.joined_year}`
  const bibtex = `@misc{${citeKey},
  author       = {${person.display_name}},
  title        = {{ArCode Moroccan Darija Lexicon: Verified Dialect Documentation and Attestations (v${corpusVersion})}},
  howpublished = {\\url{${permalink}}},
  year         = {${person.joined_year}},
  note         = {Role: ${ROLE_EN[person.role]}, Documented: ${wordsCount} entries, ${examplesCount} attestations. Dialect region: ${person.dialect_region || 'National Moroccan'}}
}`

  // Standard APA 7th Edition citation
  const apa7 = `${person.display_name}. (${person.joined_year}). ArCode Moroccan Darija Lexicon: Verified lexical contributions and dialect documentation (Version ${corpusVersion}) [Data set]. ArCode Research Initiative. ${permalink}`

  return {
    arabic,
    english,
    bibtex,
    apa7,
    permalink,
  }
}

function drawMoroccanKhatamSealOnCanvas(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  strokeColor: string,
) {
  const half = size / 2
  ctx.save()
  ctx.translate(cx, cy)
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = 1.6

  for (const angle of [0, Math.PI / 4]) {
    ctx.save()
    ctx.rotate(angle)
    drawRoundedRect(ctx, -half, -half, size, size, 2.5)
    ctx.stroke()
    ctx.restore()
  }

  ctx.beginPath()
  ctx.arc(0, 0, size * 0.24, 0, Math.PI * 2)
  ctx.fillStyle = strokeColor
  ctx.fill()
  ctx.restore()
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

function drawLexicalRadarOnCanvas(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  person: PublicContributorRecord,
  badges: MeritBadge[],
  accentColor: string,
  borderColor: string,
) {
  const words = person.documented_words_count ?? person.accepted_count
  const attestations = person.documented_examples_count ?? person.attestations_count
  const sprintCount = person.sprint_participations_count ?? 0
  const hasRegion = Boolean(person.dialect_region && person.dialect_region !== 'مشترك عام')
  const hasRegionalBadge = badges.some((b) => b.id === 'regional_specialist')

  const vocabVal = Math.min(100, Math.max(20, Math.round((words / 30) * 100)))
  const attestationVal = Math.min(100, Math.max(20, Math.round((attestations / 50) * 100)))
  const geoVal = hasRegionalBadge ? 95 : hasRegion ? 75 : 40
  const sealsVal = Math.min(100, Math.max(15, Math.round((badges.length / 6) * 100)))
  let semanticVal = 35
  if (person.specialty && person.specialty.trim().length > 10) semanticVal += 30
  if (badges.some((b) => b.id === 'category_expert' || b.id === 'active_corrector')) semanticVal += 20
  if (sprintCount > 0) semanticVal += 15
  semanticVal = Math.min(100, semanticVal)

  const values = [vocabVal, attestationVal, geoVal, sealsVal, semanticVal]
  const count = values.length
  const angleStep = (Math.PI * 2) / count
  const startAngle = -Math.PI / 2

  ctx.save()

  // Concentric guideline rings
  const rings = [0.45, 0.8, 1.0]
  ctx.strokeStyle = borderColor
  ctx.lineWidth = 0.8

  rings.forEach((rScale) => {
    ctx.beginPath()
    for (let i = 0; i < count; i++) {
      const angle = startAngle + i * angleStep
      const x = cx + radius * rScale * Math.cos(angle)
      const y = cy + radius * rScale * Math.sin(angle)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.stroke()
  })

  // Radial spokes
  for (let i = 0; i < count; i++) {
    const angle = startAngle + i * angleStep
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle))
    ctx.stroke()
  }

  // 5-axis footprint polygon
  ctx.beginPath()
  values.forEach((val, idx) => {
    const angle = startAngle + idx * angleStep
    const r = (val / 100) * radius
    const x = cx + r * Math.cos(angle)
    const y = cy + r * Math.sin(angle)
    if (idx === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.closePath()

  ctx.fillStyle = 'rgba(217, 255, 67, 0.22)'
  ctx.fill()
  ctx.strokeStyle = accentColor
  ctx.lineWidth = 1.6
  ctx.stroke()

  // Vertex points
  values.forEach((val, idx) => {
    const angle = startAngle + idx * angleStep
    const r = (val / 100) * radius
    const x = cx + r * Math.cos(angle)
    const y = cy + r * Math.sin(angle)
    ctx.beginPath()
    ctx.arc(x, y, 2.2, 0, Math.PI * 2)
    ctx.fillStyle = accentColor
    ctx.fill()
  })

  ctx.restore()
}

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

function drawArCodeAvatarOnCanvas(
  ctx: CanvasRenderingContext2D,
  seed: string,
  x: number,
  y: number,
  size: number,
) {
  const palette =
    ARCODE_PALETTES[
      [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % ARCODE_PALETTES.length
    ]
  const scale = size / 96

  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)

  // Circular clip matching Avatar.tsx rounded-full presentation
  ctx.beginPath()
  ctx.arc(48, 48, 48, 0, Math.PI * 2)
  ctx.clip()

  ctx.fillStyle = palette.shell
  ctx.fillRect(0, 0, 96, 96)

  // Ears / horns
  ctx.strokeStyle = palette.face
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(18, 31)
  ctx.lineTo(25, 17)
  ctx.lineTo(37, 26)
  ctx.moveTo(78, 31)
  ctx.lineTo(71, 17)
  ctx.lineTo(59, 26)
  ctx.stroke()

  // Head shell
  drawRoundedRect(ctx, 19, 25, 58, 54, 20)
  ctx.fillStyle = palette.face
  ctx.fill()

  // Visor
  drawRoundedRect(ctx, 27, 35, 42, 27, 11)
  ctx.fillStyle = palette.shell
  ctx.fill()

  // Eyes
  ctx.fillStyle = palette.face
  ctx.beginPath()
  ctx.arc(39, 48, 4, 0, Math.PI * 2)
  ctx.arc(57, 48, 4, 0, Math.PI * 2)
  ctx.fill()

  // Smile
  ctx.strokeStyle = palette.detail
  ctx.lineWidth = 3.5
  ctx.beginPath()
  ctx.moveTo(40, 57)
  ctx.quadraticCurveTo(48, 64, 56, 57)
  ctx.stroke()

  // Antenna
  ctx.strokeStyle = palette.face
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(48, 25)
  ctx.lineTo(48, 15)
  ctx.stroke()

  ctx.fillStyle = palette.detail
  ctx.beginPath()
  ctx.arc(48, 12, 5, 0, Math.PI * 2)
  ctx.fill()

  // Neck pins
  ctx.strokeStyle = palette.face
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(34, 79)
  ctx.lineTo(34, 85)
  ctx.moveTo(62, 79)
  ctx.lineTo(62, 85)
  ctx.stroke()

  ctx.restore()
}

export interface ContributorCardRenderOptions {
  corpusVersion: string
  theme?: 'dark' | 'light'
  currentHref?: string
}

export function renderContributorHonorCardDataUrl(
  person: PublicContributorRecord,
  badges: MeritBadge[],
  options: ContributorCardRenderOptions,
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
  const subtleSurface = isDark ? '#07070A' : '#F4F4F5'

  // 1. Base Canvas Fill + Architectural Grid Lines
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(9,9,11,0.06)'
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

  // 2. Main Certificate Frame
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

  // 3. Top Institutional Header
  ctx.direction = 'ltr'
  ctx.textAlign = 'left'
  ctx.fillStyle = accent
  ctx.font = '600 15px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillText(`ARCODE STANDARD · HONOR ROLL · v${options.corpusVersion}`, leftEdge, cardY + 50)

  ctx.direction = 'rtl'
  ctx.textAlign = 'right'
  ctx.fillStyle = textSecondary
  ctx.font = '600 16px system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif'
  ctx.fillText('لوحة شرف المساهمين والهيئة العلمية — إشهاد توثيق رسمي', rightEdge, cardY + 50)

  ctx.strokeStyle = border
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(leftEdge, cardY + 74)
  ctx.lineTo(rightEdge, cardY + 74)
  ctx.stroke()

  // 4. Identity Block (ArCode Vector Mark + Name + Role + Region)
  const avatarSize = 96
  const avatarX = rightEdge - avatarSize
  const avatarY = cardY + 104
  const stableSeed =
    person.avatar_seed || person.github_handle || person.display_name || person.public_slug
  drawArCodeAvatarOnCanvas(ctx, stableSeed, avatarX, avatarY, avatarSize)

  const textRight = avatarX - 28
  ctx.direction = 'rtl'
  ctx.textAlign = 'right'
  ctx.fillStyle = accent
  ctx.font = '600 17px system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif'
  ctx.fillText(
    `${ROLE_AR[person.role]} · عضو منذ ${person.joined_year}`,
    textRight,
    cardY + 132,
  )

  ctx.fillStyle = textPrimary
  ctx.font = '700 44px system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif'
  ctx.fillText(person.display_name, textRight, cardY + 182)

  if (person.github_handle) {
    ctx.direction = 'ltr'
    ctx.textAlign = 'left'
    ctx.fillStyle = textSecondary
    ctx.font = '600 18px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillText(`@${person.github_handle}`, leftEdge, cardY + 148)
  }

  // Region & Specialty Line
  ctx.direction = 'rtl'
  ctx.textAlign = 'right'
  ctx.fillStyle = textSecondary
  ctx.font = '500 20px system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif'
  const regionLabel = person.dialect_region || 'تداول مغربي عام'
  const specialtyLabel =
    person.specialty || 'توثيق المفردات المتداولة ومراجعة الشواهد السياقية للدارجة المغربية'
  const bioLines = wrapCanvasText(ctx, `المنطقة: ${regionLabel} · ${specialtyLabel}`, innerWidth, 2)
  let cursorY = cardY + 242
  for (const line of bioLines) {
    ctx.fillText(line, rightEdge, cursorY)
    cursorY += 32
  }

  // 5. Verified Impact Metrics Strip
  const statsY = cardY + 318
  const statsH = 122
  drawRoundedRect(ctx, leftEdge, statsY, innerWidth, statsH, 16)
  ctx.fillStyle = subtleSurface
  ctx.fill()
  ctx.strokeStyle = border
  ctx.lineWidth = 1
  ctx.stroke()

  const wordsCount = person.documented_words_count ?? person.accepted_count
  const examplesCount = person.documented_examples_count ?? person.attestations_count
  const colW = innerWidth / 3

  const metrics = [
    { value: String(wordsCount), label: 'مفردة ساهم في توثيقها', highlight: false },
    { value: String(examplesCount), label: 'شاهد وتصديق سياقي', highlight: true },
    { value: String(person.accepted_count), label: 'مقترح معجمي معتمد', highlight: false },
  ]

  metrics.forEach((m, idx) => {
    const colRight = rightEdge - idx * colW - 32
    ctx.direction = 'ltr'
    ctx.textAlign = 'right'
    ctx.fillStyle = m.highlight ? accent : textPrimary
    ctx.font = '700 40px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillText(m.value, colRight, statsY + 58)

    ctx.direction = 'rtl'
    ctx.textAlign = 'right'
    ctx.fillStyle = textSecondary
    ctx.font = '500 17px system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif'
    ctx.fillText(m.label, colRight, statsY + 94)

    if (idx < 2) {
      const divX = rightEdge - (idx + 1) * colW
      ctx.strokeStyle = border
      ctx.beginPath()
      ctx.moveTo(divX, statsY + 24)
      ctx.lineTo(divX, statsY + statsH - 24)
      ctx.stroke()
    }
  })

  // 6. Earned Exclusive Moroccan Khatam Seals Line & Lexical Footprint Radar
  const sealY = statsY + statsH + 38
  if (badges.length > 0) {
    drawMoroccanKhatamSealOnCanvas(ctx, rightEdge - 10, sealY - 6, 16, accent)

    const badgesText = `أختام المعجم الممنوحة: ${badges
      .slice(0, 3)
      .map((b) => `${b.sealName} (${b.label})`)
      .join(' · ')}`
    ctx.direction = 'rtl'
    ctx.textAlign = 'right'
    ctx.fillStyle = textPrimary
    ctx.font = '600 17px system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif'
    const badgeLines = wrapCanvasText(ctx, badgesText, innerWidth - 240, 1)
    if (badgeLines[0]) {
      ctx.fillText(badgeLines[0], rightEdge - 28, sealY)
    }
  }

  // Draw 5-axis Lexical Footprint Radar on the canvas
  const radarCx = leftEdge + 46
  const radarCy = sealY - 6
  drawLexicalRadarOnCanvas(ctx, radarCx, radarCy, 26, person, badges, accent, border)

  ctx.direction = 'rtl'
  ctx.textAlign = 'right'
  ctx.fillStyle = textSecondary
  ctx.font = '600 12px system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif'
  ctx.fillText('البصمة المعجمية الخماسية', leftEdge + 195, sealY - 14)
  ctx.font = '500 11px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillText('5-Axis Radar Footprint', leftEdge + 195, sealY + 2)

  // 7. Footer Attribution & Permalink
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
  ctx.fillText('المعجم المغربي المفتوح · Darija LexReview', rightEdge, footerY)

  const cleanUrl = buildContributorProfileUrl(person.public_slug, options.currentHref).replace(
    /^https?:\/\//,
    '',
  )
  ctx.direction = 'ltr'
  ctx.textAlign = 'left'
  ctx.fillStyle = textSecondary
  ctx.font = '500 14px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillText(`CC BY-NC 4.0 · ${cleanUrl}`, leftEdge, footerY)

  return canvas.toDataURL('image/png')
}

export function downloadCitationFile(
  content: string,
  filename: string,
  mimeType = 'text/plain;charset=utf-8',
): boolean {
  if (typeof document === 'undefined') return false
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
  return true
}

export function downloadContributorHonorCard(
  person: PublicContributorRecord,
  badges: MeritBadge[],
  options: ContributorCardRenderOptions,
): boolean {
  const dataUrl = renderContributorHonorCardDataUrl(person, badges, options)
  if (!dataUrl || typeof document === 'undefined') return false

  const safeSlug =
    person.public_slug
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'contributor'

  const anchor = document.createElement('a')
  anchor.href = dataUrl
  anchor.download = `darija-lexreview-honor-${safeSlug}.png`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  return true
}
