import type { ExampleFilter, WorkbenchTab } from '../types/lexicon'

export type AppPage =
  | 'home'
  | 'review'
  | 'lexicon'
  | 'contribute'
  | 'submissions'
  | 'profile'
  | 'editorial'
  | 'export'
  | 'auth'

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
      return 'explorer'
    case 'contribute':
      return 'new_entry'
    case 'submissions':
      return 'submissions'
    case 'profile':
      return 'profile'
    case 'editorial':
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

  // 1. Clean dedicated SPA paths
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
      category: rawCat.length <= 120 ? rawCat : 'all',
      exampleFilter,
      query,
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

  // 2. Root path `/` with legacy `?tab=...` or `?entry=...` deep-links -> automatic route upgrade
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

  // 3. Pure Landing Page `/`
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
    case 'contribute':
      return '/contribute'
    case 'submissions':
      return '/submissions'
    case 'profile':
      return '/profile'
    case 'editorial':
      return '/editorial'
    case 'export':
      return '/export'
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
