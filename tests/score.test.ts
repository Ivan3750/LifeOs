import { describe, expect, it } from 'vitest';
import { dayScore, freeTime, isWorkDay, sleepRhythm } from '@/lib/score';
import { makeState } from '@/lib/seed';
import { addD, ymd } from '@/lib/util';
import type { State } from '@/lib/types';

/** A blank state with a fixed "now" on a Wednesday afternoon. */
const NOW = new Date('2026-03-18T15:00:00').getTime();
const K = '2026-03-18';
const blank = (): State => {
  const s = makeState(false);
  s.dayStart = '08:00'; s.dayEnd = '23:00'; s.dayFromSleep = false; s.meals = []; s.goal = 10;
  s.workDays = [true, true, true, true, true, false, false];
  return s;
};

describe('dayScore', () => {
  it('judges nothing when nothing was ever recorded', () => {
    expect(dayScore(blank(), K, [], [], NOW).total).toBeNull();
  });

  it('judges nothing for a day in the future', () => {
    const s = blank(); s.health[K] = { water: 8, sleep: 8, mood: 0, steps: 0, workout: 30, weight: 0 };
    expect(dayScore(s, ymd(addD(new Date(K + 'T00:00'), 2)), [], [], NOW).total).toBeNull();
  });

  it('gives full marks to a finished day with everything done', () => {
    const s = blank(), day = '2026-03-17';
    s.health[day] = { water: 8, sleep: 8, mood: 0, steps: 0, workout: 30, weight: 0 };
    s.habits.push({ id: 1, name: 'h', days: { [day]: 1 } });
    s.moods.push({ id: 2, t: new Date(day + 'T12:00').getTime(), v: 8, energy: 3, tags: [], note: '' });
    const t = new Date(day + 'T09:00').getTime();
    s.sessions.push({ t, m: 300 });
    const r = dayScore(s, day, [], s.sessions, NOW);
    expect(r.total).toBe(100);
  });

  it('does not punish a sick day for missing work', () => {
    const s = blank(), day = '2026-03-17';
    s.health[day] = { water: 8, sleep: 9, mood: 0, steps: 0, workout: 0, weight: 0 };
    s.offDays = { [day]: { kind: 'sick', note: '' } };
    const r = dayScore(s, day, [], [], NOW);
    expect(r.skipped.some(x => x.key === 'focus')).toBe(true);
    expect(r.total).toBe(100);
  });

  it('counts only logged sleep and skips the rest', () => {
    const s = blank();
    s.health[K] = { water: 0, sleep: 7.5, mood: 0, steps: 0, workout: 0, weight: 0 };
    const r = dayScore(s, K, [], [], NOW);
    expect(r.parts.find(p => p.key === 'sleep')?.got).toBe(12);
    expect(r.skipped.some(x => x.key === 'mood')).toBe(true);
  });
});

describe('freeTime', () => {
  it('subtracts events once even when they overlap', () => {
    const s = blank();
    const ev = (id: string, a: string, b: string) => ({ id, date: K, s: a, e: b, title: id, c: 'c1' });
    const t = freeTime(s, '2026-03-17', [ev('a', '10:00', '12:00'), ev('b', '11:00', '13:00')], [], NOW);
    expect(Math.round(t.freeDay)).toBe(15 * 60 - 3 * 60);
  });
});

describe('days and rhythm', () => {
  it('knows work days', () => {
    const s = blank();
    expect(isWorkDay(s, '2026-03-18')).toBe(true);
    expect(isWorkDay(s, '2026-03-21')).toBe(false);
  });
  it('averages bed time across midnight', () => {
    const s = blank();
    s.health['2026-03-16'] = { water: 0, sleep: 0, mood: 0, steps: 0, workout: 0, weight: 0, bed: '23:30', wake: '07:00' };
    s.health['2026-03-17'] = { water: 0, sleep: 0, mood: 0, steps: 0, workout: 0, weight: 0, bed: '00:30', wake: '07:00' };
    s.health['2026-03-15'] = { water: 0, sleep: 0, mood: 0, steps: 0, workout: 0, weight: 0, bed: '00:00', wake: '07:00' };
    const r = sleepRhythm(s, K);
    expect(r.wake).toBe(7 * 60);
    expect(r.bed).toBe(24 * 60);
  });
});
