import { describe, expect, it } from 'vitest';
import { makeActions } from '@/lib/actions';
import { makeState } from '@/lib/seed';
import { balance, budgetDKK, expectedIncomeDKK, monthPlan, pendingRecurring, potSaved, realTx } from '@/lib/money';
import { ymd } from '@/lib/util';
import { moneyInsights, noSpendStreak } from '@/lib/insights';
import type { State } from '@/lib/types';

const NOW = new Date('2026-03-18T12:00:00');
function setup() {
  const S: State = makeState(false);
  S.money.accounts[0].budget = 3000; S.money.accounts[1].budget = 0;
  const A = makeActions({ update: fn => fn(S), getS: () => S, toast: () => {}, notify: () => {}, del: fn => fn(S) });
  return { S, A };
}
const tx = (S: State, p: Partial<State['money']['tx'][number]>) => S.money.tx.push({ id: S.nextId++, type: 'out', amt: 100, cat: 'Їжа', note: '', date: '2026-03-10', acc: 'dk', ...p });

describe('budget that takes income into account', () => {
  it('uses the fixed budget by default', () => {
    const { S } = setup();
    expect(budgetDKK(S, '2026-03')).toBe(3000);
  });
  it('in income mode: income minus the savings share', () => {
    const { S } = setup();
    S.money.budgetMode = 'income'; S.money.saveRate = 25;
    tx(S, { type: 'in', amt: 10000, cat: 'Зарплата', date: '2026-02-27' });
    expect(budgetDKK(S, '2026-02')).toBe(7500);
  });
  it('falls back to the fixed budget while the month has no income', () => {
    const { S } = setup();
    S.money.budgetMode = 'income';
    expect(budgetDKK(S, '2026-02')).toBe(3000);
  });
  it('counts income that is still expected from regular incomes this month', () => {
    const { S, A } = setup();
    S.money.budgetMode = 'income'; S.money.saveRate = 0;
    A.addRecurring({ type: 'in', name: 'Зарплата', amt: 12000, day: 28, cat: 'Зарплата', acc: 'dk', from: '2026-03' });
    expect(expectedIncomeDKK(S, '2026-03', '2026-03-18')).toBe(12000);
    expect(expectedIncomeDKK(S, '2026-03', '2026-03-28')).toBe(0);
  });
});

describe('month plan', () => {
  it('shows income, spending, what is left and the daily allowance', () => {
    const { S } = setup();
    tx(S, { type: 'in', amt: 5000, cat: 'Зарплата', date: '2026-03-02' });
    tx(S, { amt: 600, date: '2026-03-05' });
    const p = monthPlan(S, '2026-03', NOW);
    expect(p).toMatchObject({ income: 5000, spent: 600, net: 4400 });
    expect(p.rate).toBeCloseTo(0.88);
    expect(p.left).toBe(2400);
    expect(p.daysLeft).toBe(14);
    expect(Math.round(p.perDay)).toBe(171);
    expect(Math.round(p.forecast!)).toBe(Math.round((600 / 18) * 31));
  });
  it('has no forecast in the first days of a month', () => {
    const { S } = setup();
    expect(monthPlan(S, '2026-03', new Date('2026-03-02T12:00:00')).forecast).toBeNull();
  });
});

