import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: {
        sitekey: string
        callback: (token: string) => void
        'expired-callback'?: () => void
        'error-callback'?: () => void
        theme?: 'light' | 'dark' | 'auto'
        language?: string
        action?: string
      }) => string
      remove: (widgetId: string) => void
    }
  }
}

interface TurnstileWidgetProps {
  siteKey: string
  onToken: (token: string | null) => void
}

const SCRIPT_ID = 'cloudflare-turnstile-api'

export function TurnstileWidget({ siteKey, onToken }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!siteKey || !containerRef.current) return

    let widgetId: string | null = null
    let cancelled = false

    const render = () => {
      if (cancelled || widgetId || !window.turnstile || !containerRef.current) return
      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action: 'signup',
        language: 'ar',
        theme: 'auto',
        callback: (token) => onToken(token),
        'expired-callback': () => onToken(null),
        'error-callback': () => onToken(null),
      })
    }

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    if (!script) {
      script = document.createElement('script')
      script.id = SCRIPT_ID
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }

    script.addEventListener('load', render)
    render()

    return () => {
      cancelled = true
      script?.removeEventListener('load', render)
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [siteKey, onToken])

  if (!siteKey) {
    return (
      <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">
        لم يتم إعداد مفتاح Turnstile العام بعد. أضف VITE_TURNSTILE_SITE_KEY إلى متغيرات بيئة Cloudflare Pages.
      </p>
    )
  }

  return <div ref={containerRef} className="flex min-h-[66px] justify-center" aria-label="التحقق الأمني" />
}
