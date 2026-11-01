export type EntryType =
  | 'word'
  | 'expression'
  | 'sentence'
  | 'proverb'
  | 'question'
  | 'conversational'
  | 'unknown'

export type RegisterType =
  | 'neutral'
  | 'formal'
  | 'informal'
  | 'vulgar'
  | 'literary'
  | 'religious'
  | 'unknown'

export type SourceType =
  | 'original'
  | 'contributor'
  | 'dictionary'
  | 'corpus'
  | 'web'
  | 'other'
  | 'unknown'

export type SubmissionStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'needs_changes'
  | 'merged'
  | 'withdrawn'
  | 'superseded'

export interface ProvenanceInfo {
  sourceType: SourceType
  sourceName: string
  sourceUrl?: string
  rightsHolder: string
  license: string
  redistributionPermission: 'allowed' | 'not_allowed' | 'unknown' | 'not_applicable'
  trainingPermission: 'allowed' | 'not_allowed' | 'unknown' | 'not_applicable'
  commercialPermission: 'allowed' | 'not_allowed' | 'unknown' | 'not_applicable'
  notes: string
}

export interface ContextualExample {
  id: string
  entryId: string
  darijaAr: string
  darijaLatin: string
  meaningAr: string
  meaningFr: string
  exampleFushaAr?: string
  exampleFr?: string
  register: RegisterType
  region?: string[]
  reviewStatus: string
}

export interface LexicalEntry {
  id: string
  numericId: number | null
  word: string
  latin: string
  meaning: string
  french: string
  category: string
  entryType?: EntryType
  register?: RegisterType
  region?: string[]
  status: string
  reviewNotes: string
  provenance: ProvenanceInfo
  examples: ContextualExample[]
}

export interface EvidenceItem {
  url: string
  note: string
}

export type DataPermission = 'allowed' | 'not_allowed' | 'unknown' | 'not_applicable'

export interface ProposedFields {
  submission_kind?: 'edit_entry' | 'new_entry'
  word_ar?: string
  arabizi?: string
  category?: string
  meaning?: string
  msa_translation?: string
  french_translation?: string
  entry_type?: EntryType
  register?: RegisterType
  regions?: string[]
  usage_note?: string
  example_darija?: string
  example_arabizi?: string
  example_translation?: string
  example_french?: string
  source_type?: SourceType
  source_name?: string
  rights_confirmed?: boolean
  rights_holder?: string
  license?: string
  redistribution_permission?: DataPermission
  training_permission?: DataPermission
  commercial_permission?: DataPermission
  corpus_version?: string
  baseline_fingerprint?: string
}

export interface LocalDraft {
  entryId: string
  headword: string
  category: string
  proposedData: ProposedFields
  evidence: EvidenceItem[]
  reviewerNote: string
  updatedAt: string
}

export interface SubmissionRecord {
  id: string
  entry_id: string
  supersedes_id?: string | null
  proposed_data: ProposedFields
  evidence: EvidenceItem[]
  reviewer_note: string | null
  status: SubmissionStatus
  reviewer_id?: string
  editor_id?: string | null
  editor_display_name?: string | null
  editor_note: string | null
  created_at: string
  updated_at: string
  corpus_version?: string | null
  baseline_fingerprint?: string | null
  exported_in_version?: string | null
  exported_at?: string | null
  is_sandbox?: boolean
}

export interface ReviewDecisionEvent {
  id: string | number
  submission_id: string
  actor_id: string | null
  actor_display_name?: string | null
  event_type: 'baseline' | 'submitted' | 'decision' | 'withdrawn' | 'superseded'
  previous_status: SubmissionStatus | null
  new_status: SubmissionStatus
  editor_note: string | null
  occurred_at: string
}

export type UserRole = 'reviewer' | 'editor' | 'admin'

export interface ReviewerProfile {
  id: string
  display_name: string | null
  dialect_region?: string | null
  specialty?: string | null
  github_handle?: string | null
  role: UserRole
  created_at?: string
}

export type PromotionRequestStatus = 'pending' | 'approved' | 'rejected'

export interface RolePromotionRequest {
  id: string
  requester_id: string
  requester_name: string
  dialect_region: string | null
  experience_summary: string
  sample_links: string | null
  requested_role: 'editor'
  status: PromotionRequestStatus
  reviewed_by: string | null
  reviewed_by_name?: string | null
  admin_note: string | null
  created_at: string
  updated_at: string
  is_sandbox?: boolean
}

export interface RawOfficialCorpus {
  lexiconMeta: Record<string, unknown>
  rawEntries: Array<Record<string, unknown>>
  examplesMeta: Record<string, unknown>
  rawExamples: Array<Record<string, unknown>>
}

export interface ExportValidationIssue {
  severity: 'error' | 'warning'
  target: 'lexicon' | 'examples' | 'conflict'
  itemRef: string
  message: string
}

export interface OfficialExportBundle {
  lexiconJson: {
    meta: Record<string, unknown>
    categories: Array<{ category: string; count: number }>
    entries: Array<Record<string, unknown>>
  }
  examplesJson: {
    meta: Record<string, unknown>
    examples: Array<Record<string, unknown>>
  }
  checksums: {
    lexiconSha256: string
    examplesSha256: string
  }
  patchSummary: {
    generated_at: string
    target_version: string
    lexicon_sha256: string
    examples_sha256: string
    applied_submission_ids: string[]
    modified_entries: Array<Record<string, unknown>>
    added_entries: Array<Record<string, unknown>>
    added_examples: Array<Record<string, unknown>>
  }
  prMarkdown: string
  issues: ExportValidationIssue[]
  stats: {
    modifiedEntriesCount: number
    addedEntriesCount: number
    addedExamplesCount: number
    conflictsCount: number
  }
}

export interface ReleaseManifestRecord {
  id: string
  version: string
  lexicon_sha256: string
  examples_sha256: string
  total_entries: number
  total_examples: number
  modified_entries_count: number
  added_entries_count: number
  added_examples_count: number
  submission_ids: string[]
  github_pr_url: string | null
  notes: string | null
  exported_by?: string | null
  exported_by_name: string | null
  created_at: string
  is_sandbox?: boolean
}

export type AttestationVerdict = 'accurate' | 'needs_correction' | 'regional_variant'

export type RapidMicroTask =
  | 'verify_words'
  | 'verify_examples'
  | 'enrich_examples'
  | 'regional_usage'

export interface CommunityAttestationRecord {
  entry_id: string
  example_id?: string
  verdict: AttestationVerdict
  dialect_region: string | null
  note: string | null
  updated_at: string
  corpus_version?: string
  response_ms?: number | null
  is_local?: boolean
}

export interface EntryAttestationSummary {
  entryId: string
  accurateCount: number
  flaggedCount: number
  regionalCount: number
  weightedAccurateScore?: number
  regions: string[]
}

export interface ExampleAttestationSummary {
  exampleId: string
  entryId: string
  accurateCount: number
  flaggedCount: number
  regionalCount: number
  weightedAccurateScore?: number
  regions: string[]
}

export type DataMode = 'loading' | 'live' | 'cached' | 'demo'
export type WorkbenchTab =
  | 'rapid_review'
  | 'explorer'
  | 'new_entry'
  | 'corpus'
  | 'submissions'
  | 'moderation'
  | 'exporter'
export type ExampleFilter =
  | 'all'
  | 'with_examples'
  | 'needs_examples'
  | 'priority_enrichment'
