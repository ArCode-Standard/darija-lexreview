import type { ExampleFilter, WorkbenchTab } from '../types/lexicon'

export type AppPage =
  | 'home'
  | 'review'
  | 'lexicon'
  | 'collections'
  | 'insights'
  | 'contributors'
  | 'contribute'
  | 'submissions'
  | 'messages'
  | 'profile'
  | 'editorial'
  | 'members'
  | 'export'
  | 'auth'
  | 'embed'

const VALID_TABS = new Set<WorkbenchTab>([
  'rapid_review',
  'explorer',
  'new_entry',
  'corpus',
  'submissions',
  'moderation',
  'exporter',
  'profile',
])

const VALID_EXAMPLE_FILTERS = new Set<ExampleFilter>([
  'all',
  'with_examples',
  'needs_examples',
  'priority_enrichment',
])

export interface WorkbenchUrlState {
  tab: WorkbenchTab
  explorerSubView: 'entries' | 'categories'
  entryId: string | null
  category: string
  exampleFilter: ExampleFilter
  query: string
}

export interface AppRouteState {
  page: AppPage
  explorerSubView: 'entries' | 'categories'
  entryId: string | null
  contributorSlug?: string
  collectionSlug?: string
  etymology?: string
  embedTheme?: 'light' | 'dark' | 'auto'
  embedCompact?: boolean
  category: string
  exampleFilter: ExampleFilter
  query: string
}

export function workbenchTabToPage(tab: WorkbenchTab): AppPage {
  switch (tab) {
    case 'rapid_review':
      return 'review'
    case 'explorer':
    case 'corpus':
      return 'lexicon'
    case 'new_entry':
      return 'contribute'
    case 'submissions':
      return 'submissions'
    case 'profile':
      return 'profile'
    case 'moderation':
      return 'editorial'
    case 'exporter':
      return 'export'
    default:
      return 'review'
  }
}

export function pageToWorkbenchTab(page: AppPage): WorkbenchTab {
  switch (page) {
    case 'review':
      return 'rapid_review'
    case 'lexicon':
    case 'collections':
    case 'insights':
    case 'embed':
      return 'explorer'
    case 'contribute':
      return 'new_entry'
    case 'submissions':
      return 'submissions'
    case 'profile':
    case 'messages':
    case 'contributors':
      return 'profile'
    case 'editorial':
    case 'members':
      return 'moderation'
    case 'export':
      return 'exporter'
    default:
      return 'rapid_review'
  }
}

export function parseWorkbenchUrlState(search: string): WorkbenchUrlState {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const rawTab = params.get('tab') ?? ''
  const entryParam = params.get('entry')?.trim() || null
  const viewParam = params.get('view')

  let tab: WorkbenchTab = VALID_TABS.has(rawTab as WorkbenchTab)
    ? (rawTab as WorkbenchTab)
    : entryParam
      ? 'explorer'
      : 'rapid_review'

  let explorerSubView: 'entries' | 'categories' =
    viewParam === 'categories' ? 'categories' : 'entries'

  if (tab === 'corpus') {
    tab = 'explorer'
    explorerSubView = 'categories'
  }

  const rawCat = params.get('cat')?.trim() || 'all'
  const rawEx = params.get('ex') ?? 'all'
  const exampleFilter: ExampleFilter = VALID_EXAMPLE_FILTERS.has(rawEx as ExampleFilter)
    ? (rawEx as ExampleFilter)
    : 'all'
  const query = params.get('q') ?? ''

  return {
    tab,
    explorerSubView,
    entryId: entryParam && entryParam.length <= 64 ? entryParam : null,
    category: rawCat.length <= 120 ? rawCat : 'all',
    exampleFilter,
    query: query.slice(0, 120),
  }
}

