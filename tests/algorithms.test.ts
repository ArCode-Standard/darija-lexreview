import { describe, expect, it } from 'vitest'
import { analyzeLexicalContexts, characterNgramSimilarity, cosineSimilarity, damerauLevenshteinDistance, detectIntegrityIssues, discoverVariantCandidates, normalizeArabicForSearch, normalizeArabiziForSearch, normalizeDarijaSearchKey, rankReviewTasks, scoreEvidenceQuality, summarizeRegionalDistribution, jaroWinklerSimilarity, normalizedEditSimilarity, rankVectorCandidates, discoverVariantCandidatesWithStats } from '../algorithms'
describe('Darija Intelligence Engine',()=>{
 it('normalizes Arabic, Arabizi, and mixed-script search forms',()=>{expect(normalizeArabicForSearch(' أَهْلًا ـ ')).toBe('اهلا');expect(normalizeArabiziForSearch('Chno-kayen')).toBe('chno kayen');expect(normalizeDarijaSearchKey('WaCH واش')).toBe('wach واش')})
 it('calculates Unicode-aware string similarities',()=>{expect(damerauLevenshteinDistance('abcd','abdc')).toBe(1);expect(damerauLevenshteinDistance('CA','ABC')).toBe(2);expect(characterNgramSimilarity('chno','chno')).toBe(1);expect(damerauLevenshteinDistance('🙂a','a🙂')).toBe(1)})
 it('discovers candidates without merging and rejects invalid thresholds',()=>{expect(discoverVariantCandidates([{id:'a',form:'شنو'},{id:'b',form:'أشنو'}],0.7).length).toBeGreaterThan(0);expect(()=>discoverVariantCandidates([],Number.NaN)).toThrow(RangeError)})
 it('flags duplicate forms and possible sense differences',()=>{expect(detectIntegrityIssues([{id:'1',word:'شنو',meaning:'ماذا'},{id:'2',word:'شنو',meaning:'أي شيء'}]).map(x=>x.kind)).toContain('possible_meaning_conflict')})
 it('scores evidence metadata completeness',()=>{expect(scoreEvidenceQuality([{sourceName:'Dictionary',sourceType:'dictionary',url:'https://example.org',rightsHolder:'X',license:'CC BY',note:'entry',independent:true}]).score).toBe(100)})
 it('ranks review tasks deterministically and guards invalid timestamps',()=>{const result=rankReviewTasks([{id:'low',evidenceComplete:true,lastReviewedAt:'2026-10-30'},{id:'high',hasContradiction:true,evidenceComplete:false}],new Date('2026-11-02'));expect(result[0].id).toBe('high');expect(Number.isFinite(rankReviewTasks([{id:'bad-date',lastReviewedAt:'not-a-date'}])[0].score)).toBe(true)})
 it('keeps unknown regional observations visible and rejects invalid counts',()=>{const x=summarizeRegionalDistribution([{entryId:'x',region:'Rabat'},{entryId:'x'}])[0];expect(x.coverage).toBe('partially_documented');expect(x.unknownCount).toBe(1);expect(()=>summarizeRegionalDistribution([{entryId:'x',count:Number.NaN}])).toThrow(RangeError)})
 it('calculates additional Unicode-aware similarity signals',()=>{expect(jaroWinklerSimilarity('MARTHA','MARHTA')).toBeGreaterThan(0.9);expect(normalizedEditSimilarity('سلام','سلم')).toBeGreaterThan(0.6);expect(jaroWinklerSimilarity('','سلام')).toBe(0)})
 it('rejects fractional regional counts instead of silently rounding',()=>{expect(()=>summarizeRegionalDistribution([{entryId:'x',count:1.5}])).toThrow(RangeError)})
 it('validates vector inputs even when the candidate list is empty',()=>{expect(()=>rankVectorCandidates([],[])).toThrow(RangeError)})
 it('calculates cosine similarity',()=>{expect(cosineSimilarity([1,0],[1,0])).toBeCloseTo(1);expect(cosineSimilarity([1e200,0],[1e200,0])).toBeCloseTo(1)})
 it('reports context diagnostics',()=>{expect(analyzeLexicalContexts([{id:'1',text:'شنو بغيتي',translation:'what do you want'},{id:'2',text:'شنو بغيتي',translation:'what do you want'}]).possibleSenseGroups).toHaveLength(1)})

 it('uses indexed blocking for large variant corpora and preserves obvious near variants',()=>{
   const items=[{id:'a',form:'kifach'},{id:'b',form:'kifash'},...Array.from({length:400},(_,i)=>({id:`noise-${i}`,form:`entryword${i}`}))];
   const result=discoverVariantCandidatesWithStats(items,0.75);
   expect(result.stats.strategy).toBe('indexed');
   expect(result.stats.candidatePairs).toBeLessThan(items.length*(items.length-1)/2);
   expect(result.matches.some(x=>[x.leftId,x.rightId].includes('a')&&[x.leftId,x.rightId].includes('b'))).toBe(true);
 });
 it('bounds highly frequent exact-form blocks and exposes truncation',()=>{
   const items=Array.from({length:300},(_,i)=>({id:`same-${i}`,form:'شنو'}));
   const result=discoverVariantCandidatesWithStats(items,1,{exhaustiveBelow:0,maxCandidatesPerItem:8});
   expect(result.stats.strategy).toBe('indexed');
   expect(result.stats.truncatedItems).toBeGreaterThan(0);
   expect(result.stats.candidatePairs).toBeLessThan(items.length*(items.length-1)/2);
   expect(result.matches.every(x=>x.score===1)).toBe(true);
 });
})
