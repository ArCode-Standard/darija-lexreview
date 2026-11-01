import { describe, expect, it } from 'vitest'
import { sha256Hex } from '../src/utils/sha256'
import {
  buildEntryShareUrl,
  buildWorkbenchUrlSearch,
  parseWorkbenchUrlState,
} from '../src/utils/urlState'
import {
  clearCorpusSnapshot,
  loadCorpusSnapshot,
  saveCorpusSnapshot,
} from '../src/services/corpusCache'
import { DEMO_ENTRIES, DEMO_RAW_CORPUS, formatStatusLabel } from '../src/services/dataset'
import { buildOfficialExportBundle } from '../src/services/exporter'
import type { SubmissionRecord } from '../src/types/lexicon'

describe('SHA-256 checksums & Release Manifest integrity', () => {
  it('computes exact FIPS 180-4 SHA-256 hex digests', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
    // Deterministic UTF-8 Arabic digest
    expect(sha256Hex('معجم الدارجة المغربية')).toHaveLength(64)
    expect(sha256Hex('معجم الدارجة المغربية')).toBe(sha256Hex('معجم الدارجة المغربية'))
  })

  it('attaches SHA-256 checksums to bundle and PR Markdown without adding extra keys to official JSON files', () => {
    const sub: SubmissionRecord = {
      id: 'sub-sha-1',
      entry_id: '1',
      proposed_data: {
        word_ar: 'بزاف',
        arabizi: 'bzzaf',
        msa_translation: 'كثيراً جداً',
      },
      evidence: [],
      reviewer_note: null,
      status: 'accepted',
      reviewer_id: 'rev-1',
      editor_id: 'ed-1',
      editor_note: 'تعديل معتمد للاختبار.',
      created_at: '2026-11-01T10:00:00.000Z',
      updated_at: '2026-11-01T10:05:00.000Z',
    }

    const bundle = buildOfficialExportBundle(DEMO_RAW_CORPUS, [sub], '1.5.1')

    expect(bundle.checksums.lexiconSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(bundle.checksums.examplesSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(bundle.patchSummary.lexicon_sha256).toBe(bundle.checksums.lexiconSha256)
    expect(bundle.patchSummary.examples_sha256).toBe(bundle.checksums.examplesSha256)
    expect(bundle.prMarkdown).toContain(bundle.checksums.lexiconSha256)
    expect(bundle.prMarkdown).toContain(bundle.checksums.examplesSha256)

    // Ensure official JSON files strictly match exact downloaded string digest and have zero non-schema keys
    expect(Object.keys(bundle.lexiconJson).sort()).toEqual(['categories', 'entries', 'meta'])
    expect(Object.keys(bundle.examplesJson).sort()).toEqual(['examples', 'meta'])
    expect(sha256Hex(`${JSON.stringify(bundle.lexiconJson, null, 2)}\n`)).toBe(
      bundle.checksums.lexiconSha256,
    )
    expect(sha256Hex(`${JSON.stringify(bundle.examplesJson, null, 2)}\n`)).toBe(
      bundle.checksums.examplesSha256,
    )
  })
})

describe('URL deep-linking state sync', () => {
  it('routes direct ?entry= links into explorer entries view and round-trips filters', () => {
    const parsedFromEntryOnly = parseWorkbenchUrlState('?entry=42')
    expect(parsedFromEntryOnly.tab).toBe('explorer')
    expect(parsedFromEntryOnly.explorerSubView).toBe('entries')
    expect(parsedFromEntryOnly.entryId).toBe('42')

    const search = buildWorkbenchUrlSearch({
      tab: 'explorer',
      explorerSubView: 'entries',
      entryId: '42',
      category: 'ظرف',
      exampleFilter: 'needs_examples',
      query: 'بزاف',
    })
    const roundTripped = parseWorkbenchUrlState(search)
    expect(roundTripped).toEqual({
      tab: 'explorer',
      explorerSubView: 'entries',
      entryId: '42',
      category: 'ظرف',
      exampleFilter: 'needs_examples',
      query: 'بزاف',
    })
  })

  it('builds clean shareable entry URLs', () => {
    const shareUrl = buildEntryShareUrl('108', 'https://lexreview.example.org/?tab=submissions')
    expect(shareUrl).toBe('https://lexreview.example.org/?tab=explorer&entry=108#workspace')
  })
})

describe('Offline corpus snapshot cache & lifecycle statuses', () => {
  it('saves and restores full corpus snapshots when offline', async () => {
    await clearCorpusSnapshot()
    expect(await loadCorpusSnapshot()).toBeNull()

    const sampleCorpus = {
      entries: DEMO_ENTRIES,
      totalExamplesCount: 4,
      categories: ['ظرف', 'أداة استفهام'],
      rawCorpus: DEMO_RAW_CORPUS,
    }
    const cachedAt = await saveCorpusSnapshot(sampleCorpus)
    expect(cachedAt).toBeTruthy()

    const restored = await loadCorpusSnapshot()
    expect(restored).not.toBeNull()
    expect(restored?.corpus.entries.length).toBe(DEMO_ENTRIES.length)
    expect(restored?.cachedAt).toBe(cachedAt)
  })

  it('formats withdrawn and superseded submission statuses in Arabic', () => {
    expect(formatStatusLabel('withdrawn')).toContain('مسحوب')
    expect(formatStatusLabel('superseded')).toContain('مُستبدل')
  })
})
