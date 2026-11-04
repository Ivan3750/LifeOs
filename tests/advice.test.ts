import { describe, expect, it } from 'vitest';
import { makeState } from '@/lib/seed';
import { adviceCards } from '@/lib/advice';
import { addD, ymd } from '@/lib/util';
import type { State } from '@/lib/types';

const NOW = new Date('2026-03-30T18:00:00');

/** 20 days with a short night every third day, mood following it, and a short night today. */
function world(): State {
  const S = makeState(false); S.meals = [];
  for (let i = 20; i >= 0; i--) {
    const k = ymd(addD(NOW, -i)), short = i % 3 === 0;
    S.health[k] = { water: 6, sleep: short ? 5.2 : 7.8, mood: 0, steps: 0, workout: 20, weight: 0 };
    S.moods.push({ id: 100 + i, t: new Date(k + 'T12:00').getTime(), v: short ? 4 : 8, energy: short ? 1 : 3, tags: [], note: '' });
  }
  return S;
}

describe('advice page', () => {
  it('shows the sleep advice once, even though two engines would speak about it', () => {
    const S = world();
    const r = adviceCards(S, () => [], NOW);
    const sleepy = r.todo.filter(c => c.topic === 'sleep' || c.topic === 'bed');
    expect(sleepy).toHaveLength(1);
    expect(r.todo[0].area).toBe('Здоровʼя');
  });

  it('adds the plain rules (an overdue task) after the history-based advice', () => {
    const S = world();
    S.tasks.push({ id: 1, t: 'Подзвонити', p: 'hi', d: false, due: '2026-03-20' });
    const r = adviceCards(S, () => [], NOW);
    const i = r.todo.findIndex(c => c.id === 'overdue');
    expect(i).toBeGreaterThan(0);
    expect(r.todo[i].reason.length).toBeGreaterThan(20);
    expect(r.todo[i].to).toBe('tasks');
  });

  it('keeps what goes well apart from what to do', () => {
    const S = world();
    S.health[ymd(NOW)] = { water: 6, sleep: 8, mood: 0, steps: 0, workout: 20, weight: 0 };
    const r = adviceCards(S, () => [], NOW);
    expect(r.todo.every(c => c.tone === 'warn')).toBe(true);
    expect(r.good.every(c => c.tone === 'good')).toBe(true);
  });

  it('has nothing from the history without records, only plain reminders for the evening', () => {
    const r = adviceCards(makeState(false), () => [], NOW);
    expect(r.todo.map(c => c.id).sort()).toEqual(['move', 'water']);
    expect(r.good).toEqual([]);
  });
});
