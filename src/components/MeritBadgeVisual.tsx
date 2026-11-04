import {
  type MeritBadge,
  type MeritBadgeIconKey,
  type MeritBadgeTier,
  type MeritBadgeTone,
  getBadgeClasses,
  getTierPillClasses,
} from '../utils/meritBadges'

/**
 * Inner bespoke geometric artwork tailored exclusively for ArCode Moroccan Darija Lexicon.
 * Drawn inside a 40x40 coordinate system centered at (20, 20).
 */
function renderInnerSealGlyph(icon: MeritBadgeIconKey) {
  switch (icon) {
    case 'diwan_seal':
      // Andalusian Horseshoe Arch & Sovereign Keystone
      return (
        <g stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M13.5 27.5V20.8C13.5 16.5 16.4 13.4 20 13.4C23.6 13.4 26.5 16.5 26.5 20.8V27.5" />
          <path d="M16.2 27.5V21.2C16.2 18.7 17.9 16.8 20 16.8C22.1 16.8 23.8 18.7 23.8 21.2V27.5" />
          <line x1="11.5" y1="27.5" x2="28.5" y2="27.5" />
          <path d="M20 10.6L21.3 12.2L20 13.8L18.7 12.2Z" fill="currentColor" stroke="none" />
        </g>
      )

    case 'maghrebi_qalam':
      // Maghrebi Calligraphic Reed Pen Nib (القلم المغربي المبسوط) + Precision Crossbar
      return (
        <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M20 11.5L25.6 19.2L23.2 27.8H16.8L14.4 19.2L20 11.5Z" />
          <line x1="20" y1="11.8" x2="20" y2="20.4" />
          <circle cx="20" cy="21.6" r="1.45" fill="currentColor" stroke="none" />
          <line x1="15.2" y1="25.2" x2="24.8" y2="25.2" />
        </g>
      )

    case 'thuraya_crown':
      // Moroccan Thuraya Crown & Sovereign Star
      return (
        <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M12.6 25.2L14.2 16.4L18.1 20.3L20 13.2L21.9 20.3L25.8 16.4L27.4 25.2H12.6Z" />
          <line x1="13" y1="27.6" x2="27" y2="27.6" />
          <circle cx="20" cy="11.4" r="1.15" fill="currentColor" stroke="none" />
        </g>
      )

    case 'marrakech_astrolabe':
      // Marrakech Brass Astrolabe Rete & Alidade Sight Rule (الأسطرلاب المراكشي)
      return (
        <g stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <circle cx="20" cy="20.8" r="7.2" />
          <path d="M15.2 18.2C16.6 20.1 18.2 21 20 21C21.8 21 23.4 20.1 24.8 18.2" />
          <line x1="14.4" y1="25.4" x2="25.6" y2="16.2" />
          <circle cx="20" cy="20.8" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="20" cy="12" r="1.4" />
        </g>
      )

    case 'zellij_taxonomy':
      // Interlocking 4-Fold Moroccan Zellij Rosette (فسيفساء الحقول الدلالية)
      return (
        <g stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M20 12L23.2 16.8L28 20L23.2 23.2L20 28L16.8 23.2L12 20L16.8 16.8Z" />
          <rect x="16.8" y="16.8" width="6.4" height="6.4" rx="0.8" />
          <circle cx="20" cy="20" r="1.2" fill="currentColor" stroke="none" />
        </g>
      )

    case 'atlas_compass':
      // Moroccan Compass Rose & Twin Atlas Peaks (بوصلة الأطلس اللهجي)
      return (
        <g stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M20 11.6L22.1 17.9L28.4 20L22.1 22.1L20 28.4L17.9 22.1L11.6 20L17.9 17.9Z" />
          <circle cx="20" cy="20" r="2.1" />
        </g>
      )

    case 'sprint_standard':
      // Heraldic Expedition Banner & Star (لواء النفير المعجمي)
      return (
        <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <line x1="14.5" y1="11.8" x2="14.5" y2="28.4" />
          <path d="M14.5 13H26.4L23.8 17.4L26.4 21.8H14.5" />
          <circle cx="19.6" cy="17.4" r="1.35" fill="currentColor" stroke="none" />
        </g>
      )

    case 'atlas_cedar':
      // Founding Moroccan Atlas Cedar Emblem (غرسة الرعيل المؤسس)
      return (
        <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M20 12.2L24.8 17.4H15.2L20 12.2Z" />
          <path d="M20 16.2L26.4 22.2H13.6L20 16.2Z" />
          <line x1="20" y1="22.2" x2="20" y2="27.4" />
          <line x1="15.5" y1="27.4" x2="24.5" y2="27.4" />
        </g>
      )

    case 'shadda_loupe':
      // Arabic Shadda Calligraphic Diacritic inside Precision Optical Ring (عدسة الضبط والتصويب)
      return (
        <g stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <circle cx="19.2" cy="19.2" r="6.4" />
          <path d="M16.2 18.6C16.2 20.3 17.6 20.8 18.6 19.3C19.1 18.5 19.2 17.7 19.2 17.5C19.2 17.7 19.4 18.5 19.9 19.3C20.8 20.8 22.2 20.3 22.2 18.6" />
          <line x1="23.9" y1="23.9" x2="27.6" y2="27.6" />
        </g>
      )

    case 'corpus_stamp':
      // Open Arabic Lexicon Codex & Verification Star (طابع الاعتماد المعجمي)
      return (
        <g stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M20 16.2C18.2 14.9 15.6 14.6 12.8 15.2V25.8C15.6 25.2 18.2 25.5 20 26.8C21.8 25.5 24.4 25.2 27.2 25.8V15.2C24.4 14.6 21.8 14.9 20 16.2Z" />
          <line x1="20" y1="16.2" x2="20" y2="26.6" />
          <path d="M20 11.4L21.1 13.1L20 14.4L18.9 13.1Z" fill="currentColor" stroke="none" />
        </g>
      )

    case 'open_lineage':
    default:
      // Open-Source Lineage Nodes (عقدة النَّسَب المفتوح)
      return (
        <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <circle cx="15.2" cy="15.5" r="2.1" />
          <circle cx="24.8" cy="15.5" r="2.1" />
          <circle cx="20" cy="25.2" r="2.3" />
          <path d="M16.6 17.2L19.1 23.1" />
          <path d="M23.4 17.2L20.9 23.1" />
        </g>
      )
  }
}

