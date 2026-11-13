// Shared security helpers for the MarketPilot Worker.
// No secrets live here. Limits are best-effort per Worker isolate; add a Cloudflare
// rate-limiting rule in the dashboard for hard guarantees (see docs/SECURITY_REVIEW.md).

export const DEFAULT_ALLOWED_ORIGINS = [
  "https://ashishnaikbackup.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

export function allowedOrigins(env) {
  const configured = typeof env?.ALLOWED_ORIGINS === "string" ? env.ALLOWED_ORIGINS : "";
  const list = configured.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : DEFAULT_ALLOWED_ORIGINS;
}

// CORS is a browser policy, not authentication. We only echo origins we trust.
export function corsHeaders(request, env) {
  const headers = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  };
  const origin = request.headers.get("Origin");
  if (origin && allowedOrigins(env).includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

// Constant-time string comparison (length is not secret here; contents are).
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  const len = Math.max(x.length, y.length);
  let diff = x.length ^ y.length;
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

// True only when the request carries `Authorization: Bearer <expected>`.
export function hasBearer(request, expected) {
  if (!expected) return false;
  const header = request.headers.get("Authorization") || "";
  if (!header.startsWith("Bearer ")) return false;
  return safeEqual(header.slice(7), expected);
}

const buckets = new Map();
export function rateLimit(key, limit, windowMs = 60_000, nowMs = Date.now()) {
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.resetAt <= nowMs) buckets.delete(k);
  }
  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= nowMs) {
    buckets.set(key, { count: 1, resetAt: nowMs + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  entry.count += 1;
  if (entry.count > limit) return { ok: false, retryAfter: Math.ceil((entry.resetAt - nowMs) / 1000) };
  return { ok: true, retryAfter: 0 };
}
export function resetRateLimits() { buckets.clear(); }

export function clientId(request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "anonymous";
}

// Per-route request limits: [requests per minute, max body bytes].
export function limitsFor(method, path) {
  if (path === "/api/v1/ai/chat") return { rpm: 10, maxBytes: 60_000 };
  if (path === "/api/v1/paper-bot/run") return { rpm: 6, maxBytes: 2_000_000 };
  if (path.startsWith("/api/v1/paper-bot/")) return { rpm: 60, maxBytes: 1_000 };
  if (method === "POST") return { rpm: 60, maxBytes: 1_000_000 };
  return { rpm: 120, maxBytes: 1_000 };
}
