export interface ReviewTask { id:string; hasContradiction?:boolean; evidenceComplete?:boolean; reviewerDisagreement?:boolean; lastReviewedAt?:string|null; impactCount?:number }
export interface ReviewPriorityResult { id:string; score:number; reasons:string[] }
/** Explainable operational queue score; not a correctness or acceptance probability. */
export function rankReviewTasks(tasks:ReviewTask[],now=new Date()):ReviewPriorityResult[] {
 return tasks.map(t=>{let score=0;const reasons:string[]=[]
  if(t.hasContradiction){score+=35;reasons.push('contradiction_detected')}
  if(t.reviewerDisagreement){score+=25;reasons.push('reviewer_disagreement')}
  if(!t.evidenceComplete){score+=15;reasons.push('incomplete_evidence')}
  if(t.lastReviewedAt){const days=Math.max(0,(now.getTime()-Date.parse(t.lastReviewedAt))/86400000),p=Math.min(15,Math.floor(days/30)*3);if(p){score+=p;reasons.push('stale_review')}}else{score+=8;reasons.push('never_reviewed')}
  const impact=Math.max(0,Math.floor(t.impactCount??0));if(impact){score+=Math.min(10,Math.floor(Math.log2(impact+1)*2));reasons.push('high_dependency_impact')}
  return{id:t.id,score:Math.min(100,score),reasons}
 }).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id))
}
