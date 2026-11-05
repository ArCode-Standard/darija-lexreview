import { useMemo } from 'react'
import type { PublicContributorRecord } from '../types/lexicon'
import type { MeritBadge } from '../utils/meritBadges'

export interface RadarMetric {
  key: string
  label: string
  shortLabel: string
  value: number // Normalized 0 - 100
  rawValue: number
  unit: string
  hint: string
}

export interface LexicalFootprintData {
  metrics: RadarMetric[]
  balanceScore: number
  specializationTitle: string
}

/**
 * Computes a normalized 5-axis Lexical Footprint:
 * 1. توثيق المتن (Vocabulary / Words Documentation)
 * 2. التحكيم الميداني (Attestations & Context Verification)
 * 3. التنوع الجغرافي والجهوي (Dialect Region Depth & Coverage)
 * 4. الأختام العلمية (Merit Badges & Standing Points)
 * 5. الإثراء الدلالي والأصالة (Semantic Categories & Specialty)
 */
export function computeLexicalFootprint(
  person: PublicContributorRecord,
  badges: MeritBadge[] = [],
): LexicalFootprintData {
  const words = person.documented_words_count ?? person.accepted_count
  const attestations = person.documented_examples_count ?? person.attestations_count
  const sprintCount = person.sprint_participations_count ?? 0

  // 1. Vocabulary Score (0 - 100, maxing around 30 words)
  const vocabScore = Math.min(100, Math.max(12, Math.round((words / 30) * 100)))

  // 2. Attestation & Field Review Score (0 - 100, maxing around 50 attestations)
  const attestationScore = Math.min(100, Math.max(15, Math.round((attestations / 50) * 100)))

  // 3. Geographic Depth (Has specific region, recent words, regional specialist badge)
  const hasRegion = Boolean(person.dialect_region && person.dialect_region !== 'مشترك عام')
  const hasRegionalBadge = badges.some((b) => b.id === 'regional_specialist')
  const geoScore = hasRegionalBadge ? 95 : hasRegion ? 70 : 35

  // 4. Badges & Scientific Seals Score (0 - 100, maxing around 6 badges)
  const sealsScore = Math.min(100, Math.max(10, Math.round((badges.length / 6) * 100)))

  // 5. Semantic Specialty & Research Breadth (Has specialty, sprints, category badge)
  const hasSpecialty = Boolean(person.specialty && person.specialty.trim().length > 10)
  const hasCategoryBadge = badges.some((b) => b.id === 'category_expert' || b.id === 'active_corrector')
  let semanticScore = 30
  if (hasSpecialty) semanticScore += 30
  if (hasCategoryBadge) semanticScore += 25
  if (sprintCount > 0) semanticScore += 15
  semanticScore = Math.min(100, semanticScore)

  const metrics: RadarMetric[] = [
    {
      key: 'vocabulary',
      label: 'توثيق المفردات',
      shortLabel: 'المفردات',
      value: vocabScore,
      rawValue: words,
      unit: 'مفردة',
      hint: `${words} مفردة موثقة في المعجم`,
    },
    {
      key: 'attestation',
      label: 'التحكيم الميداني',
      shortLabel: 'الشواهد',
      value: attestationScore,
      rawValue: attestations,
      unit: 'شاهد',
      hint: `${attestations} تدقيق وتصديق سياقي`,
    },
    {
      key: 'geography',
      label: 'العمق الجهوي',
      shortLabel: 'اللهجات',
      value: geoScore,
      rawValue: hasRegion ? 1 : 0,
      unit: hasRegion ? (person.dialect_region || 'محدد') : 'عام',
      hint: person.dialect_region || 'مشترك عام',
    },
    {
      key: 'seals',
      label: 'الأختام العلمية',
      shortLabel: 'الأوسمة',
      value: sealsScore,
      rawValue: badges.length,
      unit: 'أختام',
      hint: `${badges.length} وسام استحقاق مكتسب`,
    },
    {
      key: 'semantics',
      label: 'التخصص الدلالي',
      shortLabel: 'الدلالة',
      value: semanticScore,
      rawValue: sprintCount,
      unit: 'مجال',
      hint: person.specialty || 'توثيق وتدقيق لغوي عام',
    },
  ]

  // Average balance score
  const avg = Math.round(metrics.reduce((acc, m) => acc + m.value, 0) / metrics.length)

  // Specialty classification based on dominant axis
  let dominant = metrics[0]
  for (const m of metrics) {
    if (m.value > dominant.value) dominant = m
  }

  let specializationTitle = 'باحث معجمي متوازن'
  if (dominant.key === 'vocabulary') specializationTitle = 'جامع المتن والألفاظ'
  else if (dominant.key === 'attestation') specializationTitle = 'مدقق الشواهد الميدانية'
  else if (dominant.key === 'geography') specializationTitle = 'خبير الأطلس اللهجي'
  else if (dominant.key === 'seals') specializationTitle = 'حامل الأختام المعجمية'
  else if (dominant.key === 'semantics') specializationTitle = 'متخصص الحقول الدلالية'

  return {
    metrics,
    balanceScore: avg,
    specializationTitle,
  }
}

