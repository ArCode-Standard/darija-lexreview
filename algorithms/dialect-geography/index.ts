export interface RegionalObservation { entryId:string; region?:string|null; count?:number }
export interface RegionalDistribution { entryId:string; observed:Array<{region:string;count:number}>; unknownCount:number; total:number; coverage:'documented'|'partially_documented'|'undocumented' }
/** Summarizes observations supplied by the caller; missing data never means non-use. */
export function summarizeRegionalDistribution(rows:RegionalObservation[]):RegionalDistribution[] {
 const groups=new Map<string,{regions:Map<string,number>;unknown:number}>()
 for(const r of rows){const g=groups.get(r.entryId)??{regions:new Map<string,number>(),unknown:0},n=Math.max(1,Math.floor(r.count??1))
  if(r.region?.trim())g.regions.set(r.region.trim(),(g.regions.get(r.region.trim())??0)+n);else g.unknown+=n;groups.set(r.entryId,g)}
 return [...groups].map(([entryId,g])=>{const observed=[...g.regions].map(([region,count])=>({region,count})).sort((a,b)=>b.count-a.count||a.region.localeCompare(b.region)),total=g.unknown+observed.reduce((s,x)=>s+x.count,0)
  return{entryId,observed,unknownCount:g.unknown,total,coverage:observed.length===0?'undocumented':g.unknown?'partially_documented':'documented'}
 })
}
