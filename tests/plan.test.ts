import { describe, expect, it } from 'vitest';
import { planDay, peakHours, taskEstimate, weekView } from '@/lib/plan';
import { makeState } from '@/lib/seed';
import type { State, UiEvent } from '@/lib/types';

const K = '2026-11-09'; // a Monday
const at = (hm: string) => new Date(`${K}T${hm}:00`).getTime();
const base = (): State => {
  const S = makeState(false);
  S.workDays = [true, true, true, true, true, false, false];
  S.goal = 20; S.dayFromSleep = false; S.dayStart = '08:00'; S.dayEnd = '22:00'; S.meals = []; S.moveGoal = 30;
  return S;
};
const task = (S: State, t: string, extra: Partial<State['tasks'][number]> = {}) => S.tasks.push({ id: S.nextId++, t, p: 'lo', d: false, ...extra });
const none = () => [] as UiEvent[];

describe('planDay', () => {
  it('puts the task that is due first, inside free time and away from events', () => {
    const S = base();
    task(S, 'Звіт', { due: K }); task(S, 'Пізніше', { due: '2026-11-20' });
    const ev: UiEvent[] = [{ id: 'e', date: K, s: '09:00', e: '11:00', title: 'Зустріч', c: 'c1' }];
    const p = planDay(S, K, ev, at('08:00'));
    expect(p.mode).toBe('full');
    const focus = p.blocks.filter(b => b.kind === 'focus');
    expect(focus.some(b => b.task === 'Звіт')).toBe(true);
    for (const b of focus) expect(b.e <= '09:00' || b.s >= '11:00').toBe(true);
    expect(p.blocks.find(b => b.task === 'Пізніше')).toBeUndefined();
  });

  it('goes light after a short night: shorter blocks, fewer of them', () => {
    const S = base();
    for (let i = 0; i < 6; i++) task(S, 'Задача ' + i, { p: 'hi' });
    const full = planDay(S, K, none(), at('08:00'));
    S.health[K] = { water: 0, sleep: 4.5, mood: 0, steps: 0, workout: 0, weight: 0 };
    const light = planDay(S, K, none(), at('08:00'));
    expect(light.mode).toBe('light');
    expect(light.planned).toBeLessThan(full.planned);
    const mins = (b: { s: string; e: string }) => (+b.e.slice(0, 2) * 60 + +b.e.slice(3)) - (+b.s.slice(0, 2) * 60 + +b.s.slice(3));
    expect(Math.max(...light.blocks.filter(b => b.kind === 'focus').map(mins))).toBeLessThanOrEqual(35);
  });

  it('plans nothing in the past and nothing at all on a day off', () => {
    const S = base();
    task(S, 'Звіт', { due: K });
    const late = planDay(S, K, none(), at('22:30'));
    expect(late.blocks.filter(b => b.kind === 'focus')).toHaveLength(0);
    S.offDays = { [K]: { kind: 'sick', note: '' } };
    const off = planDay(S, K, none(), at('08:00'));
    expect(off.mode).toBe('off');
    expect(off.target).toBe(Math.min(off.target, 240));
  });

  it('says what did not fit', () => {
    const S = base();
    S.dayEnd = '10:00';
    for (let i = 0; i < 5; i++) task(S, 'Горить ' + i, { due: K });
    const p = planDay(S, K, none(), at('08:00'));
    expect(p.left.length).toBeGreaterThan(0);
    expect(p.notes.join(' ')).toMatch(/Не вмістилося/);
  });

  it('suggests movement when the day lacks it, in a gap away from the focus blocks', () => {
    const S = base();
    task(S, 'Звіт', { due: K });
    const p = planDay(S, K, none(), at('08:00'));
    const move = p.blocks.find(b => b.kind === 'move');
    expect(move).toBeDefined();
    for (const b of p.blocks.filter(x => x.kind === 'focus')) expect(b.e <= move!.s || b.s >= move!.e).toBe(true);
  });
});

describe('peakHours and estimates', () => {
  it('learns the best two hours from sessions, and falls back to the morning', () => {
    const S = base();
    expect(peakHours(S, at('12:00')).known).toBe(false);
    for (let d = 1; d <= 8; d++) S.sessions.push({ t: new Date(2026, 10, d, 15, 0).getTime(), m: 50 });
    const p = peakHours(S, new Date(2026, 10, 9, 12).getTime());
    expect(p.known).toBe(true);
    expect(p.from).toBeGreaterThanOrEqual(14);
    expect(p.from).toBeLessThanOrEqual(15);
  });

  it('uses 45 minutes until there is history', () => { expect(taskEstimate(base())).toBe(45); });
});

describe('weekView', () => {
  it('warns when the deadlines do not fit into the free time', () => {
    const S = base();
    S.dayEnd = '12:00';
    for (let i = 0; i < 8; i++) task(S, 'Здати ' + i, { due: '2026-11-10' });
    const w = weekView(S, none, new Date(at('08:00')));
    expect(w.days).toHaveLength(7);
    expect(w.crunch).not.toBeNull();
    expect(w.steps[0]).toMatch(/Перенеси/);
  });

  it('is quiet when there is room', () => {
    const S = base();
    task(S, 'Одна', { due: '2026-11-12' });
    expect(weekView(S, none, new Date(at('08:00'))).crunch).toBeNull();
  });

  it('forecasts the weekly focus from the pace so far', () => {
    const S = base();
    for (const d of [9, 10]) S.sessions.push({ t: new Date(2026, 10, d, 10).getTime(), m: 120 });
    const w = weekView(S, none, new Date(2026, 10, 12, 8));
    expect(w.focus.done).toBe(240);
    expect(w.focus.forecast).toBeGreaterThan(240);
    expect(w.focus.goal).toBe(1200);
  });
});
