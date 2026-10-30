import type { State } from './types';
import { goalProgress } from './goals';
import { noSpendStreak } from './insights';
import { addD, sod, ymd } from './util';
import type { IconName } from '../components/Icon';

export type Badge = { id: string; title: string; desc: string; icon: IconName; have: number; need: number; done: boolean };

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

/** Longest run of consecutive days (ending today or yesterday) that satisfy `has`. */
function streak(has: (d: string) => boolean, now: Date) {
  let n = 0, d = sod(now);
  if (!has(ymd(d))) d = addD(d, -1);
  while (n < 4000 && has(ymd(d))) { n++; d = addD(d, -1); }
  return n;
}

export function achievementBadges(S: State, now = new Date()): Badge[] {
  const focusMin = sum(S.sessions.map(s => s.m)), longest = Math.max(0, ...S.sessions.map(s => s.m));
  const focusDays = new Set(S.sessions.map(s => ymd(new Date(s.t))));
  const doneTasks = S.tasks.filter(t => t.d).length;
  const habitTicks = sum(S.habits.map(h => Object.keys(h.days).length));
  const habitStreak = Math.max(0, ...S.habits.map(h => streak(d => !!h.days[d], now)));
  const moodDays = new Set(S.moods.map(m => ymd(new Date(m.t)))).size;
  const sleepDays = Object.values(S.health).filter(h => h.sleep > 0).length;
  const txDays = new Set(S.money.tx.map(t => t.date)).size;
  const shifts = S.activities.filter(a => a.kind === 'Wolt').length;
  const stepsDone = sum(S.goals.map(g => g.steps?.filter(s => s.d).length || 0));
  const goalsDone = S.goals.filter(g => goalProgress(g) >= 1 && (g.kind === 'rating' || g.steps?.length || g.target > 0)).length;
  const paid = S.co.invoices.filter(i => i.paid), revenue = sum(paid.map(i => i.amt));
  const b = (id: string, title: string, desc: string, icon: IconName, have: number, need: number): Badge => ({ id, title, desc, icon, have: Math.min(have, need), need, done: have >= need });
  return [
    b('focus1', 'Перший фокус', 'Одна сесія від 25 хвилин', 'focus', longest, 25),
    b('focus10', '10 годин фокусу', 'Загалом десять годин глибокої роботи', 'clock', focusMin / 60, 10),
    b('focus100', 'Сто годин', 'Сто годин фокусу: це вже майстерність', 'trophy', focusMin / 60, 100),
    b('fstreak7', 'Тиждень поспіль', 'Фокус сім днів без пропуску', 'flame', streak(d => focusDays.has(d), now), 7),
    b('tasks10', '10 задач', 'Закрито десять задач', 'tasks', doneTasks, 10),
    b('tasks100', '100 задач', 'Сто закритих задач', 'check', doneTasks, 100),
    b('habit7', 'Звичка закріплена', 'Одна звичка сім днів поспіль', 'habits', habitStreak, 7),
    b('habit100', 'Сотня відміток', 'Сто виконаних звичок', 'habits', habitTicks, 100),
    b('mood7', 'Знаю себе', 'Настрій записано в сім різних днів', 'health', moodDays, 7),
    b('sleep14', 'Режим сну', 'Сон записано чотирнадцять днів', 'bed', sleepDays, 14),
    b('money30', 'Фінансова дисципліна', 'Записи грошей у тридцять різних днів', 'money', txDays, 30),
    b('nospend5', 'П’ять днів без витрат', 'Жодної витрати п’ять днів поспіль', 'flame', noSpendStreak(S, now), 5),
    b('pot1', 'Перша скарбничка', 'Відклав гроші на мету', 'goals', S.money.pots.length && S.money.tx.some(t => t.pot) ? 1 : 0, 1),
    b('step10', 'Крок за кроком', 'Десять кроків до цілей виконано', 'goals', stepsDone, 10),
    b('goal1', 'Ціль досягнуто', 'Завершена перша ціль', 'trophy', goalsDone, 1),
    b('wolt1', 'Перша зміна', 'Перша зміна на Wolt', 'wolt', shifts, 1),
    b('wolt10', 'Кур’єр-ветеран', 'Десять змін на Wolt', 'wolt', shifts, 10),
    b('lead1', 'Перший лід', 'Записано першого потенційного клієнта', 'leads', S.co.leads.length, 1),
    b('client1', 'Перший клієнт', 'Лід став клієнтом', 'user', S.co.clients.length || S.co.leads.filter(l => l.status === 'won').length, 1),
    b('paid1', 'Перші гроші', 'Перший оплачений рахунок', 'invoice', paid.length, 1),
    b('rev10k', '10 000 виручки', 'Оплачених рахунків на десять тисяч', 'trend', revenue, 10000),
  ];
}

/** Experience points from everything done in the app, and the level they add up to. */
export function xpOf(S: State) {
  const sum2 = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const xp = Math.round(
    sum2(S.sessions.map(s => s.m)) * 0.2 + S.tasks.filter(t => t.d).length * 10 + sum2(S.habits.map(h => Object.keys(h.days).length)) * 5
    + S.moods.length * 3 + Object.values(S.health).filter(h => h.sleep > 0).length * 4 + S.activities.filter(a => a.kind === 'Wolt').length * 15
    + Math.min(S.money.tx.length, 400) + sum2(S.goals.map(g => g.steps?.filter(x => x.d).length || 0)) * 8
    + S.goals.filter(g => goalProgress(g) >= 1 && (g.kind === 'rating' || g.steps?.length || g.target > 0)).length * 100
    + S.co.leads.length * 3 + S.co.clients.length * 30 + S.co.invoices.filter(i => i.paid).length * 40);
  const level = Math.floor(Math.sqrt(xp / 50)) + 1, from = 50 * (level - 1) ** 2, to = 50 * level ** 2;
  return { xp, level, from, to, pct: (xp - from) / (to - from) };
}

export const LEVEL_NAMES = ['Новачок', 'Початківець', 'Практик', 'Майстер', 'Профі', 'Експерт', 'Легенда'];
export const levelName = (l: number) => LEVEL_NAMES[Math.min(LEVEL_NAMES.length - 1, Math.floor((l - 1) / 2))];
