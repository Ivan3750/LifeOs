import { describe, expect, it } from 'vitest';
import { makeState } from '@/lib/seed';
import { makeActions } from '@/lib/actions';
import { dailyState, hunger, weekKey, weekStats } from '@/lib/needs';
import { planWeek } from '@/lib/planner';
import { suggest } from '@/lib/review';
import { daysSince, sortPlaces, suggestPerson } from '@/lib/people';
import { machinePlan } from '@/lib/machine';
import { fill } from '@/lib/store';
import type { State, UiEvent } from '@/lib/types';
import { wStart } from '@/lib/util';

// Wednesday of the week 16–22 March 2026
const NOW = new Date('2026-03-18T10:00:00');
const WS = wStart(NOW);
const ev = (date: string, s: string, e: string, title: string): UiEvent => ({ id: title + date + s, date, s, e, title, c: 'c1' });

function setup(events: UiEvent[] = []) {
  const S = makeState(false);
  S.onboarded = true;
  const update = (fn: (s: State) => void) => fn(S);
  const A = makeActions({ update, getS: () => S, toast: () => {}, notify: () => {}, del: update });
  const eventsOn = (k: string) => [...events.filter(e => e.date === k), ...S.events.filter(e => e.date === k).map(e => ({ id: 'l' + e.id, localId: e.id, date: e.date, s: e.s, e: e.e, title: e.title, c: e.c }))];
  return { S, A, eventsOn };
}
const stat = (S: State, eventsOn: (k: string) => UiEvent[], key: string, now = NOW.getTime()) => weekStats(S, WS, eventsOn, now).find(x => x.need.key === key)!;

describe('hunger', () => {
  it('is green while the week goes at the needed pace, and red when two behind or out of days', () => {
    expect(hunger(0, 4, 0)).toBe('ok');   // Monday: nothing is expected yet
    expect(hunger(0, 4, 1)).toBe('warn'); // Tuesday: one is due
    expect(hunger(0, 4, 3)).toBe('red');  // Thursday: two behind
    expect(hunger(1, 4, 4)).toBe('red');  // Friday: 3 left in 3 days
    expect(hunger(4, 4, 6)).toBe('ok');
    expect(hunger(2, 2, 0)).toBe('ok');
    expect(hunger(0, 2, 5)).toBe('red');  // Saturday, two meetings and two days
  });
});

describe('weekly stats', () => {
  it('counts marks, past calendar events and workouts, but not future events', () => {
    const { S, A, eventsOn: base } = setup();
    const events = [ev('2026-03-16', '17:00', '18:00', 'Тренування'), ev('2026-03-18', '09:00', '09:30', 'Біг'), ev('2026-03-18', '17:00', '18:00', 'Тренування'), ev('2026-03-17', '18:00', '19:30', 'Побачення з друзями')];
    const eventsOn = (k: string) => [...base(k), ...events.filter(e => e.date === k)];
    A.logNeed(1, '2026-03-19');
    const sport = stat(S, eventsOn, 'sport');
    // Monday and Wednesday morning are past; Wednesday 17:00 is still ahead; the mark of Thursday is in the future too
    expect(sport.done).toBe(2);
    expect(stat(S, eventsOn, 'people').done).toBe(1);
    S.health['2026-03-17'] = { water: 0, sleep: 0, mood: 0, steps: 0, workout: 30, weight: 0 };
    expect(stat(S, eventsOn, 'sport').done).toBe(3);
  });

  it('does not count a workout twice when it was also marked or found in the calendar', () => {
    const { S, A, eventsOn } = setup();
    S.health['2026-03-16'] = { water: 0, sleep: 0, mood: 0, steps: 0, workout: 45, weight: 0 };
    A.logNeed(1, '2026-03-16');
    expect(stat(S, eventsOn, 'sport').done).toBe(1);
  });

  it('finds needs by words in the title', () => {
    const { S, eventsOn: base } = setup();
    const eventsOn = (k: string) => [...base(k), ...(k === '2026-03-17' ? [ev(k, '19:00', '19:30', 'Урок данської')] : [])];
    expect(stat(S, eventsOn, 'danish').done).toBe(1);
  });

  it('counts work on a money goal for the income need', () => {
    const { S, A, eventsOn } = setup();
    A.addMachine({ title: 'Машина', target: 60000, saved: 0, due: '2026-12-31', price: 5000, conv: 20 });
    A.logMachine(S.machines[0].id, { leads: 2 }, '2026-03-17');
    expect(stat(S, eventsOn, 'income').done).toBe(1);
  });

  it('a planned slot counts only after it is ticked', () => {
    const { S, A, eventsOn } = setup();
    A.planSlots([{ need: 1, date: '2026-03-16', s: '16:00', e: '16:40' }]);
    expect(stat(S, eventsOn, 'sport').done).toBe(0);
    A.toggleSlot(S.events[0].id);
    expect(stat(S, eventsOn, 'sport').done).toBe(1);
    A.toggleSlot(S.events[0].id);
    expect(stat(S, eventsOn, 'sport').done).toBe(0);
    expect(S.needLog).toHaveLength(0);
  });

  it('takes back only the last mark of the week', () => {
    const { S, A } = setup();
    A.logNeed(3, '2026-03-17'); A.logNeed(3, '2026-03-18');
    A.unlogNeed(3, NOW);
    expect(S.needLog.map(l => l.date)).toEqual(['2026-03-17']);
  });
});

