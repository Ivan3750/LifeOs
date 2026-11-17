import { describe, expect, it } from 'vitest';
import { balance, budgetDKK, convert, monthOf, realTx, txDKK } from '@/lib/money';
import { makeState } from '@/lib/seed';

const base = () => { const s = makeState(false); s.money.uahPerDkk = 5; return s; };

describe('money', () => {
  it('converts between kroner and hryvnias by the rate', () => {
    const s = base();
    expect(convert(s, 100, 'DKK', 'UAH')).toBe(500);
    expect(convert(s, 500, 'UAH', 'DKK')).toBe(100);
  });

  it('keeps transfers out of income and spending but in balances', () => {
    const s = base();
    s.money.tx.push(
      { id: 1, type: 'in', amt: 1000, cat: 'Зарплата', note: '', date: '2026-03-01', acc: 'dk' },
      { id: 2, type: 'out', amt: 200, cat: 'Переказ', note: '', date: '2026-03-02', acc: 'dk', xfer: 9 },
      { id: 3, type: 'in', amt: 1000, cat: 'Переказ', note: '', date: '2026-03-02', acc: 'ua', xfer: 9 },
    );
    expect(realTx(s)).toHaveLength(1);
    expect(monthOf(s, '2026-03')).toHaveLength(1);
    expect(balance(s, 'dk')).toBe(800);
    expect(balance(s, 'ua')).toBe(1000);
    expect(txDKK(s, s.money.tx[2])).toBe(200);
  });

  it('adds the budgets of both accounts in kroner', () => {
    const s = base();
    s.money.accounts[0].budget = 1000; s.money.accounts[1].budget = 500;
    expect(budgetDKK(s)).toBe(1100);
  });
});