interface LexicalFootprintRadarProps {
  person: PublicContributorRecord
  badges?: MeritBadge[]
  size?: number
  className?: string
}

/**
 * Interactive 5-Axis Moroccan Lexical Footprint Radar (مخطط البصمة المعجمية).
 * Rendered using SVG geometric polygon with Moroccan star-inspired coordinate grid.
 */
export function LexicalFootprintRadar({
  person,
  badges = [],
  size = 240,
  className = '',
}: LexicalFootprintRadarProps) {
  const footprint = useMemo(() => computeLexicalFootprint(person, badges), [person, badges])

  const center = size / 2
  const maxRadius = size * 0.38
  const angleStep = (Math.PI * 2) / footprint.metrics.length
  // Start from top (-PI / 2)
  const startAngle = -Math.PI / 2

  // Compute vertices for polygon
  const polygonPoints = footprint.metrics
    .map((m, idx) => {
      const angle = startAngle + idx * angleStep
      const r = (m.value / 100) * maxRadius
      const x = center + r * Math.cos(angle)
      const y = center + r * Math.sin(angle)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  // Grid concentric rings (25%, 50%, 75%, 100%)
  const gridRings = [0.35, 0.65, 1.0]

  return (
    <div className={`flex flex-col items-center rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 sm:p-5 dark:border-white/10 dark:bg-[#07070A] ${className}`}>
      <div className="flex w-full items-center justify-between border-b border-zinc-200/80 pb-3 dark:border-white/10">
        <div>
          <span className="text-xs font-bold text-zinc-950 dark:text-white">
            مخطط البصمة المعجمية (Lexical Footprint)
          </span>
          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            تحليل التوازن العلمي بين التوثيق، الشواهد، اللهجات، والأوسمة
          </p>
        </div>
        <div className="text-end">
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-mono text-[10.5px] font-bold text-emerald-800 dark:bg-[#D9FF43]/20 dark:text-[#D9FF43]">
            {footprint.specializationTitle}
          </span>
        </div>
      </div>

      <div className="relative my-3 flex items-center justify-center">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          fill="none"
          aria-label="مخطط البصمة المعجمية الشعاعي"
          className="overflow-visible"
        >
          {/* Background Concentric Moroccan Radar Grids */}
          {gridRings.map((scale, i) => {
            const r = maxRadius * scale
            const ringPoints = footprint.metrics
              .map((_, idx) => {
                const angle = startAngle + idx * angleStep
                const x = center + r * Math.cos(angle)
                const y = center + r * Math.sin(angle)
                return `${x.toFixed(1)},${y.toFixed(1)}`
              })
              .join(' ')

            return (
              <polygon
                key={i}
                points={ringPoints}
                stroke="currentColor"
                strokeWidth="1"
                className="text-zinc-300 dark:text-white/15"
                fill="none"
              />
            )
          })}

          {/* Radial Spokes */}
          {footprint.metrics.map((_, idx) => {
            const angle = startAngle + idx * angleStep
            const x = center + maxRadius * Math.cos(angle)
            const y = center + maxRadius * Math.sin(angle)

            return (
              <line
                key={idx}
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                stroke="currentColor"
                strokeWidth="1"
                className="text-zinc-300 dark:text-white/15"
                strokeDasharray="2 2"
              />
            )
          })}

          {/* The Data Polygon Area */}
          <polygon
            points={polygonPoints}
            fill="currentColor"
            fillOpacity="0.25"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            className="text-emerald-600 transition-all duration-300 dark:text-[#D9FF43]"
          />

          {/* Data Points Studs */}
          {footprint.metrics.map((m, idx) => {
            const angle = startAngle + idx * angleStep
            const r = (m.value / 100) * maxRadius
            const x = center + r * Math.cos(angle)
            const y = center + r * Math.sin(angle)

            return (
              <g key={m.key}>
                <circle
                  cx={x}
                  cy={y}
                  r="3.5"
                  className="fill-white stroke-emerald-600 dark:fill-[#0B0B10] dark:stroke-[#D9FF43]"
                  strokeWidth="2"
                />
              </g>
            )
          })}

          {/* Axis Labels */}
          {footprint.metrics.map((m, idx) => {
            const angle = startAngle + idx * angleStep
            const labelRadius = maxRadius + 22
            const x = center + labelRadius * Math.cos(angle)
            const y = center + labelRadius * Math.sin(angle)

            return (
              <text
                key={m.key}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-zinc-700 text-[10.5px] font-bold dark:fill-zinc-300"
              >
                {m.shortLabel}
              </text>
            )
          })}
        </svg>
      </div>

      {/* Axis Breakdown Badges */}
      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-5 text-center">
        {footprint.metrics.map((m) => (
          <div
            key={m.key}
            className="rounded-xl border border-zinc-200/80 bg-white p-2 dark:border-white/10 dark:bg-[#0B0B10]"
          >
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{m.label}</p>
            <p className="font-mono text-xs font-bold text-zinc-950 dark:text-white">
              {m.value}%
            </p>
            <p className="truncate text-[9.5px] text-zinc-400 dark:text-zinc-500" title={m.hint}>
              {m.hint}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
