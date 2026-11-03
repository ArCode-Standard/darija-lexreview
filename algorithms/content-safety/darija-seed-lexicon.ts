import type { SafetyLexiconRule, SafetyPolicy } from './types'

/**
 * Conservative starter vocabulary for Moroccan Darija content-safety checks.
 *
 * Entries are signals, not verdicts. Ambiguous spellings are intentionally
 * excluded until dialect reviewers provide a sense, examples, and evidence.
 * Keep variants independently addressable so they can be reviewed or retired.
 */
export const DARIJA_SAFETY_SEED_RULES: SafetyLexiconRule[] = [
  // Vulgar vocabulary: a match requests review; it does not itself prove abuse.
  { id: 'darija-prof-001', phrase: 'خرا', category: 'profanity', severity: 2 },
  { id: 'darija-prof-002', phrase: 'زبل', category: 'profanity', severity: 2 },
  { id: 'darija-prof-003', phrase: 'طيز', category: 'profanity', severity: 2 },
  { id: 'darija-prof-004', phrase: 'كس', category: 'profanity', severity: 3 },
  { id: 'darija-prof-005', phrase: 'نيك', category: 'profanity', severity: 3 },
  { id: 'darija-prof-007', phrase: 'منيوك', category: 'profanity', severity: 4 },
  { id: 'darija-prof-008', phrase: 'متناك', category: 'profanity', severity: 4 },
  { id: 'darija-prof-009', phrase: 'شرموط', category: 'personal_abuse', severity: 4 },
  { id: 'darija-prof-010', phrase: 'قحبة', category: 'personal_abuse', severity: 4 },
  { id: 'darija-prof-011', phrase: 'ولد القحبة', category: 'personal_abuse', severity: 5 },
  { id: 'darija-prof-012', phrase: 'قواد', category: 'personal_abuse', severity: 4 },
  { id: 'darija-prof-013', phrase: 'ولد الحرام', category: 'personal_abuse', severity: 4 },
  { id: 'darija-prof-014', phrase: 'سير تقود', category: 'personal_abuse', severity: 4 },

  // Personal insults: require trusted targeting context before a block decision.
  { id: 'darija-abuse-001', phrase: 'حمار', category: 'personal_abuse', severity: 3 },
  { id: 'darija-abuse-002', phrase: 'كلب', category: 'personal_abuse', severity: 3 },
  { id: 'darija-abuse-003', phrase: 'حيوان', category: 'personal_abuse', severity: 2 },
  { id: 'darija-abuse-004', phrase: 'بهيم', category: 'personal_abuse', severity: 3 },
  { id: 'darija-abuse-005', phrase: 'معفن', category: 'personal_abuse', severity: 2 },
  { id: 'darija-abuse-006', phrase: 'وسخ', category: 'personal_abuse', severity: 2 },
  { id: 'darija-abuse-008', phrase: 'كلخ', category: 'personal_abuse', severity: 3 },
  { id: 'darija-abuse-009', phrase: 'مكلخ', category: 'personal_abuse', severity: 3 },
  { id: 'darija-abuse-010', phrase: 'غبي', category: 'personal_abuse', severity: 2 },
  { id: 'darija-abuse-011', phrase: 'حقير', category: 'personal_abuse', severity: 3 },
  { id: 'darija-abuse-012', phrase: 'تافه', category: 'personal_abuse', severity: 2 },
  { id: 'darija-abuse-013', phrase: 'قليل التربية', category: 'personal_abuse', severity: 3 },
  { id: 'darija-abuse-014', phrase: 'حمارة', category: 'personal_abuse', severity: 3 },
  { id: 'darija-abuse-015', phrase: 'بهيمة', category: 'personal_abuse', severity: 3 },

  // Latin / Arabizi variants commonly used in Moroccan online writing.
  { id: 'darija-lat-001', phrase: 'khra', category: 'profanity', severity: 2 },
  { id: 'darija-lat-002', phrase: 'zbel', category: 'profanity', severity: 2 },
  { id: 'darija-lat-003', phrase: 'tiz', category: 'profanity', severity: 2 },
  { id: 'darija-lat-004', phrase: 'nik', category: 'profanity', severity: 3 },
  { id: 'darija-lat-005', phrase: 'mniok', category: 'profanity', severity: 4 },
  { id: 'darija-lat-006', phrase: 'mtnak', category: 'profanity', severity: 4 },
  { id: 'darija-lat-007', phrase: 'chermout', category: 'personal_abuse', severity: 4 },
  { id: 'darija-lat-008', phrase: '9ahba', category: 'personal_abuse', severity: 4 },
  { id: 'darija-lat-009', phrase: '7mar', category: 'personal_abuse', severity: 3 },
  { id: 'darija-lat-010', phrase: 'hmar', category: 'personal_abuse', severity: 3 },
  { id: 'darija-lat-011', phrase: 'zamel', category: 'personal_abuse', severity: 4 },
  { id: 'darija-lat-012', phrase: 'kelkh', category: 'personal_abuse', severity: 3 },
  { id: 'darija-lat-013', phrase: 'mkellekh', category: 'personal_abuse', severity: 3 },
  { id: 'darija-lat-014', phrase: 'ghbi', category: 'personal_abuse', severity: 2 },
  { id: 'darija-lat-015', phrase: '7e9ir', category: 'personal_abuse', severity: 3 },
  { id: 'darija-lat-016', phrase: 'tafeh', category: 'personal_abuse', severity: 2 },
  { id: 'darija-lat-017', phrase: 'weld l7ram', category: 'personal_abuse', severity: 4 },
  { id: 'darija-lat-018', phrase: 'sir t9awed', category: 'personal_abuse', severity: 4 },
]

export function createDefaultDarijaSafetyPolicy(
  overrides: Partial<Omit<SafetyPolicy, 'rules' | 'version'>> = {},
): SafetyPolicy {
  return {
    version: 'darija-seed-1.1.0',
    rules: DARIJA_SAFETY_SEED_RULES.map((rule) => ({ ...rule })),
    reviewThreshold: 20,
    blockThreshold: 70,
    maxCharacters: 5000,
    maxRepeatedCharacterRun: 8,
    maxUrls: 3,
    ...overrides,
  }
}
