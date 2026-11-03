import { describe, expect, it } from 'vitest'
import { GOLD_FORMS, GOLD_ARABIZI, NORMALIZATION_GOLD_PAIRS } from '../benchmarks/dataset'
import { discoverVariantCandidates, normalizeDarijaSearchKey, transliterateArabizi, findDuplicateCandidates, discoverVariantCandidatesWithStats } from '../algorithms'

const expectedPairs = new Set<string>()
for (let i=0;i<GOLD_FORMS.length;i++) for(let j=i+1;j<GOLD_FORMS.length;j++) {
  const a=GOLD_FORMS[i], b=GOLD_FORMS[j]
  if(a.senseId===b.senseId && a.script===b.script) expectedPairs.add([a.id,b.id].sort().join('|'))
}
function metrics(tp:number,fp:number,fn:number) {
  const precision=tp+fp===0?0:tp/(tp+fp)
  const recall=tp+fn===0?0:tp/(tp+fn)
  return {precision,recall,f1:precision+recall===0?0:2*precision*recall/(precision+recall),tp,fp,fn}
}
function elapsed(fn:()=>void) { const start=performance.now(); fn(); return Number((performance.now()-start).toFixed(2)) }
const sizes=[1_000,10_000,50_000]
function makeSynthetic(size:number) {
  return Array.from({length:size},(_,i)=>({id:`synthetic-${i}`,form:`fixtureword${i.toString(36)}`,senseId:`synthetic-sense-${i}`}))
}

describe('Darija benchmark quality baseline (provisional fixtures)',()=>{
  it('reports precision/recall/F1 separately for candidate discovery',()=>{
    const predicted=discoverVariantCandidates(GOLD_FORMS.map(x=>({id:x.id,form:x.form,script:x.script})),0.82)
    const predictedPairs=new Set(predicted.map(x=>[x.leftId,x.rightId].sort().join('|')))
    let tp=0,fp=0,fn=0
    for(const p of predictedPairs) expectedPairs.has(p)?tp++:fp++
    for(const p of expectedPairs) if(!predictedPairs.has(p)) fn++
    const result=metrics(tp,fp,fn)
    console.info('[Darija benchmark] variant-discovery provisional metrics',result)
    expect(result.precision).toBeGreaterThanOrEqual(0)
    expect(result.recall).toBeGreaterThanOrEqual(0)
  })
  it('reports duplicate-detection precision/recall/F1 per query over the fixture set',()=>{
    let tp=0,fp=0,fn=0
    for(const query of GOLD_FORMS) {
      const candidates=GOLD_FORMS.filter(x=>x.id!==query.id).map(x=>({id:x.id,text:x.form}))
      const predicted=new Set(findDuplicateCandidates(query.form,candidates,0.72).map(x=>x.id))
      const expected=new Set(GOLD_FORMS.filter(x=>x.id!==query.id&&x.senseId===query.senseId).map(x=>x.id))
      for(const id of predicted) expected.has(id)?tp++:fp++
      for(const id of expected) if(!predicted.has(id)) fn++
    }
    const result=metrics(tp,fp,fn)
    console.info('[Darija benchmark] duplicate-detection provisional metrics',result)
    expect(result.tp+result.fn).toBeGreaterThan(0)
  })
  it('reports Arabizi transliteration exact-match metrics',()=>{
    let tp=0,fp=0,fn=0
    for(const item of GOLD_ARABIZI) {
      const predicted=normalizeDarijaSearchKey(transliterateArabizi(item.form).value)
      const expected=normalizeDarijaSearchKey(item.expectedArabic)
      if(predicted===expected) tp++; else {fp++;fn++}
    }
    const result=metrics(tp,fp,fn)
    console.info('[Darija benchmark] Arabizi exact-match metrics',result)
    expect(result.tp+result.fn).toBe(GOLD_ARABIZI.length)
  })
  it('reports normalization pair classification metrics against orthographic gold pairs',()=>{
    let tp=0,fp=0,fn=0
    for(const pair of NORMALIZATION_GOLD_PAIRS) {
      const actual=normalizeDarijaSearchKey(pair.left)===normalizeDarijaSearchKey(pair.right)
      if(actual&&pair.equivalent)tp++; else if(actual&&!pair.equivalent)fp++; else if(!actual&&pair.equivalent)fn++
    }
    const result=metrics(tp,fp,fn)
    console.info('[Darija benchmark] orthographic normalization metrics',result)
    expect(result.tp+result.fn).toBe(NORMALIZATION_GOLD_PAIRS.filter(x=>x.equivalent).length)
  })
  it('measures linear workloads at 1k, 10k and 50k; records quadratic pairwise risk',()=>{
    const report=[]
    for(const size of sizes) {
      const data=makeSynthetic(size)
      const normalizationMs=elapsed(()=>{for(const row of data)normalizeDarijaSearchKey(row.form)})
      const duplicateSearchMs=elapsed(()=>{findDuplicateCandidates('fixtureword',data.map(x=>({id:x.id,text:x.form})),0.99)})
      const transliterationMs=elapsed(()=>{for(let i=0;i<data.length;i++)transliterateArabizi('3lach-kifach-bghiti')})
      report.push({size,normalizationMs,duplicateSearchMs,transliterationMs,variantPairCount:size*(size-1)/2,variantDiscovery:'not-run: quadratic workload exceeds safe benchmark budget'})
    }
    console.info('[Darija benchmark] scale report',JSON.stringify(report))
    expect(report.map(x=>x.size)).toEqual(sizes)
    expect(report[2].variantPairCount).toBe(1_249_975_000)
  })
})
