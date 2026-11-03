import { useState } from 'react'
import { Download, Share, Smartphone, X } from 'lucide-react'
import { usePWAInstall } from '../hooks/usePWAInstall'

interface PWAInstallButtonProps {
  variant?: 'compact' | 'sidebar'
}

export function PWAInstallButton({ variant = 'compact' }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall()
  const [showIOSGuide, setShowIOSGuide] = useState(false)

  if (isInstalled) {
    return null
  }

  if (!isInstallable && !isIOS) {
    return null
  }

  const buttonClass =
    variant === 'sidebar'
      ? 'flex w-full items-center justify-between gap-2 rounded-xl border border-emerald-500/35 bg-emerald-50/70 px-3 py-2 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100/70 transition-colors cursor-pointer dark:border-[#D9FF43]/35 dark:bg-[#D9FF43]/10 dark:text-[#D9FF43] dark:hover:bg-[#D9FF43]/18'
      : 'inline-flex h-9 w-9 2xl:w-auto items-center justify-center gap-1.5 rounded-full border border-zinc-200 bg-white 2xl:px-3.5 text-xs font-semibold text-zinc-800 hover:border-zinc-400 hover:text-zinc-950 shrink-0 whitespace-nowrap transition-colors cursor-pointer dark:border-white/15 dark:bg-[#0C0C10] dark:text-zinc-200 dark:hover:border-[#D9FF43]/60 dark:hover:text-[#D9FF43]'

  return (
    <>
      <button
        type="button"
        title="تثبيت المنصة كتطبيق مستقل (PWA)"
        aria-label="تثبيت المنصة كتطبيق"
        onClick={() => {
          if (isInstallable) {
            void install()
          } else if (isIOS) {
            setShowIOSGuide(true)
          }
        }}
        className={buttonClass}
      >
        <span className="flex items-center gap-1.5">
          {isIOS ? (
            <Smartphone className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-[#D9FF43]" />
          ) : (
            <Download className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-[#D9FF43]" />
          )}
          <span className={variant === 'sidebar' ? '' : 'hidden 2xl:inline'}>
            {variant === 'sidebar' ? 'تثبيت المنصة كتطبيق (PWA)' : 'تثبيت التطبيق'}
          </span>
        </span>
      </button>

      {showIOSGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="تثبيت المنصة على iPhone أو iPad"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowIOSGuide(false)
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-white/15 dark:bg-[#0B0B10]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-emerald-700 dark:text-[#D9FF43]">
                  INSTALL PWA · iOS SAFARI
                </p>
                <h3 className="mt-1 font-display text-lg font-bold text-zinc-950 dark:text-white">
                  تثبيت Darija LexReview على جهازك
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                aria-label="إغلاق"
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ol className="mt-4 space-y-3 text-xs leading-6 text-zinc-700 dark:text-zinc-300">
              <li className="flex items-start gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-[#07070A]">
                <Share className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-[#D9FF43]" />
                <span>
                  1. اضغط على زر <strong>المشاركة (Share)</strong> في شريط متصفح Safari.
                </span>
              </li>
              <li className="flex items-start gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-[#07070A]">
                <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-[#D9FF43]" />
                <span>
                  2. مرّر لأسفل واختر <strong>الإضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong> لتعمل المنصة كتطبيق مستقل حتى دون اتصال.
                </span>
              </li>
            </ol>

            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full min-h-[42px] rounded-full bg-zinc-950 py-2 text-xs font-bold text-white hover:bg-zinc-800 cursor-pointer dark:bg-[#D9FF43] dark:text-[#050507] dark:hover:bg-[#e5ff73]"
            >
              حسناً، فهمت
            </button>
          </div>
        </div>
      )}
    </>
  )
}
