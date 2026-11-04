import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from '../src/App'
import { AuthDialog } from '../src/components/AuthDialog'
import { CommandPalette } from '../src/components/CommandPalette'
import { Footer } from '../src/components/Footer'
import { HeroSection } from '../src/components/HeroSection'
import { Navbar } from '../src/components/Navbar'
import { WorkspaceShell } from '../src/components/WorkspaceShell'
import { CorpusInsightsPage } from '../src/components/Workbench/CorpusInsightsPage'
import { LexiconSidebar } from '../src/components/Workbench/LexiconSidebar'
import { PublicContributorsPage } from '../src/components/Workbench/PublicContributorsPage'
import { RapidReviewPanel } from '../src/components/Workbench/RapidReviewPanel'
import { DEMO_ENTRIES } from '../src/services/dataset'

function collectTsxFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...collectTsxFiles(fullPath))
    } else if (entry.name.endsWith('.tsx')) {
      results.push(fullPath)
    }
  }
  return results
}

describe('JSX React child safety & SSR smoke rendering', () => {
  it('contains zero object-literal JSX children (such as double-braced comments {{/* ... */}}) across src/**/*.tsx', () => {
    const srcDir = path.resolve(process.cwd(), 'src')
    const tsxFiles = collectTsxFiles(srcDir)
    expect(tsxFiles.length).toBeGreaterThan(10)

    const violations: string[] = []

    for (const filePath of tsxFiles) {
      const code = fs.readFileSync(filePath, 'utf8')
      const sf = ts.createSourceFile(
        filePath,
        code,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      )

      const inspectNode = (node: ts.Node) => {
        if (
          ts.isJsxExpression(node) &&
          node.parent &&
          (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) &&
          node.expression &&
          ts.isObjectLiteralExpression(node.expression)
        ) {
          const pos = sf.getLineAndCharacterOfPosition(node.getStart())
          violations.push(
            `${path.relative(process.cwd(), filePath)}:${pos.line + 1} -> ${node.getText()}`,
          )
        }
        ts.forEachChild(node, inspectNode)
      }

      inspectNode(sf)
    }

    expect(violations).toEqual([])
  })

  it('renders App and core UI shells without invalid React child errors', () => {
    const noop = () => {}

    expect(() => renderToStaticMarkup(<App />)).not.toThrow()

    expect(() =>
      renderToStaticMarkup(
        <Navbar
          isAuthenticated={false}
          userDisplayName={null}
          userRole={null}
          canAccessEditorialTools={false}
          unreadMessagesCount={0}
          onOpenAuth={noop}
          onOpenCommandPalette={noop}
          onSelectWorkbenchTab={noop}
          onNavigatePage={noop}
        />,
      ),
    ).not.toThrow()

    expect(() =>
      renderToStaticMarkup(
        <HeroSection
          entries={DEMO_ENTRIES}
          entriesCount={DEMO_ENTRIES.length}
          categoriesCount={5}
          examplesCount={4}
          dataMode="live"
          isAuthenticated={false}
          onStartRapidReview={noop}
          onStartDetailedReview={noop}
          onSelectEntry={noop}
          onQuickAddWord={noop}
          onOpenContributors={noop}
          onSelectWorkbenchTab={noop}
        />,
      ),
    ).not.toThrow()

    expect(() =>
      renderToStaticMarkup(
        <WorkspaceShell
          activePage="lexicon"
          explorerSubView="entries"
          isFocusMode={false}
          onExitFocusMode={noop}
          isAuthenticated={false}
          userDisplayName={null}
          userRole={null}
          canAccessEditorialTools={false}
          isStaffRole={false}
          darkMode
          onToggleDarkMode={noop}
          dataMode="live"
          entriesCount={DEMO_ENTRIES.length}
          corpusVersion="1.5.0"
          cachedCorpusAt={null}
          completedTodayCount={0}
          draftsCount={0}
          unreadMessagesCount={0}
          onReloadCorpus={noop}
          onOpenCommandPalette={noop}
          onNavigatePage={noop}
        >
          <LexiconSidebar
            entries={DEMO_ENTRIES}
            filteredEntries={DEMO_ENTRIES}
            activeEntry={DEMO_ENTRIES[0]}
            categories={['التواصل', 'الزمن']}
            query=""
            selectedCategory="all"
            exampleFilter="all"
            selectedEntryType="all"
            selectedRegister="all"
            selectedRegion="all"
            regions={['مشترك عام']}
            dataMode="live"
            drafts={{}}
            onQueryChange={noop}
            onCategoryChange={noop}
            onExampleFilterChange={noop}
            onEntryTypeChange={noop}
            onRegisterChange={noop}
            onRegionChange={noop}
            onSelectEntry={noop}
            onResetFilters={noop}
          />
        </WorkspaceShell>,
      ),
    ).not.toThrow()

    expect(() =>
      renderToStaticMarkup(
        <RapidReviewPanel
          entries={DEMO_ENTRIES}
          categories={['التواصل']}
          corpusVersion="1.5.0"
          canAccessEditorialTools={false}
          isFocusMode={false}
          onToggleFocusMode={noop}
          userEmail={null}
          userVerdictsByEntryId={{}}
          userVerdictsByExampleId={{}}
          summariesByEntryId={{}}
          summariesByExampleId={{}}
          skippedIds={new Set()}
          skippedExampleIds={new Set()}
          canUndo={false}
          completedTodayCount={0}
          calibrationStats={{ passed: 0, total: 0 }}
          onRecordCalibrationOutcome={noop}
          sessionPrefs={{
            dialectRegion: 'مشترك عام',
            dailyGoal: 10,
            rightsConfirmedOnce: true,
            trainingPermission: 'allowed',
          }}
          onUpdateSessionPrefs={noop}
          onRecordAttestation={async () => ({ storedLive: false })}
          onSkipEntry={noop}
          onUndoLastStep={async () => null}
          onResetSessionSkips={noop}
          onSaveDraft={noop}
          onOpenDetailedEntry={noop}
          onRequireLogin={noop}
          onSubmissionSuccess={noop}
        />,
      ),
    ).not.toThrow()

    expect(() =>
      renderToStaticMarkup(
        <CorpusInsightsPage
          entries={DEMO_ENTRIES}
          totalExamplesCount={4}
          corpusVersion="1.5.0"
          onEnrichEntry={noop}
          onSelectCategoryInLexicon={noop}
          onSelectRegionInLexicon={noop}
          onStartRapidReview={noop}
        />,
      ),
    ).not.toThrow()

    expect(() =>
      renderToStaticMarkup(
        <PublicContributorsPage
          contributors={[]}
          loading={false}
          isAuthenticated={false}
          entriesCount={DEMO_ENTRIES.length}
          corpusVersion="1.5.0"
          onOpenProfileOrAuth={noop}
          onStartContributing={noop}
        />,
      ),
    ).not.toThrow()

    expect(() =>
      renderToStaticMarkup(
        <AuthDialog
          open
          mode="page"
          onClose={noop}
          userEmail={null}
          authProvider={null}
          profile={null}
          recoveryMode={false}
          draftsList={[]}
          entries={DEMO_ENTRIES}
          corpusVersion="1.5.0"
          totalAttestationsCount={0}
          onClearRecovery={noop}
          onAuthChanged={noop}
          onRemoveSyncedDrafts={noop}
          onDraftsSyncedSuccess={noop}
          onJumpToAdminGovernance={noop}
        />,
      ),
    ).not.toThrow()

    expect(() =>
      renderToStaticMarkup(
        <CommandPalette
          open
          onClose={noop}
          entries={DEMO_ENTRIES}
          isAuthenticated
          canAccessEditorialTools={false}
          draftsCount={0}
          onNavigatePage={noop}
          onSelectEntry={noop}
          onQuickAddWord={noop}
        />,
      ),
    ).not.toThrow()

    expect(() =>
      renderToStaticMarkup(<Footer onOpenContributors={noop} />),
    ).not.toThrow()
  })

  it('strictly limits Quick Search (⌘K) and Command Palette to registered authenticated members', () => {
    const noop = () => {}

    const visitorNavbarHtml = renderToStaticMarkup(
      <Navbar
        isAuthenticated={false}
        userDisplayName={null}
        userRole={null}
        canAccessEditorialTools={false}
        unreadMessagesCount={0}
        darkMode
        onToggleDarkMode={noop}
        onOpenAuth={noop}
        onOpenCommandPalette={noop}
        onSelectWorkbenchTab={noop}
        onNavigatePage={noop}
      />,
    )
    expect(visitorNavbarHtml).not.toContain('⌘K')
    expect(visitorNavbarHtml).not.toContain('بحث سريع')
    expect(visitorNavbarHtml).not.toContain('صندوق الرسائل')
    expect(visitorNavbarHtml).toContain('التبديل إلى الوضع النهاري')

    const memberNavbarHtml = renderToStaticMarkup(
      <Navbar
        isAuthenticated
        userDisplayName="عضو موثق"
        userRole="reviewer"
        canAccessEditorialTools={false}
        unreadMessagesCount={2}
        darkMode={false}
        onToggleDarkMode={noop}
        onOpenAuth={noop}
        onOpenCommandPalette={noop}
        onSelectWorkbenchTab={noop}
        onNavigatePage={noop}
      />,
    )
    expect(memberNavbarHtml).toContain('⌘K')
    expect(memberNavbarHtml).toContain('بحث سريع')
    expect(memberNavbarHtml).toContain('التبديل إلى الوضع الليلي')

    const visitorShellHtml = renderToStaticMarkup(
      <WorkspaceShell
        activePage="lexicon"
        explorerSubView="entries"
        isFocusMode={false}
        onExitFocusMode={noop}
        isAuthenticated={false}
        userDisplayName={null}
        userRole={null}
        canAccessEditorialTools={false}
        isStaffRole={false}
        darkMode
        onToggleDarkMode={noop}
        dataMode="live"
        entriesCount={DEMO_ENTRIES.length}
        corpusVersion="1.5.0"
        cachedCorpusAt={null}
        completedTodayCount={0}
        draftsCount={0}
        unreadMessagesCount={0}
        onReloadCorpus={noop}
        onOpenCommandPalette={noop}
        onNavigatePage={noop}
      >
        <div>محتوى</div>
      </WorkspaceShell>,
    )
    expect(visitorShellHtml).not.toContain('⌘K')
    expect(visitorShellHtml).not.toContain('بحث أو انتقال سريع')
    expect(visitorShellHtml).not.toContain('صندوق الرسائل')
    expect(visitorShellHtml).toContain('التبديل إلى الوضع النهاري')

    const memberShellHtml = renderToStaticMarkup(
      <WorkspaceShell
        activePage="lexicon"
        explorerSubView="entries"
        isFocusMode={false}
        onExitFocusMode={noop}
        isAuthenticated
        userDisplayName="عضو موثق"
        userRole="reviewer"
        canAccessEditorialTools={false}
        isStaffRole={false}
        darkMode
        onToggleDarkMode={noop}
        dataMode="live"
        entriesCount={DEMO_ENTRIES.length}
        corpusVersion="1.5.0"
        cachedCorpusAt={null}
        completedTodayCount={0}
        draftsCount={0}
        unreadMessagesCount={0}
        onReloadCorpus={noop}
        onOpenCommandPalette={noop}
        onNavigatePage={noop}
      >
        <div>محتوى</div>
      </WorkspaceShell>,
    )
    expect(memberShellHtml).toContain('⌘K')
    expect(memberShellHtml).toContain('بحث أو انتقال سريع')

    const visitorPaletteHtml = renderToStaticMarkup(
      <CommandPalette
        open
        onClose={noop}
        entries={DEMO_ENTRIES}
        isAuthenticated={false}
        canAccessEditorialTools={false}
        draftsCount={0}
        onNavigatePage={noop}
        onSelectEntry={noop}
        onQuickAddWord={noop}
      />,
    )
    expect(visitorPaletteHtml).toBe('')

    const memberPaletteHtml = renderToStaticMarkup(
      <CommandPalette
        open
        onClose={noop}
        entries={DEMO_ENTRIES}
        isAuthenticated
        canAccessEditorialTools={false}
        draftsCount={0}
        onNavigatePage={noop}
        onSelectEntry={noop}
        onQuickAddWord={noop}
      />,
    )
    expect(memberPaletteHtml).toContain('تصفح مفردات المعجم')
    expect(memberPaletteHtml).toContain('ملفي الشخصي وربط GitHub / Google')
  })

  it('syncs Light/Dark theme across Footer links and all 6 static institutional pages without inline CSP violations', () => {
    const footerHtml = renderToStaticMarkup(<Footer onOpenContributors={() => {}} />)
    expect(footerHtml).not.toContain('الوضع النهاري')
    expect(footerHtml).not.toContain('الوضع الليلي')
    expect(footerHtml).toContain('عن المنصة')
    expect(footerHtml).toContain('المنهجية')
    expect(footerHtml).toContain('الخصوصية')
    expect(footerHtml).toContain('الشروط')
    expect(footerHtml).toContain('الإبلاغ')
    expect(footerHtml).toContain('الإسناد والترخيص')

    const siteCss = fs.readFileSync(path.resolve(process.cwd(), 'public/site.css'), 'utf8')
    expect(siteCss).toContain('html[data-theme="dark"]')
    expect(siteCss).toContain('html[data-theme="light"]')

    const themeJs = fs.readFileSync(path.resolve(process.cwd(), 'public/theme.js'), 'utf8')
    expect(themeJs).toContain('arcode_lexreview_theme')
    expect(themeJs).toContain('data-theme-toggle')

    const institutionalPages = [
      'public/about/index.html',
      'public/methodology/index.html',
      'public/privacy/index.html',
      'public/terms/index.html',
      'public/reporting/index.html',
      'public/attribution/index.html',
      'public/404.html',
    ]

    for (const relPath of institutionalPages) {
      const html = fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8')
      expect(html).toContain('<script src="/theme.js"></script>')
      expect(html).toContain('href="/site.css"')
      expect(html).toContain('data-theme-toggle')
      // Ensure zero inline executable scripts so Content-Security-Policy (script-src 'self') never blocks theme sync
      expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/i)
    }
  })
})
