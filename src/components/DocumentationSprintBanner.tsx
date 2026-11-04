import { ArrowLeft, Award, Flag, Users } from 'lucide-react'
import type { ComputedSprintProgress } from '../hooks/useDocumentationSprints'

interface DocumentationSprintBannerProps {
  sprintProgress: ComputedSprintProgress | null
  isAuthenticated: boolean
  isStaffRole?: boolean
  compact?: boolean
  onJoinSprint: (sprintProgress: ComputedSprintProgress) => void
  onOpenManageSprints?: () => void
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  missing_examples: 'إغناء الشواهد السياقية المفقودة',
  region: 'تغطية جغرافية جهوية',
  category: 'حقل دلالي متخصص',
  entry_type: 'توثيق الأمثال والتعابير',
  etymology: 'تأصيل تاريخي وجذور لغوية',
}

export function DocumentationSprintBanner({
  sprintProgress,
  isAuthenticated,
  isStaffRole = false,
  compact = false,
  onJoinSprint,
  onOpenManageSprints,
}: DocumentationSprintBannerProps) {
  if (!sprintProgress) return null

  const {
    sprint,
    currentCount,
    goalCount,
    progressPercent,
    remainingDays,
    myContributionsCount,
    matchingEntriesCount,
  } = sprintProgress

  const scopeLabel = sprint.target_value
    ? `${TARGET_TYPE_LABELS[sprint.target_type] ?? 'حملة توثيق'}: ${sprint.target_value}`
    : TARGET_TYPE_LABELS[sprint.target_type] ?? 'حملة توثيق جماعية'

  return (
    <section
      aria-labelledby={`sprint-heading-${sprint.id}`}
      className={
        compact
          ? 'rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 dark:border-white/12 dark:bg-[#0B0B10]'
          : 'mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 pt-6 pb-2'
      }
    >
      <div
        className={
          compact
            ? 'space-y-4'
            : 'rounded-2xl border border-zinc-200 bg-white p-6 sm:p-7 dark:border-white/12 dark:bg-[#0B0B10] space-y-5'
        }
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-[#D9FF43]">
                <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                <span>حملة توثيق موجهة نشطة</span>
              </span>
              <span aria-hidden="true">·</span>
              <span>{scopeLabel}</span>
              {remainingDays !== null && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {remainingDays > 0
                      ? `متبقٍ ${remainingDays.toLocaleString('en-US')} يوم`
                      : 'تُختتم اليوم'}
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>
                وسام المشاركة:{' '}
                <strong className="font-semibold text-zinc-900 dark:text-zinc-200">
                  {sprint.badge_label}
                </strong>
              </span>
            </div>

            <h2
              id={`sprint-heading-${sprint.id}`}
              className="font-display text-lg sm:text-xl font-bold tracking-tight text-zinc-950 dark:text-white"
            >
              {sprint.title}
            </h2>

            <p className="text-xs sm:text-sm leading-7 text-zinc-600 dark:text-zinc-400">
              {sprint.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {isStaffRole && onOpenManageSprints && (
              <button
                type="button"
                onClick={onOpenManageSprints}
                className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-zinc-300 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-800 hover:border-zinc-950 transition-colors cursor-pointer dark:border-white/15 dark:bg-[#07070A] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60"
              >
                إدارة الحملات
              </button>
            )}

            <button
              type="button"
              onClick={() => onJoinSprint(sprintProgress)}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-zinc-950 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition-colors cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
            >
              <span>شارك في توثيق مفردات الحملة</span>
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Live Collective Progress Bar */}
        <div className="pt-2 border-t border-zinc-100 dark:border-white/8 space-y-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <Users className="h-3.5 w-3.5 text-emerald-700 dark:text-[#D9FF43]" aria-hidden="true" />
              <span>
                التقدم الجماعي:{' '}
                <strong className="font-mono text-sm font-bold tabular-nums text-zinc-950 dark:text-white">
                  {currentCount.toLocaleString('en-US')} / {goalCount.toLocaleString('en-US')}
                </strong>{' '}
                شاهد وتصديق موثق
              </span>
              {matchingEntriesCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    المداخل المشمولة:{' '}
                    <span className="font-mono tabular-nums">
                      {matchingEntriesCount.toLocaleString('en-US')}
                    </span>
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              {isAuthenticated && myContributionsCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-[#D9FF43]">
                  <Award className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    ساهمتَ بـ {myContributionsCount.toLocaleString('en-US')} توثيق في هذه الحملة
                  </span>
                </span>
              )}
              <span className="font-mono text-sm font-bold tabular-nums text-emerald-700 dark:text-[#D9FF43]">
                {progressPercent}%
              </span>
            </div>
          </div>

          <div
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`نسبة إنجاز ${sprint.title}`}
            className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10"
          >
            <div
              className="h-full rounded-full bg-emerald-600 transition-all duration-300 dark:bg-[#D9FF43]"
              style={{ width: `${Math.max(4, progressPercent)}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
