import { describe, expect, it } from 'vitest';
import { emptyLife, lifeScore, lifeWeek, recoveryFor, weakest } from '@/lib/life';
import { planDay } from '@/lib/plan';
import { makeActions } from '@/lib/actions';
import { makeState } from '@/lib/seed';
import type { LifeDay, State } from '@/lib/types';

const day = (v: Partial<LifeDay>): LifeDay => ({ ...emptyLife(), ...v });
const base = (): State => { const S = makeState(false); S.workDays = [true, true, true, true, true, false, false]; S.dayFromSleep = false; S.dayStart = '08:00'; S.dayEnd = '22:00'; S.meals = []; return S; };

describe('life score', () => {
  it('is the plain mean: a perfect work sector does not buy back a ruined rest', () => {
    expect(lifeScore(day({ dev: 10, people: 1, body: 2, god: 10, life: 1, rest: 1 }))).toBe(4.2);
  });
  it('needs four rated sectors', () => {
    expect(lifeScore(day({ dev: 8, people: 8, body: 8 }))).toBeNull();
    expect(lifeScore(day({ dev: 8, people: 8, body: 8, rest: 6 }))).toBe(7.5);
    expect(lifeScore(undefined)).toBeNull();
  });
  it('finds the weakest sector', () => {
    expect(weakest(day({ dev: 8, people: 3, body: 5 }))?.key).toBe('people');
  });
});

describe('recovery mode', () => {
  const K = '2026-11-10', Y = '2026-11-09';
  it('starts after a day of 4 or lower and counts the streak', () => {
    const S = base();
    S.life = { [Y]: day({ dev: 4, people: 3, body: 4, rest: 5, next: 'вийти на прогулянку' }) };
    expect(recoveryFor(S, K)).toMatchObject({ on: true, streak: 1, next: 'вийти на прогулянку' });
    S.life['2026-11-08'] = day({ dev: 3, people: 3, body: 4, rest: 4 });
    expect(recoveryFor(S, K).streak).toBe(2);
    S.life[Y] = day({ dev: 7, people: 7, body: 7, rest: 7 });
    expect(recoveryFor(S, K).on).toBe(false);
  });
  it('makes the plan light, with one task only and no free focus', () => {
    const S = base();
    for (let i = 0; i < 5; i++) S.tasks.push({ id: S.nextId++, t: 'Задача ' + i, p: 'hi', d: false });
    S.life = { '2026-11-09': day({ dev: 3, people: 3, body: 3, rest: 3, next: 'лягти до 23:00' }) };
    const p = planDay(S, '2026-11-10', [], new Date('2026-11-10T08:00:00').getTime());
    expect(p.recovery).toBe(true);
    expect(p.mode).toBe('light');
    expect(p.blocks.filter(b => b.kind === 'focus').length).toBeLessThanOrEqual(2);
    expect(p.blocks.some(b => b.title === 'Вільний фокус')).toBe(false);
    expect(p.notes.join(' ')).toMatch(/лягти до 23:00/);
  });
});

describe('week and actions', () => {
  it('counts talks this week and names a tilt', () => {
    const S = base();
    S.life = {
      '2026-11-09': day({ dev: 9, people: 2, body: 6, rest: 6, talks: 1 }),
      '2026-11-10': day({ dev: 9, people: 3, body: 6, rest: 6, talks: 2, moment: 'сміявся з другом' }),
    };
    const w = lifeWeek(S, new Date('2026-11-11T12:00:00'));
    expect(w.talks).toBe(3);
    expect(w.low?.key).toBe('people');
    expect(w.note).toMatch(/Перекіс/);
    expect(w.best).toEqual(['сміявся з другом']);
  });
  it('setLife clamps values and keeps what was set before', () => {
    const S = base();
    const A = makeActions({ update: fn => fn(S), getS: () => S, toast: () => {}, notify: () => {}, del: fn => fn(S) });
    A.setLife('2026-11-10', { dev: 14, people: -2, moments: 9, why: 'x'.repeat(500) });
    A.setLife('2026-11-10', { body: 6 });
    expect(S.life!['2026-11-10']).toMatchObject({ dev: 10, people: 0, body: 6, moments: 3 });
    expect(S.life!['2026-11-10'].why).toHaveLength(280);
  });
});
