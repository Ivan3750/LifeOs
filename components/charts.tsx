'use client';

import { useEffect, useRef, useState } from 'react';
import { addD, AREAS, DN, fmtN, kfmt, MON, MONTHN, smooth } from '@/lib/util';

export function Ring({ pct, color, label, value }: { pct: number; color: string; label: string; value: string }) {
  const C = 2 * Math.PI * 44, p = Math.max(0, Math.min(1, pct || 0));
  return (
    <div className="ring">
      <svg viewBox="0 0 100 100">
        <circle className="trk" cx="50" cy="50" r="44" fill="none" strokeWidth="6" />
        <circle className="val" cx="50" cy="50" r="44" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={C.toFixed(1)} strokeDashoffset={(C * (1 - p)).toFixed(1)} transform="rotate(-90 50 50)" />
      </svg>
      <div className="lbl"><b className="num">{value}</b><small>{label}</small></div>
    </div>
  );
}

/** Weekly focus minutes as a smooth area with the weekdays under it. The marker is plain HTML so it stays round when the area stretches. */
export function FocusArea({ week, today }: { week: number[]; today: number }) {
  const max = Math.max(60, ...week), pts = week.map((v, i) => [i * 50, 100 - (v / max) * 80] as [number, number]);
  const line = smooth(pts);
  return (
    <div className="farea">
      <div className="farea-plot">
        <svg viewBox="0 0 300 110" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="ftg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity=".35" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L300,110 L0,110Z`} fill="url(#ftg)" />
          <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        <i className="farea-dot" style={{ left: `${(pts[today][0] / 300) * 100}%`, top: `${(pts[today][1] / 110) * 100}%` }} />
      </div>
      <div className="farea-days">{DN.map((d, i) => <span key={d} className={i === today ? 'today' : ''} title={`${d}: ${Math.round(week[i])} хв`}>{d}</span>)}</div>
    </div>
  );
}

/** Focus per 4-hour block for each weekday, with a line of daily hours. */
export function Rhythm({ blocks, today }: { blocks: number[][]; today: number }) {
  const W = 720, H = 170, L = 34, B = 24, T = 10, cw = (W - L) / 7;
  const daily = blocks.map(b => b.reduce((x, y) => x + y, 0) / 60);
  const top = Math.max(2, Math.ceil(Math.max(...daily) / 2) * 2), y = (v: number) => T + (H - B - T) * (1 - v / top);
  const bmax = Math.max(60, ...blocks.flat());
  const pts = daily.map((v, i) => [L + i * cw + cw / 2, +y(v).toFixed(1)] as [number, number]);
  const mi = daily.indexOf(Math.max(...daily));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {[0, top / 2, top].map(v => (
        <g key={v}>
          <line x1={L} x2={W} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray={v ? '3 4' : undefined} />
          <text className="chart-text" x="0" y={y(v) + 4}>{v}год</text>
        </g>
      ))}
      {blocks.map((b, i) => {
        const x0 = L + i * cw + 8, bw = (cw - 16) / 6;
        return (
          <g key={i}>
            {b.map((m, k) => {
              const h = ((H - B - T) * 0.85 * m) / bmax;
              return <rect key={k} x={(x0 + k * bw + 1).toFixed(1)} y={(H - B - h).toFixed(1)} width={(bw - 2).toFixed(1)} height={Math.max(h, 0).toFixed(1)} rx="2" fill={i === today ? 'var(--accent)' : 'var(--bar)'} />;
            })}
            <text className="chart-text" x={L + i * cw + cw / 2} y={H - 6} textAnchor="middle" style={i === today ? { fill: 'var(--ink)', fontWeight: 600 } : undefined}>{DN[i]}</text>
          </g>
        );
      })}
      <path d={smooth(pts)} fill="none" stroke="var(--ink)" strokeWidth="1.6" />
      {pts.map((p, i) => (i === mi || i === today
        ? <circle key={i} cx={p[0]} cy={p[1]} r="5" fill="var(--accent)" stroke="var(--card)" strokeWidth="2" />
        : <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill="var(--ink)" />))}
      {daily[mi] > 0 && <text className="chart-text" x={pts[mi][0]} y={Math.max(12, pts[mi][1] - 10)} textAnchor="middle" style={{ fill: 'var(--ink)', fontWeight: 600 }}>{daily[mi].toFixed(1)}год</text>}
    </svg>
  );
}

