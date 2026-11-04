export const THEME_STORAGE_KEY = 'arcode_lexreview_theme'

export type ThemeMode = 'light' | 'dark'

interface MinimalStorageRead {
  getItem(key: string): string | null
}

interface MinimalStorageWrite {
  setItem(key: string, value: string): void
}

export function getStoredThemePreference(
  storage?: MinimalStorageRead | null,
): ThemeMode | null {
  const target =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null

  if (!target) return null

  try {
    const saved = target.getItem(THEME_STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') {
      return saved
    }
  } catch {
    // Ignore storage access errors in restricted contexts
  }

  return null
}

export function getSystemThemePreference(
  matchMediaFn?: ((query: string) => { matches: boolean }) | null,
): ThemeMode {
  const matcher =
    matchMediaFn !== undefined
      ? matchMediaFn
      : typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia.bind(window)
        : null

  if (!matcher) return 'dark'

  try {
    if (matcher('(prefers-color-scheme: light)').matches) {
      return 'light'
    }
    if (matcher('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
  } catch {
    // Ignore matchMedia errors in non-browser environments
  }

  return 'dark'
}

export function resolveInitialTheme(options?: {
  storage?: MinimalStorageRead | null
  matchMedia?: ((query: string) => { matches: boolean }) | null
}): ThemeMode {
  const stored = getStoredThemePreference(options?.storage)
  if (stored) return stored
  return getSystemThemePreference(options?.matchMedia)
}

export function persistManualThemePreference(
  theme: ThemeMode,
  storage?: MinimalStorageWrite | null,
): void {
  const target =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null

  if (!target) return

  try {
    target.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Ignore storage write errors
  }
}
