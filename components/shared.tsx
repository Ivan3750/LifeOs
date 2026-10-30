'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { Icon, type IconName } from './Icon';
import { Face } from './Face';
import type { State, Tx, UiEvent } from '@/lib/types';
import { DAY, daysInMonth, hhmm, money, pctW, sod, sum, TK, toMin, wStart, ymd, addD } from '@/lib/util';
import { dayMood, moveGoal, waterGoal, ENERGY3, energyWord, moodsOn, moodWord } from '@/lib/score';
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
/** Days marked sick or emergency neither add to a streak nor break it. */
const paused = (S: State, d: Date) => { const k = S.offDays?.[ymd(d)]?.kind; return k === 'sick' || k === 'urgent'; };
export const streak = (S: State) => {
  let n = 0, d = new Date(), guard = 0;
  if (!dayMinutes(S, d) && !paused(S, d)) d = addD(d, -1);
  while (guard++ < 4000 && (dayMinutes(S, d) > 0 || paused(S, d))) { if (dayMinutes(S, d) > 0) n++; d = addD(d, -1); }
  return n;
};
export const habStreak = (days: Record<string, 1>, S?: State) => {
  let n = 0, d = new Date(), guard = 0;
  const skip = (x: Date) => !days[ymd(x)] && !!S && paused(S, x);
  if (!days[ymd(d)] && !skip(d)) d = addD(d, -1);
  while (guard++ < 4000 && (days[ymd(d)] || skip(d))) { if (days[ymd(d)]) n++; d = addD(d, -1); }
  return n;
};
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
          {QUICK_MOODS.map(([v, m]) => <button key={v} title={m} aria-label={`Настрій зараз: ${m}`} onClick={() => { A.addMood({ t: Date.now(), v, energy: 0, tags: [], note: '' }); setAskEnergy(true); }}><Face v={v} size={30} /></button>)}
        </div>
      )}
      <div className="muted" style={{ fontSize: 11, marginTop: 'auto', display: 'flex', justifyContent: 'space-between', gap: 6 }}>
        <span>{list.length ? `${list.length} ${list.length === 1 ? 'запис' : 'записи'} · ${moodWord(avgV).toLowerCase()}` : 'як ти зараз?'}</span>
        <button style={{ textDecoration: 'underline', color: 'inherit' }} onClick={() => go('health')}>Детально</button>
      </div>
    </div>
  );
}

/** Bed and wake time of the night that ended on day k; the hours of sleep are counted from them (or typed in). */
function SleepTile({ k }: { k: string }) {
  const { S, A } = useStore();
  const h = hdayOf(S, k);
  return (
    <div className="tile">
      <div className="lab"><span>Сон</span><span>ціль 8 год</span></div>
      <div className="tv num">{h.sleep || '—'}<small>{h.sleep ? 'год' : ''}</small></div>
      <div className="bar"><i style={{ width: pctW(h.sleep, 8) + '%', background: 'var(--sleep)' }} /></div>
      <div className="sleeptimes">
        <label>Заснув<input type="time" value={h.bed || ''} onChange={e => A.setSleepTimes(e.target.value, h.wake || '', k)} aria-label="Коли заснув" /></label>
        <label>Прокинувся<input type="time" value={h.wake || ''} onChange={e => A.setSleepTimes(h.bed || '', e.target.value, k)} aria-label="Коли прокинувся" /></label>
      </div>
      {!(h.bed && h.wake) && <NumBox key={k + 'sl'} label="Або годин сну" value={h.sleep} step={0.5} max={16} onSave={n => A.setH('sleep', n, k)} />}
    </div>
  );
}

/** A small number field that saves when you leave it, so typing "7,5" does not save "7" first. */
function NumBox({ label, value, step, max, onSave }: { label: string; value: number; step: number; max: number; onSave: (n: number) => void }) {
  const [v, setV] = useState(value ? String(value) : '');
  return (
    <label className="field" style={{ fontSize: 11 }}>{label}
      <input type="number" min="0" max={max} step={step} inputMode="decimal" value={v} placeholder="0" onChange={e => setV(e.target.value)}
        onBlur={() => { const n = +v.replace(',', '.') || 0; onSave(n); setV(n ? String(Math.min(max, Math.max(0, n))) : ''); }} />
    </label>
  );
}

