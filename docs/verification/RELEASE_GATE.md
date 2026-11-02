# Verification & Validation Release Gate

A successful build is not release approval.

## Automated CI
- Arabizi/Arabic mappings: 3/ع, 7/ح, 5/خ, 4/غ, 9/q/ق, ch/sh/ش, kh/خ, gh/غ.
- Gemination and diacritic normalization.
- Exporter does not mutate source corpus.
- Missing target entries and unknown rights/licences block export.
- Official JSON Schema valid/invalid payloads and unavailable-schema fail-closed behavior.
- TypeScript lint and production build.

## Role matrix — isolated Auth identities only

| Capability | Anonymous | Reviewer | Editor | Admin |
|---|---|---|---|---|
| Read own profile | Deny | Allow | Allow | Allow |
| Read another contributor profile | Deny | Deny | Deny | Allow |
| Create own pending submission | Deny | Allow | Policy-defined | Policy-defined |
| Read own submissions | Deny | Allow | Allow | Allow |
| Read all submissions | Deny | Deny | Allow | Allow |
| Decide another user's submission | Deny | Deny | Allow | Allow |
| Decide own submission | Deny | Deny | Deny | Deny |
| Manage roles / promotion decisions | Deny | Deny | Deny | Allow |
| Read audit events | Deny | Own only | All | All |
| Directly mutate audit events | Deny | Deny | Deny | Deny |

Test both row visibility and SQL errors using separate test users. Do not use production admin credentials for negative tests.

## State machine
- pending -> accepted
- pending -> rejected (editor note required)
- pending -> needs_changes (editor note required)
- needs_changes -> accepted
- needs_changes -> rejected (editor note required)
- needs_changes -> needs_changes is invalid
- accepted -> needs_changes or rejected only, with revocation justification >= 10 characters
- rejected is terminal

For each decision assert exactly one append-only event with actor, old/new status, note, timestamp and snapshot. Assert self-review and direct audit writes fail.

## Revision immutability
Create a revision linked by supersedes_id. Assert the previous payload, evidence, author and lineage are unchanged; the new row references the old row; a separate submitted event exists; cross-user supersedes is rejected.

## Regional linguistic benchmark — real data required
Do not report synthetic accuracy as measured accuracy. Collect a consented, provenance-documented gold set with native speakers from:
- North: Tangier, Tetouan, Jebala
- Atlantic/Central: Rabat, Salé, Casablanca
- Fes-Meknes
- Oriental: Oujda, Nador
- Souss: Agadir, Taroudant
- South/Southeast: Marrakech, Drâa-Tafilalet

Each record must include spoken/written form, orthographic variants, Arabic script, Arabizi variants, region, register, meaning, annotator IDs, adjudication, consent and usage rights. Split by speaker and lexical item to prevent leakage. Report top-1/top-5 recall, MRR, false-positive rate, per-region and per-script results, and confidence intervals. Obtain consent before recording or using audio.

## Independent security review
Scope Supabase Auth, OAuth callback allowlists, PKCE/state/nonce, RLS/BOLA/IDOR, SECURITY DEFINER RPCs, privilege escalation, rate limits, audit immutability, secrets, build artifacts and dependency risks. Resolve all critical/high findings before release.

## Release criteria
No public launch until role and state tests pass with isolated identities; revision immutability and official-schema export tests pass; the real regional benchmark is reviewed by native speakers; and an independent security assessment has no unresolved critical/high findings.
