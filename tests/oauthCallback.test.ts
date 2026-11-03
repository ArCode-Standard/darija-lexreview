import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('OAuth callback security contract', () => {
  const html = readFile('public/auth/callback/index.html')
  const script = readFile('public/auth/callback/callback.js')
  const headers = readFile('public/_headers')
  const authDialog = readFile('src/components/AuthDialog.tsx')

  it('loads callback behavior from a same-origin external script', () => {
    expect(html).toContain('<script src="/auth/callback/callback.js" defer></script>')
    expect(html).not.toContain('<script>')
    expect(headers).toContain("script-src 'self'")
    expect(headers).not.toContain("'unsafe-inline'")
  })

  it('never posts authorization material to an opener or wildcard origin', () => {
    expect(script).not.toContain('postMessage')
    expect(script).not.toContain('window.opener')
    expect(script).not.toContain("'*'")
    expect(script).toContain("window.location.replace('/' + callbackData)")
  })

  it('uses the stored theme and returns to the same-origin app root', () => {
    expect(script).toContain("'arcode_lexreview_theme'")
    expect(script).toContain("savedTheme === 'light' ? 'light' : 'dark'")
    expect(html).toContain('/auth/callback/callback.css')
  })

  it('routes OAuth through the callback and keeps Google disabled by default', () => {
    expect(authDialog).toContain("VITE_SUPABASE_GOOGLE_ENABLED === 'true'")
    expect(authDialog.split('/auth/callback').length - 1).toBeGreaterThanOrEqual(2)
    expect(authDialog).toContain("provider === 'google' && !GOOGLE_AUTH_ENABLED")
    expect(authDialog).toContain('!GOOGLE_AUTH_ENABLED || busy')
  })
})
