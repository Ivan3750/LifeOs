import { describe, expect, it } from 'vitest';
import { makeState } from '@/lib/seed';
import { potential, ranked, repeating, weeklyMinutes } from '@/lib/automation';
import type { AutoIdea, State } from '@/lib/types';

const idea = (o: Partial<AutoIdea> & { id: number }): AutoIdea => ({ title: 't' + o.id, what: '', mins: 0, perWeek: 0, effort: 'mid', priority: 'mid', status: 'idea', seen: 1, created: '2026-11-01', ...o });

describe('automation ideas', () => {
  it('shows a saving only when both numbers were given', () => {
    expect(weeklyMinutes({ mins: 0, perWeek: 5 })).toBeNull();
    expect(weeklyMinutes({ mins: 15, perWeek: 0 })).toBeNull();
    expect(weeklyMinutes({ mins: 15, perWeek: 4 })).toBe(60);
  });

  it('sums only the ideas that are open and have numbers, and says how many were counted', () => {
    const p = potential([idea({ id: 1, mins: 10, perWeek: 3 }), idea({ id: 2 }), idea({ id: 3, mins: 60, perWeek: 1, status: 'done' }), idea({ id: 4, mins: 5, perWeek: 2, status: 'doing' })]);
    expect(p).toEqual({ minutes: 40, known: 2, open: 3 });
    expect(potential([])).toEqual({ minutes: 0, known: 0, open: 0 });
  });

  it('puts what is being done first, then by priority, then by time saved; done ones last', () => {
    const list = ranked([
      idea({ id: 1, priority: 'low', mins: 100, perWeek: 10 }), idea({ id: 2, priority: 'high' }), idea({ id: 3, status: 'done', priority: 'high' }),
      idea({ id: 4, priority: 'high', mins: 10, perWeek: 2 }), idea({ id: 5, status: 'doing', priority: 'low' }),
    ]);
    expect(list.map(a => a.id)).toEqual([5, 4, 2, 1, 3]);
  });

  it('notices tasks that keep coming back, and ones marked repeating, but not those already listed', () => {
    const S: State = makeState(false);
    const add = (t: string, extra: object = {}) => S.tasks.push({ id: S.nextId++, t, p: 'lo', d: false, ...extra });
    add('Виставити рахунок'); add('виставити  рахунок '); add('Виставити рахунок');
    add('Раз на місяць звіт', { rep: 'month' }); add('Одноразове');
    expect(repeating(S).map(r => [r.title, r.times])).toEqual([['Виставити рахунок', 3], ['Раз на місяць звіт', 1]]);
    S.co.auto.push(idea({ id: 99, title: 'Виставити рахунок' }));
    expect(repeating(S).map(r => r.title)).toEqual(['Раз на місяць звіт']);
  });
});
