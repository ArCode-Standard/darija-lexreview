# Darija algorithm benchmark

## Dataset status

`dataset.ts` is a **provisional engineering fixture set**, not a representative Moroccan Darija corpus and not yet validated by regional native speakers. Region tags identify coverage targets, not exclusive usage. Sense IDs are the current provisional gold labels. Do not use these scores to approve or reject lexical entries.

Before treating any metric as linguistic evidence, recruit at least two independent native-speaker annotators per target region, record provenance and consent, adjudicate disagreements, and freeze a versioned train/dev/test split. Keep dialect, script, sense, and spelling-variant labels separate.

## What is measured

- Normalization: orthographic-only positive and negative pairs (hamza/alef and diacritic handling); lexical synonyms are not treated as normalization equivalents.
- Variant discovery: pairwise candidate precision, recall, and F1 against provisional sense IDs. A candidate is not a synonym assertion.
- Arabizi transliteration: exact normalized Arabic-output match against the expected-output fixtures.
- Scale: normalization, single-query duplicate search, and transliteration at 1k, 10k, and 50k synthetic entries.

## Algorithms not yet assigned accuracy scores

The current fixture labels support provisional checks for normalization, variant discovery, duplicate detection, and Arabizi transliteration only. Morphology, contradiction detection, dialect geography, context diagnostics, evidence quality, review priority, and vector semantic similarity are intentionally excluded: each needs task-specific, independently annotated gold labels and a clear definition of a positive result. Reusing word-equivalence labels for these tasks would produce meaningless precision/recall.

## Important limitation: quadratic variant discovery

The current `discoverVariantCandidates` compares every pair. Pair counts are 499,500 at 1k, 49,995,000 at 10k, and 1,249,975,000 at 50k. The harness deliberately does **not** execute the 10k/50k all-pairs workload: doing so would risk excessive CI time and memory. It reports the pair count and marks those runs as skipped. This is a measured architectural limitation, not a fabricated runtime result. A blocking/indexing strategy is required before large-corpus pairwise benchmarking.

## Run

```bash
npm test -- tests/benchmarks.test.ts
```

The report is emitted to the Vitest console. Wall-clock timings are environment-dependent and should be compared only on the same runner class. No production data, Supabase, UI, or runtime behavior is changed by this benchmark suite.