describe('daily minimum', () => {
  it('ticks movement and a new thing in one tap and feeds the need «Нове»', () => {
    const { S, A } = setup();
    expect(dailyState(S, '2026-03-18')).toEqual({ move: false, nov: false, person: false });
    A.toggleDaily('move', '2026-03-18'); A.toggleDaily('nov', '2026-03-18');
    expect(dailyState(S, '2026-03-18')).toMatchObject({ move: true, nov: true });
    expect(S.needLog.filter(l => l.need === 3)).toHaveLength(1);
    A.toggleDaily('nov', '2026-03-18');
    expect(S.needLog).toHaveLength(0);
    expect(dailyState(S, '2026-03-18').nov).toBe(false);
  });

  it('a workout counts as movement, and a message to a person as the person', () => {
    const { S, A } = setup();
    S.health['2026-03-18'] = { water: 0, sleep: 0, mood: 0, steps: 0, workout: 20, weight: 0 };
    A.addPerson({ name: 'Анна', kind: 'friend', every: 14 });
    A.addTouch(S.people[0].id, 'msg', '2026-03-18');
    expect(dailyState(S, '2026-03-18')).toMatchObject({ move: true, person: true });
  });
});

describe('people', () => {
  it('suggests the person who has waited longest compared with the wanted gap', () => {
    const { S, A } = setup();
    A.addPerson({ name: 'Мама', kind: 'family', every: 7, last: '2026-03-15' });
    A.addPerson({ name: 'Олег', kind: 'friend', every: 14, last: '2026-02-20' });
    A.addPerson({ name: 'Нова', kind: 'friend', every: 14 });
    expect(daysSince(S, S.people[0].id, '2026-03-18')).toBe(3);
    expect(suggestPerson(S, '2026-03-18')!.person.name).toBe('Нова');
    A.addTouch(S.people[2].id, 'msg', '2026-03-18');
    expect(suggestPerson(S, '2026-03-18')!.person.name).toBe('Олег');
  });

  it('puts a planned person first on the day, and a meeting counts for «Люди»', () => {
    const { S, A, eventsOn } = setup();
    A.addPerson({ name: 'Мама', kind: 'family', every: 7, last: '2026-03-17' });
    A.addPerson({ name: 'Олег', kind: 'friend', every: 14, last: '2026-01-01', nextDate: undefined });
    A.updatePerson(S.people[0].id, { nextDate: '2026-03-18', next: 'піти на каву' });
    expect(suggestPerson(S, '2026-03-18')!.person.name).toBe('Мама');
    A.addTouch(S.people[0].id, 'meet', '2026-03-18');
    expect(S.people[0].nextDate).toBeUndefined();
    expect(stat(S, eventsOn, 'people').done).toBe(1);
    A.delTouch(S.touches[S.touches.length - 1].id);
    expect(stat(S, eventsOn, 'people').done).toBe(0);
  });

  it('a meeting with a partner also counts for «Стосунки», and visiting a club for «Люди»', () => {
    const { S, A, eventsOn } = setup();
    A.addPerson({ name: 'Марта', kind: 'partner', every: 2 });
    A.addTouch(S.people[0].id, 'meet', '2026-03-17');
    expect(stat(S, eventsOn, 'love').done).toBe(1);
    A.addPlace({ name: 'Шаховий клуб', what: 'клуб', going: '2026-03-18' });
    A.visitPlace(S.places[0].id, '2026-03-18');
    expect(S.places[0]).toMatchObject({ was: '2026-03-18' });
    expect(S.places[0].going).toBeUndefined();
    expect(stat(S, eventsOn, 'people').done).toBe(2);
  });

  it('removing a person removes their touches and the marks they gave', () => {
    const { S, A } = setup();
    A.addPerson({ name: 'Марта', kind: 'partner', every: 2 });
    A.addTouch(S.people[0].id, 'meet', '2026-03-17');
    A.delPerson(S.people[0].id);
    expect(S.touches).toHaveLength(0);
    expect(S.needLog).toHaveLength(0);
  });

  it('lists places with a date ahead first', () => {
    const list = [{ id: 1, name: 'a', what: '', was: '2026-01-01' }, { id: 2, name: 'b', what: '', going: '2026-03-25' }, { id: 3, name: 'c', what: '', going: '2026-03-20' }, { id: 4, name: 'd', what: '' }];
    expect(sortPlaces(list, '2026-03-18').map(p => p.name)).toEqual(['c', 'b', 'd', 'a']);
  });
});

