import type { AccId, Account, Cur, Recurring, State, Tx } from './types';
import { money as dkk, ymd } from './util';

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'dk', name: 'Данський рахунок', cur: 'DKK', opening: 0, budget: 9000 },
  { id: 'ua', name: 'Український рахунок', cur: 'UAH', opening: 0, budget: 0 },
];
export const CUR_SIGN: Record<Cur, string> = { DKK: 'kr.', UAH: '₴' };
/** Fallback when no rate has been loaded yet (about 6.7 hryvnias per krone in autumn 2026). */
export const DEFAULT_UAH_PER_DKK = 6.7;
export const XFER_CAT = 'Переказ';

const uah = new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH', maximumFractionDigits: 0 });
export const fmtCur = (n: number, cur: Cur) => (cur === 'UAH' ? uah.format(Math.round(n)) : dkk(n));

export const accOf = (t: Tx): AccId => t.acc || 'dk';
export const account = (S: State, id: AccId) => S.money.accounts.find(a => a.id === id) || DEFAULT_ACCOUNTS.find(a => a.id === id)!;
export const curOfTx = (S: State, t: Tx) => account(S, accOf(t)).cur;
export const rate = (S: State) => S.money.uahPerDkk > 0 ? S.money.uahPerDkk : DEFAULT_UAH_PER_DKK;

export const toDKK = (S: State, amt: number, cur: Cur) => (cur === 'UAH' ? amt / rate(S) : amt);
export const convert = (S: State, amt: number, from: Cur, to: Cur) => (from === to ? amt : from === 'UAH' ? amt / rate(S) : amt * rate(S));
export const txDKK = (S: State, t: Tx) => toDKK(S, t.amt, curOfTx(S, t));

/** Real income and spending, without transfers between own accounts and without money moved into savings pots. */
export const realTx = (S: State) => S.money.tx.filter(t => !t.xfer && !t.pot);
export const monthOf = (S: State, mk: string, acc?: AccId) => realTx(S).filter(t => t.date.slice(0, 7) === mk && (!acc || accOf(t) === acc));

/** Sum of income or spending converted to kroner (or kept in the account currency when acc is given). */
export function sumIn(S: State, list: Tx[], type: 'in' | 'out', cur?: Cur) {
  return list.filter(t => t.type === type).reduce((a, t) => a + (cur ? convert(S, t.amt, curOfTx(S, t), cur) : txDKK(S, t)), 0);
}

/** Balance of an account up to and including `upTo` (today when omitted: records dated in the future are not yet on the account), in its own currency. */
export function balance(S: State, id: AccId, upTo: string = ymd(new Date())) {
  return S.money.tx.filter(t => accOf(t) === id && t.date <= upTo)
    .reduce((a, t) => a + (t.type === 'in' ? t.amt : -t.amt), account(S, id).opening);
}

export const monthKey = (d: Date | string = new Date()) => (typeof d === 'string' ? d : ymd(d)).slice(0, 7);
const dim = (mk: string) => new Date(+mk.slice(0, 4), +mk.slice(5), 0).getDate();
const shiftMk = (mk: string, n: number) => { const d = new Date(mk + '-01T00:00'); d.setMonth(d.getMonth() + n); return ymd(d).slice(0, 7); };
export { shiftMk };

/** Date of a regular payment in month mk; day 29–31 on a short month falls on its last day. */
export const recDate = (r: Recurring, mk: string) => `${mk}-${String(Math.min(r.day, dim(mk))).padStart(2, '0')}`;

/** Regular payments that should already exist but do not: one per month since `from`, dated up to today. */
export function pendingRecurring(S: State, today = ymd(new Date())): { r: Recurring; date: string }[] {
  const out: { r: Recurring; date: string }[] = [];
  for (const r of S.money.recurring) {
    if (!r.active) continue;
    for (let mk = r.from, guard = 0; mk <= today.slice(0, 7) && guard < 36; mk = shiftMk(mk, 1), guard++) {
      const date = recDate(r, mk);
      if (date <= today && !S.money.tx.some(t => t.rec === r.id && t.date.slice(0, 7) === mk)) out.push({ r, date });
    }
  }
  return out;
}

/** Income that is still expected this month from regular incomes that have not arrived yet, in kroner. */
export function expectedIncomeDKK(S: State, mk: string, today = ymd(new Date())) {
  return S.money.recurring.filter(r => r.active && r.type === 'in' && r.from <= mk && recDate(r, mk) > today && !S.money.tx.some(t => t.rec === r.id && t.date.slice(0, 7) === mk))
    .reduce((a, r) => a + toDKK(S, r.amt, account(S, r.acc).cur), 0);
}

/** Income of month mk in kroner (real income only). */
export const incomeDKK = (S: State, mk: string) => monthOf(S, mk).filter(t => t.type === 'in').reduce((a, t) => a + txDKK(S, t), 0);
export const spentDKK = (S: State, mk: string) => monthOf(S, mk).filter(t => t.type === 'out').reduce((a, t) => a + txDKK(S, t), 0);

/** The fixed budgets of all accounts together, in kroner. */
export const fixedBudgetDKK = (S: State) => S.money.accounts.reduce((a, x) => a + toDKK(S, x.budget, x.cur), 0);

/** How much may be spent in month mk, in kroner. A fixed budget, or (budgetMode 'income') the month's income and income still to come
    minus the share to save; while no income is known yet the fixed budget is used. */
export function budgetDKK(S: State, mk: string = monthKey()) {
  if (S.money.budgetMode === 'income') {
    const inc = incomeDKK(S, mk) + (mk === monthKey() ? expectedIncomeDKK(S, mk) : 0);
    if (inc > 0) return Math.max(0, inc * (1 - Math.min(90, Math.max(0, S.money.saveRate)) / 100));
  }
  return fixedBudgetDKK(S);
}

/** Money put aside in pot id (deposits minus withdrawals), in kroner. */
export const potSaved = (S: State, id: number) => S.money.tx.filter(t => t.pot === id).reduce((a, t) => a + (t.type === 'out' ? 1 : -1) * txDKK(S, t), 0);

/** The month in numbers, with income taken into account: what came in, what went out, what is left, and how fast the allowance is being used. */
export function monthPlan(S: State, mk: string, today = new Date()) {
  const income = incomeDKK(S, mk), spent = spentDKK(S, mk), expected = mk === monthKey(today) ? expectedIncomeDKK(S, mk, ymd(today)) : 0;
  const saved = S.money.tx.filter(t => t.pot && t.date.slice(0, 7) === mk).reduce((a, t) => a + (t.type === 'out' ? 1 : -1) * txDKK(S, t), 0);
  const allowance = budgetDKK(S, mk), isNow = mk === monthKey(today), days = dim(mk);
  const passed = isNow ? today.getDate() : mk < monthKey(today) ? days : 0, daysLeft = isNow ? days - today.getDate() + 1 : 0;
  const left = allowance - spent;
  return {
    income, expected, spent, saved, net: income - spent, rate: income > 0 ? (income - spent) / income : null,
    allowance, left, perDay: daysLeft > 0 ? left / daysLeft : 0, daysLeft, days,
    // spending pace: what the whole month would cost at the current speed (needs a few days of data)
    forecast: passed >= 3 && isNow ? (spent / passed) * days : null,
    avgDay: passed ? spent / passed : 0,
    mode: S.money.budgetMode === 'income' && income + expected > 0 ? 'income' as const : 'fixed' as const,
  };
}
