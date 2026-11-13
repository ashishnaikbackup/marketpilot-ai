import test from "node:test";
import assert from "node:assert/strict";
import { withD1Binding, findDatabaseId } from "../scripts/provision.mjs";

const ID = "123e4567-e89b-12d3-a456-426614174000";
const base = 'name = "marketpilot-api"\nmain = "src/index.js"\n\n[triggers]\ncrons = ["*/5 * * * 1-5"]\n';

test("withD1Binding appends a DB binding and keeps existing config", () => {
  const out = withD1Binding(base, ID);
  assert.match(out, /\[\[d1_databases\]\]/);
  assert.match(out, /binding = "DB"/);
  assert.ok(out.includes(`database_id = "${ID}"`));
  assert.ok(out.includes('crons = ["*/5 * * * 1-5"]'));
});

test("withD1Binding is idempotent and replaces an older binding", () => {
  const once = withD1Binding(base, ID);
  const twice = withD1Binding(once, "223e4567-e89b-12d3-a456-426614174000");
  assert.equal((twice.match(/\[\[d1_databases\]\]/g) || []).length, 1);
  assert.ok(twice.includes("223e4567-e89b-12d3-a456-426614174000"));
  assert.ok(!twice.includes(ID));
});

test("withD1Binding rejects invalid IDs", () => {
  assert.throws(() => withD1Binding(base, "not-a-uuid"));
  assert.throws(() => withD1Binding(base, undefined));
});

test("findDatabaseId reads Wrangler's JSON list", () => {
  assert.equal(findDatabaseId([{ name: "other", uuid: "x" }, { name: "marketpilot-paper-db", uuid: ID }]), ID);
  assert.equal(findDatabaseId([]), null);
  assert.equal(findDatabaseId(null), null);
});
