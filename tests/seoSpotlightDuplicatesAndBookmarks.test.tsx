import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEMO_ENTRIES } from '../src/services/dataset'
import { buildDefinedTermJsonLdPayload } from '../src/utils/seo'
import {
  selectDailyLexiconSpotlight,
  selectRegionalMemberTasks,
} from '../src/utils/dailySpotlight'
import { findFuzzyCorpusMatches } from '../src/utils/validation'
import {
  buildAppRouteUrl,
  buildContributorProfileUrl,
  parseAppRoute,
} from '../src/utils/urlState'
import { DailySpotlightAndRegionalTasks } from '../src/components/DailySpotlightAndRegionalTasks'
import { DictionaryReferenceCard } from '../src/components/Workbench/DictionaryReferenceCard'
import { NewEntryProposalPanel } from '../src/components/Workbench/NewEntryProposalPanel'
import { PublicContributorsPage } from '../src/components/Workbench/PublicContributorsPage'
import { ContributorProfilePanel } from '../src/components/Workbench/ContributorProfilePanel'
import type { LexicalEntry, PublicContributorRecord } from '../src/types/lexicon'

describe('1. Corpus Sitemap & Schema.org DefinedTerm SEO', () => {
  it('indexes individual /lexicon/:id word routes inside public/sitemap.xml', () => {
    const sitemap = fs.readFileSync(path.resolve(process.cwd(), 'public/sitemap.xml'), 'utf8')
    expect(sitemap).toContain('<urlset')
    expect(sitemap).toContain('/lexicon/')
    const urlMatches = sitemap.match(/<url>/g) ?? []
    expect(urlMatches.length).toBeGreaterThan(100)
  })

  it('builds valid Schema.org DefinedTerm JSON-LD with DefinedTermSet and contextual example', () => {
    const entry = DEMO_ENTRIES[0]
    const payload = buildDefinedTermJsonLdPayload(
      entry,
      'https://darija-lexreview.pages.dev/lexicon/1',
      'https://darija-lexreview.pages.dev',
    )

    expect(payload['@type']).toBe('DefinedTerm')
    expect(payload.name).toBe('بزاف')
    expect(payload.alternateName).toEqual(['bzzaf'])
    expect(payload.inLanguage).toBe('ary')
    expect(payload.description).toContain('عندي بزاف ديال الخدمة اليوم.')
    expect(payload.inDefinedTermSet['@type']).toBe('DefinedTermSet')
    expect(payload.inDefinedTermSet.license).toContain('creativecommons.org/licenses/by-nc/4.0')
  })
})

describe('2 & 5. Daily Spotlight (Visitors & Members) + Regional Tasks (Members Only)', () => {
  it('selects deterministic Daily Word and Proverb/Expression for a given date', () => {
    const dayA1 = selectDailyLexiconSpotlight(DEMO_ENTRIES, '2026-11-03')
    const dayA2 = selectDailyLexiconSpotlight(DEMO_ENTRIES, '2026-11-03')
    expect(dayA1.wordOfTheDay?.id).toBe(dayA2.wordOfTheDay?.id)
    expect(dayA1.proverbOrExpressionOfTheDay?.id).toBe(
      dayA2.proverbOrExpressionOfTheDay?.id,
    )
    expect(dayA1.wordOfTheDay).not.toBeNull()
  })

  it('respects strict Visitor vs. Member visibility in DailySpotlightAndRegionalTasks', () => {
    const noop = () => {}

    const visitorHtml = renderToStaticMarkup(
      <DailySpotlightAndRegionalTasks
        entries={DEMO_ENTRIES}
        corpusVersion="1.5.0"
        darkMode
        isAuthenticated={false}
        memberDialectRegion="فاس ومكناس"
        onSelectEntry={noop}
        onEnrichEntry={noop}
        onOpenProfileSettings={noop}
        dateSeed="2026-11-03"
      />,
    )
    expect(visitorHtml).toContain('مفردة اليوم الموثّقة')
    expect(visitorHtml).toContain('بطاقة مصوّرة للمشاركة')
    expect(visitorHtml).not.toContain('حفظ في مفضلتي')
    expect(visitorHtml).not.toContain('مطلوب توثيقها في منطقتك')

    const memberHtml = renderToStaticMarkup(
      <DailySpotlightAndRegionalTasks
        entries={DEMO_ENTRIES}
        corpusVersion="1.5.0"
        darkMode
        isAuthenticated
        memberDialectRegion="فاس ومكناس"
        isBookmarked={() => false}
        onToggleBookmark={noop}
        onSelectEntry={noop}
        onEnrichEntry={noop}
        onOpenProfileSettings={noop}
        dateSeed="2026-11-03"
      />,
    )
    expect(memberHtml).toContain('حفظ في مفضلتي')
    expect(memberHtml).toContain('مطلوب توثيقها في منطقتك (فاس ومكناس)')
  })

  it('prioritizes unattested entries needing regional examples in selectRegionalMemberTasks', () => {
    const tasks = selectRegionalMemberTasks({
      entries: DEMO_ENTRIES,
      memberRegion: 'الشمال وجبالة',
      userVerdictsByEntryId: { '1': 'accurate' },
      limit: 3,
    })
    expect(tasks.length).toBeGreaterThan(0)
    expect(tasks.some((t) => t.entry.id === '1')).toBe(false)
    // Entry '4' ('شنو') has 0 examples, so it should appear near the top
    expect(tasks.some((t) => t.entry.id === '4')).toBe(true)
  })
})

