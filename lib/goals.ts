import type { Goal, Session, State } from './types';
import { ymd } from './util';

/** Share of a goal that is done, 0–1: by steps when it has any, otherwise by the number. */
export const goalProgress = (g: Goal) => (g.steps?.length ? g.steps.filter(s => s.d).length / g.steps.length : g.target > 0 ? Math.min(1, g.cur / g.target) : 0);

/** Open tasks that move a goal forward, important first, then the goal with the nearest deadline. */
export function goalTasks(S: State) {
  const due = (id?: number) => S.goals.find(g => g.id === id)?.due || '9999';
  return S.tasks.filter(t => t.goal && !t.d && S.goals.some(g => g.id === t.goal && goalProgress(g) < 1))
    .sort((a, b) => (a.p === 'hi' ? 0 : 1) - (b.p === 'hi' ? 0 : 1) || due(a.goal).localeCompare(due(b.goal)));
}

/** Minutes of focus on day k that went to tasks linked to a goal. */
export function goalFocusOn(S: State, k: string, sessions: Session[] = S.sessions) {
  const names = new Set(S.tasks.filter(t => t.goal).map(t => t.t));
  return sessions.filter(s => s.task && names.has(s.task) && ymd(new Date(s.t)) === k).reduce((a, s) => a + s.m, 0);
}
