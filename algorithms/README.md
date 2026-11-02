# Darija LexReview — Algorithm Engine

Standalone, deterministic TypeScript algorithms for assisting Moroccan Darija lexical review.

## Modules
- `text-analysis`: Unicode-aware text cleanup and tokenization.
- `lexical-analysis`: Arabic-script normalization without deleting the original form.
- `arabizi-processing`: conservative Arabizi character mapping; ambiguous forms are preserved as alternatives.
- `duplicate-detection`: exact, normalized, and token-overlap candidate detection.
- `contradiction-detection`: explicit polarity/negation conflict signals; never claims semantic certainty.
- `dialect-analysis`: evidence-backed region hints from a supplied lexicon only.
- `linguistic-quality`: explainable completeness/format checks, not a correctness verdict.
- `shared`: shared contracts and normalization helpers.

## Design constraints
1. Preserve original user input; normalized strings are derived fields only.
2. Every score is a heuristic and includes reasons/evidence.
3. No external network calls, database writes, or automatic editorial decisions.
4. Unknown words and unsupported spellings remain unknown, not errors.
5. Human editors retain final authority. Do not use these outputs as proof of a word's meaning.

## Usage
Import individual functions from `./index`. All functions are pure and deterministic.
Run tests with `npm test`; type-check/build with `npm run build`.

## Integration boundary
This package is intentionally not connected to React components, Supabase, or RLS yet. Integration should happen only after independent tests and editor review of the heuristics.
