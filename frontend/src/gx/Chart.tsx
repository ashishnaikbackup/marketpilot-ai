import type { EquityPoint } from "./api";

// Simple dependency-free line chart. Draws only points that came from the database.
export function EquityChart({ points, up }: { points: EquityPoint[]; up: boolean }) {
  if (points.length < 2) return <div className="gx-sub" style={{ padding: "14px 0" }}>The chart appears after the bot has completed at least two runs.</div>;
  const w = 600, h = 150, pad = 6;
  const ys = points.map((p) => p.equity), lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1;
  const x = (i: number) => pad + (i / (points.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - ((v - lo) / span) * (h - pad * 2);
  const line = points.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.equity).toFixed(1)).join(" ");
  const color = up ? "#00a37a" : "#e5484d";
  return <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={150} preserveAspectRatio="none" role="img" aria-label="Paper portfolio value over time" style={{ display: "block" }}>
    <defs><linearGradient id="gxfill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".18" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
    <path d={line + ` L${x(points.length - 1)} ${h} L${x(0)} ${h} Z`} fill="url(#gxfill)" />
    <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
  </svg>;
}
