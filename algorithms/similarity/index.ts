function codePoints(value: string): string[] {
  return Array.from(value)
}

export function levenshteinDistance(a: string, b: string): number {
  const x = codePoints(a)
  const y = codePoints(b)
  if (!x.length) return y.length
  if (!y.length) return x.length
  let previous = Array.from({ length: y.length + 1 }, (_, index) => index)
  for (let i = 1; i <= x.length; i += 1) {
    const current = [i]
    for (let j = 1; j <= y.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1),
      )
    }
    previous = current
  }
  return previous[y.length]
}

/** Unrestricted Damerau-Levenshtein distance over Unicode code points. */
export function damerauLevenshteinDistance(a: string, b: string): number {
  const x = codePoints(a)
  const y = codePoints(b)
  const maxDistance = x.length + y.length
  const matrix = Array.from(
    { length: x.length + 2 },
    () => Array<number>(y.length + 2).fill(0),
  )
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
      const previousRow = lastSeen.get(y[j - 1]) ?? 0
      const previousColumn = lastMatchColumn
      let cost = 1
      if (x[i - 1] === y[j - 1]) {
        cost = 0
        lastMatchColumn = j
      }
      matrix[i + 1][j + 1] = Math.min(
        matrix[i][j] + cost,
        matrix[i + 1][j] + 1,
        matrix[i][j + 1] + 1,
        matrix[previousRow][previousColumn] +
          (i - previousRow - 1) + 1 + (j - previousColumn - 1),
      )
    }
    lastSeen.set(x[i - 1], i)
  }
  return matrix[x.length + 1][y.length + 1]
}

export function jaroWinklerSimilarity(a: string, b: string): number {
  const left = codePoints(a)
  const right = codePoints(b)
  if (a === b) return 1
  if (!left.length || !right.length) return 0
  const range = Math.max(0, Math.floor(Math.max(left.length, right.length) / 2) - 1)
  const leftMatches = Array<boolean>(left.length).fill(false)
  const rightMatches = Array<boolean>(right.length).fill(false)
  let matches = 0
  for (let i = 0; i < left.length; i += 1) {
    for (let j = Math.max(0, i - range); j <= Math.min(i + range, right.length - 1); j += 1) {
      if (rightMatches[j] || left[i] !== right[j]) continue
      leftMatches[i] = true
      rightMatches[j] = true
      matches += 1
      break
    }
  }
  if (!matches) return 0
  let rightIndex = 0
  let transpositions = 0
  for (let i = 0; i < left.length; i += 1) {
    if (!leftMatches[i]) continue
    while (!rightMatches[rightIndex]) rightIndex += 1
    if (left[i] !== right[rightIndex]) transpositions += 1
    rightIndex += 1
  }
  const m = matches
  const jaro = (m / left.length + m / right.length + (m - transpositions / 2) / m) / 3
  let prefix = 0
  while (prefix < Math.min(4, left.length, right.length) && left[prefix] === right[prefix]) prefix += 1
  return jaro + prefix * 0.1 * (1 - jaro)
}

export function characterNgramSimilarity(a: string, b: string, n = 2): number {
  if (!Number.isInteger(n) || n < 1) throw new RangeError('n must be a positive integer')
  if (a === b) return 1
  const grams = (value: string) => {
    const characters = codePoints(value)
    const result = new Set<string>()
    for (let index = 0; index <= characters.length - n; index += 1) {
      result.add(characters.slice(index, index + n).join(''))
    }
    return result
  }
  const left = grams(a)
  const right = grams(b)
  if (!left.size || !right.size) return 0
  let common = 0
  for (const gram of left) if (right.has(gram)) common += 1
  return 2 * common / (left.size + right.size)
}

export function normalizedEditSimilarity(a: string, b: string): number {
  const length = Math.max(codePoints(a).length, codePoints(b).length)
  return length === 0 ? 1 : 1 - levenshteinDistance(a, b) / length
}