function getSealFrameColors(tone: MeritBadgeTone, tier: MeritBadgeTier): string {
  if (tier === 'sovereign' || tone === 'gold') {
    return 'text-amber-800 dark:text-[#D9FF43]'
  }
  switch (tone) {
    case 'lime':
      return 'text-emerald-800 dark:text-[#D9FF43]'
    case 'emerald':
      return 'text-emerald-800 dark:text-emerald-300'
    case 'sky':
      return 'text-sky-800 dark:text-sky-300'
    case 'amber':
      return 'text-amber-800 dark:text-amber-300'
    default:
      return 'text-zinc-700 dark:text-zinc-200'
  }
}

/**
 * Full 8-pointed Moroccan Zellij Khatam Medallion SVG (خاتم الزليج الثماني المغربي).
 * Renders outer interlocking rotated squares + inner coin ring + bespoke glyph.
 */
export function MeritSealMedallion({
  icon,
  tone = 'emerald',
  tier = 'distinguished',
  size = 44,
  className = '',
}: {
  icon: MeritBadgeIconKey
  tone?: MeritBadgeTone
  tier?: MeritBadgeTier
  size?: number
  className?: string
}) {
  const colorClass = getSealFrameColors(tone, tier)
  const isSovereign = tier === 'sovereign'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${colorClass} ${className}`}
    >
      {/* Moroccan 8-pointed Khatam Star: Square A + Square B rotated 45 deg */}
      <rect
        x="6.5"
        y="6.5"
        width="27"
        height="27"
        rx="2.5"
        fill="currentColor"
        fillOpacity={isSovereign ? '0.13' : '0.08'}
        stroke="currentColor"
        strokeWidth={isSovereign ? '1.45' : '1.25'}
      />
      <rect
        x="6.5"
        y="6.5"
        width="27"
        height="27"
        rx="2.5"
        transform="rotate(45 20 20)"
        fill="currentColor"
        fillOpacity={isSovereign ? '0.10' : '0.06'}
        stroke="currentColor"
        strokeWidth={isSovereign ? '1.45' : '1.25'}
      />

      {/* Inner Engraved Medallion Ring */}
      <circle
        cx="20"
        cy="20"
        r="11.2"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="0.9"
      />

      {/* Sovereign Cardinal Studs for highest-rank seals */}
      {isSovereign && (
        <g fill="currentColor" fillOpacity="0.75">
          <circle cx="20" cy="4.2" r="0.9" />
          <circle cx="20" cy="35.8" r="0.9" />
          <circle cx="4.2" cy="20" r="0.9" />
          <circle cx="35.8" cy="20" r="0.9" />
        </g>
      )}

      {/* Exclusive Platform Glyph */}
      {renderInnerSealGlyph(icon)}
    </svg>
  )
}

export function MeritBadgeEmblemIcon({
  icon,
  className = 'h-4 w-4',
}: {
  icon: MeritBadgeIconKey
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <rect
        x="6.5"
        y="6.5"
        width="27"
        height="27"
        rx="3"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="1.5"
      />
      <rect
        x="6.5"
        y="6.5"
        width="27"
        height="27"
        rx="3"
        transform="rotate(45 20 20)"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="1.5"
      />
      {renderInnerSealGlyph(icon)}
    </svg>
  )
}

interface MeritBadgeChipProps {
  badge: MeritBadge
  size?: 'sm' | 'md'
  showSealName?: boolean
  onClick?: (badge: MeritBadge) => void
}

export function MeritBadgeChip({
  badge,
  size = 'sm',
  showSealName = false,
  onClick,
}: MeritBadgeChipProps) {
  const toneClasses = getBadgeClasses(badge.tone)
  const sizeClasses =
    size === 'md'
      ? 'gap-1.5 rounded-xl px-2.5 py-1 text-xs'
      : 'gap-1.5 rounded-lg px-2 py-0.5 text-[11px]'

  const innerContent = (
    <>
      <MeritBadgeEmblemIcon
        icon={badge.icon}
        className={size === 'md' ? 'h-4 w-4 shrink-0' : 'h-3.5 w-3.5 shrink-0'}
      />
      <span>
        {showSealName ? `${badge.sealName} · ${badge.label}` : badge.label}
      </span>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClick(badge)
        }}
        title={`انقر لعرض معايير والهدف من وسام: ${badge.sealName} (${badge.label})`}
        aria-label={`عرض تفاصيل ومعايير وسام ${badge.sealName} (${badge.label})`}
        className={`inline-flex items-center border font-semibold transition-colors cursor-pointer hover:border-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:hover:border-[#D9FF43]/75 dark:focus-visible:outline-[#D9FF43] ${sizeClasses} ${toneClasses}`}
      >
        {innerContent}
      </button>
    )
  }

  return (
    <span
      title={`${badge.sealName} (${badge.label}) — ${badge.description}`}
      className={`inline-flex items-center border font-semibold transition-colors ${sizeClasses} ${toneClasses}`}
    >
      {innerContent}
    </span>
  )
}

