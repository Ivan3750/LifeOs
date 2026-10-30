import { describe, expect, it } from 'vitest';
import { fill } from '@/lib/store';
import { makeState } from '@/lib/seed';
import type { State } from '@/lib/types';

describe('fill', () => {
  it('fills fields that older versions did not have', () => {
    const old = makeState(false) as unknown as Record<string, unknown>;
    delete old.noteList; delete old.moods; delete old.offDays;
    old.notes = 'старі нотатки';
    const s = fill(old as unknown as State);
    expect(Array.isArray(s.moods)).toBe(true);
    expect(s.noteList).toHaveLength(1);
    expect(s.noteList[0].text).toBe('старі нотатки');
    expect(s.notes).toBe('');
  });

  it('moves the old single budget onto the Danish account', () => {
    const old = makeState(false) as unknown as { money: Record<string, unknown> };
    delete old.money.accounts; old.money.budget = 4321;
    const s = fill(old as unknown as State);
    expect(s.money.accounts.find(a => a.id === 'dk')?.budget).toBe(4321);
  });

  it('repairs values of the wrong kind instead of crashing later', () => {
    const bad = { ...makeState(false), tasks: 'oops', goal: 'many', co: { name: 5 }, health: [] } as unknown as State;
    const s = fill(bad);
    expect(Array.isArray(s.tasks)).toBe(true);
    expect(typeof s.goal).toBe('number');
    expect(typeof s.co.name).toBe('string');
    expect(Array.isArray(s.co.deals)).toBe(true);
    expect(Array.isArray(s.health)).toBe(false);
  });

  it('survives garbage', () => {
    expect(Array.isArray(fill(null as unknown as State).tasks)).toBe(true);
    expect(Array.isArray(fill('x' as unknown as State).tasks)).toBe(true);
  });
});
