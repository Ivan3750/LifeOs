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

describe('first-run questions', () => {
  it('turns the answers into defaults, a first task and a calendar', () => {
    const { S, A } = setup();
    S.onboarded = false;
    A.finishOnboarding({ wake: '06:45', bed: '23:00', focus: 'Здати звіт', ical: 'webcal://example.com/a.ics' });
    expect(S).toMatchObject({ onboarded: true, wakeTarget: '06:45', dayStart: '06:45', bedTarget: '23:00', dayEnd: '23:00' });
    expect(S.tasks[0]).toMatchObject({ t: 'Здати звіт', p: 'hi', d: false });
    expect(S.icalUrls).toEqual(['https://example.com/a.ics']);
  });

  it('skipping changes nothing but ends the questions', () => {
    const { S, A } = setup();
    S.onboarded = false;
    const before = { wake: S.wakeTarget, bed: S.bedTarget };
    A.finishOnboarding();
    expect(S.onboarded).toBe(true);
    expect({ wake: S.wakeTarget, bed: S.bedTarget }).toEqual(before);
    expect(S.tasks).toHaveLength(0);
    expect(S.icalUrls).toHaveLength(0);
  });

  it('ignores a calendar link that is not https', () => {
    const { S, A } = setup();
    A.finishOnboarding({ ical: 'http://example.com/a.ics' });
    expect(S.icalUrls).toHaveLength(0);
  });
});

describe('menu without habits', () => {
  it('hides habits for a fresh start, shows them when there is habit data, and obeys the switch', async () => {
    const { navOf, tabsOf, habitsShown } = await import('@/lib/store');
    const empty = makeState(false);
    expect(navOf(empty)).not.toContain('habits');
    expect(tabsOf(empty)).toEqual(['home', 'focus', 'tasks', 'health']);
    const used = { ...empty, habits: [{ id: 1, name: 'Читати', days: {} }] };
    expect(habitsShown(used)).toBe(true);
    expect(tabsOf(used)).toEqual(['home', 'focus', 'tasks', 'habits']);
    expect(habitsShown({ ...used, habitsOn: false })).toBe(false);
    expect(habitsShown({ ...empty, habitsOn: true })).toBe(true);
  });
});
