import type { UserIdentity } from '@supabase/supabase-js'

/** Returns the verified public GitHub login supplied by the linked OAuth identity. */
export function getGitHubLogin(identity: UserIdentity | undefined): string | null {
  if (!identity || identity.provider !== 'github') return null
  const data = identity.identity_data as Record<string, unknown> | null
  const candidates = [data?.user_name, data?.login, data?.preferred_username]
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const login = candidate.trim().replace(/^@/, '')
      if (login) return login
    }
  }
  return null
}
