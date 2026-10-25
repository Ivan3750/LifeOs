import type { AccId, Account, Cur, State, Tx } from './types';
import { money as dkk } from './util';

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

/** Real income and spending, without transfers between own accounts. */
export const realTx = (S: State) => S.money.tx.filter(t => !t.xfer);
export const monthOf = (S: State, mk: string, acc?: AccId) => realTx(S).filter(t => t.date.slice(0, 7) === mk && (!acc || accOf(t) === acc));

/** Sum of income or spending converted to kroner (or kept in the account currency when acc is given). */
export function sumIn(S: State, list: Tx[], type: 'in' | 'out', cur?: Cur) {
  return list.filter(t => t.type === type).reduce((a, t) => a + (cur ? convert(S, t.amt, curOfTx(S, t), cur) : txDKK(S, t)), 0);
}

/** Balance of an account up to and including `upTo` (all records when omitted), in its own currency. */
export function balance(S: State, id: AccId, upTo?: string) {
  return S.money.tx.filter(t => accOf(t) === id && (!upTo || t.date <= upTo))
    .reduce((a, t) => a + (t.type === 'in' ? t.amt : -t.amt), account(S, id).opening);
}

/** Monthly budget of all accounts together, in kroner. */
export const budgetDKK = (S: State) => S.money.accounts.reduce((a, x) => a + toDKK(S, x.budget, x.cur), 0);
