import { describe, expect, it } from 'vitest'
import { matchesDarijaQuery, toDarijaPhoneticSkeleton } from '../src/utils/phoneticSearch'
import type { LexicalEntry } from '../src/types/lexicon'

describe('Darija phonetic normalization', () => {
  it.each([['3','ع'],['7','ح'],['5','خ'],['4','غ'],['9','ق'],['q','ق'],['ch','ش'],['sh','ش'],['kh','خ'],['gh','غ']])(
    'maps %s to its Arabic consonant', (latin, arabic) => {
      expect(toDarijaPhoneticSkeleton(latin)).toBe(toDarijaPhoneticSkeleton(arabic))
    },
  )
  it('normalizes gemination and diacritics', () => {
    expect(toDarijaPhoneticSkeleton('bzzaf')).toBe(toDarijaPhoneticSkeleton('بزّاف'))
  })
  it('matches Arabic headwords from Arabizi queries', () => {
    const entry = {
      id:'LEX-0001', numericId:1, word:'شحال', latin:'ch7al', meaning:'كم',
      french:'combien', category:'استفهام', status:'reviewed', reviewNotes:'',
      provenance:{license:'CC BY 4.0'}, examples:[],
    } as unknown as LexicalEntry
    expect(matchesDarijaQuery(entry,'sh7al')).toBe(true)
    expect(matchesDarijaQuery(entry,'شحال')).toBe(true)
  })
})
