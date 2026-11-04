import { containsPii, findPii } from "./pii-screen.ts";

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message + ": expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual));
  }
}

Deno.test("detects email addresses", () => {
  assertEqual(findPii("contact: person@example.ma"), ["email"], "email");
});

Deno.test("detects Moroccan mobile numbers in local and international formats", () => {
  assertEqual(findPii("0612345678"), ["moroccan_phone"], "local phone");
  assertEqual(findPii("+212 6 12 34 56 78"), ["moroccan_phone"], "international Moroccan phone");
});

Deno.test("normalizes Arabic-Indic digits before phone detection", () => {
  assertEqual(findPii("٠٦١٢٣٤٥٦٧٨"), ["moroccan_phone"], "Arabic-Indic phone");
});

Deno.test("detects Moroccan national identifiers when explicitly labelled", () => {
  assertEqual(findPii("CIN: AB123456"), ["moroccan_national_id"], "Latin CIN label");
  assertEqual(findPii("رقم البطاقة: AB123456"), ["moroccan_national_id"], "Arabic CIN label");
});

Deno.test("detects Moroccan IBAN values", () => {
  assertEqual(findPii("MA64011519000001205000534921"), ["moroccan_iban"], "Moroccan IBAN");
});

Deno.test("does not flag ordinary Darija text or isolated numbers", () => {
  assertEqual(containsPii(["عندي 3 كتب", "الدار البيضاء 2026", "هذا مثال لغوي"]), false, "ordinary text");
});

Deno.test("scans multiple fields without requiring their contents to be stored", () => {
  assertEqual(containsPii(["مثال", "اتصل على ٠٦١٢٣٤٥٦٧٨"]), true, "PII across fields");
});
