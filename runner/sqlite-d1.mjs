// A tiny Cloudflare-D1-compatible wrapper over node:sqlite, so the exact same bot code runs inside GitHub Actions.
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function openDb(file) {
  const sqlite = new DatabaseSync(file);
  sqlite.exec("PRAGMA journal_mode=DELETE; PRAGMA foreign_keys=ON;");
  const wrap = (sql, args = []) => ({
    sql, args, bind: (...a) => wrap(sql, a),
    first: async () => sqlite.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
    run: async () => { sqlite.prepare(sql).run(...args); return { success: true }; },
  });
  const db = {
    prepare: (sql) => wrap(sql),
    batch: async (list) => {
      sqlite.exec("BEGIN");
      try { for (const s of list) sqlite.prepare(s.sql).run(...s.args); sqlite.exec("COMMIT"); } catch (e) { sqlite.exec("ROLLBACK"); throw e; }
      return list.map(() => ({ success: true }));
    },
  };
  return { sqlite, db, close: () => sqlite.close() };
}

export function migrate(sqlite, dir) {
  sqlite.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const done = new Set(sqlite.prepare("SELECT name FROM _migrations").all().map((r) => r.name));
  const applied = [];
  for (const f of readdirSync(dir).filter((n) => /^\d+.*\.sql$/.test(n)).sort()) {
    if (done.has(f)) continue;
    sqlite.exec("BEGIN");
    try { sqlite.exec(readFileSync(join(dir, f), "utf8")); sqlite.prepare("INSERT INTO _migrations VALUES (?,?)").run(f, new Date().toISOString()); sqlite.exec("COMMIT"); applied.push(f); }
    catch (e) { sqlite.exec("ROLLBACK"); throw e; }
  }
  return applied;
}
