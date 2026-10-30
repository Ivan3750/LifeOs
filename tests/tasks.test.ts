import { describe, expect, it } from 'vitest';
import { dueLabel, dueState, parseTask } from '@/lib/tasks';

const NOW = new Date('2026-03-18T10:00:00'); // Wednesday

describe('parseTask', () => {
  it('reads priority and a relative day at the end', () => {
    expect(parseTask('Подзвонити клієнту завтра !', NOW)).toEqual({ t: 'Подзвонити клієнту', p: 'hi', due: '2026-03-19' });
  });
  it('reads a leading !', () => {
    expect(parseTask('! Здати звіт', NOW)).toEqual({ t: 'Здати звіт', p: 'hi' });
  });
  it('reads a date and rolls it into next year when it has passed', () => {
    expect(parseTask('Податки 25.03', NOW).due).toBe('2026-03-25');
    expect(parseTask('Подарунок 01.02', NOW).due).toBe('2027-02-01');
    expect(parseTask('Паспорт 5.6.2027', NOW).due).toBe('2027-06-05');
  });
  it('leaves words in the middle of the sentence alone', () => {
    expect(parseTask('Купити квитки на завтрашній концерт', NOW)).toEqual({ t: 'Купити квитки на завтрашній концерт', p: 'lo' });
    expect(parseTask('Що робити завтра вранці', NOW).due).toBeUndefined();
  });
  it('never turns the whole line into a date', () => {
    expect(parseTask('завтра', NOW)).toEqual({ t: 'завтра', p: 'lo' });
    expect(parseTask('32.13 щось', NOW).t).toBe('32.13 щось');
  });
});

describe('due dates', () => {
  it('tells how urgent a date is', () => {
    expect(dueState('2026-03-17', NOW)).toBe('overdue');
    expect(dueState('2026-03-18', NOW)).toBe('today');
    expect(dueState('2026-03-19', NOW)).toBe('tomorrow');
    expect(dueState('2026-03-22', NOW)).toBe('week');
    expect(dueState('2026-04-22', NOW)).toBe('later');
    expect(dueState(undefined, NOW)).toBe('none');
  });
  it('labels them for people', () => {
    expect(dueLabel('2026-03-18', NOW)).toBe('сьогодні');
    expect(dueLabel('2026-03-16', NOW)).toBe('2 дн тому');
    expect(dueLabel('2026-03-20', NOW)).toBe('Пт, 20 бер');
  });
});