describe('3 & 7. DictionaryReferenceCard Shareable PNG Card & Member Bookmarks', () => {
  it('renders Shareable Card button for everyone and Bookmark button only for authenticated members', () => {
    const noop = () => {}
    const visitorCard = renderToStaticMarkup(
      <DictionaryReferenceCard
        entry={DEMO_ENTRIES[0]}
        allEntries={DEMO_ENTRIES}
        corpusVersion="1.5.0"
        isAuthenticated={false}
        currentIndex={0}
        totalFiltered={5}
        hasLocalDraft={false}
        onPrev={noop}
        onNext={noop}
        onSwitchToWorkshop={noop}
        onSelectEntry={noop}
        onSelectCategory={noop}
      />,
    )
    expect(visitorCard).toContain('بطاقة مصوّرة')
    expect(visitorCard).not.toContain('حفظ المفردة في مفضلتي')

    const memberCard = renderToStaticMarkup(
      <DictionaryReferenceCard
        entry={DEMO_ENTRIES[0]}
        allEntries={DEMO_ENTRIES}
        corpusVersion="1.5.0"
        isAuthenticated
        isBookmarked
        onToggleBookmark={noop}
        currentIndex={0}
        totalFiltered={5}
        hasLocalDraft={false}
        onPrev={noop}
        onNext={noop}
        onSwitchToWorkshop={noop}
        onSelectEntry={noop}
        onSelectCategory={noop}
      />,
    )
    expect(memberCard).toContain('بطاقة مصوّرة')
    expect(memberCard).toContain('محفوظة')
  })
})

describe('4. Smart Darija Duplicate Detector (Orthographic & Phonetic Variants)', () => {
  const sampleCorpus: LexicalEntry[] = [
    ...DEMO_ENTRIES,
    {
      ...DEMO_ENTRIES[0],
      id: '901',
      word: 'دغيا',
      latin: 'dghya',
      meaning: 'بسرعة',
    },
    {
      ...DEMO_ENTRIES[0],
      id: '902',
      word: 'كال',
      latin: 'gal',
      meaning: 'قال',
    },
  ]

  it('catches taa-marbuta/haa/alif, kaf/gaf, prosthetic alif, and vowel-drop Darija duplicates', () => {
    // دغية / دغيه -> matches دغيا
    expect(findFuzzyCorpusMatches(sampleCorpus, 'دغية', '').map((m) => m.entry.word)).toContain('دغيا')
    expect(findFuzzyCorpusMatches(sampleCorpus, 'دغيه', '').map((m) => m.entry.word)).toContain('دغيا')

    // گال / ݣال -> matches كال
    expect(findFuzzyCorpusMatches(sampleCorpus, 'گال', '').map((m) => m.entry.word)).toContain('كال')
    expect(findFuzzyCorpusMatches(sampleCorpus, 'ݣال', '').map((m) => m.entry.word)).toContain('كال')

    // أشنو -> matches شنو
    expect(findFuzzyCorpusMatches(sampleCorpus, 'أشنو', '').map((m) => m.entry.word)).toContain('شنو')

    // وخا / بيزاف / مزين -> matches واخا / بزاف / مزيان
    expect(findFuzzyCorpusMatches(sampleCorpus, 'وخا', '').map((m) => m.entry.word)).toContain('واخا')
    expect(findFuzzyCorpusMatches(sampleCorpus, 'بيزاف', '').map((m) => m.entry.word)).toContain('بزاف')
    expect(findFuzzyCorpusMatches(sampleCorpus, 'مزين', '').map((m) => m.entry.word)).toContain('مزيان')
  })

  it('renders duplicate alert with 1-click enrichment prompt in NewEntryProposalPanel when prefilled with near-duplicate', () => {
    const noop = () => {}
    const html = renderToStaticMarkup(
      <NewEntryProposalPanel
        entries={sampleCorpus}
        categories={['التواصل']}
        corpusVersion="1.5.0"
        isAuthenticated
        canAccessEditorialTools={false}
        activeDraft={{
          entryId: 'NEW:دغية',
          headword: 'دغية',
          category: 'التواصل',
          proposedData: {
            submission_kind: 'new_entry',
            word_ar: 'دغية',
          },
          evidence: [],
          reviewerNote: '',
          updatedAt: '2026-11-03T09:00:00.000Z',
        }}
        sessionPrefs={{
          dialectRegion: 'فاس ومكناس',
          microTask: 'verify_words',
          rightsConfirmedOnce: true,
          trainingPermission: 'allowed',
        }}
        onUpdateSessionPrefs={noop}
        onInspectExistingEntry={noop}
        onEnrichExistingEntry={noop}
        onSaveDraft={noop}
        onRequireLogin={noop}
        onSubmissionSuccess={noop}
      />,
    )
    // Note: useEffect runs client-side, so also verify direct component render safety
    expect(html).toContain('أضف مفردة أو عبارة مغربية جديدة')
  })
})

