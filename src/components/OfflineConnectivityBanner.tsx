import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

interface OfflineConnectivityBannerProps {
  draftsCount?: number
}

export function OfflineConnectivityBanner({ draftsCount = 0 }: OfflineConnectivityBannerProps) {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 start-4 z-40 max-w-sm rounded-2xl border border-amber-400/60 bg-white/95 px-4 py-3 text-xs text-zinc-900 shadow-xl backdrop-blur-md dark:border-[#D9FF43]/45 dark:bg-[#0B0B10]/95 dark:text-zinc-100"
    >
      <div className="flex items-start gap-2.5">
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-[#D9FF43]" aria-hidden="true" />
        <div className="space-y-0.5">
          <p className="font-bold text-zinc-950 dark:text-white">
            الوضع الميداني دون اتصال مفعّل
          </p>
          <p className="text-[11px] leading-5 text-zinc-600 dark:text-zinc-400">
            تعمل المنصة بالنسخة المحفوظة محلياً؛ تُحفظ مسوداتك وتصديقاتك على جهازك بأمان
            {draftsCount > 0 ? ` (${draftsCount} مسودة محفوظة)` : ''} لمزامنتها فور عودة الشبكة.
          </p>
        </div>
      </div>
    </div>
  )
}
