'use client';

import type { ReactNode } from 'react';
import { useNow, useStore } from '@/lib/store';
import { byHunger, HUNGER_COLOR, type NeedStat } from '@/lib/needs';
import type { Plan } from '@/lib/planner';
import { rhythmOf } from '@/lib/goalplan';
import { machinePlan } from '@/lib/machine';
import { overdue, suggestPerson } from '@/lib/people';
import { stepsOn, stepsWord, stepsTone, usualSteps, weekSteps } from '@/lib/momentum';
import { DN, plural, TK, weekdayIdx } from '@/lib/util';
import { Icon } from './Icon';
import { NeedBar, sinceWord } from './needs';

const polar = (cx: number, cy: number, r: number, deg: number) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)] as const;
/** A ring segment between two radii and two angles. */
function sector(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) {
  const [x0, y0] = polar(cx, cy, r1, a0), [x1, y1] = polar(cx, cy, r1, a1), [x2, y2] = polar(cx, cy, r0, a1), [x3, y3] = polar(cx, cy, r0, a0);
  const big = a1 - a0 > 180 ? 1 : 0;
  return `M${x0.toFixed(1)},${y0.toFixed(1)} A${r1},${r1} 0 ${big} 1 ${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)} A${r0},${r0} 0 ${big} 0 ${x3.toFixed(1)},${y3.toFixed(1)}Z`;
}
const short = (name: string) => { const w = name.split(/[\s(]/)[0]; return w.length > 9 ? w.slice(0, 8) + '…' : w; };

/** The compass of the week: one petal per need, as long as the part of the week's target that is done. In the middle: steps today. */
export function Compass({ stats, steps }: { stats: NeedStat[]; steps: number }) {
  const { go } = useStore();
  const n = stats.length, C = 150, R = 104, r0 = 40, gap = 4;
  return (
    <button className="compass" onClick={() => go('needs')} aria-label="Потреби тижня: відкрити">
      <svg viewBox="0 0 300 300" role="img" aria-label={stats.map(s => `${s.need.name}: ${s.done} з ${s.need.weekly}`).join('; ') || 'Потреб немає'}>
        {stats.map((s, i) => {
          const a0 = -90 + (i * 360) / n + gap / 2, a1 = -90 + ((i + 1) * 360) / n - gap / 2, p = Math.min(1, s.need.weekly ? s.done / s.need.weekly : 1);
          const mid = (a0 + a1) / 2, [lx, ly] = polar(C, C, R + 12, mid), cos = Math.cos((mid * Math.PI) / 180);
          return (
            <g key={s.need.id}>
              <path d={sector(C, C, r0, R, a0, a1)} className="cp-track" style={{ fill: HUNGER_COLOR[s.status] }} />
              <path d={sector(C, C, r0, r0 + (R - r0) * Math.max(0.07, p), a0, a1)} fill={HUNGER_COLOR[s.status]} className="cp-petal"><title>{s.need.name}: {s.done} з {s.need.weekly}</title></path>
              <text x={lx} y={ly} className="cp-l" textAnchor={Math.abs(cos) < 0.25 ? 'middle' : cos > 0 ? 'start' : 'end'} dominantBaseline="middle">{short(s.need.name)}</text>
            </g>
          );
        })}
        <text x={C} y={C - 2} textAnchor="middle" className="cp-n">{steps}</text>
        <text x={C} y={C + 15} textAnchor="middle" className="cp-s">{plural(steps, 'крок', 'кроки', 'кроків')}</text>
      </svg>
    </button>
  );
}

/** Steps: what was done today, counted upwards. Never a mark, never red. */
export function StepsCard({ cls = 's5', stats, worked }: { cls?: string; stats: NeedStat[]; worked: (k: string) => number }) {
  const { S, A, go } = useStore();
  const now = useNow(60_000), k = TK();
  const r = stepsOn(S, k, worked(k)), usual = usualSteps(S, k, worked), week = weekSteps(S, k, worked);
  const top = Math.max(usual, ...week.map(w => w.n), 1), ti = weekdayIdx(new Date(now));
  const hungry = [...stats].sort(byHunger).filter(s => s.status !== 'ok')[0];
  const ideas: { key: string; label: string; run: () => void }[] = [];
  if (hungry) ideas.push({ key: 'need', label: `${hungry.need.name}: відмітити`, run: () => A.logNeed(hungry.need.id) });
  if (!(S.health[k]?.water >= 1)) ideas.push({ key: 'water', label: 'Склянка води', run: () => A.addH('water', 1) });
  if (!r.parts.some(p => p.key === 'mood')) ideas.push({ key: 'mood', label: 'Записати настрій', run: () => go('health') });
  const more = ideas.slice(0, 3);
  return (
    <div className={`card ${cls}`} id="steps-card">
      <div className="ch">
        <Icon n="trophy" className="ic" />
        <div><h3>Кроки сьогодні</h3><p>Рахується тільки зроблене. Жодних мінусів</p></div>
      </div>
      <div className="stepsbig">
        <b className="num" style={{ color: stepsTone(r.total, usual) }}>{r.total}</b>
        <div><span>{stepsWord(r.total)}</span><small>{r.total >= usual ? 'Це не менше за твій звичний день' : `Твій звичний день: ${usual}`}</small></div>
      </div>
      <div className="stepsweek" aria-label="Кроки за 7 днів">
        {week.map((w, i) => <div key={w.k} className={w.k === k ? 'today' : ''}><i style={{ height: Math.max(4, (w.n / top) * 54) }} /><span>{DN[(ti - 6 + i + 7) % 7][0]}</span></div>)}
      </div>
      {r.parts.length > 0 && <div className="stepchips">{r.parts.map(p => <button key={p.key} className="chipx" onClick={() => go(p.go)}>{p.label}{p.n > 1 ? ` ×${p.n}` : ''}</button>)}</div>}
      {more.length > 0 && (
        <div className="stepmore">
          <span className="muted">Що додасть ще крок</span>
          {more.map(m => <button key={m.key} className="chip" onClick={m.run}><Icon n="plus" className="icn sm" />{m.label}</button>)}
        </div>
      )}
    </div>
  );
}

/** The goals with their weekly rhythm: the part of the big picture that is done this week. */
export function GoalsRhythm({ cls = 's7', stats }: { cls?: string; stats: NeedStat[] }) {
  const { S, go } = useStore();
  const rows = S.goals.map(g => ({ g, rh: rhythmOf(stats, g.id), money: S.machines.filter(m => m.goal === g.id) })).filter(x => x.rh.needs.length || x.money.length)
    .sort((a, b) => a.rh.share - b.rh.share).slice(0, 4);
  return (
    <div className={`card ${cls}`}>
      <div className="ch"><Icon n="goals" className="ic" /><div><h3>Цілі й тижневий ритм</h3><p>{rows.length ? 'Що цього тижня робиш для кожної цілі' : 'Ціль без щотижневих дій лишається мрією'}</p></div><button className="sel" onClick={() => go('goals')}>Усі цілі</button></div>
      <div className="list">
        {rows.map(({ g, rh, money }) => (
          <button className="grhythm" key={g.id} onClick={() => go('goals')}>
            <span className="gh-top"><b>{g.title}</b><span className="num muted">{rh.needs.length ? `${Math.round(rh.share * 100)}%` : ''}</span></span>
            {rh.needs.length > 0 && <span className="gh-bars">{rh.needs.map(s => <span key={s.need.id} className="gh-n"><em>{s.need.name}</em><NeedBar st={s} /></span>)}</span>}
            {money.map(m => <small key={m.id} className="muted">«{m.title}»: цього тижня зроблено {Math.round(machinePlan(m).share * 100)}%</small>)}
          </button>
        ))}
        {!rows.length && (
          <div className="emptyline">
            <span>{S.goals.length ? 'У цілей ще немає щотижневих дій. Додай їх у картці цілі.' : 'Почни з готової цілі: вона одразу отримає ритм на тиждень.'}</span>
            <button className="btn acc sm" onClick={() => go('goals')}>{S.goals.length ? 'До цілей' : 'Швидкий початок'}</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Who is waiting for a message or a meeting. */
export function PeopleNudge({ cls = 's5' }: { cls?: string }) {
  const { S, A, go } = useStore();
  const today = TK(), sug = suggestPerson(S, today);
  const list = [...S.people].sort((a, b) => overdue(S, b, today) - overdue(S, a, today)).slice(0, 3);
  return (
    <div className={`card ${cls}`}>
      <div className="ch"><Icon n="team" className="ic" /><div><h3>Люди</h3><p>{sug ? 'Кому давно не писав' : 'З ким хочеш бути на зв’язку'}</p></div><button className="sel" onClick={() => go('people')}>Усі</button></div>
      <div className="list">
        {list.map(p => {
          const ratio = overdue(S, p, today), last = S.touches.filter(t => t.person === p.id).map(t => t.date).sort().at(-1);
          const days = last ? Math.max(0, Math.round((new Date(today + 'T00:00').getTime() - new Date(last + 'T00:00').getTime()) / 864e5)) : null;
          return (
            <div className={`item hg ${ratio >= 1 ? 'warn' : 'ok'}`} key={p.id}>
              <span className="ndot" aria-hidden="true" />
              <span className="t"><b>{p.name}</b><small>{sinceWord(days)}</small></span>
              <button className="btn ghost sm" onClick={() => A.addTouch(p.id, 'msg')}>Написав</button>
            </div>
          );
        })}
        {!list.length && <div className="emptyline"><span>Додай кількох людей, і я підкажу, кому написати.</span><button className="btn acc sm" onClick={() => go('people')}>Додати</button></div>}
      </div>
    </div>
  );
}

/** What to say at the top of the home screen: a headline and the reason for it. */
export function headline(stats: NeedStat[], plan: Plan | null, motto: string | undefined, name: string): { title: string; sub: string; slot?: Plan['slots'][number]; need?: NeedStat } {
  const need = [...stats].sort(byHunger).find(s => s.status !== 'ok');
  if (!need) return { title: motto?.trim() || 'Усе рухається. Тримай темп', sub: stats.length ? 'Усі потреби цього тижня в нормі. Можна просто жити.' : 'Увімкни потреби, і я підкажу, що робити.' };
  const slot = plan?.slots.find(x => x.need === need.need.id && x.date === TK());
  const left = Math.max(0, need.need.weekly - need.done);
  const title = need.status === 'red' ? `${need.need.name} чекає на тебе, ${name}` : `Час для: ${need.need.name}`;
  const sub = `Цього тижня ${need.done} з ${need.need.weekly}, лишилось ${left}.${slot ? ` Є вільне вікно ${slot.s}–${slot.e}.` : ''}`;
  return { title, sub, slot, need };
}

export const Eyebrow = ({ children }: { children: ReactNode }) => <div className="eyebrow">{children}</div>;
