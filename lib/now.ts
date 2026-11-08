import type { State, Task, UiEvent } from './types';
import { dueState } from './tasks';
import { toMin, ymd } from './util';
import type { IconName } from '../components/Icon';

/* «Зараз»: the rules behind the home screen. No guessing and no model: the day is read from the clock, the calendar, the timer and the
   open tasks, and the answer is always one thing to do next. */

export type Phase = 'morning' | 'day' | 'evening' | 'night';
/** Morning until 11:00 (plan the day), day until 18:00, evening until 23:00 (sum it up), then night. */
export function phaseOf(d: Date): Phase {
  const h = d.getHours();
  return h < 5 ? 'night' : h < 11 ? 'morning' : h < 18 ? 'day' : h < 23 ? 'evening' : 'night';
}

/** How much a task asks to be done today: late and due-today first, then the important ones and those that move a goal forward. */
export function taskWeight(t: Task, now: Date): number {
  const due = dueState(t.due, now);
  return (due === 'overdue' ? 100 : due === 'today' ? 70 : due === 'tomorrow' ? 25 : due === 'week' ? 10 : 0) + (t.p === 'hi' ? 30 : 0) + (t.goal ? 20 : 0);
}

/** Open tasks, the most pressing first (newer first among equals, because they are the ones still in mind). */
export function rankTasks(S: State, now: Date): Task[] {
  return S.tasks.filter(t => !t.d).map(t => ({ t, w: taskWeight(t, now) })).sort((a, b) => b.w - a.w || b.t.id - a.t.id).map(x => x.t);
}

export const PLAN_SIZE = 3;

/** The «main things» of the day. The ones picked by the person (S.plan) for today if there are any, otherwise the top of the ranking as a suggestion. */
export function todayPlan(S: State, now: Date): { tasks: Task[]; confirmed: boolean } {
  const k = ymd(now);
  if (S.plan && S.plan.date === k && S.plan.ids.length) {
    const tasks = S.plan.ids.map(id => S.tasks.find(t => t.id === id)).filter((t): t is Task => !!t);
    return { tasks, confirmed: true };
  }
  return { tasks: rankTasks(S, now).slice(0, PLAN_SIZE), confirmed: false };
}

/** The best open task that is not in `skip`: used when one planned task is swapped for another. */
export function nextCandidate(S: State, now: Date, skip: number[]): Task | undefined {
  return rankTasks(S, now).find(t => !skip.includes(t.id));
}

export type Current =
  | { kind: 'focus'; task: string; left: number }
  | { kind: 'break'; left: number }
  | { kind: 'event'; ev: UiEvent; endsIn: number }
  | { kind: 'task'; task: Task | null; window: number | null; minutes: number };

/** Length of a focus run that fits before the next event: the usual one, or a shorter one when the window is small (but never under 10 minutes). */
export function fitMinutes(focusMin: number, window: number | null): number {
  return window !== null && window < focusMin ? Math.max(10, window - 2) : focusMin;
}

/** What is going on right now and what is next. events: today's events (ours and from calendars). */
export function nowState(S: State, events: UiEvent[], at: number): { cur: Current; next: { ev: UiEvent; inMin: number } | null } {
  const d = new Date(at), m = d.getHours() * 60 + d.getMinutes();
  const timed = events.filter(e => !e.allDay && e.act === undefined);
  const upcoming = timed.filter(e => toMin(e.s) > m).sort((a, b) => toMin(a.s) - toMin(b.s))[0];
  const next = upcoming ? { ev: upcoming, inMin: toMin(upcoming.s) - m } : null;

  const T = S.timer;
  if (T.running) {
    const left = Math.max(0, Math.round((T.endAt - at) / 1000));
    return { cur: T.mode === 'focus' ? { kind: 'focus', task: T.task, left } : { kind: 'break', left }, next };
  }
  const inside = timed.find(e => toMin(e.s) <= m && m < toMin(e.e));
  if (inside) return { cur: { kind: 'event', ev: inside, endsIn: toMin(inside.e) - m }, next };

  const planned = todayPlan(S, d).tasks.find(t => !t.d);
  const task = planned ?? rankTasks(S, d)[0] ?? null;
  const window = next ? next.inMin : null;
  return { cur: { kind: 'task', task, window, minutes: fitMinutes(S.focusMin, window) }, next };
}

/** A few words for the top of the screen. */
export function greeting(name: string, d: Date): string {
  const h = d.getHours();
  return (h < 5 ? 'Доброї ночі' : h < 12 ? 'Доброго ранку' : h < 18 ? 'Доброго дня' : 'Доброго вечора') + ', ' + name;
}

/** Quick help for the moment when something is off. Each way out is one tap and starts something right away. */
export type Reset = { key: string; label: string; hint: string; icon: IconName };
export const RESETS: Reset[] = [
  { key: 'start', label: 'Не можу почати', hint: '5 хвилин на найменший крок', icon: 'play' },
  { key: 'drift', label: 'Відволікаюсь', hint: '15 хвилин без телефону', icon: 'focus' },
  { key: 'tired', label: 'Втомився', hint: 'Вода, рух, перерва', icon: 'bed' },
  { key: 'stress', label: 'Тривога чи злість', hint: 'Дихання на 2 хвилини', icon: 'wave' },
  { key: 'craving', label: 'Тягне до шкідливого', hint: 'SOS: що зробити зараз', icon: 'flame' },
];