export function buildWorkbenchUrlSearch(state: WorkbenchUrlState): string {
  const params = new URLSearchParams()

  if (state.tab !== 'rapid_review') {
    params.set('tab', state.tab)
  }

  if (state.tab === 'explorer') {
    if (state.explorerSubView === 'categories') {
      params.set('view', 'categories')
    } else if (state.entryId) {
      params.set('entry', state.entryId)
    }
    if (state.category && state.category !== 'all') {
      params.set('cat', state.category)
    }
    if (state.exampleFilter !== 'all') {
      params.set('ex', state.exampleFilter)
    }
    if (state.query.trim()) {
      params.set('q', state.query.trim())
    }
  }

  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function buildEntryShareUrl(entryId: string, currentHref?: string): string {
  const baseHref =
    currentHref ?? (typeof window !== 'undefined' ? window.location.href : 'https://lexreview.local/')
  const url = new URL(baseHref)
  url.search = ''
  url.searchParams.set('tab', 'explorer')
  url.searchParams.set('entry', entryId)
  url.hash = 'workspace'
  return url.toString()
}

export function buildCleanEntryUrl(entryId: string, currentHref?: string): string {
  const baseHref =
    currentHref ?? (typeof window !== 'undefined' ? window.location.href : 'https://lexreview.local/')
  const url = new URL(baseHref)
  url.pathname = `/lexicon/${encodeURIComponent(entryId)}`
  url.search = ''
  url.hash = ''
  return url.toString()
}

export function buildContributorProfileUrl(slug: string, currentHref?: string): string {
  const baseHref =
    currentHref ?? (typeof window !== 'undefined' ? window.location.href : 'https://lexreview.local/')
  const url = new URL(baseHref)
  url.pathname = `/contributors/${encodeURIComponent(slug.trim())}`
  url.search = ''
  url.hash = ''
  return url.toString()
}

export function buildCollectionUrl(slug?: string | null, currentHref?: string): string {
  const baseHref =
    currentHref ?? (typeof window !== 'undefined' ? window.location.href : 'https://lexreview.local/')
  const url = new URL(baseHref)
  url.pathname = slug?.trim()
    ? `/collections/${encodeURIComponent(slug.trim())}`
    : '/collections'
  url.search = ''
  url.hash = ''
  return url.toString()
}

export function buildEmbedEntryUrl(
  entryId: string,
  options?: { theme?: 'light' | 'dark' | 'auto'; compact?: boolean; currentHref?: string },
): string {
  const baseHref =
    options?.currentHref ??
    (typeof window !== 'undefined' ? window.location.href : 'https://lexreview.local/')
  const url = new URL(baseHref)
  url.pathname = `/embed/${encodeURIComponent(entryId.trim())}`
  url.search = ''
  if (options?.theme && options.theme !== 'auto') {
    url.searchParams.set('theme', options.theme)
  }
  if (options?.compact) {
    url.searchParams.set('compact', '1')
  }
  url.hash = ''
  return url.toString()
}

export function parseAppRoute(pathname: string, search: string): AppRouteState {
  const cleanPath = (pathname || '/').replace(/\/+$/, '') || '/'
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)

  const rawCat = params.get('cat')?.trim() || 'all'
  const rawEx = params.get('ex') ?? 'all'
  const exampleFilter: ExampleFilter = VALID_EXAMPLE_FILTERS.has(rawEx as ExampleFilter)
    ? (rawEx as ExampleFilter)
    : 'all'
  const query = (params.get('q') ?? '').slice(0, 120)
  const viewParam = params.get('view')
  const queryEntry = params.get('entry')?.trim() || null

  const rawEtym = params.get('etym')?.trim() || ''

  if (cleanPath === '/review') {
    return {
      page: 'review',
      explorerSubView: 'entries',
      entryId: null,
      category: 'all',
      exampleFilter: 'all',
      query: '',
    }
  }

  if (cleanPath === '/lexicon' || cleanPath.startsWith('/lexicon/')) {
    let pathEntryId: string | null = null
    if (cleanPath.startsWith('/lexicon/')) {
      try {
        pathEntryId = decodeURIComponent(cleanPath.slice('/lexicon/'.length)).trim() || null
      } catch {
        pathEntryId = cleanPath.slice('/lexicon/'.length).trim() || null
      }
    }
    const resolvedEntry = pathEntryId ?? queryEntry
    return {
      page: 'lexicon',
      explorerSubView: viewParam === 'categories' && !pathEntryId ? 'categories' : 'entries',
      entryId: resolvedEntry && resolvedEntry.length <= 64 ? resolvedEntry : null,
      ...(rawEtym && rawEtym !== 'all' && rawEtym.length <= 40 ? { etymology: rawEtym } : {}),
      category: rawCat.length <= 120 ? rawCat : 'all',
      exampleFilter,
      query,
    }
  }

  if (cleanPath === '/collections' || cleanPath.startsWith('/collections/')) {
    let rawSlug = ''
    if (cleanPath.startsWith('/collections/')) {
      try {
        rawSlug = decodeURIComponent(cleanPath.slice('/collections/'.length)).trim()
      } catch {
        rawSlug = cleanPath.slice('/collections/'.length).trim()
      }
    }
    const safeSlug = rawSlug && rawSlug.length <= 96 && !rawSlug.includes('/') ? rawSlug : undefined
    return {
      page: 'collections',
      explorerSubView: 'entries',
      entryId: null,
      ...(safeSlug ? { collectionSlug: safeSlug } : {}),
      category: 'all',
      exampleFilter: 'all',
      query: '',
    }
  }

  if (cleanPath.startsWith('/embed/')) {
    let embedEntryId: string | null = null
    try {
      embedEntryId = decodeURIComponent(cleanPath.slice('/embed/'.length)).trim() || null
    } catch {
      embedEntryId = cleanPath.slice('/embed/'.length).trim() || null
    }
    const rawTheme = params.get('theme')
    const embedTheme: 'light' | 'dark' | 'auto' =
      rawTheme === 'light' || rawTheme === 'dark' ? rawTheme : 'auto'
    const embedCompact = params.get('compact') === '1'
    return {
      page: 'embed',
      explorerSubView: 'entries',
      entryId: embedEntryId && embedEntryId.length <= 64 ? embedEntryId : '1',
      embedTheme,
      embedCompact,
      category: 'all',
      exampleFilter: 'all',
      query: '',
    }
  }

  if (cleanPath === '/insights') {
    return {
      page: 'insights',
      explorerSubView: 'entries',
      entryId: null,
      category: 'all',
      exampleFilter: 'all',
      query: '',
    }
  }

  if (cleanPath === '/contribute') {
    return {
      page: 'contribute',
      explorerSubView: 'entries',
      entryId: null,
      category: 'all',
      exampleFilter: 'all',
      query: '',
    }
  }

  if (cleanPath === '/submissions') {
    return {
      page: 'submissions',
      explorerSubView: 'entries',
      entryId: null,
      category: 'all',
      exampleFilter: 'all',
      query: '',
    }
  }

  if (cleanPath === '/profile') {
    return {
      page: 'profile',
      explorerSubView: 'entries',
      entryId: null,
      category: 'all',
      exampleFilter: 'all',
      query: '',
    }
  }

  if (cleanPath === '/editorial') {
    return {
      page: 'editorial',
      explorerSubView: 'entries',
      entryId: null,
      category: 'all',
      exampleFilter: 'all',
      query: '',
    }
  }

  if (cleanPath === '/export') {
    return {
      page: 'export',
      explorerSubView: 'entries',
      entryId: null,
      category: 'all',
      exampleFilter: 'all',
      query: '',
    }
  }

  if (cleanPath === '/contributors' || cleanPath.startsWith('/contributors/')) {
    let rawSlug = ''
    if (cleanPath.startsWith('/contributors/')) {
      try {
        rawSlug = decodeURIComponent(cleanPath.slice('/contributors/'.length)).trim()
      } catch {
        rawSlug = cleanPath.slice('/contributors/'.length).trim()
      }
    }
    const safeSlug = rawSlug && rawSlug.length <= 96 && !rawSlug.includes('/') ? rawSlug : undefined
    return {
      page: 'contributors',
      explorerSubView: 'entries',
      entryId: null,
      ...(safeSlug ? { contributorSlug: safeSlug } : {}),
      category: 'all',
      exampleFilter: 'all',
      query: '',
    }
  }

  if (cleanPath === '/messages') {
    return {
      page: 'messages',
      explorerSubView: 'entries',
      entryId: null,
      category: 'all',
      exampleFilter: 'all',
      query: '',
    }
  }

  if (cleanPath === '/members' || cleanPath === '/admin/members') {
    return {
      page: 'members',
      explorerSubView: 'entries',
      entryId: null,
      category: 'all',
      exampleFilter: 'all',
      query: '',
    }
  }

  if (cleanPath === '/auth') {
    return {
      page: 'auth',
      explorerSubView: 'entries',
      entryId: null,
      category: 'all',
      exampleFilter: 'all',
      query: '',
    }
  }

  const hasLegacyTab = VALID_TABS.has((params.get('tab') ?? '') as WorkbenchTab)
  if (hasLegacyTab || queryEntry || viewParam === 'categories') {
    const legacy = parseWorkbenchUrlState(search)
    return {
      page: workbenchTabToPage(legacy.tab),
      explorerSubView: legacy.explorerSubView,
      entryId: legacy.entryId,
      category: legacy.category,
      exampleFilter: legacy.exampleFilter,
      query: legacy.query,
    }
  }

  return {
    page: 'home',
    explorerSubView: 'entries',
    entryId: null,
    category: 'all',
    exampleFilter: 'all',
    query: '',
  }
}

