import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '../lib/supabase'

export type AvatarSource = 'upload' | 'github' | 'dicebear' | 'arcode'

interface AvatarProps {
  source?: AvatarSource | null
  path?: string | null
  seed?: string | null
  githubHandle?: string | null
  displayName?: string | null
  size?: number
  className?: string
}

const PALETTES = [
  { shell: '#D9FF43', face: '#101014', detail: '#00C896' },
  { shell: '#8BE1D2', face: '#102B35', detail: '#F6C85F' },
  { shell: '#B9A6FF', face: '#211A3B', detail: '#FF8C9D' },
  { shell: '#FFB879', face: '#3B2418', detail: '#83D7FF' },
  { shell: '#8BC5FF', face: '#14243A', detail: '#D9FF43' },
  { shell: '#F2A6D8', face: '#351D32', detail: '#A8E6CF' },
]

function ArCodeAvatarMark({ seed, size }: { seed: string; size: number }) {
  const palette = PALETTES[[...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % PALETTES.length]
  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      role="img"
      aria-label="شخصية ArCode"
      className="block shrink-0"
    >
      <rect width="96" height="96" rx="28" fill={palette.shell} />
      <path d="M18 31 25 17l12 9M78 31 71 17 59 26" fill="none" stroke={palette.face} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="19" y="25" width="58" height="54" rx="20" fill={palette.face} />
      <rect x="27" y="35" width="42" height="27" rx="11" fill={palette.shell} />
      <circle cx="39" cy="48" r="4" fill={palette.face} />
      <circle cx="57" cy="48" r="4" fill={palette.face} />
      <path d="M40 57q8 7 16 0" fill="none" stroke={palette.detail} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M48 25V15" stroke={palette.face} strokeWidth="4" strokeLinecap="round" />
      <circle cx="48" cy="12" r="5" fill={palette.detail} />
      <path d="M34 79v6m28-6v6" stroke={palette.face} strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}

export function Avatar({
  source = 'arcode',
  path,
  seed,
  githubHandle,
  displayName,
  size = 44,
  className = '',
}: AvatarProps) {
  const stableSeed = seed || githubHandle || displayName || 'Darija-LexReview'
  const [failed, setFailed] = useState(false)

  const imageUrl = useMemo(() => {
    if (source === 'upload' && path && supabase) {
      return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
    }
    if (source === 'github' && githubHandle) {
      return `https://github.com/${encodeURIComponent(githubHandle.replace(/^@/, ''))}.png?size=${Math.max(48, size * 2)}`
    }
    if (source === 'dicebear') {
      return `https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${encodeURIComponent(stableSeed)}`
    }
    return null
  }, [source, path, githubHandle, size, stableSeed])

  useEffect(() => setFailed(false), [imageUrl])

  const style: CSSProperties = { width: size, height: size }
  if (!imageUrl || failed || (source === 'upload' && !path)) {
    return (
      <span className={`inline-flex shrink-0 overflow-hidden rounded-full ${className}`} style={style}>
        <ArCodeAvatarMark seed={stableSeed} size={size} />
      </span>
    )
  }

  return (
    <img
      src={imageUrl}
      alt={displayName ? `صورة ${displayName}` : 'الصورة الشخصية'}
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full object-cover ${className}`}
      style={style}
    />
  )
}
