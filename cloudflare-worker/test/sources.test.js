import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { unzipFirst, summariseBhavcopy, fetchFoBhavcopy, bhavUrl } from "../src/nse-fo.js";
import { parseRss, fetchNews } from "../src/news.js";

function zip(name, text) {
  const data = deflateRawSync(Buffer.from(text)), n = Buffer.from(name);
  const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(text.length, 22); lh.writeUInt16LE(n.length, 26);
  const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(8, 10); cd.writeUInt32LE(data.length, 20); cd.writeUInt32LE(text.length, 24); cd.writeUInt16LE(n.length, 28); cd.writeUInt32LE(0, 42);
  const cdOff = 30 + n.length + data.length, eo = Buffer.alloc(22); eo.writeUInt32LE(0x06054b50, 0); eo.writeUInt16LE(1, 8); eo.writeUInt16LE(1, 10); eo.writeUInt32LE(46 + n.length, 12); eo.writeUInt32LE(cdOff, 16);
  return Buffer.concat([lh, n, data, cd, n, eo]);
}
const HEAD = "TradDt,BizDt,Sgmt,FinInstrmTp,TckrSymb,XpryDt,StrkPric,OptnTp,OpnIntrst,ChngInOpnIntrst,TtlTradgVol,UndrlygPric,NewBrdLotQty";
const row = (sym, tp, exp, k, ot, oi, chg) => `2026-11-13,2026-11-13,FO,${tp},${sym},${exp},${k},${ot},${oi},${chg},1000,25000,75`;
const rows = [HEAD];
for (let k = 24500; k <= 25500; k += 100) { rows.push(row("NIFTY", "IDO", "2026-11-17", k, "CE", k === 25200 ? 90000 : 10000, 500)); rows.push(row("NIFTY", "IDO", "2026-11-17", k, "PE", k === 24800 ? 120000 : 12000, -200)); }
rows.push(row("NIFTY", "IDO", "2026-12-29", 25000, "CE", 5, 1)); rows.push(row("NIFTY", "IDF", "2026-11-17", 0, "", 1, 1)); rows.push("garbage");
const csv = rows.join("\n");

test("zip reader and bhavcopy summary: PCR, OI change, support/resistance, max pain, nearest expiry only", () => {
  assert.equal(unzipFirst(zip("f.csv", csv)).toString(), csv);
  const s = summariseBhavcopy(csv), n = s.underlyings[0];
  assert.equal(s.trade_date, "2026-11-13"); assert.equal(n.underlying, "NIFTY"); assert.equal(n.expiry, "2026-11-17");
  assert.equal(n.support_strike, 24800); assert.equal(n.resistance_strike, 25200);
  assert.equal(n.call_open_interest, 10 * 10000 + 90000); assert.equal(n.put_open_interest, 10 * 12000 + 120000);
  assert.equal(n.change_in_call_oi, 11 * 500); assert.equal(n.change_in_put_oi, -11 * 200);
  assert.equal(n.lot_size, 75); assert.ok(n.max_pain >= 24500 && n.max_pain <= 25500); assert.ok(n.pcr_oi > 0);
  assert.throws(() => summariseBhavcopy("a,b\n1,2"), /Unexpected bhavcopy/);
});

test("bhavcopy fetch walks back over missing days and reports EOD, never live", async () => {
  const urls = [];
  const out = await fetchFoBhavcopy(async (u) => { urls.push(u); return u.includes("20261113") ? new Response(zip("f.csv", csv)) : new Response("", { status: 404 }); }, Date.parse("2026-11-16T05:00:00Z"));
  assert.equal(out.data_mode, "eod"); assert.equal(out.file_date, "20261113"); assert.ok(urls[0].includes("20261116") && urls.at(-1) === bhavUrl("20261113"));
  await assert.rejects(() => fetchFoBhavcopy(async () => new Response("", { status: 403 }), Date.parse("2026-11-16T05:00:00Z")), /not available/);
});

test("news parser returns headline, source, link and time only", async () => {
  const xml = `<rss><channel><item><title><![CDATA[Nifty ends higher &amp; IT leads - Mint]]></title><link>https://example.com/a</link><pubDate>Mon, 16 Nov 2026 04:00:00 GMT</pubDate><source url="x">Mint</source></item><item><title>No link</title><link>javascript:x</link></item></channel></rss>`;
  const it = parseRss(xml);
  assert.equal(it.length, 1); assert.equal(it[0].title, "Nifty ends higher & IT leads"); assert.equal(it[0].source, "Mint"); assert.equal(it[0].published, "2026-11-16T04:00:00.000Z");
  const n = await fetchNews(async () => new Response(xml));
  assert.equal(n.INDIA.length, 1); assert.match(n.source, /not analysed/);
  assert.deepEqual((await fetchNews(async () => { throw new Error("x"); })).GLOBAL, []);
});
