# Server Content Gateway — implementation status

**Date:** 2026-11-03  
**Branch:** feat/server-enforced-content-gateway  
**Depends on:** PR #36 (content-safety engine and learning foundation)  
**Production status:** no migration applied; no Edge Function deployed; no secrets changed.

## Implemented in this branch

1. Vendored the exact content-safety engine modules from PR #36 into the Edge runtime and made their imports Deno-compatible.
2. Added an authenticated content-safety-gateway Edge Function with:
   - platform JWT verification left enabled;
   - explicit auth.getUser() verification;
   - server-derived role and account-standing checks;
   - a strict operation allowlist and per-operation field allowlists;
   - bounded request size and bounded nested-content flattening;
   - trusted contexts derived only from the operation map;
   - no token for review, block, or urgent-escalation decisions;
   - a 90-second token request bound to actor, operation, and exact JSONB payload;
   - exact-origin CORS allowlisting and no wildcard origin;
   - no submitted text in logs.
3. Added a SQL implementation draft outside the executable migrations directory. It defines private one-time token storage, transaction-scoped consumption, table triggers, SECURITY INVOKER write RPCs, scan audit metadata, and private learning registries.
4. Changed the proposed signup trigger in the SQL draft so unreviewed raw_user_meta_data is not copied into the canonical public profile.
5. Added a second Edge Function for consented learning feedback intake and independent editorial review.
6. Added privacy-preserving durable scan-decision audit events (digest, engine/policy version, bounded signal metadata; no raw text) and per-actor rate limits.
7. Added Edge Function runtime configuration and deployment/security READMEs.

## Important limitations — not complete or production-ready

- The SQL is deliberately under supabase/drafts/, not supabase/migrations/. CI uses the pinned Supabase CLI to create a temporary migration in its isolated runner; that generated migration is not committed or applied to production.
- The first isolated reset exposed a duplicated malformed tail in the SQL draft. That block has been removed. The pgTAP file also had malformed dollar-quoted assertions; those delimiters have been repaired. The latest CI run after these fixes is pending, so neither migration reset nor pgTAP is yet confirmed successful.
- The Edge Function requires CONTENT_GATEWAY_ALLOWED_ORIGINS and a reviewed CONTENT_SAFETY_POLICY_JSON secret. Neither secret has been configured. If policy is absent, the function fails closed with 503.
- No Moroccan profanity catalogue is fabricated or shipped. A policy must be curated, licensed, benchmarked, and reviewed by Darija editors before the gateway can issue write tokens.
- The primary React content-write paths now call the shared `src/lib/contentGateway.ts` adapter: new proposals, rapid-review corrections, draft synchronization (one token per draft), editorial decisions (including bulk approval), community attestations, profile text changes, promotion requests/decisions, member governance, outbound messages, and moderation reports/resolutions.
- The adapter calls the Edge Function first, then the matching SECURITY INVOKER RPC. It deliberately has no direct-REST fallback. Signup no longer writes profile text into user-editable Auth metadata; users without an immediate session complete their profile after sign-in through the scanned profile flow.
- Metadata-only operations remain direct by design: inbox read/ack timestamps and avatar/public-listing metadata. These fields are excluded from the text projection and do not carry user-authored content. Avatar storage remains governed by its existing Storage policies.
- The SQL draft still defaults to shadow; it must not be switched to enforce until the draft is materialized as a migration, all deployed app versions are compatible, and direct REST bypass tests pass.
- Added service-role-only dataset freezing with exact train/validation/test membership, approved/licensed/consented/PII-screened source checks, and cross-split group/contributor leakage checks. Dataset fingerprints are computed server-side.
- Added a domain-specific release-policy registry (no policy is seeded), evaluation persistence with a policy-versioned release gate, model candidate registration, independent editor/admin release reviews, guarded activation, and rollback records. Content-safety model releases require two distinct approvals; linguistic releases require one.
- These lifecycle RPCs are persistence and governance primitives, not training jobs. No model is trained, no dataset is automatically assembled, and no release policy is activated until a reviewed policy is installed by a trusted operator.
- The current learning PII check remains a bounded email/phone pattern screen, not a comprehensive PII detector. It requires a stronger reviewed screening process before accepting sensitive or high-risk corpora.

## Required next steps

1. Wait for the latest CI run to finish. It now uses `supabase migration new` to materialize the draft only inside the isolated runner, then runs `supabase db reset` and pgTAP. Review every SQL/RPC/trigger/grant result before creating a committed migration.
2. Run supabase db reset --local and supabase test db in CI. Add pgTAP coverage for:
   - direct REST INSERT/UPDATE rejection in enforce mode;
   - valid token + matching payload + matching actor success;
   - token expiry, replay, payload mutation, actor mismatch, and operation mismatch rejection;
   - unchanged metadata updates not requiring content scans;
   - preservation of existing RLS, audit, rate-limit, lifecycle, and governance triggers;
   - auth signup behavior and all six protected tables.
3. Configure policy and origin secrets only in a non-production environment.
4. Add a client adapter and migrate every write path from PLATFORM-CONTENT-INVENTORY.md to its table-specific RPC.
5. Run shadow mode, inspect false positives/negatives and latency, then request an explicit production-enforcement approval.

## Security note

The Edge Function is not a complete write boundary until the database migration is applied and all write RPCs are used. A scan endpoint alone does not prevent direct PostgREST writes. Do not describe the platform as fully protected based on this branch.


## Read-only production snapshot (2026-11-03 18:00 UTC)

The linked Supabase project was inspected without writes:

- The production migration ledger still ends at `20261103145945_enforce_member_standing_and_expiry`; the gateway migration is not present.
- No Edge Functions are deployed in the project.
- No database migration, secret, RLS policy, or production data was changed during this work.
- Security advisors report existing SECURITY DEFINER RPC exposure warnings (3 callable by anon and 8 by authenticated) and disabled leaked-password protection. These findings predate this gateway branch and were not modified here; they need a separate, function-by-function review.
- Performance advisors report eight unindexed foreign keys and eight unused indexes. These are observations, not proof that every index should be removed or every FK is currently a bottleneck.


## Update — client write integration and learning lifecycle

The shared client adapter is now used by the listed content-bearing write surfaces. It does not retry with PostgREST if scanning or the RPC fails. Draft synchronization issues a separate short-lived token for each draft; a failure can therefore leave a partial batch, and the result reports already-synced IDs.

The SQL draft now also covers dialect-region text on community attestations and promotion requests in the trigger projection. Dataset freezing requires all three non-empty splits, exact source membership, approved consented/licensed/screened candidates, and no source-group or contributor overlap across splits. Fingerprints are calculated from candidate digests and the canonical JSONB split manifest.

Evaluation requires a reviewed, active policy for the dataset domain. No default thresholds are inserted because thresholds must be set by an authorized reviewer after benchmark calibration. Model activation is blocked until the evaluation gate and the required independent approvals are satisfied. Rollback records the prior and replacement model IDs and rationale.

**Still not complete:** this branch has not materialized or applied a migration, has not run an isolated database reset/pgTAP after these latest changes, has not been deployed to a non-production Supabase project, and has not completed a production-version inventory or browser-level integration test. The PII screen is regex-based and requires a stronger detector/review gate. No training or automatic model promotion occurs.
