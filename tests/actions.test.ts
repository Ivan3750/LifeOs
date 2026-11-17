import { describe, expect, it } from 'vitest';
import { makeActions } from '@/lib/actions';
import { makeState } from '@/lib/seed';
import { goalProgress } from '@/lib/goals';
import { dailyEarnings, hoursToGoal, woltStats } from '@/lib/wolt';
import type { State } from '@/lib/types';
import { ymd } from '@/lib/util';

function setup() {
  const S: State = makeState(false);
  const A = makeActions({ update: fn => fn(S), getS: () => S, toast: () => {}, notify: () => {}, del: fn => fn(S) });
  return { S, A };
}

describe('company chain', () => {
  it('winning a deal creates one project and one invoice, linked, and only once', () => {
    const { S, A } = setup();
    S.co.deals.push({ id: 1, title: 'Сайт', client: 'Кавʼярня', amt: 5000, stage: 'proposal' });
    A.moveDeal(1, 1);
    expect(S.co.deals[0].stage).toBe('won');
    expect(S.co.projects).toHaveLength(1);
    expect(S.co.projects[0]).toMatchObject({ deal: 1, budget: 5000, client: 'Кавʼярня' });
    expect(S.co.invoices).toHaveLength(1);
    expect(S.co.invoices[0]).toMatchObject({ deal: 1, project: S.co.projects[0].id, amt: 5000 });
    A.moveDeal(1, -1); A.moveDeal(1, 1);
    expect(S.co.projects).toHaveLength(1);
    expect(S.co.invoices).toHaveLength(1);
  });
  it('bills a project that has no invoice, once', () => {
    const { S, A } = setup();
    S.co.projects.push({ id: 9, name: 'Лендінг', client: 'X', due: '', progress: 100, status: 'done', budget: 800 });
    A.invoiceProject(9); A.invoiceProject(9);
    expect(S.co.invoices).toHaveLength(1);
    expect(S.co.invoices[0]).toMatchObject({ project: 9, amt: 800 });
  });
});

describe('wolt', () => {
  it('a finished shift writes the shift and its income; deleting the shift removes both', () => {
    const { S, A } = setup();
    S.act = { kind: 'Wolt', title: 'Зміна', start: Date.now() - 3 * 36e5 };
    A.finishShift({ earned: 420, orders: 9, km: 31 });
    expect(S.act).toBeNull();
    const shift = S.activities[0];
    expect(shift).toMatchObject({ kind: 'Wolt', orders: 9, earned: 420, km: 31 });
    expect(S.money.tx).toHaveLength(1);
    expect(S.money.tx[0]).toMatchObject({ type: 'in', cat: 'Wolt', amt: 420, shift: shift.id });
    const st = woltStats(S, 0);
    expect(st.orders).toBe(9);
    expect(st.earned).toBe(420);
    expect(Math.round(st.perHour)).toBe(140);
    expect(Math.round(st.perOrder)).toBe(47);
    A.delShift(shift.id);
    expect(S.activities).toHaveLength(0);
    expect(S.money.tx).toHaveLength(0);
  });
  it('adds a past shift and shows it in the daily bars', () => {
    const { S, A } = setup();
    const start = new Date(); start.setHours(10, 0, 0, 0);
    expect(A.addShift({ start: +start, end: +start + 2 * 36e5, earned: 200, orders: 4, km: 0 })).toBe(true);
    const today = dailyEarnings(S, 3).at(-1)!;
    expect(today.d).toBe(ymd(new Date()));
    expect(today.earned).toBe(200);
    expect(today.hours).toBeCloseTo(2);
    expect(A.addShift({ start: +start, end: +start, earned: 1, orders: 0, km: 0 })).toBe(false);
  });
  it('estimates the hours left to a goal', () => {
    expect(hoursToGoal(1000, 400, 100)).toBe(6);
    expect(hoursToGoal(1000, 1200, 100)).toBe(0);
    expect(hoursToGoal(1000, 400, 0)).toBe(0);
  });
});

describe('goals in life areas', () => {
  it('a rating goal starts at the area rating and follows it', () => {
    const { S, A } = setup();
    S.wheel[3] = 4; // Стосунки
    A.addGoal({ title: 'Знайти дівчину', area: 'Стосунки', target: 8, unit: '', due: '', steps: ['Піти на танці'], kind: 'rating' });
    const g = S.goals[0];
    expect(g).toMatchObject({ kind: 'rating', from: 4, cur: 4, target: 8 });
    expect(goalProgress(g)).toBe(0);
    A.setWheel(3, 6);
    expect(S.goals[0].cur).toBe(6);
    expect(goalProgress(S.goals[0])).toBe(0.5);
    A.setWheel(3, 10);
    expect(goalProgress(S.goals[0])).toBe(1);
    A.setWheel(0, 3);
    expect(S.goals[0].cur).toBe(10);
  });
});

describe('tasks', () => {
  it('adds a task from one line', () => {
    const { S, A } = setup();
    expect(A.addTaskLine('Подзвонити клієнту завтра !')).toBe(true);
    expect(S.tasks[0]).toMatchObject({ t: 'Подзвонити клієнту', p: 'hi' });
    expect(S.tasks[0].due).toBeDefined();
    A.toggleTask(S.tasks[0].id);
    expect(S.tasks[0].doneAt).toBeGreaterThan(0);
  });
});
