import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import { containsPii } from "../_shared/pii-screen.ts";

const MAX_BODY_BYTES = 16 * 1024;
const SOURCES = new Set([
  "lexicon_suggestion", "editor_correction", "moderation_appeal",
  "moderation_decision", "benchmark_annotation",
]);
const SURFACES = new Set([
  "profile", "lexicon", "contribution", "review",
  "comment", "discussion", "report", "benchmark",
]);
const EDITOR_SOURCES = new Set(["editor_correction", "moderation_decision", "benchmark_annotation"]);
const PII_SCREENING_VERSION = "pii-regex-2-ma";

function response(body: unknown, status = 200, origin?: string) {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "vary": "Origin",
  });
  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-headers", "authorization, apikey, content-type, x-client-info, x-supabase-api-version");
    headers.set("access-control-allow-methods", "POST, OPTIONS");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function allowedOrigins(): Set<string> {
  return new Set((Deno.env.get("CONTENT_GATEWAY_ALLOWED_ORIGINS") ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean));
}

function validId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9:_-]{1,180}$/.test(value);
}

Deno.serve(async (req: Request) => {
  const origins = allowedOrigins();
  const origin = req.headers.get("origin") ?? "";
  if (!origins.has(origin)) return response({ error: "origin_not_allowed" }, 403);
  if (req.method === "OPTIONS") return response({ ok: true }, 200, origin);
  if (req.method !== "POST") return response({ error: "method_not_allowed" }, 405, origin);

  const authorization = req.headers.get("authorization") ?? "";
  const bearer = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!bearer) return response({ error: "authentication_required" }, 401, origin);

  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return response({ error: "payload_too_large" }, 413, origin);
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return response({ error: "invalid_request" }, 400, origin);
    }
    const body = parsed as Record<string, unknown>;
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) return response({ error: "gateway_configuration_missing" }, 503, origin);

    const userClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: "Bearer " + bearer[1] } },
    });
    const { data: auth, error: authError } = await userClient.auth.getUser(bearer[1]);
    if (authError || !auth.user) return response({ error: "invalid_session" }, 401, origin);

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile, error: profileError } = await admin
      .from("reviewer_profiles")
      .select("id, role, account_status, suspended_until")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profileError || !profile) return response({ error: "active_profile_required" }, 403, origin);
    const expiry = profile.suspended_until ? new Date(profile.suspended_until).getTime() : Number.NaN;
    const expiredSuspension = profile.account_status === "suspended" && Number.isFinite(expiry) && expiry <= Date.now();
    if (!["active", "warned"].includes(profile.account_status) && !expiredSuspension) {
      return response({ error: "account_not_active" }, 403, origin);
    }

    if (body.action === "submit") {
      const allowedKeys = new Set([
        "domain", "source", "sourceSurface", "groupId", "text", "label",
        "rationale", "consentToDatasetUse", "license", "provenance", "sourceReference",
      ]);
      if (Object.keys(body).some((key) => !allowedKeys.has(key) && key !== "action")) {
        return response({ error: "unsupported_field" }, 400, origin);
      }
      const { domain, source, sourceSurface, groupId, text, label, rationale, consentToDatasetUse, license } = body;
      if (!["linguistic", "content_safety"].includes(String(domain)) ||
          !SOURCES.has(String(source)) || !SURFACES.has(String(sourceSurface)) ||
          !validId(groupId) || typeof text !== "string" || !text.trim() || text.length > 5000 ||
          typeof label !== "string" || !label.trim() || label.length > 120 ||
          typeof rationale !== "string" || !rationale.trim() || rationale.length > 2000 ||
          consentToDatasetUse !== true || typeof license !== "string" || !license.trim() || license.length > 250) {
        return response({ error: "invalid_feedback_or_missing_consent" }, 422, origin);
      }
      if (EDITOR_SOURCES.has(String(source)) && !["editor", "admin"].includes(profile.role)) {
        return response({ error: "editor_role_required" }, 403, origin);
      }
      if (containsPii([text, label, rationale])) {
        return response({ error: "personal_data_must_be_redacted" }, 422, origin);
      }

      const provenance = body.provenance;
      if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) {
        return response({ error: "invalid_provenance" }, 422, origin);
      }
      const provenanceRecord = provenance as Record<string, unknown>;
      const provenanceKeys = new Set(["recordId", "corpusVersion", "commit", "decisionId"]);
      if (Object.keys(provenanceRecord).some((key) => !provenanceKeys.has(key)) ||
          Object.values(provenanceRecord).some((value) => !validId(value))) {
        return response({ error: "invalid_provenance" }, 422, origin);
      }
      const sourceReference = body.sourceReference ?? null;
      if (sourceReference !== null && !validId(sourceReference)) {
        return response({ error: "invalid_source_reference" }, 422, origin);
      }

      const { data: candidateId, error } = await admin.rpc("submit_learning_feedback_candidate", {
        p_actor_id: auth.user.id,
        p_domain: domain,
        p_source: source,
        p_source_surface: sourceSurface,
        p_group_id: groupId,
        p_text: text.trim(),
        p_label: label.trim(),
        p_rationale: rationale.trim(),
        p_consent: true,
        p_license: license.trim(),
        p_provenance: provenanceRecord,
        p_screening_version: PII_SCREENING_VERSION,
        p_source_reference: sourceReference,
      });
      if (error || typeof candidateId !== "string") {
        console.error(JSON.stringify({ event: "learning_candidate_submission_failed", actorId: auth.user.id, code: error?.code }));
        const statusCode = error?.code === "54000" ? 429
          : error?.code === "23505" ? 409
          : error?.code === "42501" ? 403
          : error?.code === "22023" ? 422 : 503;
        const errorCode = error?.code === "54000" ? "submission_rate_limited"
          : error?.code === "23505" ? "duplicate_feedback"
          : error?.code === "42501" ? "submission_not_authorized"
          : error?.code === "22023" ? "invalid_feedback" : "submission_unavailable";
        return response({ error: errorCode }, statusCode, origin);
      }
      return response({ candidateId, status: "pending", message: "feedback_received_for_independent_review" }, 201, origin);
    }

    if (body.action === "review") {
      if (Object.keys(body).some((key) => !["action", "candidateId", "decision", "reason"].includes(key))) {
        return response({ error: "unsupported_field" }, 400, origin);
      }
      if (typeof body.candidateId !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.candidateId) ||
          !["approve", "reject"].includes(String(body.decision)) ||
          typeof body.reason !== "string" || !body.reason.trim() || body.reason.length > 2000) {
        return response({ error: "invalid_review_request" }, 422, origin);
      }
      if (containsPii([body.reason as string])) {
        return response({ error: "personal_data_must_be_redacted" }, 422, origin);
      }
      const { data: status, error } = await userClient.rpc("review_learning_feedback_candidate", {
        p_candidate_id: body.candidateId,
        p_decision: body.decision,
        p_reason: body.reason.trim(),
      });
      if (error) {
        const statusCode = error.code === "42501" ? 403 : error.code === "55000" ? 409 : 400;
        return response({ error: "review_rejected", code: error.code }, statusCode, origin);
      }
      return response({ candidateId: body.candidateId, status }, 200, origin);
    }

    return response({ error: "unsupported_action" }, 400, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error(JSON.stringify({ event: "learning_governance_error", code: message.slice(0, 100) }));
    return response({ error: error instanceof SyntaxError ? "invalid_request" : "learning_service_unavailable" }, error instanceof SyntaxError ? 400 : 500, origin);
  }
});
