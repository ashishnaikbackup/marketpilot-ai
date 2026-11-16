import { useMemo, useState } from "react";
import { pctText, tone, when, type Desk } from "./api";

const KINDS = [["all", "All"], ["F", "F&O stocks"], ["E", "ETFs"]] as const;
const SORTS = [["az", "A–Z"], ["up", "Top gainers"], ["down", "Top losers"]] as const;

export default function Board({ desk }: { desk: Desk }) {
  const b = desk.board;
  const [q, setQ] = useState(""), [kind, setKind] = useState<"all" | "F" | "E">("all"), [sort, setSort] = useState<"az" | "up" | "down">("az"), [n, setN] = useState(40);
  const rows = useMemo(() => {
    if (!b) return [];
    const t = q.trim().toLowerCase();
    let r = b.rows.filter((x) => (kind === "all" || x[5] === kind) && (!t || x[0].toLowerCase().includes(t) || x[1].toLowerCase().includes(t)));
    if (sort === "up") r = [...r].sort((a, c) => (c[3] ?? -1e9) - (a[3] ?? -1e9));
    if (sort === "down") r = [...r].sort((a, c) => (a[3] ?? 1e9) - (c[3] ?? 1e9));
    return r;
  }, [b, q, kind, sort]);
  if (!b) return null;
  const cur = desk.region === "INDIA" ? "₹" : "$";
  return <div className="gx-card"><div className="gx-h"><h2>All {desk.region === "INDIA" ? "Indian" : "US"} stocks</h2><small>{b.priced.toLocaleString()} of {b.total_symbols.toLocaleString()} priced</small></div>
    <form className="gx-ask" onSubmit={(e) => e.preventDefault()}><input value={q} onChange={(e) => { setQ(e.target.value); setN(40); }} placeholder="Search a symbol or company" aria-label="Search stocks" /></form>
    <div className="gx-chips" style={{ marginTop: 10 }}>{KINDS.map(([k, l]) => <button key={k} className={kind === k ? "on" : ""} onClick={() => { setKind(k); setN(40); }}>{l}</button>)}{SORTS.map(([k, l]) => <button key={k} className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{l}</button>)}</div>
    {rows.slice(0, n).map((x) => <div className="gx-row" key={x[0]}><div><strong>{x[0]}{x[5] === "F" ? " · F&O" : x[5] === "E" ? " · ETF" : ""}</strong><small>{x[1] || "—"} · price as of {when(x[4])}</small></div>
      <div className="r">{cur}{x[2].toLocaleString(undefined, { maximumFractionDigits: 2 })}<br /><small className={tone(x[3])}>{pctText(x[3])}</small></div></div>)}
    {!rows.length && <p className="gx-sub">No match.</p>}
    {rows.length > n && <button className="gx-btn plain" style={{ marginTop: 10 }} onClick={() => setN(n + 60)}>Show more ({rows.length - n} left)</button>}
    <p className="gx-sub">{b.source}. Every row shows when its price was taken; the list refreshes in rolling slices, so some rows are older than others. Reference only: confirm the live price in your broker app before any real order. This app never places orders.</p></div>;
}
