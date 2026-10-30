import { describe, expect, it } from 'vitest';
import { makeState } from '@/lib/seed';
import { adviceList, dayRows, describe as say, findings, moodCause, todayAdvice } from '@/lib/correlations';
import { makeActions } from '@/lib/actions';
import { addD, rng, ymd } from '@/lib/util';
import type { State } from '@/lib/types';

const NOW = new Date('2026-03-18T15:00:00');
const key = (back: number, at = NOW) => ymd(addD(at, -back));

type Spec = Partial<{ sleep: number; bed: string; water: number; workout: number; mood: number; energy: number; focus: number; spend: number; habit: boolean; events: number; wolt: number; rest: number; stress: boolean }>;

/** A made-up history: spec(i) describes the day that was i days ago (1 = yesterday). Everything not mentioned stays the same every day. */
function world(spec: (i: number) => Spec, days = 30, at = NOW): State {
  const S = makeState(false);
  S.dayFromSleep = false; S.dayStart = '07:00';
  S.habits.push({ id: 1, name: 'Зарядка', days: {} });
  for (let i = days; i >= 1; i--) {
    const k = key(i, at), s = spec(i), t0 = new Date(k + 'T00:00').getTime();
    S.health[k] = { water: s.water ?? 6, sleep: s.sleep ?? 7.6, mood: 0, steps: 0, workout: s.workout ?? 25, weight: 0, ...(s.bed ? { bed: s.bed, wake: '07:00' } : {}) };
    S.moods.push({ id: 100 + i, t: t0 + 12 * 36e5, v: s.mood ?? 7, energy: s.energy ?? 3, tags: s.stress ? ['Стрес'] : [], note: '' });
    if (s.focus !== undefined) S.sessions.push({ t: t0 + 10 * 36e5, m: s.focus });
    if (s.spend !== undefined) S.money.tx.push({ id: 5000 + i, type: 'out', amt: s.spend, cat: 'Їжа', note: '', date: k, acc: 'dk' });
    if (s.habit) S.habits[0].days[k] = 1;
    for (let e = 0; e < (s.events ?? 0); e++) S.events.push({ id: 7000 + i * 10 + e, date: k, s: '10:00', e: '11:00', title: 'Подія', c: 'c1' });
    if (s.wolt) S.activities.push({ id: 8000 + i, kind: 'Wolt', title: '', start: t0 + 10 * 36e5, end: t0 + (10 + s.wolt) * 36e5 });
    if (s.rest) S.activities.push({ id: 9000 + i, kind: 'Відпочинок', title: '', start: t0 + 18 * 36e5, end: t0 + 18 * 36e5 + s.rest * 6e4 });
  }
  return S;
}
const find = (S: State, id: string, at = NOW) => findings(S, at).find(f => f.id === id);
/** every third day is «special»; the effect lands on the day itself (lag 0) or on the next day (lag 1: day i-1 follows day i) */
const third = (i: number) => i % 3 === 0, after = (i: number) => (i + 1) % 3 === 0;