describe('week plan', () => {
  it('puts the missing slots into the free windows, around the fixed blocks', () => {
    // school every weekday 08:00–15:30, work 16:00–20:00 on Mon–Wed
    const fixed: UiEvent[] = [];
    for (const k of ['2026-03-16', '2026-03-17', '2026-03-18', '2026-03-19', '2026-03-20']) fixed.push(ev(k, '08:00', '15:30', 'Школа'));
    for (const k of ['2026-03-18', '2026-03-19']) fixed.push(ev(k, '16:00', '20:00', 'Arbejde'));
    const { S, eventsOn: base } = setup(fixed);
    const eventsOn = (k: string): UiEvent[] => [...base(k)];
    const plan = planWeek(S, WS, eventsOn, NOW.getTime());
    const sport = plan.slots.filter(x => x.need === 1);
    expect(sport).toHaveLength(4);
    // never inside a fixed block, never twice on one day, and never in the past
    for (const x of plan.slots) {
      expect(`${x.date}T${x.s}` > '2026-03-18T10:00').toBe(true);
      const blocks = eventsOn(x.date).filter(e => !e.allDay);
      for (const b of blocks) expect(x.e <= b.s || x.s >= b.e).toBe(true);
    }
    expect(new Set(sport.map(x => x.date)).size).toBe(4);
    // people like the weekend
    const people = plan.slots.filter(x => x.need === 2);
    expect(people.map(x => x.date).sort()).toEqual(['2026-03-21', '2026-03-22']);
    // the sport slot on Wednesday starts when the work ends or before it starts
    expect(plan.slots.every(x => x.s >= '07:00')).toBe(true);
  });

  it('does not overlap two slots and counts what is already planned', () => {
    const { S, A, eventsOn } = setup();
    const before = planWeek(S, WS, eventsOn, NOW.getTime());
    A.planSlots(before.slots.filter(x => x.need === 1));
    const after = planWeek(S, WS, eventsOn, NOW.getTime());
    expect(after.slots.filter(x => x.need === 1)).toHaveLength(0);
    const all = [...S.events.map(e => ({ date: e.date, s: e.s, e: e.e })), ...after.slots];
    for (const a of all) for (const b of all) if (a !== b && a.date === b.date) expect(a.e <= b.s || a.s >= b.e).toBe(true);
  });

  it('reports a need that does not fit and plans nothing in a fully booked day', () => {
    const full: UiEvent[] = ['2026-03-18', '2026-03-19', '2026-03-20', '2026-03-21', '2026-03-22'].map(k => ev(k, '00:00', '23:59', 'Усе зайнято'));
    const { S, eventsOn: base } = setup(full);
    const plan = planWeek(S, WS, base, NOW.getTime());
    expect(plan.slots).toHaveLength(0);
    expect(plan.unplaced.length).toBeGreaterThan(0);
  });

  it('gives the only free slot to the need marked for focus in last week\'s review', () => {
    const { S, A, eventsOn: base } = setup();
    // two needs want the same hour; only one fits on the one free evening
    for (const n of S.needs) { if (n.id === 5 || n.id === 6) Object.assign(n, { weekly: 1, min: 60, from: '19:00', to: '22:00', days: 'any' }); else n.on = false; }
    const solo = (k: string) => (k < '2026-03-22' ? [...base(k), ev(k, '00:00', '23:59', 'зайнято')] : [...base(k), ev(k, '00:00', '19:00', 'зайнято'), ev(k, '20:30', '23:59', 'зайнято')]);
    expect(planWeek(S, WS, solo, NOW.getTime()).slots.map(x => x.need)).toEqual([5]);
    const lastWeek = weekKey(new Date('2026-03-11T10:00:00'));
    A.applySuggestion(lastWeek, { id: 'focus-6', need: 6, kind: 'focus', text: '', score: 1 });
    const plan = planWeek(S, WS, solo, NOW.getTime());
    expect(plan.slots.map(x => x.need)).toEqual([6]);
    expect(plan.unplaced).toEqual([{ need: 5, missing: 1 }]);
  });
});

