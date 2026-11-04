import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DEMO_ENTRIES } from '../src/services/dataset'
import { mergeApprovedSubmissionsIntoCorpus } from '../src/services/liveApprovedOverlay'
import { buildAppRouteUrl, parseAppRoute } from '../src/utils/urlState'
import { mergeGuestAndMemberBookmarks } from '../src/hooks/useMemberBookmarks'
import { EditorPromotionModal } from '../src/components/EditorPromotionModal'
import { LexiconSidebar } from '../src/components/Workbench/LexiconSidebar'
import { DictionaryReferenceCard } from '../src/components/Workbench/DictionaryReferenceCard'
import { injectWordOpenGraphHtml } from '../functions/lexicon/[id]'
import { injectContributorOpenGraphHtml } from '../functions/contributors/[slug]'
import type { SubmissionRecord } from '../src/types/lexicon'

describe('Comprehensive Site Audit Fixes (9-Point Verification)', () => {
  it('Fix #1: renders EditorPromotionModal cleanly for signed-in reviewers without triggering Auth login', () => {
    const html = renderToStaticMarkup(
      <EditorPromotionModal
        open
        onClose={() => {}}
        profile={{
          id: 'rev-101',
          display_name: 'ياسين المراكشي',
          dialect_region: 'مراكش والحوز',
          specialty: 'الأمثال والتراث الشفهي',
          role: 'reviewer',
        }}
        userEmail="yassine@example.org"
        acceptedCount={7}
        attestationsCount={32}
      />,
    )

    expect(html).toContain('تقديم طلب ترقية إلى صفة «محرر معتمد»')
    expect(html).toContain('إرسال طلب الترقية')
    expect(html).toContain('مراكش والحوز')
  })

  it('Fix #2: renders mobile jump-to-card strip and saved-words quick filter in LexiconSidebar', () => {
    const noop = () => {}
    const html = renderToStaticMarkup(
      <LexiconSidebar
        entries={DEMO_ENTRIES}
        filteredEntries={DEMO_ENTRIES}
        activeEntry={DEMO_ENTRIES[0]}
        categories={['عام']}
        query=""
        selectedCategory="all"
        exampleFilter="all"
        selectedEntryType="all"
        selectedRegister="all"
        selectedRegion="all"
        regions={['فاس ومكناس']}
        dataMode="live"
        drafts={{}}
        bookmarkedEntryIds={[DEMO_ENTRIES[0].id]}
        onlyBookmarked={false}
        onToggleOnlyBookmarked={noop}
        onQueryChange={noop}
        onCategoryChange={noop}
        onExampleFilterChange={noop}
        onEntryTypeChange={noop}
        onRegisterChange={noop}
        onRegionChange={noop}
        onSelectEntry={noop}
        onJumpToDetailCard={noop}
        onResetFilters={noop}
      />,
    )

    expect(html).toContain(`انتقل إلى البطاقة المعروضة: «${DEMO_ENTRIES[0].word}»`)
    expect(html).toContain('تصفية مفرداتي المحفوظة')
  })

  it('Fix #5: persists Moroccan dialect region filter (?region=...) across parseAppRoute & buildAppRouteUrl', () => {
    const parsed = parseAppRoute(
      '/lexicon',
      '?region=%D8%B3%D9%88%D8%B3+%D9%88%D8%A7%D9%84%D8%AC%D9%86%D9%88%D8%A8&etym=amazigh',
    )
    expect(parsed.page).toBe('lexicon')
    expect(parsed.region).toBe('سوس والجنوب')
    expect(parsed.etymology).toBe('amazigh')

    const built = buildAppRouteUrl(parsed)
    expect(built).toContain('/lexicon?')
    expect(built).toContain('etym=amazigh')
    const roundTripped = parseAppRoute('/lexicon', built.slice('/lexicon'.length))
    expect(roundTripped.region).toBe('سوس والجنوب')
    expect(roundTripped.etymology).toBe('amazigh')

    // All-regions default stays clean without ?region=all pollution
    const cleanDefault = buildAppRouteUrl({
      page: 'lexicon',
      explorerSubView: 'entries',
      entryId: null,
      region: 'all',
      category: 'all',
      exampleFilter: 'all',
      query: '',
    })
    expect(cleanDefault).toBe('/lexicon')
  })

  it('Fix #6: merges unexported accepted Supabase submissions immediately into live corpus', () => {
    const base = DEMO_ENTRIES.slice(0, 2)
    const targetId = base[0].id

    const acceptedSubmissions: SubmissionRecord[] = [
      {
        id: 'sub-edit-001',
        entry_id: targetId,
        proposed_data: {
          submission_kind: 'edit_entry',
          etymology: 'amazigh',
          example_darija: 'هاد الكلمة متداولة بزاف فالسوق القديم',
          example_arabizi: 'had lklma mtdawla bzzaf f souq lqdim',
          example_translation: 'هذه الكلمة متداولة جداً في السوق القديم',
          regions: ['فاس ومكناس'],
        },
        evidence: [],
        reviewer_note: null,
        status: 'accepted',
        editor_note: 'شاهد موثق ومعتمد',
        created_at: '2026-03-01T10:00:00Z',
        updated_at: '2026-03-02T10:00:00Z',
        exported_in_version: null,
      },
      {
        id: 'sub-new-002',
        entry_id: 'NEW:17100000',
        proposed_data: {
          submission_kind: 'new_entry',
          word_ar: 'تايميمونت',
          arabizi: 'taymimount',
          meaning: 'لفظ ترحيبي محلي أصيل',
          french_translation: 'expression de bienvenue',
          category: 'عبارات الترحيب',
          etymology: 'amazigh',
          example_darija: 'مرحبا وتايميمونت بيكم عندنا',
        },
        evidence: [],
        reviewer_note: null,
        status: 'accepted',
        editor_note: 'مدخل جديد معتمد',
        created_at: '2026-03-03T10:00:00Z',
        updated_at: '2026-03-04T10:00:00Z',
        exported_in_version: null,
      },
      {
        // Already exported in v1.5.0 -> must NOT be double-applied
        id: 'sub-exported-003',
        entry_id: 'NEW:999',
        proposed_data: {
          submission_kind: 'new_entry',
          word_ar: 'مدخل مصدر سابقا',
          meaning: 'تم تصديره',
          category: 'عام',
        },
        evidence: [],
        reviewer_note: null,
        status: 'accepted',
        editor_note: null,
        created_at: '2026-02-01T10:00:00Z',
        updated_at: '2026-02-02T10:00:00Z',
        exported_in_version: '1.5.0',
      },
    ]

    const merged = mergeApprovedSubmissionsIntoCorpus(base, acceptedSubmissions)
    expect(merged.liveNewEntriesCount).toBe(1)
    expect(merged.liveUpdatedEntriesCount).toBe(1)
    expect(merged.liveOverlayCount).toBe(2)
    expect(merged.entries.some((e) => e.word === 'تايميمونت')).toBe(true)
    expect(merged.entries.some((e) => e.word === 'مدخل مصدر سابقا')).toBe(false)

    const updatedBaseEntry = merged.entries.find((e) => e.id === targetId)
    expect(updatedBaseEntry?.etymology).toBe('amazigh')
    expect(
      updatedBaseEntry?.examples.some(
        (ex) => ex.darijaAr === 'هاد الكلمة متداولة بزاف فالسوق القديم',
      ),
    ).toBe(true)
  })

  it('Fix #7: injects word & contributor OpenGraph tags at the edge and ships a 1200x630 social card in index.html', () => {
    const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8')
    expect(indexHtml).toContain('og-social-card.jpg')
    expect(indexHtml).toContain('og:image:width" content="1200"')
    expect(indexHtml).toContain('og:image:height" content="630"')
    expect(
      fs.existsSync(path.resolve(process.cwd(), 'public/assets/og-social-card.jpg')),
    ).toBe(true)

    const rewrittenWord = injectWordOpenGraphHtml(
      indexHtml,
      {
        id: '42',
        darijaAr: 'بزاف',
        darijaLatin: 'bzzaf',
        meaningAr: 'كثيراً أو جِداً',
        french: 'beaucoup',
      },
      'https://darija-lexreview.pages.dev',
    )
    expect(rewrittenWord).toContain(
      '<title>معنى «بزاف» (bzzaf) بالدارجة المغربية | Darija LexReview</title>',
    )
    expect(rewrittenWord).toContain('property="og:type" content="article"')
    expect(rewrittenWord).toContain('https://darija-lexreview.pages.dev/lexicon/42')
    expect(rewrittenWord).toContain('https://darija-lexreview.pages.dev/assets/og-social-card.jpg')

    const rewrittenContributor = injectContributorOpenGraphHtml(
      indexHtml,
      'fatima-zohra',
      'https://darija-lexreview.pages.dev',
    )
    expect(rewrittenContributor).toContain('property="og:type" content="profile"')
    expect(rewrittenContributor).toContain(
      'https://darija-lexreview.pages.dev/contributors/fatima-zohra',
    )
  })

  it('Fix #8: merges guest browser bookmarks with member bookmarks without duplicates and renders guest local-save button', () => {
    const merged = mergeGuestAndMemberBookmarks(['12', '45', '12'], ['45', '88'])
    expect(merged).toEqual(['12', '45', '88'])

    const guestCardWithToggle = renderToStaticMarkup(
      <DictionaryReferenceCard
        entry={DEMO_ENTRIES[0]}
        allEntries={DEMO_ENTRIES}
        corpusVersion="1.5.0"
        isAuthenticated={false}
        isBookmarked={false}
        onToggleBookmark={() => {}}
        currentIndex={0}
        totalFiltered={DEMO_ENTRIES.length}
        hasLocalDraft={false}
        onPrev={() => {}}
        onNext={() => {}}
        onSwitchToWorkshop={() => {}}
        onSelectEntry={() => {}}
        onSelectCategory={() => {}}
      />,
    )
    expect(guestCardWithToggle).toContain('حفظ مؤقت بالمتصفح')
    expect(guestCardWithToggle).not.toContain('حفظ المفردة في مفضلتي')
  })
})
