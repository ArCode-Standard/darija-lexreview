# Darija algorithm benchmark

## Dataset status

`dataset.ts` is a **provisional engineering fixture set**, not a representative Moroccan Darija corpus and not yet validated by regional native speakers. Region tags identify coverage targets, not exclusive usage. Sense IDs are the current provisional gold labels. Do not use these scores to approve or reject lexical entries.

Before treating any metric as linguistic evidence, recruit at least two independent native-speaker annotators per target region, record provenance and consent, adjudicate disagreements, and freeze a versioned train/dev/test split. Keep dialect, script, sense, and spelling-variant labels separate.

## What is measured

- Normalization: orthographic-only positive and negative pairs (hamza/alef and diacritic handling); lexical synonyms are not treated as normalization equivalents.
- Variant discovery: pairwise candidate precision, recall, and F1 against provisional sense IDs. A candidate is not a synonym assertion.
- Arabizi transliteration: exact normalized Arabic-output match against the expected-output fixtures.
- Scale: normalization, single-query duplicate search, transliteration, and indexed variant candidate generation on synthetic data.

## Algorithms not yet assigned accuracy scores

The current fixture labels support provisional checks for normalization, variant discovery, duplicate detection, and Arabizi transliteration only. Morphology, contradiction detection, dialect geography, context diagnostics, evidence quality, review priority, and vector semantic similarity are intentionally excluded: each needs task-specific, independently annotated gold labels and a clear definition of a positive result. Reusing word-equivalence labels for these tasks would produce meaningless precision/recall.

## Variant discovery: exhaustive and indexed modes

The original exhaustive strategy compares all pairs: 499,500 at 1k, 49,995,000 at 10k, and 1,249,975,000 at 50k. The new indexed strategy uses character-bigram postings, skips common blocks, and bounds candidate fan-out per record. Small corpora retain exhaustive comparison by default; large corpora use approximate candidate generation.

The indexed mode exposes `candidatePairs`, `skippedCommonBlocks`, and `truncatedItems`. It can miss a true variant when no retained bigram is shared or a candidate cap is reached. Missing results are not negative linguistic evidence. See [the indexed discovery engineering note](../docs/algorithms/INDEXED-VARIANT-DISCOVERY.md).

The 50k benchmark measures candidate-generation workload, not linguistic recall or precision. A representative, speaker-reviewed gold set is still required before production decision support.

## Run

```bash
npm test -- tests/benchmarks.test.ts
```

The report is emitted to the Vitest console. Wall-clock timings are environment-dependent and should be compared only on the same runner class. No production data, Supabase, UI, or runtime behavior is changed by this benchmark suite.
