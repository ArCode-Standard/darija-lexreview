export interface ContextExample { id:string; text:string; translation?:string; region?:string; register?:string }
export interface ContextAnalysis { exampleCount:number; distinctRegions:string[]; distinctRegisters:string[]; missingTranslations:string[]; repeatedTexts:string[]; possibleSenseGroups:Array<{key:string;exampleIds:string[]}> }
/** Diagnostics only. Shared translations are candidate sense groups for human review. */
export function analyzeLexicalContexts(examples:ContextExample[]):ContextAnalysis {
 const translations=new Map<string,string[]>(),texts=new Map<string,number>(),regions=new Set<string>(),registers=new Set<string>(),missing:string[]=[]
 for(const e of examples){const tr=e.translation?.trim().toLowerCase();if(tr)translations.set(tr,[...(translations.get(tr)??[]),e.id]);else missing.push(e.id)
  const tx=e.text.trim().toLowerCase();if(tx)texts.set(tx,(texts.get(tx)??0)+1);if(e.region?.trim())regions.add(e.region.trim());if(e.register?.trim())registers.add(e.register.trim())}
 return{exampleCount:examples.length,distinctRegions:[...regions].sort(),distinctRegisters:[...registers].sort(),missingTranslations:missing,repeatedTexts:[...texts].filter(([,n])=>n>1).map(([x])=>x),possibleSenseGroups:[...translations].filter(([,ids])=>ids.length>1).map(([key,exampleIds])=>({key,exampleIds}))}
}
