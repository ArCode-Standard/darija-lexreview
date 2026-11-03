import { describe, expect, it } from 'vitest'
import {
  analyzeText,
  analyzeLexicalForm,
  transliterateArabizi,
  transliterateArabiziCandidates,
  findDuplicateCandidates,
  detectPolarityConflicts,
  inferRegionHints,
  scoreEntryCompleteness,
  analyzeMorphology,
  cosineSimilarity,
  rankVectorCandidates,
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
    expect(analyzeLexicalForm('مدرسة').comparisonForm).toBe('مدرسة')
  })

  it('transliterates common Darija Arabizi digraphs and digits', () => {
    const result = transliterateArabizi('3lach')
    expect(result.value).toBe('علاش')
    expect(result.confidence).toBe('low')
    expect(result.notes.length).toBeGreaterThan(0)
  })

  it('returns ranked alternatives for context-sensitive consonants', () => {
    const candidates = transliterateArabiziCandidates('gari', { latinTokenPolicy: 'all' })
    expect(candidates.length).toBeGreaterThan(1)
    expect(candidates[0]?.value).toBe('گاري')
    expect(candidates.some((candidate) => candidate.value === 'جاري')).toBe(true)
    expect(candidates[0]!.score).toBeGreaterThan(candidates[1]!.score)
  })

  it('ranks a provisional lexical hint above letter-by-letter guesses', () => {\n    const result = transliterateArabiziCandidates('salam')\n    expect(result[0]?.value).toBe('سلام')\n    expect(result[0]?.decisions).toContain('seed-lexicon:salam')\n  })\n\n  it('uses adjacent vowels to rank soft c while retaining a hard-c alternative', () => {
    const candidates = transliterateArabiziCandidates('citi', { latinTokenPolicy: 'all' })
    expect(candidates[0]?.value).toBe('سيتي')
    expect(candidates.some((candidate) => candidate.value.startsWith('كي'))).toBe(true)
  })

  it('supports common digit conventions and digraphs', () => {
    expect(transliterateArabizi('khobz').value).toBe('خوبز')
    expect(transliterateArabizi('9alb').value).toBe('قالب')
  })

  it('preserves Arabic text, punctuation, and whitespace in mixed-script input', () => {
    expect(transliterateArabizi('3lach سلام؟').value).toBe('علاش سلام؟')
    expect(transliterateArabizi('hello 3lach salam').value).toBe('hello علاش سلام')
    expect(transliterateArabizi('gari', { latinTokenPolicy: 'all' }).value).toBe('گاري')
  })

  it('bounds candidate generation and rejects invalid limits', () => {
    expect(transliterateArabiziCandidates('gari', { maxCandidates: 1 })).toHaveLength(1)
    expect(() => transliterateArabiziCandidates('gari', { maxCandidates: 0 })).toThrow(RangeError)
    expect(() => transliterateArabiziCandidates('gari', { maxCandidates: 21 })).toThrow(RangeError)
    expect(transliterateArabiziCandidates('   ')).toEqual([])
  })

  it('ranks normalized and misspelled duplicate candidates', () => {
    const normalized = findDuplicateCandidates('سلام', [{ id: '1', text: 'سَلام' }])
    expect(normalized[0]?.method).toBe('normalized')
    const typo = findDuplicateCandidates('سلام', [{ id: '2', text: 'سلم' }], 0.6)
    expect(typo[0]?.similarity).toBeGreaterThan(0.6)
  })

  it('rejects empty duplicate queries and invalid thresholds', () => {
    expect(findDuplicateCandidates('   ', [{ id: '1', text: 'سلام' }])).toEqual([])
    expect(() => findDuplicateCandidates('سلام', [], 1.5)).toThrow(RangeError)
  })

  it('flags polarity clashes only when claims share a topic', () => {
    const related = detectPolarityConflicts([
      { id: 'a', text: 'ما كاينش الماء' },
      { id: 'b', text: 'كاين الماء' },
    ])
    expect(related).toHaveLength(1)
    expect(related[0].severity).toBe('review')
    const unrelated = detectPolarityConflicts([
      { id: 'a', text: 'ما كاينش الماء' },
      { id: 'b', text: 'كاين الخبز' },
    ])
    expect(unrelated).toHaveLength(0)
  })

  it('matches dialect terms on token boundaries and keeps source IDs', () => {
    const result = inferRegionHints('واش هاد الكلمة', [
      { term: 'واش', region: 'north', sourceId: 'dataset:1' },
      { term: 'اش', region: 'south', sourceId: 'dataset:2' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]?.region).toBe('north')
    expect(result[0]?.sourceIds).toContain('dataset:1')
  })

  it('scores completeness, not correctness', () => {
    const result = scoreEntryCompleteness({ term: 'واخا' })
    expect(result.score).toBe(35)
    expect(result.signals.map((signal) => signal.code)).toContain('MISSING_DEFINITION')
  })

  it('returns morphology as hypotheses, not definitive segmentation', () => {
    const result = analyzeMorphology('كنكتب')
    expect(result.tokens[0]?.prefixes).toContain('كن')
    expect(result.tokens[0]?.confidence).toBe('low')
  })

  it('computes cosine similarity for supplied vectors only', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1)
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0)
    expect(() => cosineSimilarity([1], [1, 2])).toThrow(RangeError)
    const ranked = rankVectorCandidates([1, 0], [
      { id: 'close', vector: [0.9, 0.1] },
      { id: 'far', vector: [0, 1] },
    ])
    expect(ranked[0]?.id).toBe('close')
  })
})
