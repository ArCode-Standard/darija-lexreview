import { tokenize } from '../shared/normalize'

export interface MorphologyToken {
  surface: string
  stemCandidate: string
  prefixes: string[]
  suffixes: string[]
  markers: string[]
  confidence: 'low'
  note: string
}

export interface MorphologyAnalysis {
  original: string
  tokens: MorphologyToken[]
}

const PREFIXES = ['غادي', 'كن', 'كت', 'كي', 'كا', 'ما']
const SUFFIXES = ['يات', 'يات', 'هم', 'ها', 'هما', 'كم', 'نا', 'ني', 'ك', 'ه', 'و']

/**
 * A deliberately conservative affix scanner. It reports possible surface markers;
 * it is not a full morphological parser and must not be used to rewrite entries.
 */
export function analyzeMorphology(input: string): MorphologyAnalysis {
  const tokens = tokenize(input).map((surface): MorphologyToken => {
    let stemCandidate = surface
    const prefixes: string[] = []
    const suffixes: string[] = []

    const prefix = PREFIXES.find((item) =>
      stemCandidate.startsWith(item) && stemCandidate.length - item.length >= 2,
    )
    if (prefix) {
      prefixes.push(prefix)
      stemCandidate = stemCandidate.slice(prefix.length)
    }

    const suffix = SUFFIXES.find((item) =>
      stemCandidate.endsWith(item) && stemCandidate.length - item.length >= 2,
    )
    if (suffix) {
      suffixes.push(suffix)
      stemCandidate = stemCandidate.slice(0, -suffix.length)
    }

    const markers = [...prefixes, ...suffixes]
    return {
      surface,
      stemCandidate: markers.length ? stemCandidate : surface,
      prefixes,
      suffixes,
      markers,
      confidence: 'low',
      note: markers.length
        ? 'Possible affix boundary detected by surface rules; verify against a Darija morphology lexicon.'
        : 'No supported affix pattern detected; this does not imply the token is morphologically simple.',
    }
  })

  return { original: input, tokens }
}
