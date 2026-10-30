import type { State, Task } from './types';
import { addD, DN, MON, sod, weekdayIdx, ymd } from './util';

const DAYWORDS: Record<string, number> = { сьогодні: 0, завтра: 1, післязавтра: 2 };

/** Date in a task line: «25.11», «25.11.2026» or «25/11». The year is the next one when that day has already passed. */
function dateToken(w: string, now: Date): string | null {
  const m = w.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/);
  if (!m) return null;
  const d = +m[1], mo = +m[2];
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
  let y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : now.getFullYear();
  let out = new Date(y, mo - 1, d);
  if (out.getMonth() !== mo - 1) return null;
  if (!m[3] && out < sod(now)) { y++; out = new Date(y, mo - 1, d); }
  return ymd(out);
}

/** Splits «Подзвонити клієнту завтра !» into the text, the priority and the date.
    Only whole words at the very start or end are read, so a sentence that merely contains «завтра» is left alone. */
export function parseTask(line: string, now = new Date()): { t: string; p: 'hi' | 'lo'; due?: string } {
  const words = line.trim().split(/\s+/).filter(Boolean);
  let p: 'hi' | 'lo' = 'lo', due: string | undefined;
  const eat = (w: string) => {
    if (w === '!') { p = 'hi'; return true; }
    const dw = DAYWORDS[w.toLowerCase()];
    if (dw !== undefined && !due) { due = ymd(addD(sod(now), dw)); return true; }
    const dt = !due && dateToken(w, now);
    if (dt) { due = dt; return true; }
    return false;
  };
  while (words.length > 1 && eat(words[words.length - 1])) words.pop();
  while (words.length > 1 && words[0] === '!') { p = 'hi'; words.shift(); }
  return { t: words.join(' '), p, ...(due ? { due } : {}) };
}

export type DueState = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'none';

export function dueState(due: string | undefined, now = new Date()): DueState {
  if (!due) return 'none';
  const days = Math.round((new Date(due + 'T00:00').getTime() - sod(now).getTime()) / 864e5);
  return days < 0 ? 'overdue' : days === 0 ? 'today' : days === 1 ? 'tomorrow' : days <= 7 ? 'week' : 'later';
}

/** «сьогодні», «завтра», «Пт, 5 лис», or «2 дні тому» for something overdue. */
export function dueLabel(due: string, now = new Date()): string {
  const d = new Date(due + 'T00:00'), days = Math.round((d.getTime() - sod(now).getTime()) / 864e5);
  if (days === 0) return 'сьогодні';
  if (days === 1) return 'завтра';
  if (days === -1) return 'вчора';
  if (days < 0) return `${-days} дн тому`;
  return `${DN[weekdayIdx(d)]}, ${d.getDate()} ${MON[d.getMonth()].slice(0, 3)}`;
}

/** Focus minutes logged against each task title. */
export function focusByTask(S: State): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of S.sessions) if (s.task) m.set(s.task, (m.get(s.task) || 0) + s.m);
  return m;
}

/** Open tasks: overdue first, then by date, important ones ahead of the rest of the same day. */
export const byUrgency = (a: Task, b: Task) =>
  (a.due || '9999').localeCompare(b.due || '9999') || (a.p === 'hi' ? 0 : 1) - (b.p === 'hi' ? 0 : 1);
