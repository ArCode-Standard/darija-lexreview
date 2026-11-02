import type { LexicalEntry } from '../types/lexicon'
import { formatAccessionCode } from '../services/dataset'

const ARABIC_DIACRITICS_RE = /[\u064B-\u065F\u0670\u0640]/g

/**
 * Converts Moroccan Darija written in either Arabic script or Latin Arabizi
 * into a unified consonantal phonetic skeleton so contributors can search
 * interchangeably (e.g. "bzzaf" <-> "bezzaf" <-> "بزاف", "ch7al" <-> "شحال",
 * "dghya" <-> "دغيا", "9rib" <-> "qrib" <-> "قريب").
 */
export function toDarijaPhoneticSkeleton(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(ARABIC_DIACRITICS_RE, '')
    // Normalize multi-letter Arabizi digraphs first
    .replace(/tch/g, 'ش')
    .replace(/ch|sh/g, 'ش')
    .replace(/kh/g, 'خ')
    .replace(/gh/g, 'غ')
    .replace(/ou|oo/g, 'w')
    .replace(/ee|ii/g, 'y')

  let out = ''
  for (const ch of cleaned) {
    switch (ch) {
      case 'ا':
      case 'أ':
      case 'إ':
      case 'آ':
      case 'ٱ':
      case 'ء':
      case 'ؤ':
      case 'ئ':
      case '2':
        // Glottal/long-alif dropped in consonantal skeleton unless word-initial
        if (out.length === 0) out += 'a'
        break
      case 'ع':
      case '3':
        out += '3'
        break
      case 'ح':
      case '7':
        out += '7'
        break
      case 'خ':
      case '5':
        out += '5'
        break
      case 'غ':
      case '4':
        out += '4'
        break
      case 'ق':
      case '9':
      case 'q':
      case 'k':
      case 'ك':
      case 'گ':
      case 'ݣ':
      case 'g':
        // Unify qaf/kaf/gaf cluster or keep distinct enough: map ق/9/q -> 9, ك/k/g/گ/ݣ -> k
        if (ch === 'ق' || ch === '9' || ch === 'q') out += '9'
        else out += 'k'
        break
      case 'ب':
      case 'b':
      case 'p':
        out += 'b'
        break
      case 'ت':
      case 'ث':
      case 'ط':
      case 'ة':
      case 't':
        out += 't'
        break
      case 'ج':
      case 'j':
        out += 'j'
        break
      case 'د':
      case 'ذ':
      case 'ض':
      case 'd':
        out += 'd'
        break
      case 'ر':
      case 'r':
        out += 'r'
        break
      case 'ز':
      case 'ظ':
      case 'z':
        out += 'z'
        break
      case 'س':
      case 'ص':
      case 's':
      case 'c':
        out += 's'
        break
      case 'ش':
        out += 'S'
        break
      case 'ف':
      case 'f':
      case 'v':
        out += 'f'
        break
      case 'ل':
      case 'l':
        out += 'l'
        break
      case 'م':
      case 'm':
        out += 'm'
        break
      case 'ن':
      case 'n':
        out += 'n'
        break
      case 'ه':
      case 'h':
        out += 'h'
        break
      case 'و':
      case 'w':
      case 'u':
        out += 'w'
        break
      case 'ي':
      case 'ى':
      case 'y':
        out += 'y'
        break
      case 'a':
      case 'e':
      case 'i':
      case 'o':
        // Short Latin vowels omitted in interior positions for spelling-tolerant matching
        if (out.length === 0) out += 'a'
        break
      default:
        break
    }
  }

  // Collapse geminated/repeated consonants (e.g. "bzzaf" -> "bzf", "ddaba" -> "db")
  // and strip trailing feminine -a/-h variance when skeleton is >= 3 chars
  const deduped = out.replace(/(.)\1+/g, '$1')
  return deduped
}

export function isPriorityEnrichmentEntry(entry: LexicalEntry): boolean {
  const missingExamples = entry.examples.length === 0
  const unreviewedStatus = entry.status !== 'reviewed'
  const unverifiedLicense =
    !entry.provenance.license || entry.provenance.license.toLowerCase() === 'unknown'
  return missingExamples || unreviewedStatus || unverifiedLicense
}

export function matchesDarijaQuery(entry: LexicalEntry, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return true

  const accession = formatAccessionCode(entry.id, entry.numericId).toLowerCase()
  const directHaystack = [
    entry.id,
    accession,
    entry.word,
    entry.latin,
    entry.meaning,
    entry.french,
    entry.category,
    ...entry.examples.map((ex) => `${ex.darijaAr} ${ex.darijaLatin}`),
  ]
    .join(' ')
    .toLowerCase()

  if (directHaystack.includes(q)) {
    return true
  }

  // Bidirectional phonetic skeleton match for tokens >= 2 phonetic consonants
  const queryTokens = q.split(/\s+/).filter(Boolean)
  if (queryTokens.length === 0) return false

  const entrySkeletonTargets = [
    toDarijaPhoneticSkeleton(entry.word),
    ...entry.latin.split('/').map((part) => toDarijaPhoneticSkeleton(part)),
  ].filter((s) => s.length >= 2)

  if (entrySkeletonTargets.length === 0) return false

  return queryTokens.every((token) => {
    const tokenSkel = toDarijaPhoneticSkeleton(token)
    if (tokenSkel.length < 2) return false
    // Strip leading 'a' on comparison if one side wrote alif and the other omitted short initial vowel
    const coreToken = tokenSkel.length >= 3 ? tokenSkel.replace(/^a/, '') : tokenSkel
    return entrySkeletonTargets.some((target) => {
      const coreTarget = target.length >= 3 ? target.replace(/^a/, '') : target
      return target.includes(tokenSkel) || (coreToken.length >= 2 && coreTarget.includes(coreToken))
    })
  })
}