interface MeritBadgeMedallionCardProps {
  badge: MeritBadge
  scarcityLabel?: string
  onClick?: (badge: MeritBadge) => void
}

export function MeritBadgeMedallionCard({
  badge,
  scarcityLabel,
  onClick,
}: MeritBadgeMedallionCardProps) {
  const tierTextClass = getTierPillClasses(badge.tier)
  const isSovereign = badge.tier === 'sovereign'

  const baseSurfaceClasses = isSovereign
    ? 'border-amber-300/80 bg-amber-50/35 dark:border-[#D9FF43]/35 dark:bg-[#0D0F07]'
    : 'border-zinc-200/90 bg-zinc-50/70 dark:border-white/10 dark:bg-[#07070A]'

  const cardBody = (
    <>
      <div className="mt-0.5 shrink-0">
        <MeritSealMedallion
          icon={badge.icon}
          tone={badge.tone}
          tier={badge.tier}
          size={48}
        />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
          <span className={`font-bold ${tierTextClass}`}>{badge.tierLabel}</span>
          <span className="font-mono text-zinc-400 dark:text-zinc-500">
            {scarcityLabel ? `${scarcityLabel} · ${badge.code}` : badge.code}
          </span>
        </div>

        <div className="flex flex-wrap items-baseline gap-1.5">
          <p className="font-display text-xs sm:text-sm font-bold text-zinc-950 dark:text-white">
            {badge.sealName}
          </p>
          <span aria-hidden="true" className="text-xs text-zinc-400">
            ·
          </span>
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            {badge.label}
          </span>
        </div>

        <p className="text-[11px] leading-5 text-zinc-600 dark:text-zinc-400">
          {badge.description}
        </p>

        <p className="pt-0.5 text-[10.5px] leading-4 font-medium text-emerald-800/90 dark:text-zinc-300">
          القيمة العلمية: {badge.valueStatement}
        </p>

        {onClick && (
          <p className="pt-1 text-[10.5px] font-semibold text-emerald-700 group-hover/medallion:underline dark:text-[#D9FF43]">
            عرض معايير الاستحقاق والهدف ←
          </p>
        )}
      </div>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClick(badge)
        }}
        aria-label={`عرض معايير والهدف من وسام ${badge.sealName} (${badge.label})`}
        className={`group/medallion flex w-full items-start gap-3.5 rounded-2xl border p-3.5 text-start transition-colors cursor-pointer hover:border-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:hover:border-[#D9FF43]/70 dark:focus-visible:outline-[#D9FF43] ${baseSurfaceClasses}`}
      >
        {cardBody}
      </button>
    )
  }

  return (
    <div
      className={`flex items-start gap-3.5 rounded-2xl border p-3.5 transition-colors ${baseSurfaceClasses}`}
    >
      {cardBody}
    </div>
  )
}