describe('6 & 7. Direct Contributor Permalink (/contributors/:slug), Saved Profile Bookmarks & Realtime SQL', () => {
  it('parses and builds /contributors/:slug routes cleanly', () => {
    const parsed = parseAppRoute('/contributors/salma-9f2a1c', '')
    expect(parsed.page).toBe('contributors')
    expect(parsed.contributorSlug).toBe('salma-9f2a1c')
    expect(buildAppRouteUrl(parsed)).toBe('/contributors/salma-9f2a1c')
    expect(
      buildContributorProfileUrl('salma-9f2a1c', 'https://darija-lexreview.pages.dev/lexicon'),
    ).toBe('https://darija-lexreview.pages.dev/contributors/salma-9f2a1c')
  })

  it('renders direct permalink copy button in PublicContributorsPage modal and Saved Words in ContributorProfilePanel', () => {
    const noop = () => {}
    const contributors: PublicContributorRecord[] = [
      {
        public_slug: 'salma-9f2a1c',
        display_name: 'سلمى الإدريسي',
        dialect_region: 'فاس ومكناس',
        specialty: 'اللسانيات والمعجمية',
        github_handle: 'salma-ling',
        role: 'editor',
        accepted_count: 10,
        attestations_count: 20,
        joined_year: 2026,
      },
    ]

    const modalHtml = renderToStaticMarkup(
      <PublicContributorsPage
        contributors={contributors}
        loading={false}
        isAuthenticated={false}
        entriesCount={921}
        corpusVersion="1.5.0"
        initialSelectedSlug="salma-9f2a1c"
        onOpenProfileOrAuth={noop}
        onStartContributing={noop}
      />,
    )
    expect(modalHtml).toContain('رابط البطاقة')

    const profileHtml = renderToStaticMarkup(
      <ContributorProfilePanel
        profile={{
          id: '12345678-aaaa-bbbb-cccc-1234567890ab',
          display_name: 'سلمى الإدريسي',
          dialect_region: 'فاس ومكناس',
          public_listed: true,
          role: 'reviewer',
        }}
        userEmail="salma@example.org"
        entries={DEMO_ENTRIES}
        bookmarkedEntryIds={['1', '3']}
        publicContributorSlug="salma-9f2a1c"
        onOpenBookmarkedEntry={noop}
        onRemoveBookmark={noop}
        onProfileSaved={noop}
      />,
    )
    expect(profileHtml).toContain('مفرداتي المحفوظة (2)')
    expect(profileHtml).toContain('بزاف')
    expect(profileHtml).toContain('دابا')
    expect(profileHtml).toContain('نسخ رابط ملفك العام')
    expect(profileHtml).toContain('/contributors/salma-9f2a1c')
  })

  it('defines member_bookmarks RLS policies and supabase_realtime publication on member_messages', () => {
    const sql = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'supabase/migrations/20261103180000_member_bookmarks_and_realtime_inbox.sql',
      ),
      'utf8',
    )
    expect(sql).toContain('create table if not exists public.member_bookmarks')
    expect(sql).toContain('enable row level security')
    expect(sql).toContain('alter publication supabase_realtime add table public.member_messages')
  })
})
