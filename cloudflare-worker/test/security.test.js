import test from "node:test";
import assert from "node:assert/strict";
import app from "../src/index.js";
import { safeEqual, hasBearer, rateLimit, resetRateLimits, corsHeaders } from "../src/security.js";

const PAGES = "https://ashishnaikbackup.github.io";

test("preflight from the Pages origin allows the Authorization header", async () => {
  const r = await app.fetch(new Request("https://unit.test/api/v1/paper-bot/positions", {
    method: "OPTIONS", headers: { Origin: PAGES, "Access-Control-Request-Headers": "authorization" },
  }), {});
  assert.equal(r.status, 204);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), PAGES);
  assert.match(r.headers.get("Access-Control-Allow-Headers"), /Authorization/);
});

test("unknown origins are not echoed back and wildcard is never sent", async () => {
  const r = await app.fetch(new Request("https://unit.test/api/v1/health", { headers: { Origin: "https://evil.example" } }), {});
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), null);
});

test("ALLOWED_ORIGINS overrides the defaults", () => {
  const req = new Request("https://unit.test/", { headers: { Origin: "https://my.site" } });
  assert.equal(corsHeaders(req, { ALLOWED_ORIGINS: "https://my.site" })["Access-Control-Allow-Origin"], "https://my.site");
  assert.equal(corsHeaders(req, {})["Access-Control-Allow-Origin"], undefined);
});

test("safeEqual and hasBearer compare tokens exactly", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual("abc", "abcd"), false);
  assert.equal(safeEqual(undefined, "abc"), false);
  const ok = new Request("https://unit.test/", { headers: { Authorization: "Bearer s3cret" } });
  assert.equal(hasBearer(ok, "s3cret"), true);
  assert.equal(hasBearer(ok, "other"), false);
  assert.equal(hasBearer(ok, ""), false);
  assert.equal(hasBearer(new Request("https://unit.test/", { headers: { Authorization: "s3cret" } }), "s3cret"), false);
});

test("rate limiter blocks after the limit and recovers after the window", () => {
  resetRateLimits();
  for (let i = 0; i < 3; i++) assert.equal(rateLimit("k", 3, 1000, 0).ok, true);
  const blocked = rateLimit("k", 3, 1000, 10);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfter >= 1);
  assert.equal(rateLimit("k", 3, 1000, 2000).ok, true);
});

test("oversized POST bodies are rejected with 413", async () => {
  resetRateLimits();
  const big = JSON.stringify({ pad: "x".repeat(70_000) });
  const r = await app.fetch(new Request("https://unit.test/api/v1/ai/chat", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: big,
  }), { AI_CHAT_ENABLED: "true" });
  assert.equal(r.status, 413);
});

test("API returns 429 once the per-route limit is exceeded", async () => {
  resetRateLimits();
  let last;
  for (let i = 0; i < 12; i++) {
    last = await app.fetch(new Request("https://unit.test/api/v1/ai/chat", {
      method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": "9.9.9.9" }, body: "{}",
    }), {});
  }
  assert.equal(last.status, 429);
  assert.ok(last.headers.get("Retry-After"));
});
