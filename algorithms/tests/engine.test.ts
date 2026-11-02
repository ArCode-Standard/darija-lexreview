import { describe, expect, it } from 'vitest'
import {
  analyzeText,
  analyzeLexicalForm,
  transliterateArabizi,
  findDuplicateCandidates,
  detectPolarityConflicts,
  inferRegionHints,
  scoreEntryCompleteness,
} from '../index'

describe('Darija algorithm engine', () => {
  it('analyzes text without losing the original input', () => {
    const result = analyzeText('  السَّلَام  ')
    expect(result.original).toBe('  السَّلَام  ')
    expect(result.script).toBe('arabic')
    expect(result.normalized).toBe('السلام')
  })

  it('normalizes Arabic comparison forms but preserves source form', () => {
    const result = analyzeLexicalForm('أهلاً')
    expect(result.original).toBe('أهلاً')
    expect(result.comparisonForm).toBe('اهلا')
  })

  it('returns a low-confidence Arabizi candidate', () => {
    const result = transliterateArabizi('3lach')
    expect(result.value).toBe('علach')
    expect(result.confidence).toBe('low')
  })

  it('ranks normalized duplicate candidates', () => {
    const result = findDuplicateCandidates('سلام', [{ id: '1', text: 'سَلام' }])
    expect(result[0]?.method).toBe('normalized')
  })

  it('flags explicit polarity clashes for human review', () => {
    const result = detectPolarityConflicts([
      { id: 'a', text: 'ما كاينش' },
      { id: 'b', text: 'كاين' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('review')
  })

  it('requires sourced lexicon entries for regional hints', () => {
    const result = inferRegionHints('واش هاد الكلمة', [
      { term: 'واش', region: 'north', sourceId: 'dataset:1' },
    ])
    expect(result[0]?.sourceIds).toContain('dataset:1')
  })

  it('scores completeness, not correctness', () => {
    const result = scoreEntryCompleteness({ term: 'واخا' })
    expect(result.score).toBe(35)
    expect(result.signals.map((signal) => signal.code)).toContain('MISSING_DEFINITION')
  })
})
