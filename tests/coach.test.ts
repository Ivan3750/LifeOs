import { describe, expect, it } from 'vitest';
import { makeState } from '@/lib/seed';
import { chains, coach, coachRows, links } from '@/lib/coach';
import { addD, ymd } from '@/lib/util';
import type { State } from '@/lib/types';

const NOW = new Date('2026-03-30T18:00:00');
const hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** 24 days where a short night makes tasks slow, the evening late and the mood low: the chain the advice page should find. */
function world(): State {
  const S = makeState(false); S.meals = [];
  const wob = (i: number, a: number) => (((i * 37) % 11) / 10 - 0.5) * a; // fixed small «noise»
  const sleep = (i: number) => (i % 3 === 0 ? 5.5 : 8) + wob(i, 0.3);
  for (let i = 24; i >= 0; i--) {
    const d = addD(NOW, -i), k = ymd(d), short = sleep(i) < 6.5;
    const prevShort = sleep(i + 1) < 6.5;
    S.health[k] = { water: 6, sleep: Math.round(sleep(i) * 10) / 10, mood: 0, steps: 0, workout: 20, weight: 0, bed: hm(Math.round(1410 + (prevShort ? 100 : 0) + wob(i, 20))), wake: '07:30' };
    const m = (short ? 4 : 7) + wob(i, 0.4);
    S.moods.push({ id: 1000 + i, t: new Date(k + 'T12:00').getTime(), v: Math.round(m * 10) / 10, energy: 3, tags: [], note: '' });
    // tasks done that day and the focus spent on them: a short night makes every task take longer
    const done = 3, pace = short ? 60 : 25;
    S.sessions.push({ t: new Date(k + 'T09:00').getTime(), m: done * pace });
    for (let j = 0; j < done; j++) S.tasks.push({ id: 2000 + i * 10 + j, t: `t${i}-${j}`, p: 'lo', d: true, doneAt: new Date(k + 'T15:00').getTime() });
  }
  return S;
}

describe('advice system', () => {
  it('makes a row of numbers per day, with the evening bedtime taken from the next day', () => {
    const S = world(), rows = coachRows(S, () => [], 10, NOW);
    expect(rows).toHaveLength(10);
    const r = rows[3], next = S.health[rows[4].k].bed!;
    expect(r.bedTonight).toBe(Number(next.slice(0, 2)) * 60 + Number(next.slice(3)) + (Number(next.slice(0, 2)) < 12 ? 1440 : 0));
    expect(rows[9].bedTonight).toBeNull();
    expect(r.taskPace).toBeCloseTo(r.focus! / r.tasks!);
  });

  it('finds that short sleep slows tasks, delays the evening and lowers the mood', () => {
    const ls = links(coachRows(world(), () => [], 60, NOW)), ids = ls.map(l => l.id);
    expect(ids).toContain('sleep-mood-0');
    expect(ids).toContain('sleep-taskPace-0');
    expect(ids).toContain('sleep-bedTonight-0');
    const pace = ls.find(l => l.id === 'sleep-taskPace-0')!;
    expect(pace.badSide).toBe('low'); expect(pace.bad.avg).toBeGreaterThan(pace.good.avg);
  });

  it('joins links into a chain that starts with something you can change', () => {
    const ch = chains(links(coachRows(world(), () => [], 60, NOW)));
    expect(ch.length).toBeGreaterThan(0);
    expect(ch.every(c => c.steps.length >= 2 && c.steps[0].d === c.root)).toBe(true);
    expect(ch.some(c => c.root === 'sleep')).toBe(true);
  });

  it('does not invent links from noise or from too few days', () => {
    const S = makeState(false); S.meals = [];
    for (let i = 4; i >= 0; i--) S.health[ymd(addD(NOW, -i))] = { water: 5, sleep: 7 + i * 0.1, mood: 0, steps: 0, workout: 0, weight: 0 };
    expect(links(coachRows(S, () => [], 60, NOW))).toEqual([]);
  });

  it('warns about a short night today, with the numbers of earlier days, and says why', () => {
    const S = world(); S.health[ymd(NOW)] = { ...S.health[ymd(NOW)], sleep: 5.2 };
    const tip = coach(S, () => [], NOW).tips.find(t => t.id === 'short-sleep')!;
    expect(tip.title).toContain('5,2');
    expect(tip.facts.some(f => f.includes('У такі дні'))).toBe(true);
    expect(tip.why.length).toBeGreaterThan(40); expect(tip.action).toContain('лягай');
  });

  it('notices overdue tasks and leads and unpaid invoices from other parts of the app', () => {
    const S = makeState(false); S.meals = [];
    S.tasks.push({ id: 1, t: 'Старе', p: 'lo', d: false, due: '2026-03-01' });
    S.co.leads.push({ id: 2, name: 'Клієнт', contact: '', source: '', status: 'new', value: 0, next: '2026-03-20', note: '', created: '2026-03-01' });
    S.co.invoices.push({ id: 3, no: '1', client: 'X', amt: 100, issued: '2026-03-01', due: '2026-03-10', paid: false, paidAt: '' });
    const ids = coach(S, () => [], NOW).tips.map(t => t.id);
    expect(ids).toEqual(expect.arrayContaining(['overdue', 'leads', 'invoices']));
  });
});
