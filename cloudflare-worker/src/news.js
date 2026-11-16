// Headlines only, from public Google News RSS searches. Nothing is summarised, scored or turned into a trade signal.
export const FEEDS = {
  INDIA: "https://news.google.com/rss/search?q=NSE+Nifty+Sensex+stock+market+when:1d&hl=en-IN&gl=IN&ceid=IN:en",
  GLOBAL: "https://news.google.com/rss/search?q=Wall+Street+stocks+Nasdaq+when:1d&hl=en-US&gl=US&ceid=US:en",
};
const dec = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
const tag = (x, t) => { const m = new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`).exec(x); return m ? dec(m[1]) : null; };

export function parseRss(xml, limit = 12) {
  const items = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const x = m[1], title = tag(x, "title"), link = tag(x, "link"), pub = tag(x, "pubDate"), source = tag(x, "source");
    if (!title || !/^https?:\/\//.test(link || "")) continue;
    const t = pub ? Date.parse(pub) : NaN;
    items.push({ title: title.replace(new RegExp("\\s+-\\s+" + (source || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"), ""), source, link, published: Number.isFinite(t) ? new Date(t).toISOString() : null });
    if (items.length >= limit) break;
  }
  return items;
}

export async function fetchNews(fetchImpl = fetch) {
  const out = { source: "Google News RSS (headlines only, not analysed)", fetched_at: new Date().toISOString() };
  for (const [region, url] of Object.entries(FEEDS)) {
    try { const r = await fetchImpl(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; MarketPilotPaperBot/1.0)" }, signal: AbortSignal.timeout(15000) }); out[region] = r.ok ? parseRss(await r.text()) : []; } catch { out[region] = []; }
  }
  return out;
}
