import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DocumentationSprintBanner } from '../src/components/DocumentationSprintBanner'
import { EmbeddedWordWidgetView } from '../src/components/EmbeddedWordWidgetView'
import { EntryRevisionHistoryPanel } from '../src/components/Workbench/EntryRevisionHistoryPanel'
import {
  HomeThematicCollectionsGateway,
  ThematicCollectionsPage,
} from '../src/components/Workbench/ThematicCollectionsPage'
import {
  type ComputedSprintProgress,
  doesEntryMatchSprint,
} from '../src/hooks/useDocumentationSprints'
import { DEMO_ENTRIES } from '../src/services/dataset'
import type { DocumentationSprint } from '../src/types/lexicon'
import { formatEtymologyLabel, resolveEntryEtymology } from '../src/utils/etymology'
import { computeContributorBadges } from '../src/utils/meritBadges'
import {
  THEMATIC_COLLECTIONS,
  buildThematicCollections,
  findThematicCollectionBySlug,
} from '../src/utils/thematicCollections'
import {
  buildAppRouteUrl,
  buildCollectionUrl,
  buildEmbedEntryUrl,
  parseAppRoute,
} from '../src/utils/urlState'

describe('5 Lexicographical & Community Features (Sprints, History, Embed, Collections, Etymology)', () => {
  it('resolves accurate Moroccan Darija etymological roots and scholarly notes', () => {
    const bezzaf = resolveEntryEtymology({
      word: 'بزاف',
      latin: 'bezzaf',
      meaning: 'كثيراً',
      category: 'ظرف',
    })
    expect(bezzaf.etymology).toBe('arabic_shifted')
    expect(bezzaf.etymologyNote).toContain('بالجُزاف')

    const wakha = resolveEntryEtymology({
      word: 'واخا',
      latin: 'wakha',
      meaning: 'حسناً',
      category: 'تعبير',
    })
    expect(wakha.etymology).toBe('amazigh')

    const zellij = resolveEntryEtymology({
      word: 'زليج',
      latin: 'zellij',
      meaning: 'بلاط خزفي مزخرف',
      category: 'معمار وحرف',
    })
    expect(zellij.etymology).toBe('andalusi')

    const kuzina = resolveEntryEtymology({
      word: 'كوزينة',
      latin: 'kuzina',
      meaning: 'مطبخ',
      category: 'المنزل',
    })
    expect(kuzina.etymology).toBe('romance_loan')
    expect(formatEtymologyLabel('romance_loan')).toContain('مقترض')
  })

  it('builds curated thematic mini-dictionaries and round-trips /collections/:slug URLs', () => {
    expect(THEMATIC_COLLECTIONS.length).toBeGreaterThanOrEqual(6)
    const collections = buildThematicCollections(DEMO_ENTRIES)
    expect(collections.length).toBe(THEMATIC_COLLECTIONS.length)

    const targetSlug = THEMATIC_COLLECTIONS[0].slug
    const found = findThematicCollectionBySlug(collections, targetSlug)
    expect(found?.slug).toBe(targetSlug)

    const parsedIndex = parseAppRoute('/collections', '')
    expect(parsedIndex.page).toBe('collections')
    expect(parsedIndex.collectionSlug).toBeUndefined()

    const parsedSingle = parseAppRoute(`/collections/${targetSlug}`, '')
    expect(parsedSingle.page).toBe('collections')
    expect(parsedSingle.collectionSlug).toBe(targetSlug)

    const builtUrl = buildAppRouteUrl({
      page: 'collections',
      explorerSubView: 'entries',
      entryId: null,
      collectionSlug: targetSlug,
      category: 'all',
      exampleFilter: 'all',
      query: '',
    })
    expect(builtUrl).toBe(`/collections/${targetSlug}`)
    expect(buildCollectionUrl(targetSlug)).toContain(`/collections/${targetSlug}`)

    const gatewayHtml = renderToStaticMarkup(
      <HomeThematicCollectionsGateway entries={DEMO_ENTRIES} onOpenCollection={() => {}} />,
    )
    expect(gatewayHtml).toContain('المجموعات الموضوعاتية والمعاجم المصغّرة')

    const pageHtml = renderToStaticMarkup(
      <ThematicCollectionsPage
        entries={DEMO_ENTRIES}
        selectedSlug={null}
        onSelectCollectionSlug={() => {}}
        onOpenEntry={() => {}}
      />,
    )
    expect(pageHtml).toContain(THEMATIC_COLLECTIONS[0].title)
  })

  it('parses /embed/:entryId routes with theme/compact params and renders EmbeddedWordWidgetView with backlink', () => {
    const entry = DEMO_ENTRIES[0]
    const embedHref = buildEmbedEntryUrl(entry.id, { theme: 'dark', compact: true })
    expect(embedHref).toContain(`/embed/${entry.id}`)
    expect(embedHref).toContain('theme=dark')
    expect(embedHref).toContain('compact=1')

    const parsed = parseAppRoute(`/embed/${entry.id}`, '?theme=dark&compact=1')
    expect(parsed.page).toBe('embed')
    expect(parsed.entryId).toBe(entry.id)
    expect(parsed.embedTheme).toBe('dark')
    expect(parsed.embedCompact).toBe(true)

    const parsedLexiconEtym = parseAppRoute('/lexicon', '?etym=amazigh')
    expect(parsedLexiconEtym.page).toBe('lexicon')
    expect(parsedLexiconEtym.etymology).toBe('amazigh')

    const widgetHtml = renderToStaticMarkup(
      <EmbeddedWordWidgetView
        entry={entry}
        corpusVersion="2.4.0"
        themeMode="dark"
        compact={false}
      />,
    )
    expect(widgetHtml).toContain(entry.word)
    expect(widgetHtml).toContain(`/lexicon/${entry.id}`)
    expect(widgetHtml).toContain('Darija LexReview')
  })

  it('matches entries against Documentation Sprints, renders live progress bar, and awards sprint merit badge', () => {
    const sampleSprint: DocumentationSprint = {
      id: 'sprint-test-1',
      slug: 'draa-tafilalet-sprint',
      title: 'حملة توثيق ١٠٠ شاهد من جهة درعة تافيلالت',
      description: 'هدف جماعي لتوثيق الشواهد السياقية في الواحات والجنوب الشرقي.',
      target_type: 'missing_examples',
      target_value: null,
      goal_count: 100,
      baseline_count: 42,
      badge_label: 'وسام توثيق درعة تافيلالت',
      starts_at: '2026-10-01T00:00:00.000Z',
      ends_at: '2026-12-31T00:00:00.000Z',
      status: 'active',
      created_at: '2026-10-01T00:00:00.000Z',
    }

    const entryWithoutExamples = { ...DEMO_ENTRIES[0], examples: [] }
    const entryWithExamples = DEMO_ENTRIES.find((e) => e.examples.length > 0) ?? DEMO_ENTRIES[0]
    expect(doesEntryMatchSprint(entryWithoutExamples, sampleSprint)).toBe(true)
    if (entryWithExamples.examples.length > 0) {
      expect(doesEntryMatchSprint(entryWithExamples, sampleSprint)).toBe(false)
    }

    const progress: ComputedSprintProgress = {
      sprint: sampleSprint,
      matchingEntriesCount: 25,
      currentCount: 42,
      goalCount: 100,
      progressPercent: 42,
      remainingDays: 14,
      myContributionsCount: 3,
    }

    const bannerHtml = renderToStaticMarkup(
      <DocumentationSprintBanner
        sprintProgress={progress}
        isAuthenticated
        isStaffRole
        onJoinSprint={() => {}}
        onOpenManageSprints={() => {}}
      />,
    )
    expect(bannerHtml).toContain('حملة توثيق ١٠٠ شاهد من جهة درعة تافيلالت')
    expect(bannerHtml).toContain('42')
    expect(bannerHtml).toContain('100')
    expect(bannerHtml).toContain('وسام توثيق درعة تافيلالت')

    const badges = computeContributorBadges({
      role: 'reviewer',
      acceptedCount: 1,
      attestationsCount: 2,
      sprintParticipationsCount: 2,
      sprintBadgeLabel: 'وسام توثيق درعة تافيلالت',
    })
    expect(badges.some((b) => b.id === 'sprint_champion')).toBe(true)
    expect(badges.find((b) => b.id === 'sprint_champion')?.label).toBe('وسام توثيق درعة تافيلالت')
  })

  it('renders transparent word revision history timeline with baseline provenance and field attestations', () => {
    const entry = DEMO_ENTRIES[0]
    const historyHtml = renderToStaticMarkup(
      <EntryRevisionHistoryPanel
        entry={entry}
        corpusVersion="2.4.0"
        attestationSummary={{
          entryId: entry.id,
          total: 7,
          accurateCount: 6,
          regionalCount: 1,
          needsEditCount: 0,
          regions: ['الدار البيضاء - سطات', 'فاس - مكناس'],
        }}
      />,
    )
    expect(historyHtml).toContain('السجل الموسوعي الشفاف لتطور')
    expect(historyHtml).toContain('إدراج المدخل التأسيسي في المتن المعجمي المفتوح')
    expect(historyHtml).toContain('التصديق الميداني للتداول اللهجي')
  })
})
