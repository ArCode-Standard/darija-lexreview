# Content Safety Engine

A deterministic, configurable scanning library (engine version 0.2.1). It is an initial policy engine, not a trained classifier.

## Core APIs

- normalizeSafetyText: conservative Unicode and Arabic normalization for comparison only.
- obfuscationSkeleton: secondary representation for spaced-letter and common digit substitutions.
- analyzeDarijaContext: produces a multi-label, advisory context assessment (directed abuse, banter, quote/evidence, linguistic mention, threat language, or uncertainty). It is text-derived and never trusted for enforcement.\n- scanContent: scans one text value with a trusted surface and trusted context, and attaches the context assessment.
- scanContentPayload: scans an explicit map of all text fields in a writable payload and aggregates the strongest decision.

## Policy rules

Rules are injected through a versioned SafetyPolicy. The repository includes a small, conservative Moroccan Darija starter lexicon. It is not exhaustive and is not a source of automatic verdicts.

A rule contains a stable ID, phrase, category, and severity from 1 to 5. Rule phrases are limited to 120 characters. Policy thresholds and content limits are validated at runtime.

## Lexicon curation

The detailed editorial checklist is in [DARIJA-SAFETY-LEXICON-GUIDE.md](../../docs/algorithms/DARIJA-SAFETY-LEXICON-GUIDE.md).

- Keep Arabic-script, Latin, Arabizi, mixed-script, and common spacing variants as separately reviewable entries.
- Do not add a spelling solely because it resembles a known insult. Record its dialectal sense and a real, licensed example first.
- Exclude ambiguous terms until a Moroccan Darija reviewer confirms the intended sense and likely false positives.
- Keep person-directed insults separate from profanity and require trusted targeting context before a targeted-abuse block.
- Add neutral/educational counterexamples for every high-risk term so benchmarks measure false positives as well as recall.
- Treat severity as annotation metadata, not a direct probability of abuse.
- Version the lexicon whenever entries are added, corrected, or retired.

## Context understanding\n\nThe context layer combines phrase-level cues with matched lexicon categories. It deliberately keeps multiple labels when signals conflict: laughter does not cancel an insult, and quotation does not prove that a threat is harmless. Its confidence is heuristic, not calibrated probability. Threat-like phrases discovered by this layer trigger review; only server-derived trusted context and the policy engine can authorize enforcement.\n\n## Context and trust

The context property is not user input. A server adapter must derive it from the authenticated route and trusted workflow. A browser request must not be able to claim that arbitrary content is an academic quote, a dictionary definition, a report, or a non-targeted message.

allow_with_context means the workflow may accept a quoted or linguistic mention while retaining an audit/review signal. It does not mean the text is safe to display without presentation controls.

## Decision semantics

- allow: no configured signal.
- allow_with_context: trusted linguistic or reporting context was detected.
- review: ambiguous content requires human review.
- block: clear targeted abuse or configured severe policy violation.
- urgent_escalation: threat signal requiring urgent human review.

Text-derived Darija direct-address cues (for example, second-person forms) can raise a low-confidence review signal when an insult is also present; they never authorize a block. Only server-derived targeting context can do that. A profanity-only hit is not an automatic block. Compact or obfuscated matches are context signals and must be validated against a human-labelled benchmark. Moroccan Arabizi digit conventions (2/3/5/6/7/8/9) are normalized to their Arabic phonetic counterparts; English leetspeak substitutions are kept separate to avoid conflating Darija transliteration with unrelated Latin characters. Separated-letter matching permits limited spaces and punctuation while preserving word boundaries.

## Server-side requirement

This library has no authentication, database, RLS, persistence, or audit storage. It must run in a trusted server process. Calling it from React does not protect a Supabase table from direct REST writes.

Every insert and update must enumerate all writable text fields. Do not assume the payload scanner automatically discovers nested fields or JSON keys. The payload adapter rejects object-valued or otherwise unmapped fields, caps field count and array sizes, and scans only explicit string values. Add explicit field maps and tests for each database table.

## Current limitations

The starter list contains editor-curated candidate forms, not a corpus-derived vocabulary. It does not establish that every spelling is used uniformly across Morocco. Regional variants, reclaimed language, sarcasm, quotation, and code-switching require labelled examples and human review. This release remains deterministic; it does not train or fine-tune an ML model.
