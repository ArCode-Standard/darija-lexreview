import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import { scanContentPayload } from "../_shared/content-safety/gateway.ts";
import type { ContentSurface, SafetyPolicy, TrustedContentContext } from "../_shared/content-safety/types.ts";

type Operation =
  | "review_submissions.create"
  | "review_submissions.decision"
  | "community_attestations.upsert"
  | "reviewer_profiles.update"
  | "reviewer_profiles.admin_update"
  | "member_messages.create"
  | "member_moderation_reports.create"
  | "member_moderation_reports.resolve"
  | "role_promotion_requests.create"
  | "role_promotion_requests.decision";

interface OperationSpec {
  surface: ContentSurface;
  requiredRole: "any_active" | "editor" | "admin";
  allowedKeys: readonly string[];
  contexts?: Record<string, TrustedContentContext>;
}

const OPERATIONS: Record<Operation, OperationSpec> = {
  "review_submissions.create": {
    surface: "review", requiredRole: "any_active",
    allowedKeys: ["entry_id", "proposed_data", "evidence", "reviewer_note", "supersedes_id", "corpus_version", "baseline_fingerprint"],
    contexts: {
      proposed_data: { purpose: "dictionary_definition" },
      evidence: { purpose: "academic_quote", quotedForEvidence: true },
    },
  },
  "review_submissions.decision": {
    surface: "review", requiredRole: "editor",
    allowedKeys: ["id", "status", "editor_note"],
  },
  "community_attestations.upsert": {
    surface: "comment", requiredRole: "any_active",
    allowedKeys: ["entry_id", "verdict", "dialect_region", "note", "corpus_version", "baseline_fingerprint", "response_ms", "example_id"],
  },
  "reviewer_profiles.update": {
    surface: "profile", requiredRole: "any_active",
    allowedKeys: ["display_name", "dialect_region", "specialty", "github_handle"],
  },
  "reviewer_profiles.admin_update": {
    surface: "admin", requiredRole: "admin",
    allowedKeys: ["id", "status_reason"],
  },
  "member_messages.create": {
    surface: "private_message", requiredRole: "editor",
    allowedKeys: ["recipient_id", "is_broadcast", "category", "title", "body", "requires_ack", "pinned_until"],
  },
  "member_moderation_reports.create": {
    surface: "report", requiredRole: "editor",
    allowedKeys: ["target_user_id", "target_display_name", "recommended_action", "reason"],
    contexts: { reason: { purpose: "moderation_report", quotedForEvidence: true } },
  },
  "member_moderation_reports.resolve": {
    surface: "admin", requiredRole: "admin",
    allowedKeys: ["id", "status", "admin_note"],
  },
  "role_promotion_requests.create": {
    surface: "profile", requiredRole: "any_active",
    allowedKeys: ["requester_name", "dialect_region", "experience_summary", "sample_links"],
  },
  "role_promotion_requests.decision": {
    surface: "admin", requiredRole: "admin",
    allowedKeys: ["id", "decision", "admin_note"],
  },
};

const MAX_BODY_BYTES = 64 * 1024;
const encoder = new TextEncoder();

function json(body: unknown, status = 200, origin?: string) {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "vary": "Origin",
  });
  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-headers", "authorization, apikey, content-type");
    headers.set("access-control-allow-methods", "POST, OPTIONS");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function parseAllowedOrigins(): Set<string> {
  return new Set((Deno.env.get("CONTENT_GATEWAY_ALLOWED_ORIGINS") ?? "")
    .split(",").map((item) => item.trim()).filter(Boolean));
}

function flattenText(value: unknown, output: string[], depth = 0): void {
  if (depth > 8 || output.length > 200) throw new RangeError("Content structure exceeds scan limits");
  if (typeof value === "string") {
    output.push(value);
    return;
  }
  if (value === null || value === undefined || typeof value === "number" || typeof value === "boolean") return;
  if (Array.isArray(value)) {
    if (value.length > 200) throw new RangeError("Content array exceeds scan limits");
    for (const item of value) flattenText(item, output, depth + 1);
    return;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 100) throw new RangeError("Content object exceeds scan limits");
    for (const [key, child] of entries) {
      flattenText(child, output, depth + 1);
    }
    return;
  }
  throw new TypeError("Unsupported content value");
}

function validatePayload(operation: Operation, payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("payload must be a JSON object");
  }
  const record = payload as Record<string, unknown>;
  const allowed = new Set(OPERATIONS[operation].allowedKeys);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) throw new TypeError("Unsupported payload field: " + key);
  }
  return record;
}

function scanFields(payload: Record<string, unknown>): Record<string, string | string[] | null> {
  const fields: Record<string, string | string[] | null> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === null || value === undefined) {
      fields[key] = null;
    } else if (typeof value === "string") {
      fields[key] = value;
    } else {
      const flattened: string[] = [];
      flattenText(value, flattened);
      fields[key] = flattened;
    }
  }
  return fields;
}

function loadPolicy(): SafetyPolicy {
  const raw = Deno.env.get("CONTENT_SAFETY_POLICY_JSON");
  if (!raw) throw new Error("CONTENT_SAFETY_POLICY_NOT_CONFIGURED");
  let policy: SafetyPolicy;
  try {
    policy = JSON.parse(raw) as SafetyPolicy;
  } catch {
    throw new Error("CONTENT_SAFETY_POLICY_INVALID");
  }
  if (!policy || typeof policy.version !== "string" || !policy.version.trim() ||
      !Array.isArray(policy.rules) || policy.rules.length === 0) {
    throw new Error("CONTENT_SAFETY_POLICY_INVALID");
  }
  return policy;
}

