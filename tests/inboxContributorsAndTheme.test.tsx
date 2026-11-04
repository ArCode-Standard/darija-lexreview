import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MemberMessagesPage } from '../src/components/Workbench/MemberMessagesPage'
import { PublicContributorsPage } from '../src/components/Workbench/PublicContributorsPage'
import type { MemberMessageRecord, PublicContributorRecord } from '../src/types/lexicon'
import {
  THEME_STORAGE_KEY,
  getStoredThemePreference,
  persistManualThemePreference,
  resolveInitialTheme,
} from '../src/utils/themePreference'

describe('First-visit device prefers-color-scheme & manual header toggle persistence', () => {
  it('follows device light/dark preference on first visit without writing to storage prematurely', () => {
    const store = new Map<string, string>()
    const mockStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
    }

    const lightMatchMedia = (query: string) => ({
      matches: query === '(prefers-color-scheme: light)',
    })
    const darkMatchMedia = (query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
    })

    // First visit on a light-mode device -> resolves to light and leaves storage empty
    expect(resolveInitialTheme({ storage: mockStorage, matchMedia: lightMatchMedia })).toBe('light')
    expect(getStoredThemePreference(mockStorage)).toBeNull()

    // First visit on a dark-mode device -> resolves to dark and leaves storage empty
    expect(resolveInitialTheme({ storage: mockStorage, matchMedia: darkMatchMedia })).toBe('dark')
    expect(getStoredThemePreference(mockStorage)).toBeNull()

    // Explicit header toggle saves manual choice and overrides device preference
    persistManualThemePreference('light', mockStorage)
    expect(store.get(THEME_STORAGE_KEY)).toBe('light')
    expect(resolveInitialTheme({ storage: mockStorage, matchMedia: darkMatchMedia })).toBe('light')

    persistManualThemePreference('dark', mockStorage)
    expect(store.get(THEME_STORAGE_KEY)).toBe('dark')
    expect(resolveInitialTheme({ storage: mockStorage, matchMedia: lightMatchMedia })).toBe('dark')
  })

  it('keeps public/theme.js aligned with prefers-color-scheme and manual-only storage writes', () => {
    const themeScript = fs.readFileSync(path.resolve(process.cwd(), 'public/theme.js'), 'utf8')
    expect(themeScript).toContain('(prefers-color-scheme: light)')
    expect(themeScript).toContain('(prefers-color-scheme: dark)')
    // Ensure setItem is only called once (inside the [data-theme-toggle] click listener)
    const setItemCalls = themeScript.match(/localStorage\.setItem/g) ?? []
    expect(setItemCalls).toHaveLength(1)
  })
})

describe('Automated editorial decision inbox notifications & direct submission actions', () => {
  it('renders direct jump and revision buttons in MemberMessagesPage for adjudicated submissions', () => {
    const noop = () => {}
    const messages: MemberMessageRecord[] = [
      {
        id: 'msg-accepted-1',
        recipient_id: 'user-1',
        is_broadcast: false,
        sender_id: 'editor-1',
        sender_label: 'هيئة التحرير (يوسف)',
        category: 'appreciation',
        title: 'تم اعتماد مساهمتك المعجمية: «دغيا»',
        body: 'اعتمدت هيئة التحرير مقترحك الخاص بـ «دغيا» لإدراجه في التحديث الرسمي القادم للمعجم.',
        requires_ack: false,
        read_at: null,
        acknowledged_at: null,
        pinned_until: null,
        related_submission_id: 'sub-001',
        related_entry_id: 'NEW:dghya',
        decision_status: 'accepted',
        created_at: '2026-11-03T07:00:00.000Z',
      },
      {
        id: 'msg-changes-2',
        recipient_id: 'user-1',
        is_broadcast: false,
        sender_id: 'editor-1',
        sender_label: 'هيئة التحرير (يوسف)',
        category: 'editorial_note',
        title: 'مطلوب تعديل بسيط على مقترحك: «بزاف»',
        body: 'ملاحظة المحرر: يرجى إضافة شاهد سياقي يوضح الاستعمال الجهوي.',
        requires_ack: false,
        read_at: null,
        acknowledged_at: null,
        pinned_until: null,
        related_submission_id: 'sub-002',
        related_entry_id: '108',
        decision_status: 'needs_changes',
        created_at: '2026-11-03T07:10:00.000Z',
      },
    ]

    const html = renderToStaticMarkup(
      <MemberMessagesPage
        messages={messages}
        unreadCount={2}
        canAccessEditorialTools={false}
        onMarkRead={noop}
        onMarkAllRead={noop}
        onAcknowledgeWarning={noop}
        onOpenAdminMembers={noop}
        onStartRapidReview={noop}
        onOpenSubmissionFromMessage={noop}
      />,
    )

    expect(html).toContain('قرارات المساهمات (2)')
    expect(html).toContain('انتقل إلى مقترحك المعتمد')
    expect(html).toContain('تعديل المقترح وإعادة إرساله')
    expect(html).toContain('عرض في سجل مساهماتي')
  })

  it('defines PostgreSQL trigger trg_submission_decision_inbox_notify in migration and schema', () => {
    const migrationSql = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'supabase/migrations/20261103160000_editorial_inbox_notifications_and_contributor_stats.sql',
      ),
      'utf8',
    )
    expect(migrationSql).toContain('notify_contributor_on_submission_decision')
    expect(migrationSql).toContain('trg_submission_decision_inbox_notify')
    expect(migrationSql).toContain('related_submission_id')
    expect(migrationSql).toContain('documented_words_count')
    expect(migrationSql).toContain('documented_examples_count')
  })
})

