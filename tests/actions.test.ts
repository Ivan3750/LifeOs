import { describe, expect, it } from 'vitest';
import { makeActions } from '@/lib/actions';
import { makeState } from '@/lib/seed';
import { goalProgress } from '@/lib/goals';
import type { State } from '@/lib/types';

function setup() {
  const S: State = makeState(false);
  const A = makeActions({ update: fn => fn(S), getS: () => S, toast: () => {}, notify: () => {}, del: fn => fn(S) });
  return { S, A };
}

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
