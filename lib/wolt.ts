import type { Activity, State } from './types';
import { realTx, txDKK } from './money';
import { addD, sod, wStart, ymd } from './util';

export const WOLT = 'Wolt';

export type WoltPeriod = 'week' | 'month' | 'all';
export const periodStart = (p: WoltPeriod, now = new Date()) => (p === 'week' ? wStart(now).getTime() : p === 'month' ? new Date(ymd(now).slice(0, 7) + '-01T00:00').getTime() : 0);

export const shifts = (S: State) => S.activities.filter(a => a.kind === WOLT).sort((a, b) => b.start - a.start);
const hours = (a: Activity) => Math.max(0, a.end - a.start) / 36e5;

/** Numbers for one period. Earnings are the Wolt income records (a finished shift writes one), so they match the finance page. */
export function woltStats(S: State, from: number, now = Date.now(), live?: { start: number }) {
  const list = shifts(S).filter(a => a.end > from);
  const clip = (a: { start: number; end: number }) => Math.max(0, Math.min(a.end, now) - Math.max(a.start, from)) / 36e5;
  const h = list.reduce((t, a) => t + clip(a), 0) + (live ? clip({ start: live.start, end: now }) : 0);
  const fromK = ymd(new Date(from || 0));
  const earned = realTx(S).filter(t => t.type === 'in' && t.cat === WOLT && (!from || t.date >= fromK)).reduce((t, x) => t + txDKK(S, x), 0);
  const orders = list.reduce((t, a) => t + (a.orders || 0), 0), km = list.reduce((t, a) => t + (a.km || 0), 0);
  const perHour = h >= 0.5 ? earned / h : 0;
  const withOrders = list.filter(a => a.orders), ordHours = withOrders.reduce((t, a) => t + hours(a), 0);
  return { hours: h, earned, orders, km, perHour, perOrder: orders && earned ? earned / orders : 0, ordersPerHour: ordHours ? orders / ordHours : 0, shifts: list.length };
}

/** Earnings and hours of each of the last n days (oldest first). */
export function dailyEarnings(S: State, n: number, now = new Date()) {
  const days = [...Array(n)].map((_, i) => ymd(addD(sod(now), i - n + 1)));
  const tx = realTx(S).filter(t => t.type === 'in' && t.cat === WOLT);
  return days.map(d => ({
    d,
    earned: tx.filter(t => t.date === d).reduce((a, t) => a + txDKK(S, t), 0),
    hours: S.activities.filter(a => a.kind === WOLT && ymd(new Date(a.start)) === d).reduce((a, x) => a + hours(x), 0),
  }));
}

/** Hours still needed this week to reach the goal at the current pace (0 when reached or when there is no pace yet). */
export function hoursToGoal(goal: number, earned: number, perHour: number) {
  return goal > earned && perHour > 0 ? (goal - earned) / perHour : 0;
}
