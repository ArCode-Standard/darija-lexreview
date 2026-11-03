# Moroccan Darija Content Safety Benchmark

## Purpose

Create a human-reviewed, context-aware benchmark for Arabic-script Darija, Arabizi, French/Darija code-switching, and regional variants. The benchmark must measure both harmful-content detection and preservation of legitimate linguistic documentation.

## Label schema

Use multi-label annotation rather than a single offensive/non-offensive flag:

- safe_general
- profanity_mention
- personal_abuse
- hate_or_dehumanization
- threat_or_incitement
- spam_or_flooding
- quoted_evidence
- linguistic_or_academic_use

Annotate target, intent, context, and confidence separately. A text can contain a profane term while still being a legitimate dictionary entry or moderation report.

## Required dimensions

- Script: Arabic, Arabizi, mixed.
- Language mix: Darija-only, Darija/French, Darija/Arabic, other code-switching.
- Region: only where supported by consent and evidence; do not infer region from a name.
- Surface: lexicon, contribution, profile, comment/discussion, report, message.
- Context: directed abuse, playful banter, neutral mention, definition, academic analysis, quote/evidence, threat language, ambiguous mixed intent.
- Cue combinations: insult + second-person address; insult + laughter; profanity + dictionary question; threat + report marker; quoted threat without report marker.
- Obfuscation: elongation, spacing, punctuation, digits, homoglyphs, transliteration variants.
- Provenance: source ID, license, permission, annotation history.

## Annotation protocol

1. Two independent annotators label each benchmark item.
2. A third senior editor adjudicates disagreements.
3. High-impact safety categories require explicit rationale and evidence.
4. Keep uncertainty and ambiguous cases as labels; do not force a binary answer.
5. Store the original text only in access-controlled benchmark storage.
6. Remove personal identifiers and source handles before training.
7. Keep a locked test set unavailable to the training pipeline.

## Split protocol

Split by source/thread/author group, not random row. Near-duplicates and variants of the same source must stay in one split. Keep an external evaluation set from a different source or collection period. Do not use user votes as test labels.

## Release gates

Report per-label Precision, Recall, F1, FPR and FNR, plus macro averages, confusion matrices, confidence calibration, latency, and results by script and context. A model cannot pass by achieving high aggregate accuracy while failing a high-risk class or overblocking educational mentions.

## Public seed resources to evaluate

- DarOLD v3: 20,402 human-labelled Moroccan Darija sentences, binary offensive/non-offensive labels, Arabic and Latin scripts, published under CC BY 4.0. It is a useful initial baseline, but its binary labels do not distinguish educational mentions from targeted abuse. https://data.mendeley.com/datasets/2y4m97b7dc/3
- DarOLD v4: expanded and cleaned with OMCD-derived samples and broader offensive categories; the release description notes AI-assisted relabeling and manual review of conflicts. Treat it as a candidate training source, not as a locked gold test set. https://data.mendeley.com/datasets/2y4m97b7dc/4
- OMCD and additional Darija resources: review source licenses and annotation methodology before use. https://smia.ma/en/open-data/

Do not copy raw offensive samples into this repository. Store datasets in restricted training storage and commit only manifests, hashes, schemas, and evaluation summaries.
