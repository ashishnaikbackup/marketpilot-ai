// One tick of the MarketPilot paper bot inside GitHub Actions. No servers, no Cloudflare, no tokens in the browser.
//   node runner/run.mjs <data-dir>
// Reads/writes <data-dir>/bot.sqlite and publishes static JSON to <data-dir>/public/paper-bot/*.json.
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join, resolve } from "node:path";
import { openDb, migrate } from "./sqlite-d1.mjs";
import { scheduledPaperBot, paperBotRoute } from "../cloudflare-worker/src/paper-bot.js";
import { loadGrounding } from "../cloudflare-worker/src/assistant.js";
import { providerInfo } from "../cloudflare-worker/src/providers.js";
import { buildUniverse } from "../cloudflare-worker/scripts/build-universe.mjs";
import { gunzipSync } from "node:zlib";
import { execSync } from "node:child_process";
import { fetchFoBhavcopy } from "../cloudflare-worker/src/nse-fo.js";
import { fetchNews } from "../cloudflare-worker/src/news.js";

const MIGRATIONS = fileURLToPath(new URL("../cloudflare-worker/migrations/", import.meta.url));
const NSE_MASTER = "https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz";
const READ = "static-export"; // internal only: used to call the read routes in-process; never leaves this job
const log = (...a) => console.log("[bot]", ...a);

