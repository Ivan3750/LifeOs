/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { applyIngest, guessCategory } from '@/lib/ingest';
import { makeState } from '@/lib/seed';

const fresh = () => JSON.parse(JSON.stringify(makeState(false))) as Record<string, any>;
const NOW = new Date('2026-11-07T20:00:00').getTime();

describe('applyIngest', () => {
  it('adds social time once and updates it when the total grows', () => {
    const S = fresh(), item = { type: 'social', ext: 'aw:2026-11-07:YouTube', date: '2026-11-07', platform: 'YouTube', min: 30 };
    expect(applyIngest(S, [item], 'pi', NOW).added).toBe(1);
    expect(applyIngest(S, [item], 'pi', NOW).skipped).toBe(1);
    expect(applyIngest(S, [{ ...item, min: 45 }], 'pi', NOW).updated).toBe(1);
    expect(S.social.filter((x: any) => x.ext === item.ext)).toHaveLength(1);
    expect(S.social.find((x: any) => x.ext === item.ext).min).toBe(45);
    expect(S.ingest).toMatchObject({ source: 'pi', n: 1 });
  });

  it('gives new records unique ids and moves nextId on', () => {
    const S = fresh(), start = S.nextId;
    applyIngest(S, [
      { type: 'tx', ext: 'a', dir: 'out', amt: 20, date: '2026-11-07', note: 'Netto' },
      { type: 'tx', ext: 'b', dir: 'out', amt: 30, date: '2026-11-07', note: 'Rejsekort' },
    ], 'pi', NOW);
    const ids = S.money.tx.filter((t: any) => t.ext).map((t: any) => t.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids.every((i: number) => i >= start)).toBe(true);
    expect(S.nextId).toBe(start + 2);
  });

  it('does not duplicate a bank line and sorts it into a category', () => {
    const S = fresh(), tx = { type: 'tx', ext: 'bank:1', dir: 'out', amt: 59.5, date: '2026-11-07', note: 'Netto Nørrebro' };
    applyIngest(S, [tx], 'pi', NOW); applyIngest(S, [tx], 'pi', NOW);
    const rows = S.money.tx.filter((t: any) => t.ext === 'bank:1');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: 'out', cat: 'Їжа', acc: 'dk', amt: 59.5 });
    expect(guessCategory('Wolt udbetaling', 'in')).toBe('Wolt');
  });

  it('never overwrites what was typed by hand, and counters only grow', () => {
    const S = fresh();
    S.health['2026-11-07'] = { water: 3, sleep: 6.5, mood: 0, steps: 4000, workout: 0, weight: 0 };
    applyIngest(S, [{ type: 'health', date: '2026-11-07', sleep: 8, steps: 3000, water: 2, workout: 25 }], 'pi', NOW);
    expect(S.health['2026-11-07']).toMatchObject({ sleep: 6.5, steps: 4000, water: 3, workout: 25 });
    applyIngest(S, [{ type: 'health', date: '2026-11-07', steps: 9000 }], 'pi', NOW);
    expect(S.health['2026-11-07'].steps).toBe(9000);
  });

  it('works out the night from bed and wake times', () => {
    const S = fresh();
    applyIngest(S, [{ type: 'health', date: '2026-11-08', bed: '23:30', wake: '07:00' }], 'pi', NOW);
    expect(S.health['2026-11-08']).toMatchObject({ bed: '23:30', wake: '07:00', sleep: 7.5 });
  });

  it('reports bad items and still applies the good ones', () => {
    const S = fresh();
    const r = applyIngest(S, [
      'junk', { type: 'nope' }, { type: 'social', ext: 'x', date: 'yesterday', platform: 'X', min: 5 },
      { type: 'activity', ext: 'z', kind: 'Wolt', start: NOW - 3 * 36e5, end: NOW - 36e5 },
      { type: 'activity', ext: 'w', kind: 'Wolt', start: NOW - 3 * 36e5, end: NOW + 10 * 36e5 },
    ], 'pi', NOW);
    expect(r.added).toBe(1);
    expect(r.rejected.map(x => x.i)).toEqual([0, 1, 2, 4]);
  });

  it('leaves the state alone when nothing was applied', () => {
    const S = fresh(), before = JSON.stringify(S);
    applyIngest(S, [{ type: 'social', ext: 'x', date: 'bad', platform: 'X', min: 5 }], 'pi', NOW);
    expect(JSON.stringify(S)).toBe(before);
  });
});