/** 14-day (or any length) bar chart ending today. */
export function Bars({ vals, max, color, target, unit }: { vals: number[]; max: number; color: string | ((v: number) => string); target?: number; unit: string }) {
  const W = 420, H = 150, B = 20, T = 16, n = vals.length, cw = W / n, y = (v: number) => T + (H - B - T) * (1 - Math.min(v, max) / max);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {!!target && (
        <g>
          <line x1="0" x2={W} y1={y(target).toFixed(1)} y2={y(target).toFixed(1)} stroke="var(--muted)" strokeDasharray="3 4" opacity=".7" />
          <text className="chart-text" x={W} y={(y(target) - 5).toFixed(1)} textAnchor="end">ціль</text>
        </g>
      )}
      {vals.map((v, i) => {
        const d = addD(new Date(), i - n + 1), top = y(v);
        return (
          <g key={i}>
            <rect x={(i * cw + 3).toFixed(1)} y={top.toFixed(1)} width={(cw - 6).toFixed(1)} height={Math.max(0, H - B - top).toFixed(1)} rx="3" fill={typeof color === 'function' ? color(v) : color}>
              <title>{`${d.getDate()} ${MON[d.getMonth()]}: ${fmtN(v)}${unit}`}</title>
            </rect>
            {(n - 1 - i) % 2 === 0 && <text className="chart-text" x={(i * cw + cw / 2).toFixed(1)} y={H - 5} textAnchor="middle" style={i === n - 1 ? { fill: 'var(--ink)', fontWeight: 600 } : undefined}>{d.getDate()}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export function Radar({ vals }: { vals: number[] }) {
  const c = 150, R = 100, n = vals.length;
  const pt = (i: number, r: number) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [c + r * Math.cos(a), c + r * Math.sin(a)]; };
  const P = (i: number, r: number) => pt(i, r).map(v => v.toFixed(1)).join(',');
  return (
    <svg viewBox="-60 0 420 300" style={{ width: '100%', height: 'auto' }}>
      {[2, 4, 6, 8, 10].map(lv => <polygon key={lv} points={vals.map((_, i) => P(i, (R * lv) / 10)).join(' ')} fill="none" stroke="var(--line)" />)}
      {vals.map((_, i) => {
        const [x, y] = pt(i, R), [lx, ly] = pt(i, R + 14);
        return (
          <g key={i}>
            <line x1={c} y1={c} x2={x.toFixed(1)} y2={y.toFixed(1)} stroke="var(--line)" />
            <text className="chart-text" x={lx.toFixed(1)} y={(ly + 4).toFixed(1)} textAnchor={Math.abs(lx - c) < 5 ? 'middle' : lx > c ? 'start' : 'end'}>{AREAS[i]}</text>
          </g>
        );
      })}
      <polygon points={vals.map((v, i) => P(i, (R * v) / 10)).join(' ')} fill="var(--accent)" fillOpacity=".22" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      {vals.map((v, i) => { const [x, y] = pt(i, (R * v) / 10); return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="3.5" fill="var(--accent)" />; })}
    </svg>
  );
}

/** Six months of revenue. Sized from the container so text stays readable at any width. */
export function RevenueChart({ months, rev, goal }: { months: Date[]; rev: number[]; goal: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const [W, setW] = useState(420);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(280, Math.round(el.getBoundingClientRect().width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 210, B = 22, T = 26, max = Math.max(goal, ...rev) * 1.12, cw = W / 6, y = (v: number) => T + (H - B - T) * (1 - v / max);
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
      <line x1="0" x2={W} y1={y(goal).toFixed(1)} y2={y(goal).toFixed(1)} stroke="var(--good)" strokeDasharray="4 4" />
      {rev.map((v, i) => {
        const w = Math.min(cw * 0.6, 64), x = i * cw + (cw - w) / 2, top = y(v);
        return (
          <g key={i}>
            <rect x={x.toFixed(1)} y={top.toFixed(1)} width={w.toFixed(1)} height={Math.max(0, H - B - top).toFixed(1)} rx="8" fill={i === 5 ? 'var(--accent)' : 'var(--bar)'} />
            <text className="chart-text" x={(x + w / 2).toFixed(1)} y={(top - 6).toFixed(1)} textAnchor="middle" style={{ fill: 'var(--ink)', fontWeight: 600 }}>{kfmt(v)}</text>
            <text className="chart-text" x={(x + w / 2).toFixed(1)} y={H - 5} textAnchor="middle" style={i === 5 ? { fill: 'var(--ink)', fontWeight: 600 } : undefined}>{MONTHN[months[i].getMonth()].slice(0, 3)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** A line over the last days: used for weight. Gaps (days without a value) are skipped, min and max are labelled. */
export function Trend({ vals, unit }: { vals: number[]; unit: string }) {
  const W = 420, H = 150, L = 8, R = 8, T = 22, B = 22, n = vals.length;
  const pts = vals.map((v, i) => ({ v, i })).filter(p => p.v > 0);
  if (pts.length < 2) return null;
  const lo = Math.min(...pts.map(p => p.v)), hi = Math.max(...pts.map(p => p.v)), pad = Math.max(0.5, (hi - lo) * 0.25);
  const x = (i: number) => L + ((W - L - R) * i) / Math.max(1, n - 1), y = (v: number) => T + (H - T - B) * (1 - (v - (lo - pad)) / (hi - lo + 2 * pad));
  const line = pts.map(p => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1], first = pts[0];
  return (
    <svg className="trendsvg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Від ${first.v} до ${last.v} ${unit}`}>
      <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="var(--line)" />
      <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(p => <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={p === last ? 5 : 3} fill={p === last ? 'var(--accent)' : 'var(--card)'} stroke="var(--accent)" strokeWidth="2"><title>{`${addD(new Date(), p.i - n + 1).getDate()} ${MON[addD(new Date(), p.i - n + 1).getMonth()]}: ${p.v} ${unit}`}</title></circle>)}
      <text className="chart-text" x={x(last.i)} y={Math.max(12, y(last.v) - 10)} textAnchor="end" style={{ fill: 'var(--ink)', fontWeight: 600 }}>{last.v} {unit}</text>
      <text className="chart-text" x={L} y={H - 5}>{addD(new Date(), -n + 1).getDate()} {MON[addD(new Date(), -n + 1).getMonth()]}</text>
      <text className="chart-text" x={W - R} y={H - 5} textAnchor="end">сьогодні</text>
    </svg>
  );
}
