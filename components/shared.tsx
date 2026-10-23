'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import type { HealthField, State, Tx } from '@/lib/types';
import { DAY, daysInMonth, fmtN, money, MOODC, MOODS, pctW, sod, sum, TK, wStart, ymd, addD } from '@/lib/util';

export const today = () => TK();
export const hdayOf = (S: State, k = TK()) => S.health[k] || { water: 0, sleep: 0, mood: 0, steps: 0, workout: 0, weight: 0 };
export const monthTx = (S: State) => { const mk = TK().slice(0, 7); return S.money.tx.filter(t => t.date.slice(0, 7) === mk); };
export const sumT = (a: Tx[], type: 'in' | 'out') => a.filter(t => t.type === type).reduce((x, t) => x + t.amt, 0);
export const sumA = (a: { amt: number }[]) => a.reduce((x, i) => x + (+i.amt || 0), 0);
export const dayMinutes = (S: State, d: Date) => { const a = sod(d).getTime(); return S.sessions.filter(s => s.t >= a && s.t < a + DAY).reduce((x, s) => x + s.m, 0); };
export const weekMinutes = (S: State, off = 0) => {
  const ws = addD(wStart(), off * 7).getTime(), arr = [0, 0, 0, 0, 0, 0, 0];
  S.sessions.forEach(s => { const i = Math.floor((sod(s.t).getTime() - ws) / DAY); if (i >= 0 && i < 7) arr[i] += s.m; });
  return arr;
};
export const streak = (S: State) => { let n = 0, d = new Date(); if (!dayMinutes(S, d)) d = addD(d, -1); while (dayMinutes(S, d) > 0) { n++; d = addD(d, -1); } return n; };
export const habStreak = (days: Record<string, 1>) => { let n = 0, d = new Date(); if (!days[ymd(d)]) d = addD(d, -1); while (days[ymd(d)]) { n++; d = addD(d, -1); } return n; };
export const loadC = (l: number) => (l >= 100 ? 'var(--m1)' : l >= 80 ? 'var(--accent)' : 'var(--good)');
export const avg = (a: number[]) => (a.length ? sum(a) / a.length : 0);

function StepTile({ f, label, goalTxt, unit, goal, color, dm, dp, plus }: { f: HealthField; label: string; goalTxt: string; unit: string; goal: number; color: string; dm: number; dp: number; plus: string }) {
  const { S, A } = useStore();
  const val = hdayOf(S)[f];
  return (
    <div className="tile">
      <div className="lab"><span>{label}</span><span>{goalTxt}</span></div>
      <div className="tv num">{val >= 1000 ? fmtN(val) : val}<small>{unit}</small></div>
      <div className="bar"><i style={{ width: pctW(val, goal) + '%', background: color }} /></div>
      <div className="step"><button className="sq" onClick={() => A.addH(f, -dm)} aria-label={`Зменшити: ${label}`}>−</button><button onClick={() => A.addH(f, dp)}>{plus}</button></div>
    </div>
  );
}

function MoodTile() {
  const { S, A } = useStore();
  const h = hdayOf(S);
  return (
    <div className="tile">
      <div className="lab"><span>Настрій</span><span>{h.mood ? MOODS[h.mood - 1] : 'не відмічено'}</span></div>
      <div className="moods">
        {MOODS.map((m, i) => <button key={m} title={m} aria-label={`Настрій: ${m}`} aria-pressed={h.mood === i + 1} style={{ ['--mc' as string]: MOODC[i] }} onClick={() => A.setH('mood', i + 1)}>{i + 1}</button>)}
      </div>
      <div className="muted" style={{ fontSize: 11, marginTop: 'auto' }}>1 погано · 5 чудово</div>
    </div>
  );
}

function WeightTile() {
  const { S, A } = useStore();
  const h = hdayOf(S);
  const [v, setV] = useState(h.weight ? String(h.weight) : '');
  return (
    <div className="tile">
      <div className="lab"><span>Вага</span><span>кг</span></div>
      <div className="tv num">{h.weight || '—'}<small>{h.weight ? 'кг' : ''}</small></div>
      <label className="field" htmlFor="hWeight" style={{ marginTop: 'auto' }}>Записати сьогодні
        <input id="hWeight" type="number" step="0.1" min="0" inputMode="decimal" value={v} placeholder="65.0" onChange={e => setV(e.target.value)} onBlur={() => A.setH('weight', +v.replace(',', '.') || 0)} />
      </label>
    </div>
  );
}

export function LifeTiles({ full }: { full: boolean }) {
  const { S, go } = useStore();
  const spent = sumT(S.money.tx.filter(x => x.date === TK()), 'out'), lim = S.money.budget / daysInMonth();
  return (
    <div className="life">
      <StepTile f="water" label="Вода" goalTxt="ціль 8" unit="склянок" goal={8} color="var(--water)" dm={1} dp={1} plus="+ склянка" />
      <StepTile f="sleep" label="Сон" goalTxt="ціль 8 год" unit="год" goal={8} color="var(--sleep)" dm={0.5} dp={0.5} plus="+ 30 хв" />
      <MoodTile />
      <StepTile f="workout" label="Рух" goalTxt="ціль 30 хв" unit="хв" goal={30} color="var(--good)" dm={10} dp={10} plus="+ 10 хв" />
      {full ? (
        <>
          <StepTile f="steps" label="Кроки" goalTxt="ціль 8.000" unit="" goal={8000} color="var(--accent)" dm={1000} dp={1000} plus="+ 1.000" />
          <WeightTile />
        </>
      ) : (
        <div className="tile">
          <div className="lab"><span>Витрати</span><span>ліміт {money(lim)}</span></div>
          <div className="tv num">{money(spent)}</div>
          <div className="bar"><i style={{ width: pctW(spent, lim) + '%', background: spent > lim ? 'var(--m1)' : 'var(--accent)' }} /></div>
          <div className="step"><button onClick={() => go('money')}>+ Записати</button></div>
        </div>
      )}
    </div>
  );
}

export function CatBars({ tx, limit }: { tx: Tx[]; limit: number }) {
  const by: Record<string, number> = {};
  tx.filter(t => t.type === 'out').forEach(t => { by[t.cat] = (by[t.cat] || 0) + t.amt; });
  const arr = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, limit), max = arr.length ? arr[0][1] : 1;
  if (!arr.length) return <p className="muted" style={{ margin: 0 }}>Витрат цього місяця ще немає.</p>;
  return <>{arr.map(([c, v]) => <div className="catrow" key={c}><span>{c}</span><div className="bar"><i style={{ width: pctW(v, max) + '%' }} /></div><span className="num" style={{ textAlign: 'right' }}>{money(v)}</span></div>)}</>;
}

/** Two-click delete: the first click arms the button, the second one deletes. */
export function DelBtn({ onDelete, label }: { onDelete: () => void; label: string }) {
  const { toast } = useStore();
  const [armed, setArmed] = useState(false);
  return (
    <button className="x" aria-label={label} style={armed ? { color: 'var(--m1)', opacity: 1 } : undefined}
      onClick={() => { if (armed) onDelete(); else { setArmed(true); toast('Натисни ще раз, щоб видалити'); setTimeout(() => setArmed(false), 3000); } }}>
      <span className="icn" dangerouslySetInnerHTML={{ __html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>' }} />
    </button>
  );
}
