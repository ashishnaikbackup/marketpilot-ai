// Provisions the Cloudflare D1 database for the paper bot and renders a deploy-time
// Wrangler config that contains the binding. Used by .github/workflows/deploy-api.yml.
// Nothing here prints secrets. The generated file is git-ignored and never committed.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const DB_NAME = "marketpilot-paper-db";

export function withD1Binding(toml, databaseId, databaseName = DB_NAME) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(databaseId || "")) {
    throw new Error("A valid D1 database UUID is required.");
  }
  const withoutOld = toml.replace(/\n?\[\[d1_databases\]\][\s\S]*?(?=\n\[|$)/g, "");
  return `${withoutOld.trimEnd()}\n\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "${databaseName}"\ndatabase_id = "${databaseId}"\nmigrations_dir = "migrations"\n`;
}

export function findDatabaseId(listJson, name = DB_NAME) {
  const rows = Array.isArray(listJson) ? listJson : [];
  const hit = rows.find((d) => d?.name === name);
  return hit?.uuid || hit?.id || null;
}

function wrangler(args) {
  return execFileSync("npx", ["wrangler", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function main() {
  let id = null;
  try { id = findDatabaseId(JSON.parse(wrangler(["d1", "list", "--json"]))); } catch { /* fall through to create */ }
  if (!id) {
    wrangler(["d1", "create", DB_NAME]);
    id = findDatabaseId(JSON.parse(wrangler(["d1", "list", "--json"])));
  }
  if (!id) throw new Error("Could not find or create the D1 database.");
  const base = readFileSync("wrangler.toml", "utf8");
  writeFileSync("wrangler.generated.toml", withD1Binding(base, id));
  console.log("Rendered wrangler.generated.toml with D1 binding for", DB_NAME);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