describe('weekly review', () => {
  it('suggests at most two changes: a low mark with a missed target first', () => {
    const { S, A, eventsOn } = setup();
    A.logNeed(1, '2026-03-16'); A.logNeed(1, '2026-03-17'); A.logNeed(1, '2026-03-18'); A.logNeed(1, '2026-03-19');
    const stats = weekStats(S, WS, eventsOn, new Date('2026-03-22T20:00:00').getTime());
    const ratings = { 1: 1, 2: 3 };
    const sg = suggest(stats, ratings);
    expect(sg).toHaveLength(2);
    // sport: target met but still lacking → raise the target; people: nothing done and a mark of 1 → first in the plan
    expect(sg.map(x => x.kind)).toEqual(['raise', 'focus']);
    expect(sg.find(x => x.kind === 'raise')).toMatchObject({ need: 1, target: 5 });
  });

  it('suggests lowering a target that is too big when the need feels fine anyway', () => {
    const { S, A, eventsOn } = setup();
    A.logNeed(3, '2026-03-17');
    const stats = weekStats(S, WS, eventsOn, new Date('2026-03-22T20:00:00').getTime());
    const sg = suggest(stats, { 3: 5 });
    expect(sg).toHaveLength(1);
    expect(sg[0]).toMatchObject({ kind: 'lower', need: 3, target: 4 });
  });

  it('suggests nothing when all is well, and applying a suggestion changes the target once', () => {
    const { S, A, eventsOn } = setup();
    for (const k of ['2026-03-16', '2026-03-17', '2026-03-18', '2026-03-19']) A.logNeed(1, k);
    const stats = weekStats(S, WS, eventsOn, new Date('2026-03-22T20:00:00').getTime());
    expect(suggest(stats, { 1: 5 })).toEqual([]);
    const wk = weekKey(NOW);
    A.applySuggestion(wk, { id: 'raise-1', need: 1, kind: 'raise', text: '', target: 5, score: 1 });
    A.applySuggestion(wk, { id: 'raise-1', need: 1, kind: 'raise', text: '', target: 6, score: 1 });
    expect(S.needs[0].weekly).toBe(5);
    expect(S.reviews[wk].accepted).toEqual(['raise-1']);
  });
});

