'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { stepsGoal } from '@/lib/score';
import type { HealthField } from '@/lib/types';
import { pctW, TK } from '@/lib/util';
import { Icon } from './Icon';
import { hdayOf } from './shared';

/** One daily mark that is counted with + and − buttons. `goal`: reach it; `cap`: stay under it (coffee, screen). */
type Counter = { f: HealthField; label: string; unit: string; steps: number[]; goal?: number; cap?: number; hint: string; typed?: boolean };

const COUNTERS = (goalSteps: number): Counter[] => [
  { f: 'steps', label: 'Кроки', unit: 'кроків', steps: [1000, 3000], goal: goalSteps, hint: `ціль ${goalSteps.toLocaleString('uk')}`, typed: true },
  { f: 'veg', label: 'Овочі, фрукти', unit: 'порцій', steps: [1], goal: 5, hint: 'ціль 5' },
  { f: 'outdoor', label: 'На вулиці', unit: 'хв', steps: [15, 30], goal: 30, hint: 'ціль 30 хв' },
  { f: 'mind', label: 'Тиша й дихання', unit: 'хв', steps: [5, 10], goal: 10, hint: 'ціль 10 хв' },
  { f: 'coffee', label: 'Кава', unit: 'чашок', steps: [1], cap: 3, hint: 'до 3' },
  { f: 'screen', label: 'Екран, дозвілля', unit: 'год', steps: [0.5, 1], cap: 4, hint: 'до 4 год' },
];

function CounterTile({ c, k }: { c: Counter; k: string }) {
  const { S, A } = useStore();
  const v = hdayOf(S, k)[c.f] || 0;
  const [typed, setTyped] = useState('');
  const over = c.cap != null && v > c.cap, done = c.goal != null && v >= c.goal;
  const base = c.goal ?? c.cap ?? 1;
  const show = Number.isInteger(v) ? v.toLocaleString('uk') : v.toFixed(1);
  const save = () => { const n = +typed.replace(',', '.'); if (typed.trim() && n >= 0) A.setH(c.f, n, k); setTyped(''); };
  return (
    <div className="tile">
      <div className="lab"><span>{c.label}</span><span>{c.hint}</span></div>
      <div className="tv num">{show}<small>{c.unit}</small></div>
      <div className="bar"><i style={{ width: pctW(v, base) + '%', background: over ? 'var(--m1)' : done ? 'var(--good)' : 'var(--accent)' }} /></div>
      {c.typed && (
        <input className="tinyin" type="number" min="0" inputMode="numeric" value={typed} placeholder="Ввести число" aria-label={`${c.label}: ввести число`}
          onChange={e => setTyped(e.target.value)} onBlur={save} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
      )}
      <div className="step">
        <button className="sq" aria-label={`${c.label}: мінус`} disabled={!v} onClick={() => A.addH(c.f, -c.steps[0], k)}>−</button>
        {c.steps.map(n => <button key={n} onClick={() => A.addH(c.f, n, k)}>+{n}</button>)}
      </div>
    </div>
  );
}

function PulseTile({ k }: { k: string }) {
  const { S, A } = useStore();
  const p = hdayOf(S, k).pulse || 0;
  const [v, setV] = useState(p ? String(p) : '');
  return (
    <div className="tile">
      <div className="lab"><span>Пульс у спокої</span><span>вранці</span></div>
      <div className="tv num">{p || '—'}<small>{p ? 'уд/хв' : ''}</small></div>
      <label className="field" htmlFor="hPulse" style={{ marginTop: 'auto' }}>Записати пульс
        <input id="hPulse" type="number" min="0" max="250" inputMode="numeric" value={v} placeholder="62" onChange={e => setV(e.target.value)} onBlur={() => A.setH('pulse', Math.round(+v) || 0, k)} />
      </label>
    </div>
  );
}

function VitaminsTile({ k }: { k: string }) {
  const { S, A } = useStore();
  const on = !!hdayOf(S, k).vitamins;
  return (
    <div className="tile">
      <div className="lab"><span>Вітаміни й ліки</span><span>{on ? 'прийнято' : 'ще ні'}</span></div>
      <button className={`takebtn${on ? ' on' : ''}`} aria-pressed={on} onClick={() => A.setH('vitamins', on ? 0 : 1, k)}>
        <span className="chk-big">{on && <Icon n="check" />}</span>{on ? 'Прийняв сьогодні' : 'Відмітити прийом'}
      </button>
    </div>
  );
}

/** The rest of the day's body marks: steps, food, fresh air, calm, coffee, screen, pulse, vitamins. */
export function HealthExtras({ k = TK() }: { k?: string }) {
  const { S } = useStore();
  return (
    <div className="life">
      {COUNTERS(stepsGoal(S)).map(c => <CounterTile key={c.f + k} c={c} k={k} />)}
      <PulseTile key={'p' + k} k={k} />
      <VitaminsTile k={k} />
    </div>
  );
}
