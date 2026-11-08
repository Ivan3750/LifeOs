import { describe, expect, it } from 'vitest';
import { makeState } from '@/lib/seed';
import { makeActions } from '@/lib/actions';
import { fitMinutes, nextCandidate, nowState, phaseOf, rankTasks, todayPlan } from '@/lib/now';
import type { State, UiEvent } from '@/lib/types';

const NOW = new Date('2026-03-18T10:00:00');
const ev = (id: string, s: string, e: string, extra: Partial<UiEvent> = {}): UiEvent => ({ id, date: '2026-03-18', s, e, title: id, c: 'c1', ...extra });
const task = (S: State, id: number, t: string, extra: Partial<State['tasks'][number]> = {}) => { S.tasks.push({ id, t, p: 'lo', d: false, ...extra }); };

describe('phaseOf', () => {
  it('splits the day into morning, day, evening and night', () => {
    expect(phaseOf(new Date('2026-03-18T07:00:00'))).toBe('morning');
    expect(phaseOf(new Date('2026-03-18T13:00:00'))).toBe('day');
    expect(phaseOf(new Date('2026-03-18T20:00:00'))).toBe('evening');
    expect(phaseOf(new Date('2026-03-18T02:00:00'))).toBe('night');
  });
});

describe('ranking and plan', () => {
  it('puts overdue and important tasks first, goal-linked ones above plain ones', () => {
    const S = makeState(false);
    task(S, 1, 'plain');
    task(S, 2, 'goal', { goal: 9 });
    task(S, 3, 'important', { p: 'hi' });
    task(S, 4, 'overdue', { due: '2026-03-10' });
    task(S, 5, 'done', { d: true, p: 'hi', due: '2026-03-10' });
    expect(rankTasks(S, NOW).map(t => t.t)).toEqual(['overdue', 'important', 'goal', 'plain']);
  });

  it('suggests the top three until the person accepts a plan for today', () => {
    const S = makeState(false);
    for (let i = 1; i <= 5; i++) task(S, i, 't' + i, { p: i === 2 ? 'hi' : 'lo' });
    const p = todayPlan(S, NOW);
    expect(p.confirmed).toBe(false);
    expect(p.tasks).toHaveLength(3);
    expect(p.tasks[0].t).toBe('t2');
  });

  it('keeps the accepted plan for today only, and keeps done tasks in it', () => {
    const S = makeState(false);
    const A = makeActions({ update: fn => fn(S), getS: () => S, toast: () => {}, notify: () => {}, del: fn => fn(S) });
    task(S, 1, 'a'); task(S, 2, 'b'); task(S, 3, 'c');
    S.plan = { date: '2026-03-18', ids: [1, 3] };
    A.toggleTask(1);
    const p = todayPlan(S, NOW);
    expect(p.confirmed).toBe(true);
    expect(p.tasks.map(t => [t.t, t.d])).toEqual([['a', true], ['c', false]]);
    // tomorrow the old plan is no longer valid
    expect(todayPlan(S, new Date('2026-03-19T09:00:00')).confirmed).toBe(false);
  });

  it('swaps a planned task for the next in line, or drops it', () => {
    const S = makeState(false);
    const A = makeActions({ update: fn => fn(S), getS: () => S, toast: () => {}, notify: () => {}, del: fn => fn(S) });
    task(S, 1, 'a', { p: 'hi' }); task(S, 2, 'b'); task(S, 3, 'c');
    const key = new Date().toISOString().slice(0, 10);
    A.setPlan([1, 2], key);
    const spare = nextCandidate(S, new Date(), [1, 2]);
    expect(spare?.t).toBe('c');
    A.swapPlan(2, spare!.id);
    expect(S.plan.ids).toEqual([1, 3]);
    A.swapPlan(1);
    expect(S.plan.ids).toEqual([3]);
  });
});

describe('nowState', () => {
  const at = NOW.getTime();

  it('says an event is on while it is on', () => {
    const S = makeState(false);
    const { cur } = nowState(S, [ev('Лекція', '09:30', '10:30')], at);
    expect(cur).toMatchObject({ kind: 'event', endsIn: 30 });
  });

  it('proposes the top task with a run that fits before the next event', () => {
    const S = makeState(false);
    task(S, 1, 'Звіт', { p: 'hi' });
    const { cur, next } = nowState(S, [ev('Обід', '10:20', '11:00')], at);
    expect(next).toMatchObject({ inMin: 20 });
    expect(cur).toMatchObject({ kind: 'task', window: 20, minutes: 18 });
    expect(cur.kind === 'task' && cur.task?.t).toBe('Звіт');
  });

  it('shows the running timer before anything else', () => {
    const S = makeState(false);
    S.timer = { mode: 'focus', left: 600, running: true, endAt: at + 600_000, task: 'Звіт' };
    const { cur } = nowState(S, [ev('Лекція', '09:30', '10:30')], at);
    expect(cur).toEqual({ kind: 'focus', task: 'Звіт', left: 600 });
  });

  it('says there is nothing to do when there are no tasks', () => {
    const S = makeState(false);
    const { cur } = nowState(S, [], at);
    expect(cur).toMatchObject({ kind: 'task', task: null, window: null, minutes: 25 });
  });

  it('ignores all-day events and logged activities when looking for what is on', () => {
    const S = makeState(false);
    const { cur } = nowState(S, [ev('Свято', '00:00', '23:59', { allDay: true }), ev('Магазин', '09:00', '11:00', { act: 3 })], at);
    expect(cur.kind).toBe('task');
  });
});

describe('fitMinutes', () => {
  it('uses the usual length unless the window is shorter, and never goes under ten minutes', () => {
    expect(fitMinutes(25, null)).toBe(25);
    expect(fitMinutes(25, 60)).toBe(25);
    expect(fitMinutes(25, 20)).toBe(18);
    expect(fitMinutes(25, 8)).toBe(10);
  });
});

describe('short runs', () => {
  it('a custom run length does not count as a full usual run', async () => {
    const { logFocus } = await import('@/lib/store');
    const S = makeState(false);
    const start = Date.now();
    S.timer = { mode: 'focus', left: 300, running: true, endAt: start + 300_000, task: 'x', dur: 300 };
    // two minutes into a five-minute run: two minutes are logged, not twenty
    expect(logFocus(S, start + 120_000)).toBe(2);
  });
});
