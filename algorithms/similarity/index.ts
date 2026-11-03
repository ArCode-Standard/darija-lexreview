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
  const x=Array.from(a), y=Array.from(b), d=Array.from({length:x.length+1},()=>Array<number>(y.length+1).fill(0))
  for(let i=0;i<=x.length;i++) d[i][0]=i
  for(let j=0;j<=y.length;j++) d[0][j]=j
  for(let i=1;i<=x.length;i++) for(let j=1;j<=y.length;j++) {
    const c=x[i-1]===y[j-1]?0:1
    d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+c)
    if(i>1&&j>1&&x[i-1]===y[j-2]&&x[i-2]===y[j-1]) d[i][j]=Math.min(d[i][j],d[i-2][j-2]+c)
  }
  return d[x.length][y.length]
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