export function buildAppRouteUrl(state: AppRouteState): string {
  switch (state.page) {
    case 'home':
      return '/'
    case 'review':
      return '/review'
    case 'insights':
      return '/insights'
    case 'contributors':
      return state.contributorSlug
        ? `/contributors/${encodeURIComponent(state.contributorSlug)}`
        : '/contributors'
    case 'contribute':
      return '/contribute'
    case 'submissions':
      return '/submissions'
    case 'messages':
      return '/messages'
    case 'profile':
      return '/profile'
    case 'editorial':
      return '/editorial'
    case 'members':
      return '/members'
    case 'export':
      return '/export'
    case 'collections':
      return state.collectionSlug
        ? `/collections/${encodeURIComponent(state.collectionSlug)}`
        : '/collections'
    case 'embed': {
      const embedId = state.entryId || '1'
      const params = new URLSearchParams()
      if (state.embedTheme && state.embedTheme !== 'auto') {
        params.set('theme', state.embedTheme)
      }
      if (state.embedCompact) {
        params.set('compact', '1')
      }
      const qs = params.toString()
      return qs ? `/embed/${encodeURIComponent(embedId)}?${qs}` : `/embed/${encodeURIComponent(embedId)}`
    }
    case 'auth':
      return '/auth'
    case 'lexicon': {
      const params = new URLSearchParams()
      let basePath = '/lexicon'
      if (state.explorerSubView === 'categories') {
        params.set('view', 'categories')
      } else if (state.entryId) {
        basePath = `/lexicon/${encodeURIComponent(state.entryId)}`
      }
      if (state.category && state.category !== 'all') {
        params.set('cat', state.category)
      }
      if (state.etymology && state.etymology !== 'all') {
        params.set('etym', state.etymology)
      }
      if (state.exampleFilter !== 'all') {
        params.set('ex', state.exampleFilter)
      }
      if (state.query.trim()) {
        params.set('q', state.query.trim())
      }
      const qs = params.toString()
      return qs ? `${basePath}?${qs}` : basePath
    }
  }
}
