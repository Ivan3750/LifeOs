import { describe, expect, it } from 'vitest';
import { makeState } from '@/lib/seed';
import { dayRows, describe as say, findings, todayAdvice } from '@/lib/correlations';
import { makeActions } from '@/lib/actions';
import { addD, ymd } from '@/lib/util';
import type { State } from '@/lib/types';

const NOW = new Date('2026-03-18T15:00:00');
const key = (back: number, at = NOW) => ymd(addD(at, -back));

/** A history where short sleep goes with a low mood and normal sleep with a good one. */
function history(at = NOW) {
  const S: State = makeState(false);
  S.dayFromSleep = false; S.dayStart = '07:00';
  for (let i = 1; i <= 24; i++) {
    const poor = i % 3 === 0, k = key(i, at);
    S.health[k] = { water: 6, sleep: poor ? 5.2 : 7.6, mood: 0, steps: 0, workout: 20, weight: 0 };
    S.moods.push({ id: 1000 + i, t: new Date(k + 'T12:00').getTime(), v: poor ? 4 : 8, energy: poor ? 1 : 3, tags: [], note: '' });
  }
  return S;
}

describe('links between sleep and mood', () => {
  it('finds that short sleep goes with lower mood and energy, with the numbers', () => {
    const f = findings(history(), NOW);
    const sm = f.find(x => x.id === 'sleep-mood')!;
    expect(sm).toBeDefined();
    expect(sm.low.avg).toBeCloseTo(4);
    expect(sm.high.avg).toBeCloseTo(8);
    expect(sm.low.n).toBe(8);
    expect(sm.strength).toBe(3);
    expect(f.some(x => x.id === 'sleep-energy')).toBe(true);
    expect(say(sm).text).toContain('менше 6,5');
    expect(say(sm).text).toContain('4');
  });
  it('says nothing when there are too few days to compare', () => {
    const S = makeState(false);
    S.health[key(1)] = { water: 0, sleep: 5, mood: 0, steps: 0, workout: 0, weight: 0 };
    S.moods.push({ id: 1, t: new Date(key(1) + 'T12:00').getTime(), v: 3, energy: 1, tags: [], note: '' });
    expect(findings(S, NOW)).toEqual([]);
    expect(todayAdvice(S, NOW)).toBeNull();
  });
  it('does not invent a link when mood does not depend on sleep', () => {
    const S = history();
    S.moods.forEach(m => { m.v = 7; m.energy = 3; });
    expect(findings(S, NOW).some(x => x.target === 'mood' && x.factor === 'sleep')).toBe(false);
  });
  it('uses the bedtime after midnight correctly', () => {
    const S = history();
    S.health[key(2)].bed = '00:40'; S.health[key(3)].bed = '23:30';
    const rows = dayRows(S, 5, NOW);
    expect(rows.find(r => r.k === key(2))!.bed).toBe(1480);
    expect(rows.find(r => r.k === key(3))!.bed).toBe(1410);
  });
});

describe('advice of the day', () => {
  it('after a short night recommends sleep tonight and explains why, with this person\'s numbers', () => {
    const S = history();
    S.health[key(0)] = { water: 2, sleep: 5.1, mood: 0, steps: 0, workout: 0, weight: 0 };
    S.moods.push({ id: 5000, t: new Date(key(0) + 'T11:00').getTime(), v: 3, energy: 1, tags: [], note: '' });
    const a = todayAdvice(S, NOW)!;
    expect(a.tone).toBe('warn');
    expect(a.title).toContain('сон');
    expect(a.reason).toContain('5,1');
    expect(a.reason).toMatch(/3,9 проти 8/);
    expect(a.reason).toContain('відлуння недосипу');
    expect(a.action).toMatch(/до \d\d:\d\d/);
    expect(a.task).toMatch(/^Лягти спати до/);
    expect(a.cause).toContain('недосип');
  });
  it('bedtime is 7.5 hours before the usual wake time', () => {
    const S = history();
    S.health[key(0)] = { water: 2, sleep: 5, mood: 0, steps: 0, workout: 0, weight: 0 };
    expect(todayAdvice(S, NOW)!.action).toContain('23:30');
  });
  it('praises a good night when the history shows it matters', () => {
    const S = history();
    S.health[key(0)] = { water: 6, sleep: 8, mood: 0, steps: 0, workout: 20, weight: 0 };
    const a = todayAdvice(S, NOW)!;
    expect(a.tone).toBe('good');
  });
  it('a low mood logged after a poor night is explained by the sleep', () => {
    const real = new Date(), S = history(real);   // the action reads the real clock
    S.health[key(0, real)] = { water: 6, sleep: 5.4, mood: 0, steps: 0, workout: 0, weight: 0 };
    const notes: string[] = [];
    const A = makeActions({ update: fn => fn(S), getS: () => S, toast: m => notes.push(m), notify: m => notes.push(m), del: fn => fn(S) });
    A.addMood({ t: real.getTime(), v: 3, energy: 1, tags: [], note: '' });
    expect(notes.join(' ')).toContain('причина: недосип');
  });
});
