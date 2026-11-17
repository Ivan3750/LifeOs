import type { State } from './types';
import { addD, ymd } from './util';
import { moodsOn, waterGoal } from './score';

/* «Кроки»: what was done today, counted upwards. Nothing is ever taken away, there is no maximum and no red.
   A quiet day is a quiet day, not a bad one: it simply has fewer steps. The only comparison is with your own usual days. */

export type StepPart = { key: string; label: string; n: number; go: string };

const dayOf = (t: number) => ymd(new Date(t));

/** Everything that counts as a step on day k, with where it came from. */
export function stepsOn(S: State, k: string, worked = 0): { total: number; parts: StepPart[] } {
  const parts: StepPart[] = [];
  const put = (key: string, label: string, n: number, go: string) => { if (n > 0) parts.push({ key, label, n: Math.floor(n), go }); };
  const h = S.health[k], day = S.daily?.[k];
  const sport = S.needs?.find(n => n.key === 'sport');

  put('focus', 'Фокус', worked / 20, 'focus');
  put('tasks', 'Закриті задачі', S.tasks.filter(t => t.d && t.doneAt && dayOf(t.doneAt) === k).length, 'tasks');
  put('habits', 'Звички', S.habits.filter(x => x.days[k]).length, 'habits');
  // movement counts once however it was marked
  const moved = !!day?.move || (h?.workout || 0) > 0 || (!!sport && S.needLog.some(l => l.need === sport.id && l.date === k)) || S.activities.some(a => a.kind === 'Спорт' && dayOf(a.start) === k);
  put('move', 'Рух', moved ? 1 : 0, 'health');
  put('needs', 'Потреби', S.needLog.filter(l => l.date === k && l.need !== sport?.id).length, 'needs');
  put('people', 'Люди', S.touches.filter(t => t.date === k).length, 'people');
  put('water', 'Вода', h && h.water >= waterGoal(S) ? 1 : 0, 'health');
  put('mood', 'Настрій записано', moodsOn(S, k).length ? 1 : 0, 'health');
  put('sleep', 'Сон записано', h && (h.bed || h.wake || h.sleep) ? 1 : 0, 'health');
  put('aff', 'Афірмації', (S.aff?.read?.[k]?.length ?? 0) >= 3 ? 1 : 0, 'home');
  put('goal', 'Цілі', S.machines.reduce((a, m) => a + m.log.filter(l => l.date === k).reduce((b, l) => b + l.leads + l.clients, 0), 0), 'machine');
  return { total: parts.reduce((a, p) => a + p.n, 0), parts };
}

/** The usual number of steps on your days: the middle of the last 14 days that had any (at least 4, so a fresh start has something to aim at). */
export function usualSteps(S: State, today: string, worked: (k: string) => number = () => 0): number {
  const vals = [...Array(14)].map((_, i) => stepsOn(S, ymd(addD(new Date(today + 'T00:00'), -i - 1)), worked(ymd(addD(new Date(today + 'T00:00'), -i - 1)))).total).filter(n => n > 0).sort((a, b) => a - b);
  return Math.max(4, vals.length ? vals[Math.floor(vals.length / 2)] : 0);
}

/** A kind word for the number. */
export const stepsWord = (n: number) => (n <= 0 ? 'Новий день, чистий аркуш' : n <= 2 ? 'Початок є' : n <= 5 ? 'Рухаєшся' : n <= 9 ? 'Гарний хід' : 'Потужний день');

/** Colour of the number: always the accent, a little stronger the more there is. Never red. */
export const stepsTone = (n: number, usual: number) => (n <= 0 ? 'var(--muted)' : n >= usual ? 'var(--good)' : 'var(--accent)');

/** Steps of the seven days ending on `end`, oldest first. */
export function weekSteps(S: State, end: string, worked: (k: string) => number = () => 0) {
  return [...Array(7)].map((_, i) => { const k = ymd(addD(new Date(end + 'T00:00'), i - 6)); return { k, n: stepsOn(S, k, worked(k)).total }; });
}
