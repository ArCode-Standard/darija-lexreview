import type { SafetyLexiconRule, SafetyPolicy } from './types'

/**
 * Reviewed starter vocabulary for Moroccan Darija content-safety checks.
 *
 * This is a conservative seed, not an exhaustive profanity dictionary.
 * Variants are separate entries so each spelling is independently testable
 * and can later be reviewed/retired without changing unrelated rules.
 *
 * A match is a signal for contextual handling; profanity alone is not an
 * automatic block. Keep additions tied to human-reviewed examples.
 */
export const DARIJA_SAFETY_SEED_RULES: SafetyLexiconRule[] = [
  // Common profanity / vulgar vocabulary (Arabic script)
  { id: 'darija-prof-001', phrase: 'خرا', category: 'profanity', severity: 2 },
  { id: 'darija-prof-002', phrase: 'زبل', category: 'profanity', severity: 2 },
  { id: 'darija-prof-003', phrase: 'طيز', category: 'profanity', severity: 2 },
  { id: 'darija-prof-004', phrase: 'كس', category: 'profanity', severity: 3 },
  { id: 'darija-prof-005', phrase: 'نيك', category: 'profanity', severity: 3 },
  { id: 'darija-prof-006', phrase: 'تبون', category: 'profanity', severity: 2 },
  { id: 'darija-prof-007', phrase: 'منيوك', category: 'profanity', severity: 4 },
  { id: 'darija-prof-008', phrase: 'متناك', category: 'profanity', severity: 4 },
  { id: 'darija-prof-009', phrase: 'شرموط', category: 'personal_abuse', severity: 4 },
  { id: 'darija-prof-010', phrase: 'قحبة', category: 'personal_abuse', severity: 4 },
  { id: 'darija-prof-011', phrase: 'ولد القحبة', category: 'personal_abuse', severity: 5 },

  // Insults: require trusted targeting context before a block decision
  { id: 'darija-abuse-001', phrase: 'حمار', category: 'personal_abuse', severity: 3 },
  { id: 'darija-abuse-002', phrase: 'كلب', category: 'personal_abuse', severity: 3 },
  { id: 'darija-abuse-003', phrase: 'حيوان', category: 'personal_abuse', severity: 2 },
  { id: 'darija-abuse-004', phrase: 'بهيم', category: 'personal_abuse', severity: 3 },
  { id: 'darija-abuse-005', phrase: 'معفن', category: 'personal_abuse', severity: 2 },
  { id: 'darija-abuse-006', phrase: 'وسخ', category: 'personal_abuse', severity: 2 },
  { id: 'darija-abuse-007', phrase: 'زامل', category: 'personal_abuse', severity: 4 },

  // Common Latin / Arabizi spellings
  { id: 'darija-lat-001', phrase: 'khra', category: 'profanity', severity: 2 },
  { id: 'darija-lat-002', phrase: 'zbel', category: 'profanity', severity: 2 },
  { id: 'darija-lat-003', phrase: 'tiz', category: 'profanity', severity: 2 },
  { id: 'darija-lat-004', phrase: 'nik', category: 'profanity', severity: 3 },
  { id: 'darija-lat-005', phrase: 'mniok', category: 'profanity', severity: 4 },
  { id: 'darija-lat-006', phrase: 'mtnak', category: 'profanity', severity: 4 },
  { id: 'darija-lat-007', phrase: 'chರ್ಮout'.replace('chರ್ಮout', 'chermout'), category: 'personal_abuse', severity: 4 },
  { id: 'darija-lat-008', phrase: '9حba', category: 'personal_abuse', severity: 4 },
  { id: 'darija-lat-009', phrase: '7mar', category: 'personal_abuse', severity: 3 },
  { id: 'darija-lat-010', phrase: 'hmar', category: 'personal_abuse', severity: 3 },
  { id: 'darija-lat-011', phrase: 'zamel', category: 'personal_abuse', severity: 4 },
]

export function createDefaultDarijaSafetyPolicy(
  overrides: Partial<Omit<SafetyPolicy, 'rules' | 'version'>> = {},
): SafetyPolicy {
  return {
    version: 'darija-seed-1.0.0',
    rules: DARIJA_SAFETY_SEED_RULES.map((rule) => ({ ...rule })),
    reviewThreshold: 20,
    blockThreshold: 70,
    maxCharacters: 5000,
    maxRepeatedCharacterRun: 8,
    maxUrls: 3,
    ...overrides,
  }
}
