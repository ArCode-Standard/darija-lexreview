# Tamper-resistant Content Gateway Design

## Objective

Guarantee that all protected text writes are scanned by trusted server code before the database accepts them, while preserving the current Supabase RLS ownership model and database audit triggers.

A React-only scan or an Edge Function that merely returns allow/block is insufficient if callers can still write directly to PostgREST.

## Proposed flow

1. The browser invokes the authenticated content-scan Edge Function with an explicit operation and payload.
2. The Edge Function verifies the user JWT and derives actor ID, role, target surface, and context from trusted server-side state.
3. The function validates the operation against a strict allowlist and maps every text-bearing field. No client-supplied table name, SQL, role, or context override is accepted.
4. The server runs the versioned safety engine and records the decision, policy version, engine version, and signal codes.
5. For an allowed or context-allowed payload, the server requests a short-lived one-time scan token. The token is bound to:
   - authenticated actor ID;
   - exact operation and target table;
   - SHA-256 of canonical JSONB payload;
   - engine and policy versions;
   - expiration time and one-time nonce.
6. The client calls a table-specific authenticated RPC with the original payload and token.
7. The public RPC is SECURITY INVOKER. It calls a private SECURITY DEFINER helper to validate and reserve the token, then sets a transaction-local token ID with set_config and performs the INSERT/UPDATE itself. Because the write runs as the caller, existing RLS policies and auth.uid() actor attribution remain in force.
8. A database trigger on each protected table checks the transaction-local token ID, actor, operation, expiry, and exact content-field digest. Direct REST writes have no valid transaction-local token and are rejected. If the write fails, token reservation rolls back with the transaction.
9. Existing audit, RLS, ownership, rate-limit, and lifecycle triggers remain active. Do not move the actual table write into a SECURITY DEFINER helper, because that would bypass the existing RLS context.

## Why a one-time token

A token is safer than trusting a client-supplied boolean such as scanned=true. It is generated only after the server scan, expires quickly, is single-use, and is cryptographically bound to the exact payload and actor. Changing one field invalidates it.

The token must not contain the original text. Store only the digest and minimum metadata in a private, non-exposed schema. The token-issuer RPC must be executable by service_role only. Expired tokens should be purged automatically. Never store the token secret or service-role key in the browser.

## RPC and database boundaries

- Keep token storage and privileged helpers in a non-exposed private schema.
- Expose only narrow, table-specific RPC entry points required by the application.
- Revoke direct INSERT/UPDATE privileges on protected text columns only after all clients have moved to the gateway and compatibility tests pass.
- Preserve authenticated read access and metadata-only update paths where appropriate.
- Do not create a generic dynamic-SQL endpoint that accepts arbitrary table or column names.
- Use SECURITY DEFINER only for the smallest private helper that must atomically consume a token and write. Any public RPC wrapper should be SECURITY INVOKER, explicitly granted only to authenticated, and must validate auth.uid().
- Audit every privileged function's EXECUTE grants. Do not add SECURITY DEFINER functions to the exposed public API without a reviewed threat model.
- Keep the original user JWT on the write RPC so existing triggers that depend on auth.uid() continue to attribute actions correctly.

## Decision handling

- allow: issue a one-time token and proceed.
- allow_with_context: issue a token with contextual audit metadata and presentation requirements.
- review: do not publish publicly. Route the item to a moderation hold/review state, or keep it out of public visibility until reviewed.
- block: issue no token and reject the write.
- urgent_escalation: issue no publication token; create an urgent moderation case through a separate protected action.

A review decision must never silently become allow. The storage design needs an explicit review/hold state for surfaces that cannot safely accept pending content.

## Surface-by-surface migration

1. review_submissions: scan proposed_data, evidence, reviewer_note, and any editor_note changes. Preserve existing lifecycle and self-review protections.
2. community_attestations: scan note; keep verdict and region validation and rate limits.
3. reviewer_profiles: scan display_name, specialty, dialect_region, github_handle, and status_reason; keep role/status changes on the existing admin-governed path.
4. member_messages: scan title/body/sender_label on INSERT; do not rescan read_at or acknowledged_at metadata-only updates.
5. member_moderation_reports: allow quoted abusive evidence under trusted report context; scan reason and admin_note; restrict report visibility.
6. role_promotion_requests: scan requester_name, experience_summary, sample_links, and admin_note; preserve admin-only adjudication.
7. Auth signup: stop copying arbitrary user-editable raw_user_meta_data text into canonical profiles before scanning. The signup trigger currently reads name, dialect_region, specialty, and user_name from raw_user_meta_data; revise this only with a tested signup migration and a post-confirmation profile flow.

## Rollout sequence

- Phase A: deploy gateway in shadow mode without changing write permissions; compare decisions and latency.
- Phase B: update one surface at a time to invoke the gateway and table-specific RPC.
- Phase C: verify direct REST writes fail without a token, while legitimate RPC writes retain actor attribution and audit history.
- Phase D: enable enforcement per surface after security, regression, performance, and accessibility review.
- Phase E: monitor false positives, appeals, token replay, expired-token rejection, and rollback.

## Not yet implemented

This document is the approved technical direction for a future integration stage. No Edge Function, token table, RPC, trigger, migration, or production permission change is included in the current branch. Do not deploy or apply this design without a dedicated implementation PR and explicit production approval.
