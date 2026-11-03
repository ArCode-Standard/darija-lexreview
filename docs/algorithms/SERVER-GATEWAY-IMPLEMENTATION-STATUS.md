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
6. Added Edge Function runtime configuration and deployment/security READMEs.

## Important limitations — not complete or production-ready

- The SQL is deliberately under supabase/drafts/, not supabase/migrations/. The Supabase CLI is not available in this execution environment, so a migration has not been generated with supabase migration new.
- The draft has not been applied to an isolated database and has not passed pgTAP. Its SQL must be reviewed, generated as a proper migration, and tested against a fresh database before it can be considered executable.
- The Edge Function requires CONTENT_GATEWAY_ALLOWED_ORIGINS and a reviewed CONTENT_SAFETY_POLICY_JSON secret. Neither secret has been configured. If policy is absent, the function fails closed with 503.
- No Moroccan profanity catalogue is fabricated or shipped. A policy must be curated, licensed, benchmarked, and reviewed by Darija editors before the gateway can issue write tokens.
- The frontend write paths are not yet migrated to the new Edge Function and RPCs. Existing direct REST writes remain in shadow mode until every client path is moved and verified.
- The database draft defaults to shadow; it must not be switched to enforce until client migration and bypass tests pass.
- Durable learning tables and server-only candidate ingestion plus independent review RPCs are drafted. User-facing editor review UI, dataset snapshot/freeze jobs, evaluation jobs, and model-release/rollback workflows still need implementation and tests.

## Required next steps

1. The CI workflow now runs supabase migration new and materializes the SQL draft as a generated migration in its isolated runner; review the DDL/functions/grants after CI and generate/commit the proper migration when the CLI is available locally.
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