/** Water in glasses (250 ml). Tap a glass to fill up to it; tap the last full glass again to take one away. */
function WaterTile({ k }: { k: string }) {
  const { S, A } = useStore();
  const w = hdayOf(S, k).water, goal = waterGoal(S), n = Math.max(goal, Math.min(20, Math.ceil(w)));
  return (
    <div className="tile">
      <div className="lab"><span>Вода</span><span>ціль {goal} · {goal * 0.25} л</span></div>
      <div className="tv num">{w}<small>з {goal} · {Math.round(w * 250) / 1000} л</small></div>
      <div className="glasses" role="group" aria-label="Склянки води">
        {[...Array(n)].map((_, i) => <button key={i} className={i < w ? 'on' : ''} aria-pressed={i < w} aria-label={`${i + 1} склянка`} onClick={() => A.setH('water', i + 1 === w ? i : i + 1, k)} />)}
      </div>
      {k === TK() && (() => { const h = new Date().getHours() + new Date().getMinutes() / 60, due = Math.round(goal * Math.min(1, Math.max(0, (h - 8) / 14))); return <div className="muted" style={{ fontSize: 11 }}>{w >= goal ? 'Норму виконано' : w >= due ? `Не відстаєш (до цього часу ≈ ${due})` : `До цього часу варто ≈ ${due}, ще ${due - Math.floor(w)}`}</div>; })()}
      <div className="step"><button className="sq" aria-label="Мінус склянка" disabled={!w} onClick={() => A.addH('water', -1, k)}>−</button><button onClick={() => A.addH('water', 1, k)}>+ склянка</button></div>
    </div>
  );
}

/** Minutes of movement (walk, sport, workout) for the day. */
function MoveTile({ k }: { k: string }) {
  const { S, A } = useStore();
  const m = hdayOf(S, k).workout, goal = moveGoal(S);
  return (
    <div className="tile">
      <div className="lab"><span>Рух</span><span>ціль {goal} хв</span></div>
      <div className="tv num">{m}<small>хв</small></div>
      <div className="bar"><i style={{ width: pctW(m, goal) + '%', background: m >= goal ? 'var(--good)' : 'var(--accent)' }} /></div>
      <div className="step"><button className="sq" aria-label="Мінус 10 хвилин" disabled={!m} onClick={() => A.addH('workout', -10, k)}>−10</button><button onClick={() => A.addH('workout', 10, k)}>+10</button><button onClick={() => A.addH('workout', 30, k)}>+30</button></div>
    </div>
  );
}

function WeightTile({ k }: { k: string }) {
  const { S, A } = useStore();
  const h = hdayOf(S, k);
  const [v, setV] = useState(h.weight ? String(h.weight) : '');
  return (
    <div className="tile">
      <div className="lab"><span>Вага</span><span>кг</span></div>
      <div className="tv num">{h.weight || '—'}<small>{h.weight ? 'кг' : ''}</small></div>
      <label className="field" htmlFor="hWeight" style={{ marginTop: 'auto' }}>Записати вагу
        <input id="hWeight" type="number" step="0.1" min="0" inputMode="decimal" value={v} placeholder="65.0" onChange={e => setV(e.target.value)} onBlur={() => A.setH('weight', +v.replace(',', '.') || 0, k)} />
      </label>
    </div>
  );
}

/** Tiles for one day (today unless k is given). Mood check-ins are only for the present moment. */
export function LifeTiles({ full, k = TK() }: { full: boolean; k?: string }) {
  const { S, go } = useStore();
  const isToday = k === TK();
  const spent = sumT(S, monthTx(S).filter(x => x.date === TK()), 'out'), lim = budgetDKK(S) / daysInMonth();
  return (
    <div className="life">
      <SleepTile k={k} />
      {isToday && <MoodTile />}
      <WaterTile k={k} />
      <MoveTile k={k} />
      {full ? (
        <WeightTile key={k} k={k} />
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
/** Deletes at once: every deletion offers «Скасувати» in the message at the bottom, so asking twice is not needed. */
export function DelBtn({ onDelete, label }: { onDelete: () => void; label: string }) {
  return <button className="ib danger" title={label} aria-label={label} onClick={onDelete}><Icon n="trash" /></button>;
}

/** Small round button with an icon: edit, delete, focus… The same size and hover everywhere. */
export function IconBtn({ icon, label, onClick, tone, pressed }: { icon: IconName; label: string; onClick: () => void; tone?: 'danger' | 'acc'; pressed?: boolean }) {
  return <button className={`ib${tone ? ' ' + tone : ''}`} title={label} aria-label={label} aria-pressed={pressed} onClick={onClick}><Icon n={icon} /></button>;
}

/** What a list shows when there is nothing in it: say what it is for and offer the first step. */
export function Empty({ icon, title, text, children }: { icon: IconName; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="empty-st">
      <span className="ei"><Icon n={icon} /></span>
      <b>{title}</b>
      {text && <p>{text}</p>}
      {children}
    </div>
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
