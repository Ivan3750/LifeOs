import { describe, expect, it } from 'vitest';
import { extOn, seriesSizes } from '@/lib/extcal';
import { makeActions } from '@/lib/actions';
import { makeState } from '@/lib/seed';
import { napMinutes, sleepTotal } from '@/lib/sleep';
import { freeTime } from '@/lib/score';
import type { ExtEvent, State } from '@/lib/types';

const setup = () => { const S: State = makeState(false); const A = makeActions({ update: fn => fn(S), getS: () => S, toast: () => {}, notify: () => {}, del: fn => fn(S) }); return { S, A }; };
const ev = (id: string, series: string, day: string, h = 9): ExtEvent => ({ id, series, title: 'Standup', start: `${day}T${String(h).padStart(2, '0')}:00:00`, end: `${day}T${String(h + 1).padStart(2, '0')}:00:00`, allDay: false, src: 0 });

describe('events hidden on this site only', () => {
  const ext = [ev('0-a-1', '0-a', '2026-03-02'), ev('0-a-2', '0-a', '2026-03-09'), ev('0-b-1', '0-b', '2026-03-02')];

  it('shows everything by default and marks repeating events', () => {
    const day = extOn(ext, undefined, '2026-03-02');
    expect(day.map(e => e.title)).toEqual(['Standup', 'Standup']);
    expect(day.find(e => e.series === '0-a')?.repeats).toBe(true);
    expect(day.find(e => e.series === '0-b')?.repeats).toBe(false);
    expect(seriesSizes(ext).get('0-a')).toBe(2);
  });

  it('hides one occurrence, or the whole series, without touching the other events', () => {
    expect(extOn(ext, { '0-a-1': 1 }, '2026-03-02').map(e => e.series)).toEqual(['0-b']);
    expect(extOn(ext, { '0-a-1': 1 }, '2026-03-09')).toHaveLength(1);
    expect(extOn(ext, { '0-a': 1 }, '2026-03-09')).toHaveLength(0);
    expect(extOn(ext, { '0-a': 1 }, '2026-03-02').map(e => e.series)).toEqual(['0-b']);
  });

  it('actions hide and show them again', () => {
    const { S, A } = setup();
    A.hideExt('0-a-1'); A.hideExt('0-b', true);
    expect(S.hiddenExt).toEqual({ '0-a-1': 1, '0-b': 1 });
    A.showExt('0-a-1');
    expect(S.hiddenExt).toEqual({ '0-b': 1 });
    A.showExt();
    expect(S.hiddenExt).toBeUndefined();
  });
});

describe('daytime sleep', () => {
  it('adds naps on top of the night, sorted, and removes them', () => {
    const { S, A } = setup();
    expect(A.addNap('15:00', '15:20', '2026-03-17')).toBe(true);
    expect(A.addNap('13:00', '13:30', '2026-03-17')).toBe(true);
    const h = S.health['2026-03-17'];
    expect(h.naps!.map(n => n.s)).toEqual(['13:00', '15:00']);
    expect(napMinutes(h)).toBe(50);
    h.sleep = 7;
    expect(sleepTotal(h)).toBe(7.8);
    A.delNap(h.naps![0].id, '2026-03-17');
    expect(napMinutes(S.health['2026-03-17'])).toBe(20);
    A.delNap(S.health['2026-03-17'].naps![0].id, '2026-03-17');
    expect(S.health['2026-03-17'].naps).toBeUndefined();
  });

  it('refuses a nap that ends before it starts', () => {
    const { S, A } = setup();
    expect(A.addNap('14:00', '13:00', '2026-03-17')).toBe(false);
    expect(S.health['2026-03-17']).toBeUndefined();
  });

  it('takes the nap out of the free time of the day', () => {
    const { S } = setup();
    S.dayStart = '08:00'; S.dayEnd = '20:00'; S.dayFromSleep = false; S.meals = [];
    const k = '2026-03-17', now = new Date('2026-03-18T00:00').getTime();
    const free = freeTime(S, k, [], [], now).freeDay;
    const nap = { id: 'n1', date: k, s: '13:00', e: '14:00', title: 'Денний сон', c: 'nap', nap: 1 };
    expect(freeTime(S, k, [nap], [], now).freeDay).toBe(free - 60);
  });
});