describe('every area of life can be linked', () => {
  it('body: short sleep → lower mood, with the numbers and the norm', () => {
    const S = world(i => ({ sleep: third(i) ? 5.2 : 7.6, mood: third(i) ? 4 : 8, energy: third(i) ? 1 : 3 }));
    const f = find(S, 'sleep-mood')!;
    expect(f).toMatchObject({ badSide: 'low', lag: 0, strength: 3 });
    expect(f.bad.avg).toBeCloseTo(4); expect(f.good.avg).toBeCloseTo(8); expect(f.bad.n).toBe(10);
    expect(say(f, S).text).toContain('менше 6,5');
    expect(find(S, 'sleep-energy')).toBeDefined();
  });
  it('body: movement yesterday → mood today', () => {
    const f = find(world(i => ({ workout: third(i) ? 0 : 30, mood: after(i) ? 4 : 8 })), 'workout-mood')!;
    expect(f).toMatchObject({ badSide: 'low', lag: 1 });
  });
  it('body: water and late bedtime', () => {
    expect(find(world(i => ({ water: third(i) ? 2 : 8, mood: third(i) ? 4 : 8 })), 'water-mood')).toMatchObject({ badSide: 'low' });
    expect(find(world(i => ({ bed: third(i) ? '01:20' : '23:10', mood: third(i) ? 4 : 8 })), 'bed-mood')).toMatchObject({ badSide: 'high' });
  });
  it('work: a very long focus day → less energy the next day', () => {
    const S = world(i => ({ focus: third(i) ? 330 : 90, energy: after(i) ? 1 : 3 }));
    expect(find(S, 'focus-energy')).toMatchObject({ badSide: 'high', lag: 1 });
    expect(describe_text(S, 'focus-energy')).toContain('Після дня, коли фокус триває понад');
  });
  it('work: a long Wolt day → worse focus the next day', () => {
    const S = world(i => ({ wolt: third(i) ? 8 : 0, focus: after(i) ? 30 : 120 }));
    expect(find(S, 'wolt-focus')).toMatchObject({ badSide: 'high', lag: 1 });
  });
  it('money: a day of big spending → lower mood the next day', () => {
    const f = find(world(i => ({ spend: third(i) ? 400 : 40, mood: after(i) ? 4 : 8 })), 'spend-mood')!;
    expect(f).toMatchObject({ badSide: 'high', lag: 1 });
    expect(f.bad.avg).toBeCloseTo(4);
  });
  it('money: a low mood is followed by more spending (the outcome is a «lower is better» one)', () => {
    const f = find(world(i => ({ mood: third(i) ? 3 : 8, spend: after(i) ? 300 : 40 })), 'mood-spend')!;
    expect(f).toMatchObject({ badSide: 'low', lag: 1 });
    expect(f.bad.avg).toBeCloseTo(300);
  });
  it('habits: doing the habits goes with a better mood', () => {
    expect(find(world(i => ({ habit: !third(i), mood: third(i) ? 5 : 8 })), 'habits-mood')).toMatchObject({ badSide: 'low', lag: 0 });
  });
  it('friends: days with events or meetings lift the mood', () => {
    expect(find(world(i => ({ events: third(i) ? 0 : 2, mood: third(i) ? 5 : 8 })), 'events-mood')).toMatchObject({ badSide: 'low' });
  });
  it('rest: days without rest or sport lower the next day', () => {
    expect(find(world(i => ({ rest: third(i) ? 0 : 60, mood: after(i) ? 5 : 8 })), 'rest-mood')).toMatchObject({ badSide: 'low', lag: 1 });
  });
  it('mind: a stressful day costs the sleep of the night after', () => {
    expect(find(world(i => ({ stress: third(i), sleep: after(i) ? 5.4 : 7.8 })), 'stress-sleep')).toMatchObject({ badSide: 'high', lag: 1 });
  });
});
const describe_text = (S: State, id: string) => say(find(S, id)!, S).text;

describe('what the algorithm leaves alone', () => {
  it('says nothing without enough data', () => {
    const S = makeState(false);
    S.health[key(1)] = { water: 0, sleep: 5, mood: 0, steps: 0, workout: 0, weight: 0 };
    S.moods.push({ id: 1, t: new Date(key(1) + 'T12:00').getTime(), v: 3, energy: 1, tags: [], note: '' });
    expect(findings(S, NOW)).toEqual([]);
    expect(adviceList(S, NOW)).toEqual([]);
  });
  it('invents nothing from random days', () => {
    const r = rng(11), pick = (a: number, b: number) => a + Math.round(r() * (b - a));
    const S = world(() => ({ sleep: pick(50, 90) / 10, water: pick(1, 9), workout: pick(0, 40), mood: pick(3, 9), energy: pick(1, 3), focus: pick(0, 300), spend: pick(0, 400), habit: r() > 0.5, events: pick(0, 3), wolt: pick(0, 6), rest: pick(0, 90), stress: r() > 0.7 }), 60);
    expect(findings(S, NOW).length).toBeLessThanOrEqual(1);
  });
  it('does not use today, which is not finished', () => {
    const S = world(() => ({}));
    S.sessions.push({ t: NOW.getTime() - 5 * 36e5, m: 600 });
    const rows = dayRows(S, 3, NOW);
    expect(rows[2].focus).toBe(600);
    expect(findings(S, NOW)).toEqual([]);
  });
  it('does not count days before tracking began as zeros', () => {
    const S = world(i => (i < 10 ? { focus: 100 } : {}), 30);
    const rows = dayRows(S, 30, NOW);
    expect(rows[0].focus).toBeNull();
    expect(rows[28].focus).toBe(100);
  });
  it('reads a bedtime after midnight next to one before it', () => {
    const rows = dayRows(world(i => ({ bed: i === 2 ? '00:40' : '23:30' })), 5, NOW);
    expect(rows.find(r => r.k === key(2))!.bed).toBe(1480);
    expect(rows.find(r => r.k === key(3))!.bed).toBe(1410);
  });
});

