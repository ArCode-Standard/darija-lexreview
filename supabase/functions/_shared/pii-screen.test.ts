import { assertEquals } from "jsr:@std/assert@1";
import { containsPii, findPii } from "./pii-screen.ts";

Deno.test("detects email addresses", () => {
  assertEquals(findPii("contact: person@example.ma"), ["email"]);
});

Deno.test("detects Moroccan mobile numbers in local and international formats", () => {
  assertEquals(findPii("0612345678"), ["moroccan_phone"]);
  assertEquals(findPii("+212 6 12 34 56 78"), ["moroccan_phone"]);
});

Deno.test("normalizes Arabic-Indic digits before phone detection", () => {
  assertEquals(findPii("٠٦١٢٣٤٥٦٧٨"), ["moroccan_phone"]);
});

Deno.test("detects Moroccan national identifiers when explicitly labelled", () => {
  assertEquals(findPii("CIN: AB123456"), ["moroccan_national_id"]);
  assertEquals(findPii("رقم البطاقة: AB123456"), ["moroccan_national_id"]);
});

Deno.test("detects Moroccan IBAN values", () => {
  assertEquals(findPii("MA64011519000001205000534921"), ["moroccan_iban"]);
});

Deno.test("does not flag ordinary Darija text or isolated numbers", () => {
  assertEquals(containsPii(["عندي 3 كتب", "الدار البيضاء 2026", "هذا مثال لغوي"]), false);
});

Deno.test("scans multiple fields without requiring their contents to be stored", () => {
  assertEquals(containsPii(["مثال", "اتصل على ٠٦١٢٣٤٥٦٧٨"]), true);
});
