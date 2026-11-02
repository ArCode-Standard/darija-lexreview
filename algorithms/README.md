# Darija LexReview — Algorithm Engine

Standalone, deterministic TypeScript algorithms for assisting Moroccan Darija lexical review.

## Modules
- `text-analysis`: Unicode-aware script detection, normalization, and tokenization.
- `lexical-analysis`: comparison forms and orthographic feature detection; original forms remain intact.
- `arabizi-processing`: token-aware rule transliteration for common Arabizi digits and digraphs.
- `duplicate-detection`: normalized equality, character edit similarity, and token overlap ranking.
- `contradiction-detection`: topic-constrained surface polarity alerts; not semantic proof.
- `dialect-analysis`: exact token/phrase region hints from a supplied sourced lexicon.
- `linguistic-quality`: explainable entry-completeness checks, not linguistic correctness.
- `morphology-analysis`: conservative affix/stem hypotheses with low confidence.
- `semantic-similarity`: cosine similarity over caller-supplied vectors; embeddings are not generated here.
- `shared`: contracts and reusable Unicode normalization helpers.

## Design constraints
1. Preserve original user input; normalized strings are derived comparison fields only.
2. Every score is a heuristic and includes reasons/evidence where applicable.
3. No external network calls, model inference, database writes, or automatic editorial decisions.
4. Unknown words and unsupported spellings remain unknown, not errors.
5. Similarity scores are not proof of synonymy, duplicate identity, or shared meaning.
6. Morphological segmentation and dialect identification are hypotheses requiring sourced data and human review.
7. Human editors retain final authority.

## Usage
Import individual functions from `./index`. All functions are pure and deterministic.
Run tests with `npm test`; type-check/build with `npm run build`.

## Integration boundary
This package is intentionally not connected to React components, Supabase, or RLS. Integration should happen only after independent tests and editor review of the heuristics.
