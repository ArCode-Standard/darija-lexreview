export function levenshteinDistance(a: string, b: string): number {
  const x = Array.from(a), y = Array.from(b)
  if (!x.length) return y.length
  if (!y.length) return x.length
  let prev = Array.from({ length: y.length + 1 }, (_, i) => i)
  for (let i = 1; i <= x.length; i++) {
    const curr = [i]
    for (let j = 1; j <= y.length; j++) curr[j] = Math.min(curr[j-1]+1, prev[j]+1, prev[j-1]+(x[i-1]===y[j-1]?0:1))
    prev = curr
  }
  return prev[y.length]
}
export function damerauLevenshteinDistance(a: string, b: string): number {
  const x = Array.from(a)
  const y = Array.from(b)
  const maxDistance = x.length + y.length
  const matrix = Array.from({ length: x.length + 2 }, () => Array<number>(y.length + 2).fill(0))
  matrix[0][0] = maxDistance
  for (let i = 0; i <= x.length; i += 1) {
    matrix[i + 1][0] = maxDistance
    matrix[i + 1][1] = i
  }
  for (let j = 0; j <= y.length; j += 1) {
    matrix[0][j + 1] = maxDistance
    matrix[1][j + 1] = j
  }

  const lastSeen = new Map<string, number>()
  for (let i = 1; i <= x.length; i += 1) {
    let lastMatchColumn = 0
    for (let j = 1; j <= y.length; j += 1) {
      const lastMatchRow = lastSeen.get(y[j - 1]) ?? 0
      const previousMatchColumn = lastMatchColumn
      let substitutionCost = 1
      if (x[i - 1] === y[j - 1]) {
        substitutionCost = 0
        lastMatchColumn = j
      }
      matrix[i + 1][j + 1] = Math.min(
        matrix[i][j] + substitutionCost,
        matrix[i + 1][j] + 1,
        matrix[i][j + 1] + 1,
        matrix[lastMatchRow][previousMatchColumn]
          + (i - lastMatchRow - 1) + 1 + (j - previousMatchColumn - 1),
      )
    }
    lastSeen.set(x[i - 1], i)
  }
  return matrix[x.length + 1][y.length + 1]
}
export function jaroWinklerSimilarity(a:string,b:string):number {
  if(a===b)return 1
  if(!a.length||!b.length)return 0
  const range=Math.max(0,Math.floor(Math.max(a.length,b.length)/2)-1), am=Array(a.length).fill(false), bm=Array(b.length).fill(false)
  let m=0
  for(let i=0;i<a.length;i++) for(let j=Math.max(0,i-range);j<=Math.min(i+range,b.length-1);j++) if(!bm[j]&&a[i]===b[j]){am[i]=true;bm[j]=true;m++;break}
  if(!m)return 0
  let k=0,t=0
  for(let i=0;i<a.length;i++)if(am[i]){while(!bm[k])k++;if(a[i]!==b[k])t++;k++}
  const j=(m/a.length+m/b.length+(m-t/2)/m)/3
  let p=0;while(p<Math.min(4,a.length,b.length)&&a[p]===b[p])p++
  return j+p*0.1*(1-j)
}
export function characterNgramSimilarity(a:string,b:string,n=2):number {
  if(!Number.isInteger(n)||n<1)throw new RangeError('n must be positive')
  if(a===b)return 1
  const grams=(s:string)=>{const c=Array.from(s),g=new Set<string>();for(let i=0;i<=c.length-n;i++)g.add(c.slice(i,i+n).join(''));return g}
  const x=grams(a),y=grams(b);if(!x.size||!y.size)return 0
  let common=0;for(const g of x)if(y.has(g))common++
  return 2*common/(x.size+y.size)
}
export function normalizedEditSimilarity(a:string,b:string):number {
  const n=Math.max(Array.from(a).length,Array.from(b).length)
  return n===0?1:1-levenshteinDistance(a,b)/n
}
