# Algorithm contract and integration boundary

## Stable rules
- Inputs are plain data; functions are pure and do not access Supabase or browser APIs.
- Original spellings must be stored and displayed unchanged.
- Normalized values are comparison aids only.
- Duplicate matches are candidates, not automatic merges.
- Polarity conflicts are surface-level alerts, not semantic contradiction proofs.
- Arabizi conversion is low confidence by default; preserve original Latin input.
- Dialect/region hints require a supplied lexicon with source identifiers.
- Completeness scores measure filled fields only, never linguistic truth.

## Planned platform adapter (not implemented here)
A future adapter may call these functions from a server-side review service, persist versioned outputs, and expose signals to editors. It must:
1. record engine version and input snapshot;
2. keep human accept/reject decisions separate from algorithm output;
3. never auto-approve, auto-reject, merge, or publish;
4. apply authorization and validation on the server, not only in the UI;
5. add integration tests against the actual Supabase schema and RLS policies.
