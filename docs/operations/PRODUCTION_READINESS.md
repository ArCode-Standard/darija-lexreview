# Production Readiness & Operations

**Status:** Operational runbook draft. This document does not certify that the production environment has been configured or verified.

## 1. Release decision

Do not open public submissions or announce a production launch until every required gate below has an owner, evidence and an explicit pass decision.

- [ ] All repository CI checks pass on the exact release commit.
- [ ] Supabase migrations have been reviewed and applied through the approved deployment process; the deployed schema matches the repository.
- [ ] Authentication, OAuth callback URLs and allowed redirect URLs are verified against the production domain.
- [ ] Reviewer/editor/admin permissions and RLS have been tested using separate non-production identities.
- [ ] The official corpus and context examples load from the pinned source/version; unavailable or inconsistent source data fails closed.
- [ ] Submission, review, audit, export and immutable release-ledger workflows have been exercised in a staging environment.
- [ ] Backup schedule, retention, restore procedure and responsible operator are confirmed.
- [ ] Monitoring and incident contacts are configured and tested.
- [ ] Privacy notice, data retention, evidence-source rights and user support process are approved.
- [ ] A rollback decision-maker and release window are recorded.

A successful CI run validates the tested commit; it does not prove production configuration, live OAuth, backup recovery or operational readiness.

## 2. Environment and secrets

Keep separate development, staging and production projects and credentials.

- Frontend configuration may contain only the Supabase project URL and publishable/anonymous key intended for browser use.
- Never put Supabase service-role keys, database passwords, GitHub tokens or Cloudflare API tokens in `VITE_*` variables, source files, issue comments or build artifacts.
- Store deployment secrets in the relevant provider's encrypted secret store. Limit access to named maintainers and rotate credentials when access changes or exposure is suspected.
- Verify production OAuth provider settings, Supabase Site URL, redirect allowlist and application callback handling together. Use exact HTTPS origins; avoid broad wildcard redirects.
- Restrict Cloudflare Pages production deployments to the intended branch and review preview deployments before sharing them.
- Do not copy production data into development or staging. Use synthetic or appropriately minimized data.

## 3. Database change procedure

1. Review migration SQL and its privilege/RLS impact in a pull request.
2. Rebuild a clean local database from all migrations and run the full pgTAP suite.
3. Validate the migration against a disposable staging project with representative test identities and data.
4. Capture the current backup/restore point and record the migration commit and operator.
5. Apply the approved migration using the documented Supabase deployment mechanism during the agreed change window.
6. Verify schema state, critical RPCs, RLS behavior and application health.
7. If verification fails, stop further rollout. Prefer a forward-fix migration; restore only under the recovery procedure and an explicit incident decision.

Never edit production tables manually to bypass migrations. Never rewrite an already-applied migration; add a new migration.

## 4. Backup and recovery

Before launch, the project owner must record the actual backup capability and retention available on the selected Supabase plan. Do not assume point-in-time recovery or a particular retention period without checking the active project settings.

Maintain an encrypted, access-controlled backup/export procedure appropriate to the data and database size. Keep backup credentials separate from application credentials. Record:

- Backup frequency and retention: **owner to configure and verify**.
- Recovery Point Objective (RPO): **owner to define**.
- Recovery Time Objective (RTO): **owner to define**.
- Backup operator and escalation contact: **owner to assign**.
- Backup location, encryption and access policy: **owner to document**.

### Restore drill

1. Restore the backup into a separate, isolated Supabase project—not over production.
2. Apply no unreviewed schema changes; verify the restored migration/schema version.
3. Check row counts and referential integrity for profiles, submissions, review events, audit events and release manifests.
4. Verify RLS and RPC behavior with separate reviewer/editor/admin test accounts.
5. Verify the official corpus version and source integrity independently; it is maintained in its own repository.
6. Record elapsed recovery time, data loss window, failures and corrective actions.
7. Delete the isolated restore only after the drill evidence is retained and access is revoked.

A backup is not considered verified until a restore drill has succeeded.

## 5. Monitoring and alert response

Configure provider-side monitoring before launch. At minimum, review:

- Supabase Auth failures and unexpected sign-in volume.
- Database availability, connection pressure, resource utilization and failed queries.
- Elevated RPC errors, RLS denials that indicate unexpected access patterns, and unusual role-promotion activity.
- Submission/review volume spikes, rate-limit events and export failures.
- Cloudflare Pages deployment failures and frontend availability.
- Dependency/security alerts and failed CI runs.

Do not log access tokens, passwords, full authentication payloads or unnecessary personal/evidence content. Alerts must have a named recipient and a documented response path. Test alert delivery before launch.

## 6. Incident response

### Triage

1. Record detection time, reporter, affected environment, symptoms and incident owner.
2. Classify impact: availability, confidentiality, integrity, account compromise or data loss.
3. Preserve relevant provider logs and audit evidence with restricted access.
4. Avoid destructive cleanup or speculative database edits while the scope is unknown.

### Containment

- For suspected credential exposure, revoke/rotate the affected credential in its provider and update dependent secret stores; never paste the replacement into Git.
- For suspected account compromise, disable or contain the affected identity through the provider's supported controls and review role changes and audit events.
- For a faulty frontend release, stop promotion and roll back to the last known-good Pages deployment where appropriate.
- For suspected database integrity or authorization failure, suspend the affected workflow and prevent further exports/releases until reviewed.
- Do not delete audit records or alter immutable release history.

### Recovery and closure

1. Confirm the root cause and affected records/users.
2. Restore service using a reviewed fix or tested recovery procedure.
3. Validate permissions, data integrity and user-facing workflows.
4. Notify affected parties as required by applicable policy/law.
5. Record timeline, impact, evidence, remediation and follow-up owners.
6. Add regression tests and update this runbook.

## 7. Release and rollback

For each release, record the Git commit SHA, CI run, migration set, Pages deployment identifier, release operator and verification results.

- Promote only a commit whose required CI checks are successful.
- Deploy application changes separately from database changes when practical.
- Confirm the deployed frontend references the intended Supabase environment.
- Run smoke tests for sign-in, corpus loading, submission creation, editor decision, audit history and authorized export using controlled test accounts/data.
- If a release causes a frontend regression, roll back the Pages deployment and verify it.
- A frontend rollback does not reverse database migrations. Database rollback requires a reviewed recovery plan; prefer a compatible forward fix.
- Never claim production verification based solely on a successful deployment job or a local build.

## 8. Pre-launch evidence record

Complete and retain this record for every production launch:

| Evidence | Required record |
|---|---|
| Release | Commit SHA, CI run URL, approver |
| Database | Migration list, staging test result, production verification |
| Auth/RLS | Test date, test identities/roles, results |
| Corpus | Repository commit/version, integrity check |
| Backup | Provider capability, retention, last successful restore drill |
| Monitoring | Alert destinations and delivery test |
| Deployment | Cloudflare deployment ID and smoke-test result |
| Operations | Incident owner, escalation contact, RPO/RTO |
| Approval | Explicit go/no-go decision and date |

## 9. Current known limitations

- The README describes the project as an MVP requiring environment setup before real submissions.
- Repository CI rebuilds an isolated Supabase stack and runs database tests; it does not test the live production Supabase project.
- Automated production-site verification has previously returned HTTP 403, so public production availability must be verified through an authorized, documented route before claiming it is healthy.
- This runbook adds procedures only. It does not apply production migrations, change provider settings, create secrets, enable monitoring, or perform a restore.
