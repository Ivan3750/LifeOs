import type { BadHabit, State } from './types';
import { addD, DAY, sod, ymd } from './util';

/** What usually sets a craving off. The last one is for everything else. */
export const TRIGGERS = ['Нудьга', 'Стрес', 'Соцмережі', 'Втома', 'Самотність', 'Звичка', 'Інше'] as const;
/** Days of a clean streak worth celebrating. */
export const MILESTONES = [1, 3, 7, 14, 30, 60, 90, 180, 365];
/** The tools of the SOS button. */
export const TOOLS: Record<string, string> = { exercise: 'Вправи', breath: 'Дихання', game: 'Гра' };

/** The moment the current streak began: the start, or the last slip if it came later. */
export const streakStart = (h: BadHabit) => Math.max(h.start, ...h.slips);
/** Whole days without a slip so far. */
export const streakDays = (h: BadHabit, now = Date.now()) => Math.max(0, Math.floor((now - streakStart(h)) / DAY));
/** Hours of the current day of the streak, for the first day when there are no whole days yet. */
export const streakHours = (h: BadHabit, now = Date.now()) => Math.max(0, Math.floor((now - streakStart(h)) / 36e5));
/** The longest streak: the best of the ended ones and the one that is going now. */
export const bestStreak = (h: BadHabit, now = Date.now()) => Math.max(h.best, streakDays(h, now));
/** Days since the beginning on which nothing went wrong. Never reset by a slip. */
export function cleanDays(h: BadHabit, now = Date.now()) {
  const total = Math.max(0, Math.floor((now - h.start) / DAY) + 1), slipDays = new Set(h.slips.map(t => ymd(new Date(t))));
  return Math.max(0, total - slipDays.size);
}
/** The next milestone and how many days are left to it (null after the last one). */
export function nextMilestone(days: number) { const m = MILESTONES.find(x => x > days); return m ? { target: m, left: m - days, from: [...MILESTONES].reverse().find(x => x <= days) ?? 0 } : null; }

export type DayMark = 'none' | 'ok' | 'slip';
/** The last n days (oldest first): before the start, clean, or with a slip. */
export function dayMarks(h: BadHabit, n = 14, now = new Date()): { k: string; mark: DayMark }[] {
  const slips = new Set(h.slips.map(t => ymd(new Date(t))), ), start = ymd(new Date(h.start));
  return [...Array(n)].map((_, i) => { const k = ymd(addD(sod(now), i - n + 1)); return { k, mark: k < start ? 'none' : slips.has(k) ? 'slip' : 'ok' }; });
}

/** Habits that were being tracked on day k and the ones that slipped that day. */
export function quitOn(S: State, k: string) {
  const active = S.badHabits.filter(h => ymd(new Date(h.start)) <= k);
  const slipped = active.filter(h => h.slips.some(t => ymd(new Date(t)) === k));
  return { active, slipped };
}

/** Cravings of the last n days: by trigger, how many were held, and the busiest hour. */
export function cravingStats(S: State, n = 30, now = Date.now(), habit?: number) {
  const list = S.cravings.filter(c => c.t >= now - n * DAY && (habit === undefined || c.habit === habit));
  const by: Record<string, { n: number; held: number }> = {}, hours = new Array(24).fill(0) as number[];
  for (const c of list) { const x = (by[c.trigger] ||= { n: 0, held: 0 }); x.n++; if (c.outcome === 'resisted') x.held++; hours[new Date(c.t).getHours()]++; }
  const held = list.filter(c => c.outcome === 'resisted').length;
  let peak = -1, pv = 0; for (let h = 0; h < 24; h++) if (hours[h] > pv) { pv = hours[h]; peak = h; }
  return { list, by, total: list.length, held, rate: list.length ? held / list.length : null, peak: pv >= 2 ? peak : -1, top: Object.entries(by).sort((a, b) => b[1].n - a[1].n)[0]?.[0] ?? null };
}
