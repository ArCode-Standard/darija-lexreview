export function isWebPushSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export async function requestWebPushPermission(): Promise<NotificationPermission> {
  if (!isWebPushSupported()) return 'denied'
  try {
    const permission = await Notification.requestPermission()
    return permission
  } catch {
    return 'denied'
  }
}

export function getWebPushCurrentPermission(): NotificationPermission {
  if (!isWebPushSupported()) return 'denied'
  return Notification.permission
}

export function sendLocalWebPushNotification(title: string, options?: NotificationOptions): boolean {
  if (!isWebPushSupported() || Notification.permission !== 'granted') return false
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      void navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          dir: 'rtl',
          lang: 'ar',
          ...options,
        })
      })
    } else {
      new Notification(title, {
        icon: '/favicon.ico',
        dir: 'rtl',
        ...options,
      })
    }
    return true
  } catch {
    return false
  }
}