describe('money goal', () => {
  it('breaks the sum into clients and leads per week and shows the progress of this week', () => {
    const { S, A } = setup();
    // due on Sunday 5 weeks after this one starts (this week included: 5 weeks)
    A.addMachine({ title: 'Машина', target: 50000, saved: 10000, due: '2026-04-19', price: 5000, conv: 25 });
    const id = S.machines[0].id;
    let p = machinePlan(S.machines[0], NOW);
    expect(p.left).toBe(40000);
    expect(p.weeksLeft).toBe(5);
    expect(p.clients).toBe(8);
    expect(p.leads).toBe(32);
    expect(p.perWeek).toEqual({ leads: 7, clients: 2, money: 8000 });
    A.logMachine(id, { leads: 4 }, '2026-03-17');
    A.logMachine(id, { clients: 1, money: 5000 }, '2026-03-18');
    p = machinePlan(S.machines[0], NOW);
    // the weekly target does not move when the work is done
    expect(p.perWeek.leads).toBe(7);
    expect(p.week).toEqual({ leads: 4, clients: 1, money: 5000 });
    expect(p.share).toBeCloseTo((4 / 7 + 1 / 2) / 2, 5);
    expect(p.now).toBe(35000);
  });

  it('uses the real conversion once there are enough leads', () => {
    const { S, A } = setup();
    A.addMachine({ title: 'Машина', target: 50000, saved: 0, due: '2026-12-31', price: 5000, conv: 50 });
    A.logMachine(S.machines[0].id, { leads: 20, clients: 2, money: 10000 }, '2026-03-10');
    expect(machinePlan(S.machines[0], NOW).conv).toEqual({ pct: 10, real: true });
  });

  it('adds up logs of one day and drops an emptied log', () => {
    const { S, A } = setup();
    A.addMachine({ title: 'М', target: 1000, saved: 0, due: '2026-12-31', price: 100, conv: 20 });
    const id = S.machines[0].id;
    A.logMachine(id, { leads: 1 }, '2026-03-18'); A.logMachine(id, { leads: 2 }, '2026-03-18');
    expect(S.machines[0].log).toHaveLength(1);
    expect(S.machines[0].log[0].leads).toBe(3);
    A.logMachine(id, { leads: -3 }, '2026-03-18');
    expect(S.machines[0].log).toHaveLength(0);
  });

  it('refuses a goal without a sum or a price, and links that are not web addresses', () => {
    const { S, A } = setup();
    expect(A.addMachine({ title: 'М', target: 0, saved: 0, due: '', price: 100, conv: 20 })).toBe(false);
    expect(A.addMachine({ title: 'М', target: 100, saved: 0, due: '', price: 0, conv: 20 })).toBe(false);
    A.addMachine({ title: 'М', target: 100, saved: 0, due: '', price: 10, conv: 20, url: 'javascript:alert(1)' });
    expect(S.machines[0].url).toBeUndefined();
  });
});

describe('saved data', () => {
  it('gives older data the default needs and keeps the needs a person changed', () => {
    const old = makeState(false) as unknown as Record<string, unknown>;
    for (const k of ['needs', 'needLog', 'daily', 'reviews', 'people', 'touches', 'places', 'machines']) delete old[k];
    const s = fill(old as unknown as State);
    expect(s.needs.map(n => n.key)).toContain('sport');
    expect(s.needLog).toEqual([]);
    const own = { ...makeState(false), needs: [{ id: 50, name: 'Читання', weekly: 3, on: true, min: 30, from: '20:00', to: '22:00', days: 'any' }] } as unknown as State;
    expect(fill(own).needs).toHaveLength(1);
  });
});
