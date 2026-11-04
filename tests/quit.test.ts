import { describe, expect, it } from 'vitest';
import { makeState } from '@/lib/seed';
import { makeActions } from '@/lib/actions';
import { bestStreak, cleanDays, cravingStats, dayMarks, nextMilestone, quitOn, streakDays } from '@/lib/quit';
import { dayScore } from '@/lib/score';
import { buildTables, SECTIONS, type SectionKey } from '@/lib/export';
import { coach } from '@/lib/coach';
import type { State } from '@/lib/types';
import { addD, ymd } from '@/lib/util';

const DAYMS = 864e5, NOW = new Date('2026-03-18T15:00:00');
function setup() {
  const S: State = makeState(false); S.meals = [];
  const A = makeActions({ update: fn => fn(S), getS: () => S, toast: () => {}, notify: () => {}, del: fn => fn(S) });
  return { S, A };
}

describe('habits to quit: streak that keeps progress', () => {
  it('counts whole days without a slip and the next milestone', () => {
    const { S, A } = setup(); A.addBad('Солодке');
    const h = S.badHabits[0]; h.start = NOW.getTime() - 10.5 * DAYMS;
    expect(streakDays(h, NOW.getTime())).toBe(10);
    expect(nextMilestone(10)).toEqual({ target: 14, left: 4, from: 7 });
    expect(nextMilestone(400)).toBeNull();
  });

  it('a slip restarts the streak but keeps the best one and all the clean days', () => {
    const { S, A } = setup(); A.addBad('Скрол');
    const h = S.badHabits[0], t0 = Date.now(); h.start = t0 - 12 * DAYMS;
    A.slipBad(h.id, 'Стрес');
    expect(streakDays(h, Date.now())).toBe(0);
    expect(h.best).toBe(12); expect(bestStreak(h)).toBe(12);
    expect(h.slips).toHaveLength(1);
    expect(cleanDays(h)).toBe(12); // 13 calendar days minus the day of the slip
    expect(S.cravings[0]).toMatchObject({ outcome: 'slipped', trigger: 'Стрес' });
    // a second streak that is shorter does not lower the best
    h.slips[0] = t0 - 3 * DAYMS; A.slipBad(h.id); expect(h.best).toBe(12);
  });

  it('marks the last days: before the start, clean, slip', () => {
    const { S, A } = setup(); A.addBad('X');
    const h = S.badHabits[0]; h.start = new Date('2026-03-15T08:00').getTime(); h.slips = [new Date('2026-03-17T20:00').getTime()];
    expect(dayMarks(h, 5, NOW).map(d => d.mark)).toEqual(['none', 'ok', 'ok', 'slip', 'ok']);
  });

  it('records a held craving with its reason and the tool that helped, and shows the statistics', () => {
    const { S, A } = setup(); A.addBad('Цукор'); const id = S.badHabits[0].id;
    A.logCraving(id, 'Нудьга', 'resisted', 'breath'); A.logCraving(id, 'Нудьга', 'resisted', 'game'); A.logCraving(id, 'Стрес', 'slipped');
    const st = cravingStats(S, 30, Date.now() + 1000);
    expect(st.total).toBe(3); expect(st.held).toBe(2); expect(st.top).toBe('Нудьга');
    expect(st.by['Нудьга']).toEqual({ n: 2, held: 2 });
    expect(S.badHabits[0].slips).toHaveLength(0); // a held craving costs nothing
  });

  it('removes the cravings together with the habit, and ignores an empty name', () => {
    const { S, A } = setup();
    expect(A.addBad('  ')).toBe(false);
    A.addBad('A'); const id = S.badHabits[0].id; A.logCraving(id, 'Інше'); A.delBad(id);
    expect(S.badHabits).toEqual([]); expect(S.cravings).toEqual([]);
  });
});

describe('habits to quit in the day score, export and advice', () => {
  const day = '2026-03-17';
  const health = { water: 8, sleep: 8, mood: 0, steps: 0, workout: 30, weight: 0, bed: '23:30', wake: '07:30' };

  it('gives a full mark for a clean day and nothing for a day with a slip', () => {
    const { S } = setup(); S.health[day] = health;
    S.badHabits.push({ id: 1, name: 'A', start: new Date('2026-03-10T10:00').getTime(), best: 0, slips: [] }, { id: 2, name: 'B', start: new Date('2026-03-10T10:00').getTime(), best: 0, slips: [] });
    expect(dayScore(S, day, [], [], NOW.getTime()).parts.find(p => p.key === 'quit')?.got).toBe(5);
    S.badHabits[0].slips.push(new Date(day + 'T22:00').getTime());
    expect(dayScore(S, day, [], [], NOW.getTime()).parts.find(p => p.key === 'quit')?.got).toBe(2.5);
    expect(quitOn(S, day).slipped.map(h => h.name)).toEqual(['A']);
  });

  it('skips the part when nothing is tracked or the habit had not started yet', () => {
    const { S } = setup(); S.health[day] = health;
    expect(dayScore(S, day, [], [], NOW.getTime()).skipped.some(x => x.key === 'quit')).toBe(true);
    S.badHabits.push({ id: 1, name: 'A', start: new Date('2026-03-18T08:00').getTime(), best: 0, slips: [] });
    expect(dayScore(S, day, [], [], NOW.getTime()).skipped.some(x => x.key === 'quit')).toBe(true);
  });

  it('exports cravings and slips', () => {
    const { S, A } = setup(); A.addBad('Цукор'); A.logCraving(S.badHabits[0].id, 'Стрес', 'resisted', 'exercise');
    const on = Object.fromEntries(SECTIONS.map(([k]) => [k, true])) as Record<SectionKey, boolean>;
    const t = buildTables(S, [], { from: '0000-01-01', to: ymd(addD(new Date(), 1)) }, on).find(x => x.file === 'vidmova')!;
    expect(t.rows).toHaveLength(1); expect(t.rows[0].slice(2)).toEqual(['Цукор', 'витримав', 'Стрес', 'вправи']);
  });

  it('says that a slip is data, not a defeat, and points to the usual trigger', () => {
    const { S, A } = setup(); A.addBad('Скрол'); const id = S.badHabits[0].id;
    A.logCraving(id, 'Нудьга'); A.slipBad(id, 'Нудьга');
    const tip = coach(S, () => [], new Date()).tips.find(t => t.id === 'slip')!;
    expect(tip.title).toContain('Скрол'); expect(tip.facts.join(' ')).toContain('нудьга'); expect(tip.why).toContain('причина');
  });
});