Deno.serve(async (req: Request) => {
  const origins = parseAllowedOrigins();
  const requestOrigin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") {
    if (!origins.has(requestOrigin)) return json({ error: "origin_not_allowed" }, 403);
    return json({ ok: true }, 200, requestOrigin);
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!origins.has(requestOrigin)) return json({ error: "origin_not_allowed" }, 403);

  const authHeader = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) return json({ error: "authentication_required" }, 401, requestOrigin);

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json({ error: "payload_too_large" }, 413, requestOrigin);
  }

  try {
    const rawBody = await req.text();
    if (encoder.encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return json({ error: "payload_too_large" }, 413, requestOrigin);
    }
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ error: "invalid_request" }, 400, requestOrigin);
    }
    const body = parsed as { operation?: string; payload?: unknown };
    if (!body.operation || !Object.hasOwn(OPERATIONS, body.operation)) {
      return json({ error: "unsupported_operation" }, 400, requestOrigin);
    }
    const operation = body.operation as Operation;
    const spec = OPERATIONS[operation];
    const payload = validatePayload(operation, body.payload);

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) throw new Error("GATEWAY_CONFIGURATION_MISSING");

    const userClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: "Bearer " + match[1] } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser(match[1]);
    if (authError || !authData.user) return json({ error: "invalid_session" }, 401, requestOrigin);
    const actorId = authData.user.id;

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile, error: profileError } = await admin
      .from("reviewer_profiles")
      .select("id, role, display_name, account_status, suspended_until")
      .eq("id", actorId)
      .maybeSingle();
    if (profileError || !profile) return json({ error: "active_profile_required" }, 403, requestOrigin);

    const suspensionExpiry = profile.suspended_until ? new Date(profile.suspended_until).getTime() : Number.NaN;
    const suspensionExpired = profile.account_status === "suspended" &&
      Number.isFinite(suspensionExpiry) && suspensionExpiry <= Date.now();
    const standingAllowed = ["active", "warned"].includes(profile.account_status) || suspensionExpired;
    if (profile.account_status === "banned" || !standingAllowed) {
      return json({ error: "account_not_active" }, 403, requestOrigin);
    }
    if (spec.requiredRole === "editor" && !["editor", "admin"].includes(profile.role)) {
      return json({ error: "editor_role_required" }, 403, requestOrigin);
    }
    if (spec.requiredRole === "admin" && profile.role !== "admin") {
      return json({ error: "admin_role_required" }, 403, requestOrigin);
    }

    if (operation === "reviewer_profiles.update") {
      const { data: target, error } = await admin.from("reviewer_profiles").select("id").eq("id", actorId).maybeSingle();
      if (error || !target) return json({ error: "profile_not_found" }, 404, requestOrigin);
    }

    let writePayload: Record<string, unknown> = payload;
    if (operation === "member_messages.create") {
      const displayName = typeof profile.display_name === "string" && profile.display_name.trim()
        ? profile.display_name.trim()
        : null;
      const senderLabel = profile.role === "admin"
        ? `الإدارة العامة (${displayName ?? "مشرف"})`
        : profile.role === "editor"
          ? `هيئة التحرير (${displayName ?? "محرر"})`
          : "إدارة المعجم";
      writePayload = { ...payload, sender_label: senderLabel };
    }

    const policy = loadPolicy();
    const fields = scanFields(writePayload);
    const scan = scanContentPayload({
      surface: spec.surface,
      fields,
      contexts: spec.contexts,
    }, policy);

    // A review/block/escalation decision never receives a write token.
    if (scan.decision !== "allow" && scan.decision !== "allow_with_context") {
      return json({
        decision: scan.decision,
        requiresHumanReview: scan.requiresHumanReview,
        engineVersion: scan.engineVersion,
        policyVersion: scan.policyVersion,
        signals: scan.fields.map((item) => ({ field: item.field, index: item.index, decision: item.decision, signals: item.signals })),
        writeToken: null,
      }, 409, requestOrigin);
    }

    const { data: tokenData, error: tokenError } = await admin.rpc("issue_content_scan_token", {
      p_actor_id: actorId,
      p_operation: operation,
      p_payload: writePayload,
      p_engine_version: scan.engineVersion,
      p_policy_version: scan.policyVersion,
    });
    if (tokenError || typeof tokenData !== "string" || !tokenData) {
      console.error(JSON.stringify({ event: "content_scan_token_issue_failed", operation, actorId, code: tokenError?.code }));
      return json({ error: "scan_authorization_unavailable" }, 503, requestOrigin);
    }

    return json({
      decision: scan.decision,
      requiresHumanReview: scan.requiresHumanReview,
      engineVersion: scan.engineVersion,
      policyVersion: scan.policyVersion,
      fields: scan.fields.map((item) => ({ field: item.field, index: item.index, decision: item.decision, riskLevel: item.riskLevel, signals: item.signals })),
      writeToken: tokenData,
      writePayload,
      expiresInSeconds: 90,
    }, 200, requestOrigin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message.includes("CONTENT_SAFETY_POLICY") ? 503
      : error instanceof SyntaxError || message.includes("Unsupported") || message.includes("payload") || message.includes("Content") ? 400 : 500;
    console.error(JSON.stringify({ event: "content_safety_gateway_error", code: message.slice(0, 120) }));
    return json({ error: status === 503 ? "policy_unavailable" : status === 400 ? "invalid_request" : "gateway_error" }, status, requestOrigin);
  }
});
