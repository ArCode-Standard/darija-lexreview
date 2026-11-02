export interface EmbeddedText { id:string; text:string; embedding:number[] }
export interface SemanticMatch { id:string; text:string; similarity:number }
/** Cosine similarity for vectors supplied by the caller; no model or network is bundled. */
export function cosineSimilarity(a:number[],b:number[]):number {
 if(!a.length||a.length!==b.length)throw new RangeError('Embeddings must have equal non-zero dimensions')
 let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]**2;bb+=b[i]**2}
 return aa===0||bb===0?0:dot/(Math.sqrt(aa)*Math.sqrt(bb))
}
/** Similarity does not establish synonymy or identical sense. */
export function findSemanticNeighbors(query:number[],items:EmbeddedText[],limit=10):SemanticMatch[] {
 if(!Number.isInteger(limit)||limit<0)throw new RangeError('limit must be non-negative')
 return items.map(x=>({id:x.id,text:x.text,similarity:cosineSimilarity(query,x.embedding)})).sort((a,b)=>b.similarity-a.similarity||a.id.localeCompare(b.id)).slice(0,limit)
}