describe('Public Contributors Honor Roll interactive profile card', () => {
  const sampleContributors: PublicContributorRecord[] = [
    {
      public_slug: 'salma-9f2a1c',
      display_name: 'سلمى الإدريسي',
      dialect_region: 'فاس - مكناس',
      specialty: 'اللسانيات الحاسوبية وتوثيق الأمثال المغربية',
      github_handle: 'salma-ling',
      avatar_source: 'arcode',
      avatar_path: null,
      avatar_seed: 'salma-9f2a1c',
      role: 'editor',
      accepted_count: 14,
      attestations_count: 28,
      documented_words_count: 19,
      documented_examples_count: 23,
      recent_words: ['دغيا', 'بزاف'],
      joined_year: 2026,
    },
  ]

  it('renders clickable contributor cards and detailed modal with badges, region, specialty, and word/example counts', () => {
    const noop = () => {}

    const modalHtml = renderToStaticMarkup(
      <PublicContributorsPage
        contributors={sampleContributors}
        loading={false}
        isAuthenticated={false}
        entriesCount={120}
        corpusVersion="1.5.0"
        onOpenProfileOrAuth={noop}
        onStartContributing={noop}
        onExploreRegionInLexicon={noop}
        onInspectWordInLexicon={noop}
        initialSelectedSlug="salma-9f2a1c"
      />,
    )

    expect(modalHtml).toContain('role="dialog"')
    expect(modalHtml).toContain('سلمى الإدريسي')
    expect(modalHtml).toContain('فاس - مكناس')
    expect(modalHtml).toContain('اللسانيات الحاسوبية وتوثيق الأمثال المغربية')
    expect(modalHtml).toContain('مفردة ساهم في توثيقها')
    expect(modalHtml).toContain('شاهد وتصديق سياقي')
    expect(modalHtml).toContain('19')
    expect(modalHtml).toContain('23')
    expect(modalHtml).toContain('بطاقة الهوية المعجمية للمساهم')
    expect(modalHtml).toContain('ARC-2026-')
    expect(modalHtml).toContain('حصيلة التوثيق والإحصائيات في المنصة')
    expect(modalHtml).toContain('تاريخ المساهم وسجل مسيرته في المنصة')
    expect(modalHtml).toContain('الانضمام وتأسيس الهوية المعجمية')
    expect(modalHtml).toContain('زميل الديوان المعجمي الأعلى')
    expect(modalHtml).toContain('وسام القلم المحكَّم')
    expect(modalHtml).toContain('تاج المتن المغربي')
    expect(modalHtml).toContain('خاتم الزليج الدلالي')
    expect(modalHtml).toContain('عدسة الضبط والتصويب')
    expect(modalHtml).toContain('أسطرلاب الشواهد')
    expect(modalHtml).toContain('غرسة الرعيل المؤسس')
    expect(modalHtml).toContain('محرر معتمد')
    expect(modalHtml).toContain('خبير الفئات')
    expect(modalHtml).toContain('مصحح نشط')
    expect(modalHtml).toContain('موثّق معجمي متقدم')
    expect(modalHtml).toContain('مدقّق شواهد')
    expect(modalHtml).toContain('خبير لهجي جهوي')
    expect(modalHtml).toContain('دغيا')
    expect(modalHtml).toContain('استعرض مفردات هذه المنطقة')
    expect(modalHtml).toContain('بطاقة الشرف (صورة)')
    expect(modalHtml).toContain('صيغة إشهاد مرجعي للسيرة الذاتية والملف الأكاديمي')
  })

  it('separates Editorial Board from Community Contributors, shows badge catalog & pioneer regions, and builds bilingual CV citations', async () => {
    const { buildContributorAcademicCitation } = await import(
      '../src/utils/contributorHonorCard'
    )
    const {
      computeContributorBadges,
      computeContributorHonorStanding,
      computeNextBadgeMilestones,
      MERIT_BADGE_CATALOG,
    } = await import('../src/utils/meritBadges')
    const noop = () => {}
    const mixedRoster: PublicContributorRecord[] = [
      ...sampleContributors,
      {
        public_slug: 'amine-22b910',
        display_name: 'أمين التازي',
        dialect_region: 'الدار البيضاء والوسط',
        specialty: 'توثيق التعابير اليومية',
        github_handle: 'amine-dev',
        avatar_source: 'arcode',
        avatar_path: null,
        avatar_seed: 'amine-22b910',
        role: 'reviewer',
        accepted_count: 6,
        attestations_count: 18,
        documented_words_count: 6,
        documented_examples_count: 18,
        recent_words: ['واخا'],
        joined_year: 2026,
      },
    ]

    const amineBadges = computeContributorBadges({
      role: 'reviewer',
      acceptedCount: 6,
      documentedWordsCount: 6,
      attestationsCount: 18,
      dialectRegion: 'الدار البيضاء والوسط',
      specialty: 'توثيق التعابير اليومية',
      githubHandle: 'amine-dev',
      joinedYear: 2026,
    })
    expect(amineBadges.map((b) => b.id)).toContain('category_expert')
    expect(amineBadges.map((b) => b.id)).toContain('active_corrector')
    expect(amineBadges.map((b) => b.id)).toContain('pioneer_cohort')
    expect(MERIT_BADGE_CATALOG.length).toBe(11)

    const amineStanding = computeContributorHonorStanding(amineBadges)
    expect(amineStanding.totalPoints).toBeGreaterThanOrEqual(100)
    expect(amineStanding.standingTitle).toBe('حامل الأختام العلمية الكبرى')

    const newcomerMilestones = computeNextBadgeMilestones({
      role: 'reviewer',
      acceptedCount: 0,
      attestationsCount: 3,
      dialectRegion: 'مراكش والحوز',
    })
    expect(newcomerMilestones.length).toBe(3)
    expect(newcomerMilestones[0].badge.id).toBe('active_corrector')
    expect(newcomerMilestones[0].percent).toBe(60)

    const html = renderToStaticMarkup(
      <PublicContributorsPage
        contributors={mixedRoster}
        loading={false}
        isAuthenticated={false}
        darkMode
        entriesCount={120}
        corpusVersion="2.4.0"
        onOpenProfileOrAuth={noop}
        onStartContributing={noop}
        onExploreRegionInLexicon={noop}
        onInspectWordInLexicon={noop}
      />,
    )

    expect(html).toContain('الهيئة التحريرية والعلمية المشرفة (1)')
    expect(html).toContain('مجتمع الموثّقين والمساهمين المعتمدين (1)')
    expect(html).toContain('دليل الأوسمة ومعايير الاستحقاق (11)')
    expect(html).toContain('role="progressbar"')
    expect(html).toContain('الوسام القادم:')
    expect(html).toContain('متبقٍّ 4 مساهمات معتمدة · 6/10')
    expect(html).toContain('خبير الفئات')
    expect(html).toContain('مصحح نشط')
    expect(html).toContain('بطاقة الهوية')
    expect(html).toContain('التوزيع الجهوي للموثّقين')
    expect(html).toContain('جهات بانتظار أول موثّق معلَن في اللوحة')
    expect(html).toContain('من توثيقاته:')
    expect(html).toContain('«واخا»')

    const citations = buildContributorAcademicCitation(
      sampleContributors[0],
      '2.4.0',
      'https://darija.arcode.org/contributors',
      amineBadges,
    )
    expect(citations.arabic).toContain('سلمى الإدريسي')
    expect(citations.arabic).toContain('19 مفردة')
    expect(citations.arabic).toContain('الأختام العلمية الممنوحة')
    expect(citations.english).toContain('Certified Lexicon Editor')
    expect(citations.english).toContain('https://darija.arcode.org/contributors/salma-9f2a1c')
  })
})

