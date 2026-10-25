'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import type { State, Tx, UiEvent } from '@/lib/types';
import { DAY, daysInMonth, hhmm, money, pctW, sod, sum, TK, toMin, wStart, ymd, addD } from '@/lib/util';
import { dayMood, ENERGY3, energyWord, moodColor, moodsOn, moodWord } from '@/lib/score';
import { budgetDKK, monthOf, sumIn, txDKK } from '@/lib/money';

export const today = () => TK();
export const hdayOf = (S: State, k = TK()) => S.health[k] || { water: 0, sleep: 0, mood: 0, steps: 0, workout: 0, weight: 0, bed: undefined, wake: undefined };
/** This month's income and spending on both accounts, without transfers between them. */
export const monthTx = (S: State) => monthOf(S, TK().slice(0, 7));
/** Sum in kroner; hryvnia records are converted at the current rate. */
export const sumT = (S: State, a: Tx[], type: 'in' | 'out') => sumIn(S, a, type);
export const sumA = (a: { amt: number }[]) => a.reduce((x, i) => x + (+i.amt || 0), 0);
export const dayMinutes = (S: State, d: Date) => { const a = sod(d).getTime(), b = addD(sod(d), 1).getTime(); return S.sessions.filter(s => s.t >= a && s.t < b).reduce((x, s) => x + s.m, 0); };
export const weekMinutes = (S: State, off = 0) => {
  const ws = addD(wStart(), off * 7).getTime(), arr = [0, 0, 0, 0, 0, 0, 0];
  S.sessions.forEach(s => { const i = Math.floor((sod(s.t).getTime() - ws) / DAY); if (i >= 0 && i < 7) arr[i] += s.m; });
  return arr;
};
export const streak = (S: State) => { let n = 0, d = new Date(); if (!dayMinutes(S, d)) d = addD(d, -1); while (dayMinutes(S, d) > 0) { n++; d = addD(d, -1); } return n; };
export const habStreak = (days: Record<string, 1>) => { let n = 0, d = new Date(); if (!days[ymd(d)]) d = addD(d, -1); while (days[ymd(d)]) { n++; d = addD(d, -1); } return n; };
export const loadC = (l: number) => (l >= 100 ? 'var(--m1)' : l >= 80 ? 'var(--accent)' : 'var(--good)');
export const avg = (a: number[]) => (a.length ? sum(a) / a.length : 0);

const QUICK_MOODS: [number, string][] = [[2, 'Погано'], [4, 'Так собі'], [6, 'Нормально'], [8, 'Добре'], [10, 'Чудово']];

/** Quick mood check-in: one tap saves the mood at the current time. Details are added on the Health page. */
function MoodTile() {
  const { S, A, go } = useStore();
  const [askEnergy, setAskEnergy] = useState(false);
  const list = moodsOn(S, TK()), last = list[list.length - 1], avgV = dayMood(S, TK());
  // after a quick mood tap, ask once for the energy of that same check-in
  const setEnergy = (e: number) => { if (last) A.updateMood(last.id, { t: last.t, v: last.v, energy: e, tags: last.tags, note: last.note }); setAskEnergy(false); };
  return (
    <div className="tile">
      <div className="lab"><span>Настрій</span><span>{last ? `${last.v}/10 о ${hhmm(new Date(last.t))}${last.energy ? ' · ' + energyWord(last.energy).toLowerCase() : ''}` : 'не відмічено'}</span></div>
      {askEnergy && last ? (
        <div className="energyask">
          <span>А сил скільки?</span>
          <div>{ENERGY3.map(x => <button key={x.v} title={x.hint} onClick={() => setEnergy(x.v)}>{x.l}</button>)}</div>
        </div>
      ) : (
        <div className="moods">
          {QUICK_MOODS.map(([v, m]) => <button key={v} title={m} aria-label={`Настрій зараз: ${m}`} style={{ ['--mc' as string]: moodColor(v) }} onClick={() => { A.addMood({ t: Date.now(), v, energy: 0, tags: [], note: '' }); setAskEnergy(true); }}>{v / 2}</button>)}
        </div>
      )}
      <div className="muted" style={{ fontSize: 11, marginTop: 'auto', display: 'flex', justifyContent: 'space-between', gap: 6 }}>
        <span>{list.length ? `${list.length} ${list.length === 1 ? 'запис' : 'записи'} · ${moodWord(avgV).toLowerCase()}` : 'як ти зараз?'}</span>
        <button style={{ textDecoration: 'underline', color: 'inherit' }} onClick={() => go('health')}>Детально</button>
      </div>
    </div>
  );
}

/** Bed and wake time of last night; the hours of sleep are counted from them. */
function SleepTile() {
  const { S, A } = useStore();
  const h = hdayOf(S);
  return (
    <div className="tile">
      <div className="lab"><span>Сон</span><span>ціль 8 год</span></div>
      <div className="tv num">{h.sleep || '—'}<small>{h.sleep ? 'год' : ''}</small></div>
      <div className="bar"><i style={{ width: pctW(h.sleep, 8) + '%', background: 'var(--sleep)' }} /></div>
      <div className="sleeptimes">
        <label>Заснув<input type="time" value={h.bed || ''} onChange={e => A.setSleepTimes(e.target.value, h.wake || '')} aria-label="Коли заснув" /></label>
        <label>Прокинувся<input type="time" value={h.wake || ''} onChange={e => A.setSleepTimes(h.bed || '', e.target.value)} aria-label="Коли прокинувся" /></label>
      </div>
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
  const spent = sumT(S, monthTx(S).filter(x => x.date === TK()), 'out'), lim = budgetDKK(S) / daysInMonth();
  return (
    <div className="life">
      <SleepTile />
      <MoodTile />
      {full ? (
        <WeightTile />
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
  const { S } = useStore();
  const by: Record<string, number> = {};
  tx.filter(t => t.type === 'out' && !t.xfer).forEach(t => { by[t.cat] = (by[t.cat] || 0) + txDKK(S, t); });
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

/** Puts overlapping events side by side: each gets a lane and the number of lanes in its group. */
export function lanes(evs: UiEvent[]) {
  const out: { e: UiEvent; lane: number; of: number }[] = [];
  let group: typeof out = [], ends: number[] = [], groupEnd = -1;
  const close = () => { for (const g of group) g.of = ends.length; group = []; ends = []; };
  for (const e of [...evs].sort((a, b) => toMin(a.s) - toMin(b.s) || toMin(b.e) - toMin(a.e))) {
    const s0 = toMin(e.s), e0 = Math.max(toMin(e.e), s0 + 15);
    if (s0 >= groupEnd) close();
    let lane = ends.findIndex(x => x <= s0);
    if (lane < 0) { lane = ends.length; ends.push(e0); } else ends[lane] = e0;
    groupEnd = Math.max(groupEnd, e0);
    const item = { e, lane, of: 1 }; group.push(item); out.push(item);
  }
  close();
  return out;
}
