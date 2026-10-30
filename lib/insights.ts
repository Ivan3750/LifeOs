import type { State } from './types';
import { account, fmtCur, incomeDKK, monthOf, monthKey, recDate, shiftMk, spentDKK, txDKK } from './money';
import { addD, plural, sod, ymd } from './util';
import type { IconName } from '../components/Icon';

export type Insight = { icon: IconName; tone: 'good' | 'warn' | 'info'; text: string };

/** Income and spending of the last n months, oldest first. */
export const monthSeries = (S: State, n: number, now = new Date()) =>
  [...Array(n)].map((_, i) => { const mk = shiftMk(monthKey(now), i - n + 1); return { mk, income: incomeDKK(S, mk), spent: spentDKK(S, mk) }; });

const byCat = (S: State, mk: string) => {
  const m = new Map<string, number>();
  for (const t of monthOf(S, mk).filter(x => x.type === 'out')) m.set(t.cat, (m.get(t.cat) || 0) + txDKK(S, t));
  return m;
};

/** Average spending for each weekday (Mon..Sun) over the last `weeks` weeks, in kroner. */
export function weekdaySpend(S: State, weeks = 8, now = new Date()) {
  const from = ymd(addD(sod(now), -weeks * 7)), sums = [0, 0, 0, 0, 0, 0, 0];
  for (const t of S.money.tx.filter(x => x.type === 'out' && !x.xfer && !x.pot && x.date >= from && x.date <= ymd(now))) sums[(new Date(t.date + 'T00:00').getDay() + 6) % 7] += txDKK(S, t);
  return sums.map(v => v / weeks);
}

/** Days in a row, up to today, without any spending. */
export function noSpendStreak(S: State, now = new Date()) {
  const days = new Set(S.money.tx.filter(t => t.type === 'out' && !t.xfer && !t.pot).map(t => t.date));
  const first = S.money.tx.map(t => t.date).sort()[0];
  let n = 0;
  for (let d = sod(now); first && ymd(d) >= first && !days.has(ymd(d)); d = addD(d, -1)) n++;
  return n;
}

/** A few plain sentences about the month: what changed, what is close to a limit, what is coming. */
export function moneyInsights(S: State, mk: string, now = new Date()): Insight[] {
  const out: Insight[] = [], today = ymd(now), isNow = mk === monthKey(now);
  const cur = byCat(S, mk), prev = byCat(S, shiftMk(mk, -1));
  const income = incomeDKK(S, mk), spent = spentDKK(S, mk);

  if (income > 0 && (spent > 0 || isNow)) {
    const rate = (income - spent) / income;
    out.push(rate >= 0.2 ? { icon: 'trend', tone: 'good', text: `Ти відкладаєш ${Math.round(rate * 100)}% доходу: це більше за цільові 20%.` }
      : rate >= 0 ? { icon: 'trend', tone: 'info', text: `Лишається ${Math.round(rate * 100)}% доходу. Щоб було 20%, треба витрачати на ${fmtCur(Math.max(0, spent - income * 0.8), 'DKK')} менше.` }
      : { icon: 'alert', tone: 'warn', text: `Витрати вищі за дохід на ${fmtCur(spent - income, 'DKK')}. Гроші беруться із заощаджень.` });
  }
  const changes = [...cur].map(([c, v]) => ({ c, v, p: prev.get(c) || 0 })).filter(x => x.p > 0 && Math.abs(x.v - x.p) >= 30 && Math.abs(x.v - x.p) / x.p >= 0.2).sort((a, b) => Math.abs(b.v - b.p) - Math.abs(a.v - a.p)).slice(0, 2);
  for (const x of changes) out.push({ icon: x.v > x.p ? 'alert' : 'check', tone: x.v > x.p ? 'warn' : 'good', text: `${x.c}: ${x.v > x.p ? '+' : '−'}${Math.round((Math.abs(x.v - x.p) / x.p) * 100)}% до минулого місяця (${fmtCur(x.v, 'DKK')} проти ${fmtCur(x.p, 'DKK')}).` });
  for (const [c, lim] of Object.entries(S.money.catBudgets)) {
    const v = cur.get(c) || 0;
    if (v > lim) out.push({ icon: 'alert', tone: 'warn', text: `Ліміт «${c}» перевищено на ${fmtCur(v - lim, 'DKK')}.` });
    else if (v > lim * 0.85) out.push({ icon: 'alert', tone: 'warn', text: `«${c}»: використано ${Math.round((v / lim) * 100)}% ліміту, лишилось ${fmtCur(lim - v, 'DKK')}.` });
  }
  const biggest = monthOf(S, mk).filter(t => t.type === 'out').sort((a, b) => txDKK(S, b) - txDKK(S, a))[0];
  if (biggest && txDKK(S, biggest) >= 100) out.push({ icon: 'money', tone: 'info', text: `Найбільша витрата: ${fmtCur(biggest.amt, account(S, biggest.acc || 'dk').cur)} (${biggest.cat}${biggest.note ? ', ' + biggest.note : ''}).` });
  if (isNow) {
    const s = noSpendStreak(S, now);
    if (s >= 2) out.push({ icon: 'flame', tone: 'good', text: `${s} ${plural(s, 'день', 'дні', 'днів')} без жодної витрати поспіль. Так тримати!` });
    const days = weekdaySpend(S), max = Math.max(...days);
    if (max > 0 && S.money.tx.length > 20) { const i = days.indexOf(max); out.push({ icon: 'clock', tone: 'info', text: `Найбільше ти витрачаєш у ${['понеділок', 'вівторок', 'середу', 'четвер', 'пʼятницю', 'суботу', 'неділю'][i]}: у середньому ${fmtCur(max, 'DKK')}.` }); }
    const soon = S.money.recurring.filter(r => r.active && r.type === 'out' && r.from <= mk).map(r => ({ r, d: recDate(r, mk) })).filter(x => x.d > today && x.d <= ymd(addD(now, 7)) && !S.money.tx.some(t => t.rec === x.r.id && t.date.slice(0, 7) === mk));
    if (soon.length) out.push({ icon: 'clock', tone: 'info', text: `Найближчим часом спишеться: ${soon.map(x => `${x.r.name} ${fmtCur(x.r.amt, account(S, x.r.acc).cur)} (${+x.d.slice(8)}-го)`).join(', ')}.` });
  }
  return out.map(x => ({ ...x, text: x.text.replace(/\.\.$/, '.') }));
}
