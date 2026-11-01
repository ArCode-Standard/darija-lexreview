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

export type SubmissionStatus = 'pending' | 'accepted' | 'rejected' | 'needs_changes'

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
  is_sandbox?: boolean
}

export interface ReviewerProfile {
  id: string
  display_name: string | null
  role: 'reviewer' | 'editor' | 'admin'
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
  patchSummary: {
    generated_at: string
    target_version: string
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

export type DataMode = 'loading' | 'live' | 'demo'
export type WorkbenchTab =
  | 'explorer'
  | 'new_entry'
  | 'corpus'
  | 'submissions'
  | 'moderation'
  | 'exporter'
export type ExampleFilter = 'all' | 'with_examples' | 'needs_examples'
