export type ContentSurface = 'profile' | 'lexicon' | 'contribution' | 'review' | 'comment' | 'discussion' | 'report' | 'private_message' | 'admin'
export type ContentCategory = 'profanity' | 'personal_abuse' | 'hate_speech' | 'threat' | 'spam' | 'obfuscation'
export type ContentDecision = 'allow' | 'allow_with_context' | 'review' | 'block' | 'urgent_escalation'
export type ContentPurpose = 'general' | 'dictionary_definition' | 'linguistic_analysis' | 'academic_quote' | 'moderation_report'

/** Must be derived by trusted server workflows, never copied from untrusted request JSON. */
export interface TrustedContentContext {
  purpose: ContentPurpose
  quotedForEvidence?: boolean
  targetedAtPerson?: boolean
  targetedAtGroup?: boolean
  explicitIncitement?: boolean
}

export interface SafetyLexiconRule {
  id: string
  phrase: string
  category: Exclude<ContentCategory, 'spam' | 'obfuscation'>
  severity: 1 | 2 | 3 | 4 | 5
}

export interface SafetyPolicy {
  version: string
  rules: SafetyLexiconRule[]
  reviewThreshold: number
  blockThreshold: number
  maxCharacters: number
  maxRepeatedCharacterRun: number
  maxUrls: number
}

export interface SafetySignal {
  code: string
  category: ContentCategory
  severity: 1 | 2 | 3 | 4 | 5
  ruleId?: string
  confidence: 'low' | 'medium' | 'high'
}

export interface ContextAssessmentSummary {
  primary: string
  labels: string[]
  confidence: 'low' | 'medium' | 'high'
  requiresHumanReview: boolean
  cueCodes: string[]
  trustedForEnforcement: false
}

export interface ContentSafetyResult {
  decision: ContentDecision
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  score: number
  signals: SafetySignal[]
  contextAssessment?: ContextAssessmentSummary
  requiresHumanReview: boolean
  engineVersion: string
  policyVersion: string
  processedAt: string
}
