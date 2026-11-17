import { describe, expect, it } from 'vitest';
import { makeState } from '@/lib/seed';
import { stepsOn, stepsWord, usualSteps, weekSteps } from '@/lib/momentum';

const K = '2026-03-18';
const at = (h: number) => new Date(`${K}T${String(h).padStart(2, '0')}:00:00`).getTime();

describe('steps', () => {
  it('an empty day is zero steps and a kind word, never negative', () => {
    const r = stepsOn(makeState(false), K);
    expect(r.total).toBe(0);
    expect(stepsWord(0)).toBe('Новий день, чистий аркуш');
  });

  it('counts what was done: focus per 20 minutes, tasks, habits, people, needs', () => {
    const S = makeState(false);
    S.tasks.push({ id: 1, t: 'a', p: 'lo', d: true, doneAt: at(10) }, { id: 2, t: 'b', p: 'lo', d: true, doneAt: at(11) }, { id: 3, t: 'c', p: 'lo', d: false });
    S.habits.push({ id: 4, name: 'x', days: { [K]: 1 } });
    S.people.push({ id: 5, name: 'Анна', kind: 'friend', every: 14 });
    S.touches.push({ id: 6, person: 5, date: K, kind: 'msg' });
    S.needLog.push({ id: 7, need: 3, date: K, t: at(12) });
    const r = stepsOn(S, K, 65);
    expect(r.parts.find(p => p.key === 'focus')!.n).toBe(3);
    expect(r.parts.find(p => p.key === 'tasks')!.n).toBe(2);
    expect(r.total).toBe(3 + 2 + 1 + 1 + 1);
  });

  it('movement counts once, however it was marked', () => {
    const S = makeState(false);
    S.daily[K] = { move: 1 };
    S.health[K] = { water: 0, sleep: 0, mood: 0, steps: 0, workout: 30, weight: 0 };
    S.needLog.push({ id: 7, need: 1, date: K, t: at(16) });
    const r = stepsOn(S, K);
    expect(r.parts.filter(p => p.key === 'move')).toHaveLength(1);
    expect(r.total).toBe(1);
  });

  it('compares only with your own usual days, with a floor for a fresh start', () => {
    const S = makeState(false);
    expect(usualSteps(S, K)).toBe(4);
    for (let i = 1; i <= 6; i++) S.daily[`2026-03-${String(18 - i).padStart(2, '0')}`] = { move: 1, nov: 1 };
    // two steps a day are below the floor
    expect(usualSteps(S, K)).toBe(4);
    const days = Object.fromEntries([...Array(6)].map((_, i) => [`2026-03-${String(17 - i).padStart(2, '0')}`, 1 as const]));
    for (let i = 1; i <= 4; i++) S.habits.push({ id: i, name: 'h' + i, days });
    expect(usualSteps(S, K)).toBe(5);
  });

  it('gives seven days ending on the given day', () => {
    const S = makeState(false);
    S.daily[K] = { move: 1 };
    const w = weekSteps(S, K);
    expect(w).toHaveLength(7);
    expect(w[6]).toEqual({ k: K, n: 1 });
    expect(w[0].k).toBe('2026-03-12');
  });
});
