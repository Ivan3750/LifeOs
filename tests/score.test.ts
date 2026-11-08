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
    expect(r.parts.find(p => p.key === 'sleep')?.got).toBe(14);
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
    expect(g.parts.find(p => p.key === 'sleepreg')?.got).toBe(8);
    expect(l.parts.find(p => p.key === 'sleepreg')?.got).toBe(0);
    // both slept 8 hours, so the length part is the same
    expect(l.parts.find(p => p.key === 'sleep')?.got).toBe(14);
  });

  it('counts time logged on the business as work', () => {
    const s = blank(); s.health[day] = night('23:30', '07:30');
    s.activities.push({ id: 5, kind: 'Бізнес', title: '', start: new Date(day + 'T10:00').getTime(), end: new Date(day + 'T14:00').getTime() });
    const r = dayScore(s, day, [], [], NOW);
    expect(r.parts.find(p => p.key === 'focus')?.got).toBe(22);
    expect(r.parts.some(p => p.key === 'biz')).toBe(false);
  });

  it('judges the tasks of the day: closed against due and still open', () => {
    const s = blank(); s.health[day] = night('23:30', '07:30');
    expect(dayScore(s, day, [], [], NOW).skipped.some(x => x.key === 'tasks')).toBe(true);
    s.tasks.push({ id: 1, t: 'a', p: 'lo', d: true, doneAt: new Date(day + 'T14:00').getTime() }, { id: 2, t: 'b', p: 'lo', d: false, due: day });
    expect(dayScore(s, day, [], [], NOW).parts.find(p => p.key === 'tasks')?.got).toBe(3.5);
  });

  it('counts social media added afterwards for a past day', () => {
    const s = blank(); s.health[day] = night('23:30', '07:30');
    const before = dayScore(s, day, [], [], NOW);
    expect(before.skipped.some(x => x.key === 'social')).toBe(true);
    s.social.push({ id: 9, date: day, platform: 'YouTube', min: 200 });
    const after = dayScore(s, day, [], [], NOW).parts.find(p => p.key === 'social')!;
    expect(after.got).toBe(0);
  });

  it('judges social media against the limit of each platform', () => {
    const s = blank(); s.health[day] = night('23:30', '07:30');
    s.social.push({ id: 1, date: day, platform: 'Instagram', min: 30 }, { id: 2, date: day, platform: 'YouTube', min: 40 });
    expect(dayScore(s, day, [], [], NOW).parts.find(p => p.key === 'social')?.got).toBe(4);
    s.social.push({ id: 3, date: day, platform: 'Instagram', min: 30 });
    expect(dayScore(s, day, [], [], NOW).parts.find(p => p.key === 'social')?.got).toBe(2);
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

  it('is worth exactly 100 points when every part applies', () => {
    const s = blank();
    s.health[day] = { ...night('23:30', '07:30'), water: 8, workout: 30 };
    s.habits.push({ id: 1, name: 'h', days: { [day]: 1 } });
    s.badHabits.push({ id: 7, name: 'q', start: new Date('2026-03-01T10:00').getTime(), best: 0, slips: [] });
    s.moods.push({ id: 2, t: new Date(day + 'T12:00').getTime(), v: 8, energy: 3, tags: [], note: '' });
    s.sessions.push({ t: new Date(day + 'T09:00').getTime(), m: 300 });
    s.social.push({ id: 3, date: day, platform: 'Instagram', min: 10 });
    s.goals.push({ id: 9, title: 'g', area: 'Карʼєра', target: 10, cur: 1, unit: '', due: '' });
    s.tasks.push({ id: 1, t: 'a', p: 'lo', d: true, doneAt: new Date(day + 'T14:00').getTime(), goal: 9 });
    s.sessions.push({ t: new Date(day + 'T15:00').getTime(), m: 60, task: 'a' });
    const r = dayScore(s, day, [], s.sessions, NOW);
    expect(r.groups.reduce((a, g) => a + g.max, 0)).toBe(100);
    expect(r.coverage).toBe(1);
    expect(r.total).toBe(100);
  });

  it('says how much of the day could be judged, so one logged item is not mistaken for a full day', () => {
    const s = blank();
    s.moods.push({ id: 2, t: new Date(day + 'T12:00').getTime(), v: 9, energy: 3, tags: [], note: '' });
    const r = dayScore(s, day, [], [], NOW);
    expect(r.coverage).toBeLessThan(0.45);
    expect(r.groups.map(g => g.key)).toEqual(['mind']);   // not written down is never counted as 0
    expect(r.total).toBe(100);
  });

  it('does not punish what was not logged: empty water, movement, habits and focus are left out', () => {
    const s = blank();
    s.habits.push({ id: 1, name: 'h', days: {} }, { id: 2, name: 'g', days: {} });
    s.moods.push({ id: 2, t: new Date(day + 'T12:00').getTime(), v: 7, energy: 3, tags: [], note: '' });
    const r = dayScore(s, day, [], [], NOW);
    expect(r.parts.map(p => p.key)).toEqual(['mood']);
    expect(r.skipped.map(p => p.key)).toEqual(expect.arrayContaining(['focus', 'water', 'move', 'habits']));
    expect(r.total).toBe(100);
  });

  it('still counts partly done habits, and an empty workday for someone who uses the focus timer', () => {
    const s = blank();
    s.habits.push({ id: 1, name: 'h', days: { [day]: 1 } }, { id: 2, name: 'g', days: {} });
    s.sessions.push({ t: new Date('2026-03-12T09:00').getTime(), m: 60 });   // the timer was used three days earlier
    const r = dayScore(s, day, [], s.sessions, NOW);
    expect(r.parts.find(p => p.key === 'habits')!.got).toBe(6);              // 1 of 2 habits: half of 12
    expect(r.parts.find(p => p.key === 'focus')!.got).toBe(0);               // the timer is in use, so an empty workday counts
  });
});

describe('dayScore: daytime sleep', () => {
  const day = '2026-03-17';
  const base = { water: 0, mood: 0, steps: 0, workout: 0, weight: 0 };

  it('adds a nap after lunch to a short night', () => {
    const s = blank(); s.health[day] = { ...base, sleep: 5.5 };
    const before = dayScore(s, day, [], [], NOW).parts.find(p => p.key === 'sleep')!;
    s.health[day].naps = [{ id: 1, s: '13:00', e: '14:30' }];
    const after = dayScore(s, day, [], [], NOW).parts.find(p => p.key === 'sleep')!;
    expect(before.got).toBeCloseTo(7, 5);   // 5.5 h: (5.5 − 4) / 3 of 14
    expect(after.got).toBe(14);             // 5.5 + 1.5 = 7 h
    expect(after.hint).toContain('день 90 хв');
  });

  it('does not make a long night better, and a nap alone is judged as sleep too', () => {
    const s = blank(); s.health[day] = { ...base, sleep: 8, naps: [{ id: 1, s: '13:00', e: '13:30' }] };
    expect(dayScore(s, day, [], [], NOW).parts.find(p => p.key === 'sleep')?.got).toBe(14);
    s.health[day] = { ...base, sleep: 0, naps: [{ id: 1, s: '13:00', e: '13:30' }] };
    expect(dayScore(s, day, [], [], NOW).parts.find(p => p.key === 'sleep')?.got).toBeCloseTo(0, 5);
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
