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
    expect(r.parts.find(p => p.key === 'sleep')?.got).toBe(15);
    expect(r.skipped.some(x => x.key === 'sleepreg')).toBe(true);
    expect(r.skipped.some(x => x.key === 'mood')).toBe(true);
  });
});

describe('dayScore: steady sleep, business and social media', () => {
  const day = '2026-03-17';
  const night = (bed: string, wake: string, sleep = 8) => ({ water: 0, sleep, mood: 0, steps: 0, workout: 0, weight: 0, bed, wake });

  it('rewards going to bed on time and waking up on time, not only sleeping long', () => {
    const good = blank(); good.health[day] = night('23:40', '07:30');
    const late = blank(); late.health[day] = night('02:30', '10:30');
    const g = dayScore(good, day, [], [], NOW), l = dayScore(late, day, [], [], NOW);
    expect(g.parts.find(p => p.key === 'sleepreg')?.got).toBe(10);
    expect(l.parts.find(p => p.key === 'sleepreg')?.got).toBe(0);
    // both slept 8 hours, so the length part is the same
    expect(l.parts.find(p => p.key === 'sleep')?.got).toBe(15);
  });

  it('counts time logged on the business as work', () => {
    const s = blank(); s.health[day] = night('23:30', '07:30');
    s.activities.push({ id: 5, kind: 'Бізнес', title: '', start: new Date(day + 'T10:00').getTime(), end: new Date(day + 'T14:00').getTime() });
    const r = dayScore(s, day, [], [], NOW);
    expect(r.parts.find(p => p.key === 'focus')?.got).toBe(25);
    expect(r.parts.some(p => p.key === 'biz')).toBe(false);
  });

  it('judges social media against the limit of each platform', () => {
    const s = blank(); s.health[day] = night('23:30', '07:30');
    s.social.push({ id: 1, date: day, platform: 'Instagram', min: 30 }, { id: 2, date: day, platform: 'YouTube', min: 40 });
    expect(dayScore(s, day, [], [], NOW).parts.find(p => p.key === 'social')?.got).toBe(6);
    s.social.push({ id: 3, date: day, platform: 'Instagram', min: 30 });
    expect(dayScore(s, day, [], [], NOW).parts.find(p => p.key === 'social')?.got).toBe(3);
    s.social = [];
    expect(dayScore(s, day, [], [], NOW).skipped.some(x => x.key === 'social')).toBe(true);
  });

  it('adds up to 100 when every part is full', () => {
    const s = blank();
    s.health[day] = { ...night('23:30', '07:30'), water: 8, workout: 30 };
    s.habits.push({ id: 1, name: 'h', days: { [day]: 1 } });
    s.moods.push({ id: 2, t: new Date(day + 'T12:00').getTime(), v: 8, energy: 3, tags: [], note: '' });
    s.sessions.push({ t: new Date(day + 'T09:00').getTime(), m: 300 });
    s.social.push({ id: 3, date: day, platform: 'Instagram', min: 10 });
    const r = dayScore(s, day, [], s.sessions, NOW);
    expect(r.total).toBe(100);
    expect(r.groups.reduce((a, g) => a + g.max, 0)).toBeLessThanOrEqual(100);
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
