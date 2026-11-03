# Content Safety Engine

A deterministic, configurable scanning library (engine version 0.2.0). It is an initial policy engine, not a trained classifier.

## Core APIs

- normalizeSafetyText: conservative Unicode and Arabic normalization for comparison only.
- obfuscationSkeleton: secondary representation for spaced-letter and common digit substitutions.
- scanContent: scans one text value with a trusted surface and trusted context.
- scanContentPayload: scans an explicit map of all text fields in a writable payload and aggregates the strongest decision.

## Policy rules

Rules are injected through a versioned SafetyPolicy. The repository intentionally does not ship a public profanity catalogue. The policy owner must curate and version Arabic, Arabizi, French-mixed and regional variants with editorial review and benchmark evidence.

A rule contains a stable ID, phrase, category, and severity from 1 to 5. Rule phrases are limited to 120 characters. Policy thresholds and content limits are validated at runtime.

## Context and trust

The context property is not user input. A server adapter must derive it from the authenticated route and trusted workflow. A browser request must not be able to claim that arbitrary content is an academic quote, a dictionary definition, a report, or a non-targeted message.

allow_with_context means the workflow may accept a quoted or linguistic mention while retaining an audit/review signal. It does not mean the text is safe to display without presentation controls.

## Decision semantics

- allow: no configured signal.
- allow_with_context: trusted linguistic or reporting context was detected.
- review: ambiguous content requires human review.
- block: clear targeted abuse or configured severe policy violation.
- urgent_escalation: threat signal requiring urgent human review.

A profanity-only hit is not an automatic block. Compact or obfuscated matches are context signals and must be validated against a human-labelled benchmark. Moroccan Arabizi digit conventions (2/3/5/6/7/8/9) are normalized to their Arabic phonetic counterparts; English leetspeak substitutions are kept separate to avoid conflating Darija transliteration with unrelated Latin characters. Content exceeding the configured maximum character count is rejected before expensive lexical scanning.

## Server-side requirement

This library has no authentication, database, RLS, persistence, or audit storage. It must run in a trusted server process. Calling it from React does not protect a Supabase table from direct REST writes.

Every insert and update must enumerate all writable text fields. Do not assume the payload scanner automatically discovers nested fields or JSON keys. The payload adapter rejects object-valued or otherwise unmapped fields, caps field count and array sizes, and scans only explicit string values. Add explicit field maps and tests for each database table.


## Moroccan Darija starter lexicon

- `darija-seed-lexicon.ts` exports `DARIJA_SAFETY_SEED_RULES` and `createDefaultDarijaSafetyPolicy()`.
- The starter set includes Arabic-script and Latin/Arabizi spellings for common vulgar terms and insults, with separate severity and category labels.
- General profanity is a review signal, not an automatic ban. Personal-abuse entries require trusted server-side targeting context before they can trigger a targeted-abuse block.
- The seed is deliberately limited and must be expanded using editor-reviewed regional variants, spelling variants, false-positive reports, and licensed examples. Do not treat it as a complete list of Moroccan profanity.
- The default policy is an opt-in starter configuration. Production services must explicitly load a versioned policy and must not trust client-provided context.
