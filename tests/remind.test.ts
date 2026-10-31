import { describe, expect, it } from 'vitest';
import { makeState } from '@/lib/seed';
import { DEFAULT_REMIND, dangerHours, dueNow, firedKey, remindText, reminderTimes, type RemindCfg } from '@/lib/remind';
import { checkPin, makePin, pinHints, validPin, waitAfter } from '@/lib/pin';
import type { State } from '@/lib/types';

const NOW = new Date('2026-03-18T20:50:00');
const at = (h: number, m = 0) => new Date(`2026-03-18T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
function world(): State {
  const S = makeState(false);
  S.badHabits.push({ id: 1, name: 'X', start: NOW.getTime() - 30 * 864e5, best: 0, slips: [] });
  // cravings: three at 21:xx, one at 15:xx, two at 09:xx (but one is older than 60 days)
  const c = (d: number, h: number) => S.cravings.push({ id: S.cravings.length + 10, t: new Date(`2026-03-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:20:00`).getTime(), habit: 1, trigger: 'Нудьга', outcome: 'resisted' });
  c(10, 21); c(12, 21); c(15, 21); c(11, 15); c(5, 9); c(6, 9);
  S.cravings.push({ id: 99, t: new Date('2025-12-01T09:00').getTime(), habit: 1, trigger: 'Інше', outcome: 'resisted' });
  return S;
}
const cfg = (p: Partial<RemindCfg> = {}): RemindCfg => ({ ...DEFAULT_REMIND, on: true, ...p });

describe('dangerous hours', () => {
  it('takes the hours with at least two cravings, the busiest first three, in the order of the day', () => {
    expect(dangerHours(world(), NOW.getTime())).toEqual([9, 21]);
  });
  it('combines the hours from the history with hand-picked times, and nothing without a habit to quit', () => {
    const S = world();
    expect(reminderTimes(S, cfg({ hours: ['18:30', '21:00'] }), NOW.getTime())).toEqual([{ min: 540, auto: true }, { min: 1110, auto: false }, { min: 1260, auto: true }]);
    expect(reminderTimes(S, cfg({ auto: false, hours: [] }), NOW.getTime())).toEqual([]);
    S.badHabits = [];
    expect(reminderTimes(S, cfg(), NOW.getTime())).toEqual([]);
  });
});

describe('when to remind', () => {
  const times = [{ min: 21 * 60, auto: true }];
  it('is due from the lead time up to half an hour after, once a day', () => {
    expect(dueNow(times, cfg({ lead: 15 }), at(20, 40), [])).toBeNull();
    expect(dueNow(times, cfg({ lead: 15 }), at(20, 50), [])?.min).toBe(1260);
    expect(dueNow(times, cfg({ lead: 15 }), at(21, 25), [])?.min).toBe(1260);
    expect(dueNow(times, cfg({ lead: 15 }), at(21, 40), [])).toBeNull();
    expect(dueNow(times, cfg({ lead: 15 }), at(20, 50), [firedKey(at(20, 50), times[0])])).toBeNull();
  });
  it('does nothing while switched off', () => { expect(dueNow(times, cfg({ on: false }), at(21), [])).toBeNull(); });
  it('does not name the habit in the text', () => {
    const before = remindText(times[0], at(20, 45)), on = remindText(times[0], at(21, 5));
    expect(before.body).toContain('Через 15 хв'); expect(on.body).toContain('21:00');
    expect(before.title + before.body + on.body).not.toContain('X');
  });
});

describe('phone code', () => {
  it('accepts only English letters and digits, 4 to 32 characters', () => {
    expect(validPin('ab12')).toBe(true); expect(validPin('Secret2026')).toBe(true);
    expect(validPin('abc')).toBe(false); expect(validPin('привіт12')).toBe(false); expect(validPin('ab 12')).toBe(false); expect(validPin('a'.repeat(33))).toBe(false);
    expect(pinHints('1234')).toEqual(['додай хоча б одну літеру', 'краще від 6 символів']);
    expect(pinHints('abcd1234')).toEqual([]);
  });
  it('keeps only a salted hash that checks the right code and nothing else', async () => {
    const r = await makePin('Ab12cd', 60, 1000), r2 = await makePin('Ab12cd', 60, 1000);
    expect(JSON.stringify(r)).not.toContain('Ab12cd');
    expect(r.hash).not.toBe(r2.hash); // a new salt every time
    expect(await checkPin('Ab12cd', r)).toBe(true);
    expect(await checkPin('ab12cd', r)).toBe(false);
    expect(await checkPin('Ab12c', r)).toBe(false);
    expect(r.lock).toBe(60);
  });
  it('slows down after five wrong tries', () => {
    expect([0, 1, 4].map(waitAfter)).toEqual([0, 0, 0]);
    expect([5, 6, 7].map(waitAfter)).toEqual([30, 60, 120]);
    expect(waitAfter(50)).toBe(3600);
  });
});
