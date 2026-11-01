import type { ExampleFilter, WorkbenchTab } from '../types/lexicon'

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
