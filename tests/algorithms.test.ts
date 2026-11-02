import {describe,expect,it} from 'vitest'
import {analyzeLexicalContexts,characterNgramSimilarity,cosineSimilarity,damerauLevenshteinDistance,detectIntegrityIssues,discoverVariantCandidates,normalizeArabicForSearch,normalizeArabiziForSearch,rankReviewTasks,scoreEvidenceQuality,summarizeRegionalDistribution} from '../algorithms'
describe('Darija Intelligence Engine',()=>{
 it('normalizes Arabic and Arabizi search forms',()=>{expect(normalizeArabicForSearch(' أَهْلًا ـ ')).toBe('اهلا');expect(normalizeArabiziForSearch('Chno-kayen')).toBe('chno kayen')})
 it('calculates string similarities',()=>{expect(damerauLevenshteinDistance('abcd','abdc')).toBe(1);expect(characterNgramSimilarity('chno','chno')).toBe(1)})
 it('discovers candidates without merging',()=>{expect(discoverVariantCandidates([{id:'a',form:'شنو'},{id:'b',form:'أشنو'}],0.7).length).toBeGreaterThan(0)})
 it('flags duplicate forms and possible sense differences',()=>{expect(detectIntegrityIssues([{id:'1',word:'شنو',meaning:'ماذا'},{id:'2',word:'شنو',meaning:'أي شيء'}]).map(x=>x.kind)).toContain('possible_meaning_conflict')})
 it('scores evidence metadata completeness',()=>{expect(scoreEvidenceQuality([{sourceName:'Dictionary',sourceType:'dictionary',url:'https://example.org',rightsHolder:'X',license:'CC BY',note:'entry',independent:true}]).score).toBe(100)})
 it('ranks review tasks deterministically',()=>{expect(rankReviewTasks([{id:'low',evidenceComplete:true,lastReviewedAt:'2026-10-30'},{id:'high',hasContradiction:true,evidenceComplete:false}],new Date('2026-11-02')).[0]?.id).toBe('high')})
 it('keeps unknown regional observations visible',()=>{const x=summarizeRegionalDistribution([{entryId:'x',region:'Rabat'},{entryId:'x'}])[0];expect(x.coverage).toBe('partially_documented');expect(x.unknownCount).toBe(1)})
 it('calculates cosine similarity',()=>{expect(cosineSimilarity([1,0],[1,0])).toBeCloseTo(1)})
 it('reports context diagnostics',()=>{expect(analyzeLexicalContexts([{id:'1',text:'شنو بغيتي',translation:'what do you want'},{id:'2',text:'شنو بغيتي',translation:'what do you want'}]).possibleSenseGroups).toHaveLength(1)})
})
