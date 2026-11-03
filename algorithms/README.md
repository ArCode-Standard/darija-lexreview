# Darija Intelligence Engine

Standalone deterministic TypeScript algorithms for Moroccan Darija analysis. This package is intentionally not connected to the app, Supabase, authentication, corpus exports, or production data.

Modules: normalization, similarity, variant discovery, integrity checks, evidence metadata scoring, review prioritization, regional distribution, embedding similarity, and context diagnostics.

All outputs are suggestions for human review. No module approves, rejects, merges, exports, or modifies a corpus record.

Limitations:
- Similarity is not proof of identity, synonymy, pronunciation, or etymology.
- Arabizi has no single standardized spelling.
- Missing regional observations do not imply non-use.
- Evidence score measures metadata completeness, not truth or source authority.
- Semantic similarity requires caller-supplied embeddings; no model or network dependency is bundled.
- Context grouping is a diagnostic, not automatic word-sense disambiguation.
