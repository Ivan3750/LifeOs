import type { AutoIdea, State } from './types';
import { norm } from './clients';

/* Automation opportunities of the business. The app never guesses how much time something takes:
   a saving is shown only when the person gave both the minutes and how often. */

export const EFFORT: Record<AutoIdea['effort'], string> = { low: 'Проста', mid: 'Середня', high: 'Складна' };
export const PRIORITY: Record<AutoIdea['priority'], string> = { high: 'Високий', mid: 'Середній', low: 'Низький' };
export const STATUS: Record<AutoIdea['status'], string> = { idea: 'Ідея', doing: 'Роблю', done: 'Зроблено' };

/** Minutes a week that doing it by hand takes, from the person's own numbers; null when either is unknown. */
export const weeklyMinutes = (a: Pick<AutoIdea, 'mins' | 'perWeek'>): number | null => (a.mins > 0 && a.perWeek > 0 ? Math.round(a.mins * a.perWeek) : null);

const PRI = { high: 0, mid: 1, low: 2 } as const;
/** Open ideas first (those being worked on, then ideas), by priority, then by the time they could save; done ones last. */
export function ranked(list: AutoIdea[]): AutoIdea[] {
  const st = (a: AutoIdea) => (a.status === 'done' ? 2 : a.status === 'doing' ? 0 : 1);
  return [...list].sort((a, b) => st(a) - st(b) || PRI[a.priority] - PRI[b.priority] || (weeklyMinutes(b) ?? -1) - (weeklyMinutes(a) ?? -1) || b.seen - a.seen || a.id - b.id);
}

/** What could be saved a week by the ideas that are not done yet, from the numbers that were given. `known`: how many of them have numbers. */
export function potential(list: AutoIdea[]) {
  const open = list.filter(a => a.status !== 'done'), known = open.map(weeklyMinutes).filter((m): m is number => m !== null);
  return { minutes: known.reduce((t, m) => t + m, 0), known: known.length, open: open.length };
}

/** Tasks that keep coming back: the same line done or open at least `min` times, or marked as repeating. Already listed ones are left out. */
export function repeating(S: State, min = 3): { title: string; times: number; rep: boolean }[] {
  const have = new Set(S.co.auto.map(a => norm(a.title)));
  const m = new Map<string, { title: string; times: number; rep: boolean }>();
  for (const t of S.tasks) {
    const k = norm(t.t); if (!k || have.has(k)) continue;
    const e = m.get(k) || { title: t.t, times: 0, rep: false };
    e.times++; e.rep = e.rep || !!t.rep; m.set(k, e);
  }
  return [...m.values()].filter(e => e.times >= min || e.rep).sort((a, b) => b.times - a.times).slice(0, 5);
}