describe('advice for today, from any area', () => {
  it('after a short night: sleep first, with the reason and a bedtime', () => {
    const S = world(i => ({ sleep: third(i) ? 5.2 : 7.6, mood: third(i) ? 4 : 8, energy: third(i) ? 1 : 3 }));
    S.health[key(0)] = { water: 2, sleep: 5.1, mood: 0, steps: 0, workout: 0, weight: 0 };
    S.moods.push({ id: 5000, t: new Date(key(0) + 'T11:00').getTime(), v: 3, energy: 1, tags: [], note: '' });
    const a = todayAdvice(S, NOW)!;
    expect(a).toMatchObject({ tone: 'warn', area: 'Здоровʼя' });
    expect(a.title).toContain('сон');
    expect(a.reason).toContain('5,1');
    expect(a.reason).toMatch(/проти 8/);
    expect(a.reason).toContain('відлуння недосипу');
    expect(a.action).toContain('23:30');
    expect(a.task).toMatch(/^Лягти спати до/);
  });
  it('after a day of big spending: a tip from Finance', () => {
    const S = world(i => ({ spend: third(i) ? 400 : 40, mood: after(i) ? 4 : 8 }));
    S.money.tx.push({ id: 9999, type: 'out', amt: 420, cat: 'Покупки', note: '', date: key(1), acc: 'dk' });
    const list = adviceList(S, NOW);
    const a = list.find(x => x.area === 'Фінанси')!;
    expect(a).toBeDefined();
    expect(a.reason).toContain('Вчора');
    expect(a.reason).toContain('460 kr.');
    expect(a.action).toContain('ліміт');
    expect(a.forMood).toBe(true);
  });
  it('after an overloaded day: a tip from Work', () => {
    const S = world(i => ({ focus: third(i) ? 330 : 90, energy: after(i) ? 1 : 3 }));
    S.sessions.push({ t: new Date(key(1) + 'T09:00').getTime(), m: 300 });
    const a = adviceList(S, NOW).find(x => x.area === 'Карʼєра')!;
    expect(a.title).toBe('Не перевантажуй себе');
    expect(a.action).toContain('перерви');
  });
  it('gives advice from several areas at once, never more than three', () => {
    const S = world(i => ({ sleep: third(i) ? 5.2 : 7.6, spend: third(i) ? 400 : 40, focus: third(i) ? 330 : 90, wolt: third(i) ? 7 : 0, mood: third(i) || after(i) ? 4 : 8, energy: after(i) ? 1 : 3 }));
    S.health[key(0)] = { water: 6, sleep: 5, mood: 0, steps: 0, workout: 20, weight: 0 };
    S.money.tx.push({ id: 9999, type: 'out', amt: 420, cat: 'Покупки', note: '', date: key(1), acc: 'dk' });
    S.sessions.push({ t: new Date(key(1) + 'T09:00').getTime(), m: 340 });
    const list = adviceList(S, NOW);
    expect(list.length).toBeGreaterThan(1);
    expect(list.length).toBeLessThanOrEqual(3);
    expect(list[0].area).toBe('Здоровʼя');
    expect(new Set(list.map(x => x.area)).size).toBeGreaterThan(1);
  });
  it('praises a good night when the history shows it matters', () => {
    const S = world(i => ({ sleep: third(i) ? 5.2 : 7.6, mood: third(i) ? 4 : 8 }));
    S.health[key(0)] = { water: 6, sleep: 8, mood: 0, steps: 0, workout: 20, weight: 0 };
    expect(todayAdvice(S, NOW)!.tone).toBe('good');
  });
});

describe('explaining a low mood when it is logged', () => {
  it('names a short night', () => {
    const real = new Date(), S = world(i => ({ sleep: third(i) ? 5.2 : 7.6, mood: third(i) ? 4 : 8 }), 30, real);
    S.health[key(0, real)] = { water: 6, sleep: 5.4, mood: 0, steps: 0, workout: 0, weight: 0 };
    const notes: string[] = [];
    const A = makeActions({ update: fn => fn(S), getS: () => S, toast: m => notes.push(m), notify: m => notes.push(m), del: fn => fn(S) });
    A.addMood({ t: real.getTime(), v: 3, energy: 1, tags: [], note: '' });
    expect(notes.join(' ')).toContain('причина: недосип');
  });
  it('names something other than sleep when sleep was fine', () => {
    const real = new Date(), S = world(i => ({ spend: third(i) ? 400 : 40, mood: after(i) ? 4 : 8 }), 30, real);
    S.money.tx.push({ id: 9999, type: 'out', amt: 450, cat: 'Покупки', note: '', date: key(1, real), acc: 'dk' });
    const cause = moodCause(S, real)!;
    expect(cause.cause).toContain('великі витрати вчора');
  });
});
