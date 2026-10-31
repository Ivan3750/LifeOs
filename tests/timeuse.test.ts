import { describe, expect, it } from 'vitest';
import { makeState } from '@/lib/seed';
import { classify, eventGroups, learn, normTitle, stems, timeLedger, unlearn } from '@/lib/timeuse';
import { socialOn, socialPeriod } from '@/lib/social';
import { keepsRhythm, sleepStability } from '@/lib/sleep';
import type { State, UiEvent } from '@/lib/types';

const blank = (): State => { const s = makeState(false); s.meals = []; return s; };
const ev = (id: string, date: string, s: string, e: string, title: string): UiEvent => ({ id, date, s, e, title, c: 'c1' });

describe('what an event means', () => {
  it('ignores case, numbers and punctuation in a title', () => {
    expect(normTitle('  Воркшоп №2: Дизайн! ')).toBe('воркшоп дизайн');
    expect(stems('Лекція: Алгоритми')).toEqual(['лекці', 'алгор']);
  });

  it('guesses from plain words, but knows nothing about strange titles', () => {
    const s = blank();
    expect(classify(s, 'Лекція: Алгоритми')).toEqual({ cat: 'study', source: 'guess' });
    expect(classify(s, 'Спортзал о 19:00')).toMatchObject({ cat: 'sport' });
    expect(classify(s, 'Xyz abc')).toEqual({ cat: null, source: 'none' });
  });

  it('remembers an answer and applies it to the same title', () => {
    const s = blank();
    learn(s, 'Зустріч клубу', 'people');
    expect(classify(s, 'зустріч клубу!')).toEqual({ cat: 'people', source: 'user' });
  });

  it('learns from words: a new title with a known word gets the same answer', () => {
    const s = blank();
    learn(s, 'Клуб шахів', 'rest');
    learn(s, 'Клуб програмування', 'rest');
    expect(classify(s, 'Клуб на вихідних')).toEqual({ cat: 'rest', source: 'learned' });
  });

  it('does not trust a word that was answered both ways', () => {
    const s = blank();
    learn(s, 'Зустріч з клієнтом', 'work'); learn(s, 'Зустріч з другом', 'people');
    expect(classify(s, 'Зустріч щось').source).not.toBe('learned');
  });

  it('takes the votes back when an answer changes or is removed', () => {
    const s = blank();
    learn(s, 'Клуб шахів', 'rest');
    learn(s, 'Клуб шахів', 'study');
    expect(s.evWords['клуб']).toEqual({ study: 1 });
    unlearn(s, 'Клуб шахів');
    expect(s.evCats).toEqual({}); expect(s.evWords).toEqual({});
  });
});

describe('events by title and the ledger of the day', () => {
  const day = '2026-03-17';
  it('groups the same title and adds up the minutes, leaving out errands and all-day events', () => {
    const s = blank();
    const list = [ev('a', day, '10:00', '11:00', 'Лекція 1'), ev('b', day, '12:00', '13:30', 'Лекція 2'), { ...ev('c', day, '00:00', '23:59', 'Свято'), allDay: true }, { ...ev('d', day, '15:00', '16:00', 'Wolt'), act: 3 }];
    const g = eventGroups(s, [day], () => list);
    expect(g.map(x => [x.norm, x.min, x.count])).toEqual([['лекція', 150, 2]]);
  });

  it('counts overlapping time once and puts focus before events', () => {
    const s = blank();
    s.sessions.push({ t: new Date(day + 'T10:00').getTime(), m: 60 });
    s.health[day] = { water: 0, sleep: 8, mood: 0, steps: 0, workout: 0, weight: 0 };
    s.social.push({ id: 1, date: day, platform: 'YouTube', min: 45 });
    const l = timeLedger(s, [day], () => [ev('a', day, '10:00', '12:00', 'Лекція')], new Date('2026-03-18T00:00').getTime());
    const m = Object.fromEntries(l.rows.map(r => [r.key, r.min]));
    expect(m.focus).toBe(60);
    expect(m['ev:study']).toBe(60); // the hour already counted as focus is not counted again
    expect(m.sleep).toBe(480); expect(m.social).toBe(45);
    expect(l.rows.reduce((a, r) => a + r.min, 0)).toBeCloseTo(l.total);
  });
});

describe('social media', () => {
  it('sums a day per platform and measures what is above the limits', () => {
    const s = blank(); const d = '2026-03-17';
    s.social.push({ id: 1, date: d, platform: 'Instagram', min: 50, cmp: 1 }, { id: 2, date: d, platform: 'YouTube', min: 20 }, { id: 3, date: d, platform: 'TikTok', min: 90 });
    const r = socialOn(s, d);
    expect(r.total).toBe(160); expect(r.over).toBe(20); expect(r.compared).toBe(true); // TikTok has no limit
  });
  it('summarises a week', () => {
    const s = blank(); const now = new Date('2026-03-18T12:00');
    s.social.push({ id: 1, date: '2026-03-18', platform: 'Instagram', min: 40, why: 'Розваги', cmp: 1 }, { id: 2, date: '2026-03-10', platform: 'Instagram', min: 90 });
    const w = socialPeriod(s, 7, now);
    expect(w.total).toBe(40); expect(w.overDays).toBe(1); expect(w.compared).toBe(1); expect(w.why).toEqual({ Розваги: 40 });
  });
});

describe('sleep rhythm', () => {
  it('forgives a bedtime up to half an hour after the target and punishes a very late one', () => {
    const s = blank();
    expect(keepsRhythm(s, '23:50', undefined)).toBe(1);
    expect(keepsRhythm(s, '01:00', undefined)!).toBeCloseTo(0.5);
    expect(keepsRhythm(s, '03:00', undefined)).toBe(0);
    expect(keepsRhythm(s, undefined, undefined)).toBeNull();
    expect(keepsRhythm(s, undefined, '07:45')).toBe(1);
  });

  it('finds how steady the nights are and notices the move to an earlier bedtime', () => {
    const s = blank(); const now = new Date('2026-03-18T12:00');
    const beds = ['02:30', '02:00', '03:00', '01:45', '02:15', '00:30', '23:45', '23:30', '23:50'];
    beds.forEach((b, i) => { const k = new Date(now.getTime() - (beds.length - 1 - i) * 864e5).toISOString().slice(0, 10); s.health[k] = { water: 0, sleep: 8, mood: 0, steps: 0, workout: 0, weight: 0, bed: b, wake: '09:00' }; });
    const r = sleepStability(s, 14, now);
    expect(r.bedNights).toBe(9); expect(r.lateNights).toBe(6); expect(r.onTarget).toBe(3);
    expect(r.earlier).toBeGreaterThan(60); // bedtime moved earlier
    expect(r.windDown).toBe('22:50');
  });
});
