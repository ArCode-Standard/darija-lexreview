import { normalizeDarijaSearchKey } from '../normalization'
export interface IntegrityRecord { id:string; word:string; meaning?:string; category?:string }
export interface IntegrityFinding { kind:'duplicate_form'|'possible_meaning_conflict'|'category_mismatch'; recordIds:string[]; normalizedForm:string; detail:string }
/** Detects duplicate normalized forms and metadata differences for editorial review. */
export function detectIntegrityIssues(records:IntegrityRecord[]):IntegrityFinding[] {
  const groups=new Map<string,IntegrityRecord[]>()
  for(const r of records){const k=normalizeDarijaSearchKey(r.word);if(k)groups.set(k,[...(groups.get(k)??[]),r])}
  const out:IntegrityFinding[]=[]
  for(const [key,g] of groups){if(g.length<2)continue;const ids=g.map(x=>x.id)
    out.push({kind:'duplicate_form',recordIds:ids,normalizedForm:key,detail:'Multiple records share the same normalized written form.'})
    if(new Set(g.map(x=>(x.meaning??'').trim().toLowerCase()).filter(Boolean)).size>1)out.push({kind:'possible_meaning_conflict',recordIds:ids,normalizedForm:key,detail:'Different meaning strings may represent valid separate senses.'})
    if(new Set(g.map(x=>(x.category??'').trim().toLowerCase()).filter(Boolean)).size>1)out.push({kind:'category_mismatch',recordIds:ids,normalizedForm:key,detail:'Different categories require editorial verification.'})
  }
  return out
}
