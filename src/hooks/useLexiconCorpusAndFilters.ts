import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import type {
  DataMode,
  ExampleFilter,
  LexicalEntry,
  RawOfficialCorpus,
} from '../types/lexicon'
import {
  DEMO_ENTRIES,
  DEMO_RAW_CORPUS,
  loadCorpusWithOfflineFallback,
} from '../services/dataset'
import {
  fetchLiveApprovedSubmissions,
  mergeApprovedSubmissionsIntoCorpus,
} from '../services/liveApprovedOverlay'
import { isPriorityEnrichmentEntry, matchesDarijaQuery } from '../utils/phoneticSearch'
import type { AppRouteState } from '../utils/urlState'

export function useLexiconCorpusAndFilters(initialRoute: AppRouteState) {
  const [baseEntries, setBaseEntries] = useState<LexicalEntry[]>(DEMO_ENTRIES)
  const [entries, setEntries] = useState<LexicalEntry[]>(DEMO_ENTRIES)
  const [rawCorpus, setRawCorpus] = useState<RawOfficialCorpus>(DEMO_RAW_CORPUS)
  const [categories, setCategories] = useState<string[]>(
    Array.from(new Set(DEMO_ENTRIES.map((e) => e.category))),
  )
  const [totalExamplesCount, setTotalExamplesCount] = useState<number>(4)
  const [liveOverlayCount, setLiveOverlayCount] = useState<number>(0)
  const [dataMode, setDataMode] = useState<DataMode>('loading')
  const [cachedCorpusAt, setCachedCorpusAt] = useState<string | null>(null)
  const [corpusError, setCorpusError] = useState<string | null>(null)

  const [query, setQuery] = useState(initialRoute.query)
  const deferredQuery = useDeferredValue(query)
  const [selectedCategory, setSelectedCategory] = useState(initialRoute.category)
  const [exampleFilter, setExampleFilter] = useState<ExampleFilter>(initialRoute.exampleFilter)
  const [selectedEntryType, setSelectedEntryType] = useState('all')
  const [selectedRegister, setSelectedRegister] = useState('all')
  const [selectedRegion, setSelectedRegion] = useState<string>(initialRoute.region ?? 'all')
  const [selectedEtymology, setSelectedEtymology] = useState<string>(
    initialRoute.etymology ?? 'all',
  )
  const [activeId, setActiveId] = useState<string>(initialRoute.entryId ?? DEMO_ENTRIES[0].id)

  const applyLiveApprovedOverlay = useCallback(async (seedEntries: LexicalEntry[]) => {
    const approved = await fetchLiveApprovedSubmissions()
    const merged = mergeApprovedSubmissionsIntoCorpus(seedEntries, approved)
    setEntries(merged.entries)
    setCategories(merged.categories)
    setTotalExamplesCount(merged.totalExamplesCount)
    setLiveOverlayCount(merged.liveOverlayCount)
    setActiveId((prev) =>
      merged.entries.some((e) => e.id === prev) ? prev : (merged.entries[0]?.id ?? ''),
    )
  }, [])

  const loadCorpus = useCallback(() => {
    setDataMode('loading')
    setCorpusError(null)
    loadCorpusWithOfflineFallback()
      .then(async (res) => {
        setBaseEntries(res.corpus.entries)
        setEntries(res.corpus.entries)
        setRawCorpus(res.corpus.rawCorpus)
        setCategories(res.corpus.categories)
        setTotalExamplesCount(res.corpus.totalExamplesCount)
        setCachedCorpusAt(res.cachedAt)
        setActiveId((prev) =>
          res.corpus.entries.some((e) => e.id === prev)
            ? prev
            : (res.corpus.entries[0]?.id ?? ''),
        )
        setDataMode(res.mode)
        await applyLiveApprovedOverlay(res.corpus.entries)
      })
      .catch((error: unknown) => {
        setBaseEntries([])
        setEntries([])
        setCategories([])
        setTotalExamplesCount(0)
        setLiveOverlayCount(0)
        setCachedCorpusAt(null)
        setCorpusError(
          error instanceof Error
            ? error.message
            : 'تعذر تحميل المتن الرسمي والنسخة المحلية المحفوظة.',
        )
        setDataMode('error')
      })
  }, [applyLiveApprovedOverlay])

  useEffect(() => {
    loadCorpus()
  }, [loadCorpus])

  const refreshLiveApprovedOverlay = useCallback(async () => {
    if (baseEntries.length === 0 || dataMode === 'demo' || dataMode === 'error') return
    await applyLiveApprovedOverlay(baseEntries)
  }, [baseEntries, dataMode, applyLiveApprovedOverlay])

  const enableDemoPreview = useCallback(() => {
    setBaseEntries(DEMO_ENTRIES)
    setEntries(DEMO_ENTRIES)
    setRawCorpus(DEMO_RAW_CORPUS)
    setCategories(Array.from(new Set(DEMO_ENTRIES.map((entry) => entry.category))))
    setTotalExamplesCount(4)
    setLiveOverlayCount(0)
    setActiveId(DEMO_ENTRIES[0]?.id ?? '')
    setDataMode('demo')
  }, [])

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (selectedCategory !== 'all' && entry.category !== selectedCategory) {
        return false
      }
      if (exampleFilter === 'with_examples' && entry.examples.length === 0) {
        return false
      }
      if (exampleFilter === 'needs_examples' && entry.examples.length > 0) {
        return false
      }
      if (exampleFilter === 'priority_enrichment' && !isPriorityEnrichmentEntry(entry)) return false
      if (selectedEntryType !== 'all' && (entry.entryType ?? 'unknown') !== selectedEntryType) {
        return false
      }
      if (selectedRegister !== 'all' && (entry.register ?? 'unknown') !== selectedRegister) {
        return false
      }
      if (selectedRegion !== 'all' && !(entry.region ?? []).includes(selectedRegion)) {
        return false
      }
      if (selectedEtymology !== 'all' && (entry.etymology ?? 'unspecified') !== selectedEtymology) {
        return false
      }
      return matchesDarijaQuery(entry, deferredQuery)
    })
  }, [
    entries,
    deferredQuery,
    selectedCategory,
    exampleFilter,
    selectedEntryType,
    selectedRegister,
    selectedRegion,
    selectedEtymology,
  ])

  const activeEntry = useMemo(() => {
    return (
      entries.find((e) => e.id === activeId) ??
      filteredEntries[0] ??
      entries[0] ??
      DEMO_ENTRIES[0]
    )
  }, [entries, filteredEntries, activeId])

  const activeIndexInFiltered = useMemo(
    () => filteredEntries.findIndex((e) => e.id === activeEntry.id),
    [filteredEntries, activeEntry.id],
  )

  const availableRegions = useMemo(
    () => Array.from(new Set(entries.flatMap((entry) => entry.region ?? []))).sort(),
    [entries],
  )

  const handleResetFilters = useCallback(() => {
    setQuery('')
    setSelectedCategory('all')
    setExampleFilter('all')
    setSelectedEntryType('all')
    setSelectedRegister('all')
    setSelectedRegion('all')
    setSelectedEtymology('all')
  }, [])

  return {
    entries,
    rawCorpus,
    categories,
    totalExamplesCount,
    liveOverlayCount,
    dataMode,
    cachedCorpusAt,
    corpusError,
    loadCorpus,
    enableDemoPreview,
    refreshLiveApprovedOverlay,
    query,
    setQuery,
    selectedCategory,
    setSelectedCategory,
    exampleFilter,
    setExampleFilter,
    selectedEntryType,
    setSelectedEntryType,
    selectedRegister,
    setSelectedRegister,
    selectedRegion,
    setSelectedRegion,
    selectedEtymology,
    setSelectedEtymology,
    activeId,
    setActiveId,
    filteredEntries,
    activeEntry,
    activeIndexInFiltered,
    availableRegions,
    handleResetFilters,
  }
}
