# Darija LexReview Algorithm Engine

A deterministic TypeScript library for Moroccan Darija text and lexical review. The engine is isolated from the React interface, Supabase, authentication, production data, and corpus publishing.

## Modules

- Text and lexical normalization, script detection, and tokenization.
- Arabizi-to-Arabic candidate transliteration.
- Duplicate and spelling-variant candidate ranking.
- Surface polarity-conflict alerts constrained by shared topic evidence.
- Dialect hints from a caller-supplied, source-identified lexicon.
- Conservative morphology hypotheses and linguistic-quality diagnostics.
- Integrity checks, evidence metadata completeness, and review prioritization.
- Regional distribution summaries and lexical context diagnostics.
- Cosine similarity over caller-supplied vectors only.

## Safety and editorial boundaries

- Results are heuristic signals for human review, not linguistic truth.
- Original source spellings are never rewritten by normalization.
- Missing regional observations mean unknown, not absence or non-use.
- Similarity is not proof of identity, synonymy, pronunciation, or etymology.
- Metadata completeness is not evidence validity or source authority.
- Arabizi transliteration and morphology outputs are low-confidence hypotheses.
- Vector similarity does not generate embeddings and performs no model or network calls.
- No module approves, rejects, merges, publishes, exports, or mutates corpus records.

## Validation

Run `npm test` and `npm run build`. Thresholds and heuristics require evaluation against a representative, human-labelled Moroccan Darija dataset before production decision support.
