import { describe, expect, it } from 'vitest';
import { makeActions } from '@/lib/actions';
import { makeState } from '@/lib/seed';
import { goalProgress } from '@/lib/goals';
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
