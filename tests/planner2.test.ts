import { describe, expect, it } from 'vitest';
import { makeState } from '@/lib/seed';
import { makeActions } from '@/lib/actions';
import { makeLifeActions } from '@/lib/lifeActions';
import { planWeek } from '@/lib/planner';
import type { State, UiEvent } from '@/lib/types';
import { wStart } from '@/lib/util';

// Wednesday of the week 16–22 March 2026
const NOW = new Date('2026-03-18T10:00:00');
const WS = wStart(NOW);
const ev = (date: string, s: string, e: string, title = 'зайнято'): UiEvent => ({ id: title + date + s, date, s, e, title, c: 'c1' });
const DAYS = ['2026-03-18', '2026-03-19', '2026-03-20', '2026-03-21', '2026-03-22'];

function setup(events: UiEvent[] = []) {
  const S = makeState(false);
  const update = (fn: (s: State) => void) => fn(S);
  const deps = { update, getS: () => S, toast: () => {}, notify: () => {}, del: update };
  const A = { ...makeActions(deps), ...makeLifeActions(deps) };
  const eventsOn = (k: string) => [...events.filter(e => e.date === k), ...S.events.filter(e => e.date === k).map(e => ({ id: 'l' + e.id, localId: e.id, date: e.date, s: e.s, e: e.e, title: e.title, c: e.c }))];
  return { S, A, eventsOn };
}
const need = (S: State, key: string) => S.needs.find(n => n.key === key)!;
const plan = (S: State, eventsOn: (k: string) => UiEvent[]) => planWeek(S, WS, eventsOn, NOW.getTime());

describe('the planner suggests, it does not fill the week', () => {
  it('suggests work for the business at most twice a week and never twice a day', () => {
    const { S, eventsOn } = setup();
    Object.assign(need(S, 'income'), { weekly: 6, days: 'any' });
    const income = plan(S, eventsOn).slots.filter(x => x.need === need(S, 'income').id);
    expect(income.length).toBeLessThanOrEqual(2);
    expect(new Set(income.map(x => x.date)).size).toBe(income.length);
  });

  it('allows three work suggestions when the business is a main direction of the season', () => {
    const { S, A, eventsOn } = setup();
    Object.assign(need(S, 'income'), { weekly: 6, days: 'any' });
    A.setSeason({ from: '2026-03-16', to: '2026-03-22', main: ['business'], support: [] });
    const income = plan(S, eventsOn).slots.filter(x => x.need === need(S, 'income').id);
    expect(income).toHaveLength(3);
  });

  it('keeps part of a busy day free: a second suggestion needs the reserve to stay untouched', () => {
    // only Sunday has free time: 16:00–18:30 (the dinner starts at 18:30), two and a half hours
    const blocked = DAYS.slice(0, 4).map(k => ev(k, '00:00', '23:59')).concat([ev('2026-03-22', '00:00', '16:00'), ev('2026-03-22', '18:30', '23:59')]);
    const { S, eventsOn } = setup(blocked);
    for (const n of S.needs) { if (n.key === 'sport' || n.key === 'rest') Object.assign(n, { weekly: 1, from: '16:00', to: '18:30', days: 'any' }); else n.on = false; }
    Object.assign(need(S, 'sport'), { min: 40 }); Object.assign(need(S, 'rest'), { min: 60 });
    const p = plan(S, eventsOn);
    // both would fit one after the other, but then less than a third of the free time would be left
    expect(p.slots).toHaveLength(1);
    expect(p.unplaced).toHaveLength(1);
    const day = p.days.find(d => d.date === '2026-03-22')!;
    expect(day.free).toBe(150);
    expect(day.kept).toBeGreaterThanOrEqual(day.free * 0.35);
  });

  it('never makes more than the mode allows in one day', () => {
    const { S, A, eventsOn } = setup();
    A.setLifeMode('recovery');
    const p = plan(S, eventsOn), per = new Map<string, number>();
    for (const x of p.slots) per.set(x.date, (per.get(x.date) || 0) + 1);
    expect(Math.max(0, ...per.values())).toBeLessThanOrEqual(1);
  });
});

describe('modes and seasons change the suggestions, not the needs', () => {
  it('Recovery leaves out sport, new things, Danish and the business, and keeps the needs themselves', () => {
    const { S, A, eventsOn } = setup();
    const before = S.needs.map(n => ({ ...n }));
    A.setLifeMode('recovery');
    const ids = new Set(plan(S, eventsOn).slots.map(x => x.need));
    for (const k of ['sport', 'new', 'danish', 'income']) expect(ids.has(need(S, k).id)).toBe(false);
    expect(S.needs).toEqual(before);
  });

  it('a main direction of the season goes first when two needs want the same free hour', () => {
    const solo = (k: string) => (k < '2026-03-22' ? [ev(k, '00:00', '23:59')] : [ev(k, '00:00', '19:00'), ev(k, '20:30', '23:59')]);
    const { S, A } = setup();
    for (const n of S.needs) { if (n.key === 'people' || n.key === 'rest') Object.assign(n, { weekly: 1, min: 60, from: '19:00', to: '22:00', days: 'any' }); else n.on = false; }
    expect(plan(S, solo).slots.map(x => x.need)).toEqual([need(S, 'people').id]);
    A.setSeason({ from: '2026-03-16', to: '2026-03-22', main: ['rest'], support: ['social'] });
    expect(plan(S, solo).slots.map(x => x.need)).toEqual([need(S, 'rest').id]);
  });

  it('Busy mode leaves out «something new» but not what the person set up themselves', () => {
    const { S, A, eventsOn } = setup();
    A.setLifeMode('busy');
    const ids = new Set(plan(S, eventsOn).slots.map(x => x.need));
    expect(ids.has(need(S, 'new').id)).toBe(false);
    expect(ids.has(need(S, 'sport').id)).toBe(true);
  });

  it('creates no events by itself', () => {
    const { S, A, eventsOn } = setup();
    A.setLifeMode('social');
    plan(S, eventsOn);
    expect(S.events).toHaveLength(0);
  });
});
