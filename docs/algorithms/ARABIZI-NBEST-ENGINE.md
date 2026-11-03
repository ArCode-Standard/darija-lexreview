# Arabizi N-best Contextual Transliteration

## Purpose

The Arabizi processor converts Latin/number spellings used for Moroccan Darija into ranked Arabic-script hypotheses. It does not claim to recover a single canonical spelling. The source form must remain available to editors.

## API

```ts
transliterateArabizi(input: string): ArabiziCandidate

transliterateArabiziCandidates(
  input: string,
  options?: { maxCandidates?: number; latinTokenPolicy?: 'arabizi-hinted' | 'all' },
): ArabiziHypothesis[]
```

The backwards-compatible `transliterateArabizi` API still returns `value`, `alternatives`, `confidence`, and `notes`. Its `alternatives` field now contains additional ranked outputs.

The new API returns distinct hypotheses with:
- `value`: Arabic-script candidate.
- `score`: deterministic ranking signal, not a probability.
- `confidence`: conservative qualitative indicator.
- `decisions`: rule trace for ambiguous mappings.

The candidate limit defaults to 5 and is bounded to 1–20. The default token policy is `arabizi-hinted`: numeric Arabizi, selected distinctive spellings, and a small provisional Darija hint list are transliterated; likely English tokens are preserved. Set `latinTokenPolicy: 'all'` to force conversion of every Latin token.

## Current rule layers

1. Multi-character sequences are matched before single characters: `ch/sh`, `kh`, `gh`, `th`, `dh`, `ph`, `ou/oo`, and repeated long-vowel spellings.
2. Common numeric conventions map `2, 3, 5, 6, 7, 8, 9` to Arabic letters.
3. Context-sensitive alternatives are generated for `g`, `c`, and `q`. For example, a front vowel after `c` ranks س above ك, while `g` before a front vowel ranks ج above گ.
4. Vowels receive conservative alternatives, including omission of some internal short vowels and a final-`a` ة hypothesis.
5. Non-Latin segments, punctuation, whitespace, symbols, and likely English tokens are preserved under the default policy.

## Important limitations

- These are grapheme-to-grapheme heuristics, not a trained transliteration model.
- The ranking score is not calibrated and must not be presented as a probability.
- There is no lexical language model, morphological disambiguator, dialect-specific user profile, or speaker adaptation in this version.
- A context-sensitive rule is a ranking hint, not proof of pronunciation. Moroccan speakers use inconsistent spellings and regional conventions.
- English/Arabizi distinction is heuristic. The default policy uses digit and spelling hints plus a small provisional Darija token list; unknown plain-letter Arabizi may be preserved. Use `latinTokenPolicy: 'all'` when the caller knows the input is Arabizi.
- Outputs are advisory. Never auto-create, merge, reject, or publish a lexical entry from a transliteration result.

## Evaluation required before production use

Build a speaker-reviewed corpus with:
- original Arabizi form and accepted Arabic-script spelling(s);
- sentence context and intended lexical sense;
- region/dialect metadata only when supplied by the contributor;
- multiple accepted spellings where variation is legitimate;
- hard negatives for English, French, names, code, and mixed-script text.

Report top-1 exact match, top-k recall, character error rate, ambiguity calibration, and false transliteration rate separately. Split evaluation by contributor and lexical family to reduce leakage. Report results by region and by numeric/digraph pattern. Do not tune and evaluate on the same examples.

## Next research increments

1. Add a reviewed lexicon/context prior that is optional, versioned, and source-attributed.
2. Add word-boundary and morphology-aware decoding with an explicit unknown-token path.
3. Add dialect-conditioned mappings only when backed by speaker-labelled evidence.
4. Compare the deterministic beam-search baseline with a trained sequence model after the gold corpus is large and diverse enough.
5. Add editor feedback only through an explicit consent and review pipeline; raw private messages are not training data by default.
