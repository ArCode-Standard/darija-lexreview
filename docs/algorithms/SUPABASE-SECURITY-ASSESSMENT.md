# Supabase Security Baseline — Read-only Assessment

## Scope and method

Read-only inspection of the active Supabase project metadata, public table definitions, RLS policies, grants, triggers, migration history, Edge Functions, and Supabase Security Advisor findings on 2026-11-03.

No SQL was changed, no migration was applied, no Edge Function was deployed, and no user content was read or exported.

## Current platform baseline

- Project status: ACTIVE_HEALTHY.
- PostgreSQL: 17.11.
- Public Edge Functions: none currently listed.
- Public tables inspected: reviewer_profiles, review_submissions, review_decision_events, role_promotion_requests, community_attestations, release_manifests, member_moderation_events, member_moderation_reports, member_messages.
- RLS is enabled on all nine inspected public tables.
- The migration history currently ends with enforce_member_standing_and_expiry (20261103145945).

## Existing RLS-protected write paths

RLS currently restricts direct authenticated writes by owner and role, but the policies do not require the new TypeScript content-safety engine to have scanned the payload.

| Table | Current authenticated write policy | Text-bearing fields requiring scanning |
|---|---|---|
| review_submissions | Owner INSERT; editor UPDATE with lifecycle restrictions | proposed_data JSONB, evidence JSONB, reviewer_note, editor_note |
| community_attestations | Own INSERT/UPDATE/DELETE with active-contributor checks | note |
| reviewer_profiles | Own INSERT/UPDATE; admin manages roles | display_name, specialty, dialect_region, github_handle, status_reason |
| member_messages | Staff INSERT; recipient/admin UPDATE under policy | title, body, sender_label |
| member_moderation_reports | Editor INSERT; admin UPDATE | reason, target_display_name, admin_note |
| role_promotion_requests | Owner INSERT; admin UPDATE | requester_name, experience_summary, sample_links, admin_note |

Read and metadata-only operations (for example message read/ack timestamps) should not be needlessly routed through content scanning if the protected text fields are unchanged.

The anon role has table-level grants on community_attestations, but no anon RLS policies were returned for that table. RLS remains the row-level gate; the broad grants should be reviewed separately and reduced to the minimum required privileges in a dedicated migration.

## Existing database controls

Triggers already provide several controls:
- review_submissions: rate/bounds checks, immutable submitted content, lifecycle validation, and review decision audit events.
- community_attestations: rate limiting and actor binding.
- reviewer_profiles: prevent non-admin role/account-standing changes.
- member_messages: restrict updates to allowed recipient/admin metadata.
- release_manifests: append-only enforcement.
- reviewer_profiles governance changes: audit events and generated member messages.

These controls are valuable and must be preserved. The content-safety work must not weaken existing actor attribution, audit triggers, lifecycle rules, rate limits, or RLS.

## Security Advisor baseline

The Security Advisor reported:
- 3 public SECURITY DEFINER functions callable by anon: get_entry_attestation_summaries, get_example_attestation_summaries, get_public_contributors_directory.
- 8 public SECURITY DEFINER functions callable by authenticated, including staff display names, release operations, promotion review, and own-submission withdrawal.
- Leaked Password Protection is disabled.

These are existing baseline findings, not proof that each function is exploitable. Several inspected functions perform explicit actor/role checks internally. Each grant and function body should be reviewed before changing exposure; do not blindly revoke functions required by the current application.

## Critical integration finding

A client-side scan does not protect a table while authenticated users retain direct INSERT/UPDATE privileges through Supabase REST. The existing RLS policies enforce ownership and role rules, but they do not verify that the submitted text passed the content-safety engine.

Therefore, the production gateway phase must include both:
1. A trusted server-side scan and write workflow.
2. A database-enforced mechanism that rejects protected writes unless they carry a valid, unexpired, one-time scan authorization bound to the authenticated actor, operation, and exact payload.

Do not deploy the TypeScript engine as a browser-only check and call the platform protected.

## Training data constraints

The current application already stores provenance and training permission fields on lexical submissions and corpus records. The learning adapter must require explicit training permission and a documented license from the authoritative record, in addition to a reviewed label. A UI preference or user-editable metadata flag alone is not sufficient evidence of rights.

No persistent feedback queue, approved training dataset registry, or model registry table was found in the inspected public schema. The current TypeScript learning pipeline is an in-memory foundation only.
