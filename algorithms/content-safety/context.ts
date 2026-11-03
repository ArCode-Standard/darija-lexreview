import { normalizeSafetyText } from './normalize'
import type { ContentCategory } from './types'

export type DarijaContextLabel =
  | 'directed_abuse'
  | 'playful_banter'
  | 'quoted_evidence'
  | 'linguistic_mention'
  | 'threat_language'
  | 'ambiguous_mixed'
  | 'neutral_or_unclear'

export type ContextConfidence = 'low' | 'medium' | 'high'

export interface DarijaContextAssessment {
  primary: DarijaContextLabel
  labels: DarijaContextLabel[]
  confidence: ContextConfidence
  requiresHumanReview: boolean
  cueCodes: string[]
  /** Text-derived assessment only. It must never be treated as trusted authorization. */
  trustedForEnforcement: false
}

export interface AnalyzeDarijaContextInput {
  text: string
  matchedCategories?: readonly ContentCategory[]
}

const EDUCATIONAL_MARKERS = [
  'شنو معنى', 'اش معنى', 'اش كتعني', 'شنو كتعني', 'معنى', 'تعريف',
  'شرح كلمة', 'شرح هاد الكلمة', 'كيفاش نكتب', 'كيف تترجم',
  'dictionary', 'meaning', 'definition', 'translate this',
]
const REPORT_MARKERS = [
  'قال ليا', 'قالي', 'قال لي', 'هددني', 'توصلت برسالة',
  'في البلاغ', 'نص الرسالة', 'كنبلغ على', 'reported message',
  'he said', 'she said', 'threatened me',
]
const LAUGHTER_MARKERS = [
  'هههه', 'hahaha', 'lol', 'lmao', 'غير كنضحك',
  'كانضحك', 'غير ضحك', 'غير مزاح', 'راه غير ضحك',
]
const DIRECT_ADDRESS = /(?:^|\s)(?:nta|nti|ntoma|ntouma|نتا|نتي|نتوما|انتما|ليك|ليكم)(?:$|\s)/u
const THREAT_PATTERNS = [
  /(?:^|\s)غادي\s+(?:نقتلك|نضربك|نحرقك|نأذيك|نجي\s+عندك)(?:$|\s)/u,
  /(?:^|\s)راه\s+غادي\s+(?:نقتلك|نضربك|نحرقك)(?:$|\s)/u,
  /(?:^|\s)ghadi\s+n(?:9tlek|drbk|7re9k|2dik)(?:$|\s)/u,
]

const NEGATED_THREAT = /(?:^|\\s)(?:ما\\s+غادي\\s+|ما\\s+غاديش\\s+|عمري\\s+)(?:نقتلك|نضربك|نحرقك|نأذيك)(?:$|\\s)/u\n\nfunction containsAny(text: string, markers: readonly string[]): boolean {
  return markers.some((marker) => text.includes(normalizeSafetyText(marker)))
}

/**
 * Conservative multi-label context heuristics for Moroccan Darija.
 * The output is advisory: all cues are derived from user text and cannot
 * establish identity, intent, target, or moderation authority.
 */
export function analyzeDarijaContext(input: AnalyzeDarijaContextInput): DarijaContextAssessment {
  if (!input || typeof input.text !== 'string') throw new TypeError('input.text must be a string')
  if (Array.from(input.text).length > 5000) throw new RangeError('Context analysis input exceeds 5000 characters')

  const normalized = normalizeSafetyText(input.text)
  const categories = new Set(input.matchedCategories ?? [])
  const cueCodes: string[] = []
  const labels = new Set<DarijaContextLabel>()
  const hasAbuse = categories.has('personal_abuse') || categories.has('profanity')
  const negatedThreat = NEGATED_THREAT.test(normalized)\n  const hasThreat = categories.has('threat') || (!negatedThreat && THREAT_PATTERNS.some((pattern) => pattern.test(normalized)))
  const educational = containsAny(normalized, EDUCATIONAL_MARKERS)
  const reportMarker = containsAny(normalized, REPORT_MARKERS)
  const quoted = /["«»“”‘’]/u.test(input.text) || reportMarker
  const laughter = containsAny(normalized, LAUGHTER_MARKERS) || /😂|🤣/u.test(input.text)
  const directAddress = DIRECT_ADDRESS.test(normalized)

  if (educational) {
    labels.add('linguistic_mention')
    cueCodes.push('educational_marker')
  }
  if (quoted) {
    labels.add('quoted_evidence')
    cueCodes.push(reportMarker ? 'reported_speech_marker' : 'quotation_punctuation')
  }
  if (laughter) {
    labels.add('playful_banter')
    cueCodes.push('laughter_or_banter_marker')
  }
  if (hasThreat) {
    labels.add('threat_language')
    cueCodes.push('threat_pattern_or_lexicon_signal')
  }
  if (hasAbuse && directAddress) {
    labels.add('directed_abuse')
    cueCodes.push('abuse_with_second_person_marker')
  } else if (hasAbuse) {
    labels.add('neutral_or_unclear')
    cueCodes.push('abusive_term_without_reliable_target')
  }

  if (labels.has('directed_abuse') && labels.has('playful_banter')) {
    labels.add('ambiguous_mixed')
    cueCodes.push('mixed_banter_and_abuse_cues')
  }
  if (labels.size === 0) {
    labels.add('neutral_or_unclear')
    cueCodes.push('no_reliable_context_cue')
  }

  let primary: DarijaContextLabel = 'neutral_or_unclear'
  let confidence: ContextConfidence = 'low'
  if (hasThreat) {
    primary = 'threat_language'
    confidence = THREAT_PATTERNS.some((pattern) => pattern.test(normalized)) ? 'high' : 'medium'
  } else if (labels.has('ambiguous_mixed')) {
    primary = 'ambiguous_mixed'
    confidence = 'medium'
  } else if (labels.has('directed_abuse')) {
    primary = 'directed_abuse'
    confidence = 'medium'
  } else if (educational && !hasThreat && !directAddress) {
    primary = 'linguistic_mention'
    confidence = 'medium'
  } else if (quoted && !hasThreat) {
    primary = 'quoted_evidence'
    confidence = reportMarker ? 'medium' : 'low'
  } else if (laughter && !hasAbuse) {
    primary = 'playful_banter'
    confidence = 'low'
  } else if (hasAbuse) {
    primary = 'neutral_or_unclear'
    confidence = 'low'
  }

  const requiresHumanReview = hasThreat || labels.has('directed_abuse') ||
    labels.has('ambiguous_mixed') || (hasAbuse && !educational && !quoted && !laughter)

  return {
    primary,
    labels: [...labels],
    confidence,
    requiresHumanReview,
    cueCodes,
    trustedForEnforcement: false,
  }
}
