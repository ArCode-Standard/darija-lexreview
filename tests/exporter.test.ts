import { describe, expect, it } from 'vitest'
import { buildOfficialExportBundle, findBlockingSubmissionIds } from '../src/services/exporter'
import type { RawOfficialCorpus, SubmissionRecord } from '../src/types/lexicon'

const corpus: RawOfficialCorpus = {
  lexiconMeta:{version:'1.0.0'}, examplesMeta:{version:'1.0.0'}, rawExamples:[],
  rawEntries:[{id:1,category:'صفة',darija_ar:'زوين',darija_latin:'zwin',fusha_ar:'جميل',fr:'beau',
    provenance:{source_type:'original',rights_holder:'ArCode Standard',license:'CC BY 4.0',
      redistribution_permission:'allowed',training_permission:'not_allowed',commercial_permission:'allowed'}}],
}
const accepted: SubmissionRecord = {
  id:'submission-1',entry_id:'1',proposed_data:{word_ar:'زوين بزاف',arabizi:'zwin bzzaf'},
  evidence:[],reviewer_note:null,status:'accepted',reviewer_id:'reviewer-1',editor_id:'editor-1',
  editor_note:'تعديل لغوي موثق ومراجع.',created_at:'2026-10-30T10:00:00.000Z',
  updated_at:'2026-10-30T11:00:00.000Z',
}
describe('export integrity', () => {
  it('does not mutate the source corpus', () => {
    const before=structuredClone(corpus)
    buildOfficialExportBundle(corpus,[accepted],'1.0.1')
    expect(corpus).toEqual(before)
  })
  it('blocks accepted edits whose target entry is missing', () => {
    expect(findBlockingSubmissionIds(corpus,[{...accepted,id:'missing',entry_id:'9999'}])).toContain('missing')
  })
  it('blocks new entries with unknown rights or license fields', () => {
    const item: SubmissionRecord={...accepted,id:'new-entry',entry_id:'NEW',proposed_data:{
      submission_kind:'new_entry',word_ar:'مثال',arabizi:'mital',category:'اسم',
      msa_translation:'مثال',french_translation:'exemple',rights_holder:'unknown',
      license:'unknown',redistribution_permission:'unknown',training_permission:'unknown',
      commercial_permission:'unknown',
    }}
    expect(findBlockingSubmissionIds(corpus,[item])).toContain('new-entry')
  })
})
