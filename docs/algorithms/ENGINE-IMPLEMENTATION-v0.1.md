# Content Safety & Governed Learning — Implementation 0.1

## Delivered in this branch

- Pure TypeScript content-safety engine with Unicode normalization, Moroccan Arabizi digit-aware obfuscation skeletons, and hard content-size limits.
- Configurable, source-controlled lexicon rules. No public hard-coded profanity catalogue is included.
- Context-aware outcomes distinguishing profanity mentions from targeted abuse and threats.
- Review-first handling for ambiguous cases; a profanity-only match cannot automatically block. Explicit payload scanning rejects unmapped object values and bounds field and array counts.
- Feedback intake rejecting private-message sources, requiring explicit dataset-use consent and a documented license, and blocking obvious personal identifiers pending redaction.
- Human approval workflow, including two independent approvals for content-safety examples.
- Deterministic group-aware dataset splitting with SHA-256 dataset fingerprints, per-class Precision/Recall/F1/FPR/FNR metrics, and release-gate evaluation.

## Important boundaries

This is a deterministic baseline, not a trained ML model. No training job, model artifact, embedding model, or production inference endpoint is included. Dataset splitting and metrics are infrastructure primitives, not evidence that the dataset is representative or that the engine is accurate.

Feedback intake uses an allowlist of eligible content surfaces. The dataset fingerprint is SHA-256; the deterministic hash used for group assignment is only a split mechanism, not a security primitive. Reviewer roles, contributor references, consent records, source provenance, and context must be derived and enforced by trusted server-side services and database policies. Pure TypeScript functions alone do not provide authentication, authorization, durable audit history, or tamper resistance.\n\nThe content-safety engine is not yet integrated into application write paths. It must only be called from trusted server-side code. Context signals such as targetedAtPerson, targetedAtGroup, and purpose must be derived by the server and must never be accepted as authoritative client claims.

## Next implementation stages

1. Curate a reviewed Moroccan Darija safety benchmark with consent and provenance.
2. Expand linguistic coverage for Arabic, Arabizi, French mixing, dialect variants, code-switching, and adversarial spellings.
3. Add calibrated model-based classification only after dataset and evaluation readiness.
4. Add a server-side gateway and route every write path through it.
5. Add database persistence, role enforcement, audit logging, retention rules, and integration tests after a schema/RLS review.
6. Deploy in shadow mode, measure false positives/negatives, then seek explicit production approval.

## Non-goals of this branch

- No Supabase schema, RLS, production data, secrets, or environment configuration changes.
- No production moderation of private messages.
- No automatic corpus approval, rejection, merging, or publication.
- No deployment or merge.
