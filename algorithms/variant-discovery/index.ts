import { normalizeDarijaSearchKey } from '../normalization'
import { jaroWinklerSimilarity, normalizedEditSimilarity } from '../similarity'
export interface VariantCandidate { id:string; form:string; script?:'arabic'|'arabizi'|'unknown'; region?:string }
export interface VariantMatch { leftId:string; rightId:string; leftForm:string; rightForm:string; score:number; signals:string[] }
/** Candidate pairs only. Never asserts equivalence and never merges records. */
export function discoverVariantCandidates(items:VariantCandidate[],threshold=0.82):VariantMatch[] {
  if(threshold<0||threshold>1)throw new RangeError('threshold must be between 0 and 1')
  const out:VariantMatch[]=[]
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
    const a=items[i],b=items[j];if(!a.form.trim()||!b.form.trim()||a.id===b.id)continue
    const x=normalizeDarijaSearchKey(a.form),y=normalizeDarijaSearchKey(b.form),same=x===y
    const jw=jaroWinklerSimilarity(x,y),edit=normalizedEditSimilarity(x,y),score=same?1:Math.max(jw,edit)
    if(score>=threshold)out.push({leftId:a.id,rightId:b.id,leftForm:a.form,rightForm:b.form,score,signals:[same?'same_normalized_form':'',jw>=threshold?'jaro_winkler':'',edit>=threshold?'edit_similarity':''].filter(Boolean)})
  }
  return out.sort((a,b)=>b.score-a.score||a.leftId.localeCompare(b.leftId))
}
