export interface EvidenceSource { url?:string; sourceName?:string; sourceType?:string; rightsHolder?:string; license?:string; note?:string; independent?:boolean }
export interface EvidenceQualityResult { score:number; band:'insufficient'|'limited'|'documented'|'well_documented'; dimensions:{sourceIdentity:number;traceability:number;rightsMetadata:number;evidenceNote:number;independence:number}; missing:string[] }
function validUrl(s?:string):boolean {if(!s)return false;try{const u=new URL(s);return u.protocol==='https:'||u.protocol==='http:'}catch{return false}}
/** Scores metadata completeness only, never linguistic truth or source authority. */
export function scoreEvidenceQuality(sources:EvidenceSource[]):EvidenceQualityResult {
  const s=sources.filter(Boolean),name=s.some(x=>!!x.sourceName?.trim()),type=s.some(x=>!!x.sourceType?.trim()),url=s.some(x=>validUrl(x.url))
  const rights=s.some(x=>!!x.rightsHolder?.trim()&&!!x.license?.trim()),note=s.some(x=>!!x.note?.trim()),independent=s.some(x=>x.independent===true)
  const dimensions={sourceIdentity:(name?12:0)+(type?8:0),traceability:url?25:0,rightsMetadata:rights?20:0,evidenceNote:note?15:0,independence:independent?20:0}
  const score=Object.values(dimensions).reduce((a,b)=>a+b,0)
  const missing=[...(!name?['source_name']:[]),...(!type?['source_type']:[]),...(!url?['http_source_url']:[]),...(!rights?['rights_holder_and_license']:[]),...(!note?['evidence_note']:[]),...(!independent?['independence_not_attested']:[])]
  return {score,band:score<30?'insufficient':score<55?'limited':score<80?'documented':'well_documented',dimensions,missing}
}