async function loadUniverse(dir, nowMs, fetchImpl) {
  const file = join(dir, "universe-india.json");
  const fresh = existsSync(file) && nowMs - statSync(file).mtimeMs < 3 * 86400000;
  if (fresh) return JSON.parse(readFileSync(file, "utf8"));
  try {
    const res = await fetchImpl(NSE_MASTER, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const u = buildUniverse(JSON.parse(gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8")), nowMs);
    writeFileSync(file, JSON.stringify(u));
    log(`universe rebuilt: ${u.indices.length} indices, ${u.stocks.length} F&O stocks, ${u.etfs.length} ETFs`);
    return u;
  } catch (e) {
    log("universe refresh failed:", e instanceof Error ? e.message : e);
    return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null; // else the built-in index-only seed is used
  }
}

const eodDone = async (db, region, nowMs) => {
  const day = new Date(nowMs).toISOString().slice(0, 10);
  return Boolean(await db.prepare("SELECT 1 x FROM bot_runs WHERE region=? AND trigger='scheduled_eod' AND status='completed' AND substr(started_at,1,10)=?").bind(region, day).first());
};

export async function runOnce({ dataDir, env: extra = {}, nowMs = Date.now(), fetchImpl = fetch } = {}) {
  mkdirSync(dataDir, { recursive: true });
  const { sqlite, db, close } = openDb(join(dataDir, "bot.sqlite"));
  try {
    migrate(sqlite, MIGRATIONS);
    const universe = await loadUniverse(dataDir, nowMs, fetchImpl);
    const env = { DB: db, FREE_FEEDS: "on", BOT_READ_TOKEN: READ, ...extra, ...(universe ? { UNIVERSE_INDIA: universe } : {}) };
    const d = new Date(nowMs), wd = d.getUTCDay() >= 1 && d.getUTCDay() <= 5, utcMin = d.getUTCHours() * 60 + d.getUTCMinutes();
    // Live/delayed pass, aligned to a 15-minute slot so the scheduler's cadence rules apply.
    await scheduledPaperBot({ scheduledTime: Math.floor(nowMs / 900000) * 900000 }, env);
    // End-of-day passes, once per day each, after the close.
    const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const force = extra.FORCE_EOD === "1" || process.env.FORCE_EOD === "1";
    const istMin = (utcMin + 330) % 1440, indiaOpen = wd && istMin >= 555 && istMin <= 930, usOpen = wd && utcMin >= 13 * 60 + 30 && utcMin < 21 * 60; // never label in-session prices as a close
    if ((force ? !indiaOpen : wd && utcMin >= 10 * 60 + 5 && utcMin < 21 * 60) && !(await eodDone(db, "INDIA", nowMs))) await scheduledPaperBot({ scheduledTime: day + (10 * 60 + 20) * 60000 }, env);
    if ((force ? !usOpen : wd && utcMin >= 21 * 60 + 30) && !(await eodDone(db, "GLOBAL", nowMs))) await scheduledPaperBot({ scheduledTime: day + (22 * 60 + 30) * 60000 }, env);
    return await exportStatic({ env, dir: join(dataDir, "public", "paper-bot"), nowMs, fetchImpl });
  } finally { close(); }
}

export async function exportStatic({ env, dir, nowMs = Date.now(), fetchImpl = fetch }) {
  mkdirSync(dir, { recursive: true });
  const get = async (path) => {
    const url = new URL("https://static.invalid" + path);
    const res = await paperBotRoute(new Request(url, { headers: { Authorization: "Bearer " + READ } }), env, url);
    return res.json();
  };
  const write = (name, data) => writeFileSync(join(dir, name + ".json"), JSON.stringify(data));
  const status = await get("/api/v1/paper-bot/status");
  status.provider = providerInfo(env);
  status.hosting = "github-actions";
  write("status", status);
  for (const region of ["INDIA", "GLOBAL"]) {
    const q = "?region=" + region;
    write("portfolio-" + region, await get("/api/v1/paper-bot/portfolio" + q));
    write("positions-" + region, await get("/api/v1/paper-bot/positions" + q + "&limit=300"));
    write("equity-" + region, await get("/api/v1/paper-bot/equity" + q + "&limit=300"));
    write("reports-" + region, await get("/api/v1/paper-bot/reports" + q + "&limit=60"));
    write("insights-" + region, await get("/api/v1/paper-bot/insights" + q));
    const g = await loadGrounding(env, region);
    write("grounding-" + region, { grounding: g });
  }
  // Extra free sources, refreshed on their own cadence; failures never stop the bot.
  const stale = (name, mins) => { try { return nowMs - statSync(join(dir, name + ".json")).mtimeMs > mins * 60000; } catch { return true; } };
  const sources = {};
  if (stale("fo-eod", 360)) { try { write("fo-eod", await fetchFoBhavcopy(fetchImpl, nowMs)); sources.fo_eod = { ok: true, at: new Date(nowMs).toISOString() }; } catch (e) { const m = e instanceof Error ? e.message : String(e); log("F&O bhavcopy:", m); sources.fo_eod = { ok: false, error: m.slice(0, 400), at: new Date(nowMs).toISOString() }; } }
  if (stale("news", 25)) { try { const n = await fetchNews(fetchImpl); if (n.INDIA.length || n.GLOBAL.length) write("news", n); } catch { /* optional */ } }
  if (Object.keys(sources).length) write("sources", sources);
  write("meta", { generated_at: new Date(nowMs).toISOString(), hosting: "github-actions", mode: "paper_only" });
  return { files: readdirSync(dir).length, status: status.message };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Ten minutes during the Indian or US session, thirty otherwise (cheap no-op ticks keep the chain alive).
export function tickInterval(nowMs) {
  const d = new Date(nowMs), m = d.getUTCHours() * 60 + d.getUTCMinutes(), wd = d.getUTCDay() >= 1 && d.getUTCDay() <= 5;
  return wd && ((m >= 3 * 60 + 40 && m <= 10 * 60 + 40) || (m >= 13 * 60 + 25 && m <= 21 * 60 + 40)) ? 10 * 60000 : 30 * 60000;
}

function publish(dataDir) {
  const url = process.env.PUBLISH_URL;
  if (!url) return;
  const run = (c) => execSync(c, { cwd: dataDir, stdio: "pipe" });
  rmSync(join(dataDir, ".git"), { recursive: true, force: true });
  run("git init -q -b bot-data"); run('git config user.name "marketpilot-bot"'); run('git config user.email "marketpilot-bot@users.noreply.github.com"');
  run("git add -A"); run(`git commit -qm "Bot data ${new Date().toISOString().slice(0, 16)}Z"`);
  run(`git push -f "${url}" bot-data`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const dir = process.argv.find((a, i) => i >= 2 && !a.startsWith("--") && process.argv[i - 1] !== "--loop") || "bot-data";
  const li = process.argv.indexOf("--loop"), loopMin = li > 0 ? Number(process.argv[li + 1]) : 0;
  const env = {};
  for (const k of ["UPSTOX_ACCESS_TOKEN", "TWELVEDATA_API_KEY", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "GLOBAL_WATCHLIST"]) if (process.env[k]) env[k] = process.env[k];
  const endAt = Date.now() + loopMin * 60000;
  for (;;) {
    try { const out = await Promise.race([runOnce({ dataDir: dir, env }), new Promise((_, rej) => setTimeout(() => rej(new Error("tick exceeded 8 minutes")), 8 * 60000).unref())]); log("published", out.files, "files.", out.status); publish(dir); }
    catch (e) { log("tick failed:", e instanceof Error ? e.message : e); if (!loopMin) process.exitCode = 1; }
    process.env.FORCE_EOD = "0";
    const wait = tickInterval(Date.now());
    if (!loopMin || Date.now() + wait > endAt) break;
    await sleep(wait);
  }
}
