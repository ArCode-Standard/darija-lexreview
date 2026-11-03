# Model Training Plan — Darija and Content Safety

## Model strategy

Do not train a general language model from scratch. Start from a Darija-specific pretrained encoder, fine-tune for classification, and compare against a simple character n-gram baseline. Keep deterministic rules as a separate safety layer.

Candidate pretrained encoders:
- [SI2M-Lab/DarijaBERT](https://huggingface.co/SI2M-Lab/DarijaBERT) — Darija-focused Arabic-script encoder.
- [SI2M-Lab/DarijaBERT-arabizi](https://huggingface.co/SI2M-Lab/DarijaBERT-arabizi) — Latin-script/Arabizi variant; its model card describes a large Arabizi-specific pretraining corpus.
- [SI2M-Lab/DarijaBERT-mix](https://huggingface.co/SI2M-Lab/DarijaBERT-mix) — mixed-script candidate; the currently visible model card is sparse.

Model cards and weights must be reviewed for license, provenance, revision pinning, and security before download. The mixed model card is currently sparse; do not assume that its license or training-data rights are clear. Compare models on the same locked benchmark rather than selecting by name or popularity.

## Recommended experiments

### Experiment A — deterministic baseline
Evaluate the current normalization, lexicon rules, context logic, and obfuscation signals against the benchmark. Record false positives on dictionary and report examples.

### Experiment B — lightweight baseline
Train a character n-gram classifier as a fast reference point. It is useful for spelling variation and provides a low-cost benchmark, but it cannot replace contextual review.

### Experiment C — Darija transformer fine-tuning
Fine-tune the Arabic, Arabizi, and mixed-script encoder candidates for multi-label safety classification. Compare:
- single shared mixed-script model;
- separate Arabic and Arabizi models with script routing;
- calibrated ensemble only if it improves per-class and per-script results.

Do not assume that a single binary offensive label is sufficient. Train separate outputs for personal abuse, hate, threat, spam, profanity mention, and legitimate quoted/linguistic use.

## Training data sources

DarOLD v3 is a public human-labelled binary dataset of 20,402 Darija sentences, containing Arabic and Latin scripts and published under CC BY 4.0. It can seed a baseline but lacks enough contextual labels for the platform's complete policy.

DarOLD v4 broadens labels and adds OMCD-derived data, but its release notes describe AI-assisted relabeling with manual conflict review. It should be treated as a candidate source requiring independent quality assessment, not as the only gold standard.

Platform contributions and editor decisions can extend the dataset only when:
- the source record explicitly permits training;
- the license and provenance are retained;
- the example is anonymized and passes PII review;
- the label is approved by the required human reviewers;
- private messages and sensitive personal data are excluded.

## Reproducibility requirements

Every run records:
- immutable base-model revision and license;
- dataset version, SHA-256 fingerprint, and license manifest;
- code commit and environment lockfile;
- tokenizer and preprocessing versions;
- seed, hyperparameters, hardware, and training duration;
- per-class and per-script evaluation report;
- model artifact SHA-256 and approval identities.

Keep test data out of training and hyperparameter selection. Do not upload models or datasets to public model hubs by default.

## Deployment

Export approved models to a reproducible inference artifact (for example, safetensors and an optional ONNX runtime build after parity testing). Keep inference behind a server-side service. The browser must not download the model or access training data.

Start in shadow mode. The model can recommend review decisions but must not autonomously punish users. High-confidence threats may trigger urgent human review; final enforcement follows the approved content policy and appeal process.

## Current status

No transformer has been downloaded or fine-tuned. No dataset has been imported. The repository currently contains a deterministic TypeScript baseline and training/data-governance primitives. Model training starts only after source-license review, benchmark curation, and an available reproducible training environment.
