# Learning Governance Edge Function

This function accepts explicitly consented learning-feedback candidates and routes editorial review decisions. It does not train a model or publish submitted text.

## Submission controls

- Requires a valid Supabase JWT and active account standing.
- Requires explicit `consentToDatasetUse: true` and a documented license.
- Accepts only allowlisted source types and surfaces; `private_message` is not an eligible source.
- Editor-only sources are checked against the server-side profile role.
- Restricts provenance to non-text identifiers.
- Applies a database-side contributor rate limit and duplicate fingerprint constraint.
- New candidates are always pending; the client cannot submit an approved status.

## Review controls

- Reviews are performed under the authenticated user's JWT.
- PostgreSQL independently checks editor/admin role and active account standing.
- A contributor cannot review their own candidate.
- A reviewer can review a candidate only once.
- Linguistic examples require one independent approval; content-safety examples require two.
- A rejection permanently moves the candidate to rejected state.

## Not implemented yet

- Dataset snapshot/freeze job and deterministic group-level split persistence.
- Benchmark/evaluation worker and release-gate persistence.
- Model artifact registry approvals, activation, and rollback RPCs.
- Human review UI and moderation queue integration.
- Actual model training/fine-tuning. This service only creates and reviews governed candidates.

The function is not deployed. Its backing SQL remains a draft and is validated only through the PR's isolated CI workflow.