describe('regular payments', () => {
  it('adds each month once and never twice', () => {
    const { S, A } = setup();
    A.addRecurring({ type: 'out', name: 'Оренда', amt: 4000, day: 1, cat: 'Житло', acc: 'dk', from: '2026-01' });
    expect(pendingRecurring(S, '2026-03-18').map(x => x.date)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
    // run the same way the app does
    for (const { r, date } of pendingRecurring(S, '2026-03-18')) tx(S, { amt: r.amt, cat: r.cat, date, rec: r.id });
    expect(pendingRecurring(S, '2026-03-18')).toHaveLength(0);
    expect(pendingRecurring(S, '2026-04-02')).toHaveLength(1);
  });
  it('puts day 31 on the last day of a short month and skips switched-off payments', () => {
    const { S, A } = setup();
    A.addRecurring({ type: 'out', name: 'Підписка', amt: 50, day: 31, cat: 'Розваги', acc: 'dk', from: '2026-02' });
    expect(pendingRecurring(S, '2026-03-01').map(x => x.date)).toEqual(['2026-02-28']);
    A.toggleRecurring(S.money.recurring[0].id);
    expect(pendingRecurring(S, '2026-03-31')).toHaveLength(0);
  });
});

describe('savings pots', () => {
  it('moves money out of the account without counting it as spending', () => {
    const { S, A } = setup();
    tx(S, { type: 'in', amt: 2000, cat: 'Зарплата', date: '2026-03-01' });
    A.addPot({ name: 'Відпустка', target: 1000, due: '' });
    const id = S.money.pots[0].id;
    A.potMove(id, 300); A.potMove(id, 200); A.potMove(id, -100);
    expect(potSaved(S, id)).toBe(400);
    expect(balance(S, 'dk', '2026-12-31')).toBe(1600);
    expect(realTx(S).filter(t => t.type === 'out')).toHaveLength(0);
    A.delPot(id);
    expect(balance(S, 'dk', '2026-12-31')).toBe(2000);
  });
});

describe('safeguards', () => {
  it('cannot take more out of a pot than is in it', () => {
    const { S, A } = setup();
    A.addPot({ name: 'Подушка', target: 1000, due: '' });
    const id = S.money.pots[0].id;
    A.potMove(id, 200); A.potMove(id, -500);
    expect(potSaved(S, id)).toBe(200);
    A.potMove(id, -200);
    expect(potSaved(S, id)).toBe(0);
  });
  it('a regular payment whose day has passed this month starts next month', () => {
    const { S, A } = setup();
    const today = new Date(), day = today.getDate() === 1 ? 1 : today.getDate() - 1;
    A.addRecurring({ type: 'out', name: 'Оренда', amt: 1, day, cat: 'Житло', acc: 'dk' });
    const mk = ymd(today).slice(0, 7);
    expect(S.money.recurring[0].from > mk || day === 1 ? true : false).toBe(true);
    expect(pendingRecurring(S).every(x => x.date >= ymd(today))).toBe(true);
  });
  it('removes a month\'s record that two devices both created, keeping the oldest', () => {
    const { S, A } = setup();
    A.addRecurring({ type: 'out', name: 'Підписка', amt: 99, day: 1, cat: 'Розваги', acc: 'dk', from: '2026-03' });
    const rid = S.money.recurring[0].id;
    tx(S, { id: 50, amt: 99, cat: 'Розваги', date: '2026-03-01', rec: rid });
    tx(S, { id: 60, amt: 99, cat: 'Розваги', date: '2026-03-01', rec: rid });
    A.applyRecurring();
    expect(S.money.tx.filter(t => t.rec === rid && t.date.startsWith('2026-03')).map(t => t.id)).toEqual([50]);
  });
});

describe('balance and insights', () => {
  it('leaves out records dated in the future', () => {
    const { S } = setup();
    tx(S, { type: 'in', amt: 100, date: '2020-01-01' });
    tx(S, { type: 'in', amt: 900, date: '2999-01-01' });
    expect(balance(S, 'dk')).toBe(100);
  });
  it('counts days without spending and warns about a category limit', () => {
    const { S, A } = setup();
    tx(S, { amt: 50, date: '2026-03-14' });
    expect(noSpendStreak(S, NOW)).toBe(4);
    A.setCatBudget('Їжа', 100);
    tx(S, { amt: 80, date: '2026-03-16' });
    expect(moneyInsights(S, '2026-03', NOW).some(i => i.text.includes('Ліміт «Їжа» перевищено'))).toBe(true);
  });
});
