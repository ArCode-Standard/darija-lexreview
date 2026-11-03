# Indexed variant discovery (engineering note)

## Why this change exists

The original `discoverVariantCandidates` evaluated every pair. That is useful as a small-corpus reference implementation, but it scales as `n(n-1)/2` and becomes impractical for a growing lexicon.

The indexed implementation adds a candidate-generation stage before expensive similarity scoring:

1. Normalize each form with the existing Darija search-key function while preserving the original form in the output.
2. Build an inverted index of unique character bigrams.
3. Generate pairs that share at least one bigram.
4. Keep exact normalized-form candidates even when common bigram blocks are skipped.
5. Skip high-frequency postings and cap candidate comparisons per item.
6. Apply the existing Jaro-Winkler and normalized edit-similarity scoring only to generated pairs.

## API

- `discoverVariantCandidatesWithStats(items, threshold, options)` returns `{ matches, stats }`.
- `discoverVariantCandidates(items, threshold, options)` remains backwards-compatible and returns only the match array.

Options:

| Option | Default | Purpose |
|---|---:|---|
| `exhaustiveBelow` | 256 | Preserve exhaustive pair coverage for small eligible corpora |
| `maxBlockSize` | 64 | Skip n-gram postings larger than this |
| `maxCandidatesPerItem` | 128 | Bound candidate comparisons per record in indexed mode |

Stats report strategy, input/eligible counts, candidate/compared pairs, skipped common blocks, and truncated items.

## Important recall boundary

Indexed mode is deliberately approximate. A true spelling variant may be missed if it shares no retained bigram with the other form, if all useful bigram postings are too common, or if a per-item candidate cap is reached. Therefore:

- A returned match is a review candidate, not proof of lexical equivalence.
- An absent match is not proof that forms differ.
- `truncatedItems` and `skippedCommonBlocks` must be visible to callers that use indexed mode.
- Do not use this algorithm as an automatic merge, rejection, or publication gate.

For audits or small curated batches, set `exhaustiveBelow` high enough to force exhaustive comparison. For production-scale recall, the next step is a recall-oriented multi-pass index (character n-grams plus token-prefix/deletion signatures) evaluated against a speaker-reviewed gold set.

## Validation

The tests cover small-corpus exhaustive behavior, obvious near-variant retrieval in indexed mode, bounded exact-form blocks, and a 50k synthetic workload. Synthetic performance demonstrates engineering scalability only; it does not establish linguistic recall or precision.
