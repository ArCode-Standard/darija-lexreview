export type PiiFinding =
  | "email"
  | "moroccan_phone"
  | "international_phone"
  | "moroccan_national_id"
  | "moroccan_iban";

const ZERO_WIDTH_AND_BIDI = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/gu;
const ARABIC_DIGITS: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

function normalizeForPiiScan(value: string): string {
  return value.normalize("NFKC")
    .replace(ZERO_WIDTH_AND_BIDI, "")
    .replace(/[٠-٩۰-۹]/gu, (digit) => ARABIC_DIGITS[digit] ?? digit);
}

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu;
const MOROCCAN_PHONE = /(?:\+|00)212[\s().-]*[5-7](?:[\s().-]*\d){8}\b|\b0[5-7](?:[\s().-]*\d){8}\b/u;
const INTERNATIONAL_PHONE = /(?:\+|00)[1-9](?:[\s().-]*\d){7,14}\b/u;
const MOROCCAN_CIN = /(?:\bCIN\b|\bCNI\b|رقم\s+(?:البطاقة|التعريف)|بطاقة\s+التعريف)\s*[:#-]?\s*[A-Z]{1,2}[\s-]?\d{5,6}\b/iu;
const MOROCCAN_IBAN = /\bMA\d{26}\b/iu;

/**
 * High-confidence direct-identifier screen for user-contributed learning data.
 * This is a rejection filter, not a complete anonymizer or PII classifier.
 */
export function findPii(value: string): PiiFinding[] {
  const normalized = normalizeForPiiScan(value);
  const findings: PiiFinding[] = [];
  if (EMAIL.test(normalized)) findings.push("email");
  if (MOROCCAN_PHONE.test(normalized)) findings.push("moroccan_phone");
  else if (INTERNATIONAL_PHONE.test(normalized)) findings.push("international_phone");
  if (MOROCCAN_CIN.test(normalized)) findings.push("moroccan_national_id");
  if (MOROCCAN_IBAN.test(normalized)) findings.push("moroccan_iban");
  return findings;
}

export function containsPii(values: readonly string[]): boolean {
  return values.some((value) => findPii(value).length > 0);
}
