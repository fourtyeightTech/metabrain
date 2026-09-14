'use client';
import { useId, useState } from 'react';
import type { Tick } from '@/lib/types';

export function PriceChart({ ticks }: { ticks: Tick[] }) {
  const id = useId().replace(/:/g, ''); const [hover, setHover] = useState<number | null>(null);
  if (ticks.length < 2) return <div className="empty-chart">Waiting for market events.</div>;
  const values = ticks.map(t => t.price); const min = Math.min(...values); const max = Math.max(...values);
  const range = Math.max(max - min, max * 0.002); const width = 600; const height = 195;
  const xy = values.map((v, i) => [i / (values.length - 1) * width, 12 + (max - v) / range * (height - 36)]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const h = hover !== null ? Math.min(hover, ticks.length - 1) : null;
  return <div className="price-chart" onMouseLeave={() => setHover(null)}>
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Observed token price over time"
      onMouseMove={e => { const rect = e.currentTarget.getBoundingClientRect(); setHover(Math.round((e.clientX - rect.left) / rect.width * (ticks.length - 1))); }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c7cbd3" stopOpacity=".19"/><stop offset="100%" stopColor="#c7cbd3" stopOpacity="0"/></linearGradient></defs>
      {[35, 85, 135, 185].map(y => <line key={y} x1="0" y1={y} x2={width} y2={y} stroke="#262627" strokeDasharray="3 6"/>)}
      <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#${id})`}/>
      <path d={line} fill="none" stroke="#e4e5e9" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
      {h !== null && h >= 0 ? <g><line x1={xy[h][0]} x2={xy[h][0]} y1="0" y2={height} stroke="#85858b" strokeDasharray="4 4"/><circle cx={xy[h][0]} cy={xy[h][1]} r="4" fill="#ffffff"/></g> : null}
    </svg>
    <div className="chart-times"><span>{new Date(ticks[0].ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      <span>{h !== null && h >= 0 ? `${ticks[h].price.toPrecision(5)} · ${new Date(ticks[h].ts).toLocaleTimeString()}` : 'Observed price'}</span>
      <span>NOW</span></div>
  </div>;
}
export function ResponseTrace({ values }: { values: number[] | undefined }) {
  if (!values?.length) return <div className="no-trace"><span className="dashed-trace"/><span>No cortical samples yet</span></div>;
  const max = Math.max(...values, 0.001); const path = values.map((v, i) => `${i ? 'L' : 'M'}${i / Math.max(1, values.length - 1) * 400},${55 - v / max * 45}`).join(' ');
  return <svg className="response-trace" viewBox="0 0 400 65" role="img" aria-label="Mean absolute predicted response"><path d={path} fill="none" stroke="#c3c8d2" strokeWidth="1.5"/></svg>;
}
