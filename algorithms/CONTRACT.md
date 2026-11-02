# Algorithm contract and integration boundary

## Stable rules
- Inputs are plain data; functions are pure and do not access Supabase, browser APIs, or external services.
- Original spellings must be stored and displayed unchanged.
- Normalized values are comparison aids only and must never replace canonical spellings.
- Duplicate matches are candidates, not automatic merges.
- Edit distance and token overlap measure form similarity, not synonymy or semantic identity.
- Polarity conflicts are surface-level alerts constrained by shared topic evidence, not semantic contradiction proofs.
- Arabizi conversion is low confidence by default; preserve original Latin input.
- Dialect/region hints require a supplied lexicon with source identifiers and exact token/phrase matches.
- Morphological segmentation is a low-confidence surface hypothesis, not a complete grammar.
- Vector similarity accepts caller-supplied vectors only; it does not generate embeddings or establish meaning.
- Completeness scores measure filled fields only, never linguistic truth.

## Evidence and review
- Every result that may affect an editorial decision must be explainable and reviewable.
- Missing evidence must be represented as unknown, not as evidence of absence.
- Thresholds are configurable and must be evaluated against a representative, human-labelled Darija test set before production use.
- No heuristic score should independently approve, reject, merge, or publish a lexical entry.

## Planned platform adapter (not implemented here)
A future adapter may call these functions from a server-side review service, persist versioned outputs, and expose signals to editors. It must:
1. record engine version and input snapshot;
2. keep human accept/reject decisions separate from algorithm output;
3. never auto-approve, auto-reject, merge, or publish;
4. apply authorization and validation on the server, not only in the UI;
5. add integration tests against the actual Supabase schema and RLS policies.
