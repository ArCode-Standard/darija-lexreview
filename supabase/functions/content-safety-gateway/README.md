# Content Safety Gateway — Edge Function

This function is a server-side scanning and authorization-token issuer. It does not write application rows itself.

## Security boundary

- Platform JWT verification remains enabled (default `verify_jwt = true`).
- The handler independently resolves the supplied JWT with `auth.getUser()`.
- The actor role and standing are loaded from `reviewer_profiles`; client role/context/table names are ignored.
- The operation is an exact allowlist. The table and writable columns are derived from that operation.
- The service-role key is used only server-side to issue a short-lived token through `issue_content_scan_token`.
- The token is bound in PostgreSQL to actor ID, operation, and the exact JSONB payload digest. It expires after 90 seconds and is single-use.
- The Edge Function returns no token for `review`, `block`, or `urgent_escalation`.
- Errors and audit logs never include submitted text.

## Required secrets

Before any deployment, configure:

- `CONTENT_GATEWAY_ALLOWED_ORIGINS`: comma-separated exact HTTPS origins. Do not use `*`.
- `CONTENT_SAFETY_POLICY_JSON`: a reviewed, versioned policy object with at least one curated rule.
- Supabase's standard `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` function secrets.

An absent or empty policy fails closed with HTTP 503. No profanity list is invented or embedded in this repository; policy content must be curated, licensed, benchmarked, and reviewed by Darija editors.

## Request

```json
{
  "operation": "review_submissions.create",
  "payload": {
    "entry_id": "sample-entry",
    "proposed_data": { "word_ar": "..." },
    "evidence": [],
    "reviewer_note": "..."
  }
}
```

The client must then pass the unchanged payload and returned `writeToken` to the matching table-specific SECURITY INVOKER RPC. Editing the payload invalidates the token.

## Supported operation map

| Operation | Surface | Minimum role | Write RPC |
|---|---|---|---|
| `review_submissions.create` | review | active contributor | `submit_review_submission` |
| `review_submissions.decision` | review | editor | `decide_review_submission` |
| `community_attestations.upsert` | comment | active contributor | `submit_community_attestation` |
| `reviewer_profiles.update` | profile | active member | `update_reviewer_profile_content` |
| `reviewer_profiles.admin_update` | admin | admin | `update_reviewer_profile_admin_note` |
| `member_messages.create` | private_message | editor | `send_member_message` |
| `member_moderation_reports.create` | report | editor | `submit_moderation_report` |
| `member_moderation_reports.resolve` | admin | admin | `resolve_moderation_report` |
| `role_promotion_requests.create` | profile | active member | `submit_role_promotion_request` |
| `role_promotion_requests.decision` | admin | admin | `decide_role_promotion_request` |

## Current status

Not deployed. The matching SQL is currently in `supabase/drafts/`, not in the executable migrations directory. The project currently has no deployed Edge Functions. Do not switch the database from shadow to enforce until the SQL is generated as a proper migration, CI/pgTAP passes, every client write path is migrated, and bypass tests are verified.
