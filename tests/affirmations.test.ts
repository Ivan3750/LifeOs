import { describe, expect, it } from 'vitest';
import { AFFIRMATIONS, dailySet, flatAffirmations } from '@/lib/affirmations';

describe('affirmations', () => {
  it('has no empty or duplicate lines', () => {
    const all = flatAffirmations();
    expect(all.length).toBeGreaterThan(150);
    expect(new Set(all.map(a => a.text)).size).toBe(all.length);
    expect(all.every(a => a.text.trim().length > 0)).toBe(true);
  });
  it('filters by group', () => {
    const g = AFFIRMATIONS[0];
    expect(flatAffirmations(g.key)).toHaveLength(g.items.length);
  });
  it('gives ten distinct lines per day, stable within a day and different between days', () => {
    const a = dailySet('2026-11-01'), b = dailySet('2026-11-01'), c = dailySet('2026-11-02');
    expect(a).toHaveLength(10);
    expect(new Set(a.map(x => x.text)).size).toBe(10);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});
