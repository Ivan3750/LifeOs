import type { LifeMode, Season, State, Task } from './types';
import { energyLevel, moodsOn } from './score';
import { sleepTotal } from './sleep';
import { addD, DAY, ymd } from './util';

/* LifeOS 2.0. Everything here only chooses what to put forward or keep quiet. Nothing here creates a task, a goal or a reminder. */

/** The rhythms of life. A mode changes the suggestions and the order of things, never what has to be done.
    reserve: share of a day's free time the planner keeps empty; maxPerDay: most suggested slots on one day;
    skip / boost: needs (by key) that are left out of the suggestions / come first in them. */
export const MODES: Record<LifeMode, { label: string; hint: string; reserve: number; maxPerDay: number; skip: string[]; boost: string[]; tasks: number }> = {
  normal: { label: 'Звичайний', hint: 'Звичайний ритм. Усе в міру.', reserve: 0.35, maxPerDay: 3, skip: [], boost: [], tasks: 3 },
  busy: { label: 'Завантажений', hint: 'Багато роботи й навчання. Менше пропозицій, більше місця для себе.', reserve: 0.35, maxPerDay: 2, skip: ['new'], boost: ['income'], tasks: 3 },
  exam: { label: 'Іспити', hint: 'Підготовка до іспитів. Лише найпотрібніше, решта почекає.', reserve: 0.3, maxPerDay: 2, skip: ['new', 'danish', 'income'], boost: ['rest', 'sport'], tasks: 3 },
  recovery: { label: 'Відновлення', hint: 'Час відновитися. Необовʼязкове можна відкласти без наслідків.', reserve: 0.6, maxPerDay: 1, skip: ['new', 'danish', 'income', 'sport'], boost: ['rest', 'faith'], tasks: 1 },
  social: { label: 'Соціальний', hint: 'Пріоритет людям і новим враженням. Пропозиції лише як ідеї.', reserve: 0.35, maxPerDay: 3, skip: ['income'], boost: ['people', 'new', 'love'], tasks: 2 },
};
export const MODE_ORDER: LifeMode[] = ['normal', 'busy', 'exam', 'recovery', 'social'];
export const modeOf = (S: State): LifeMode => (S.lifeMode && S.lifeMode in MODES ? S.lifeMode : 'normal');

/** The directions a season can be made of, and the needs (by key) each one stands for. */
export const LIFE_AREAS: { key: string; label: string; needs: string[] }[] = [
  { key: 'social', label: 'Соціальне життя', needs: ['people', 'new'] },
  { key: 'study', label: 'Навчання й іспити', needs: [] },
  { key: 'business', label: 'WebHjerte і бізнес', needs: ['income'] },
  { key: 'rest', label: 'Відпочинок і враження', needs: ['rest', 'new'] },
  { key: 'health', label: 'Здоровʼя', needs: ['sport'] },
  { key: 'faith', label: 'Віра', needs: ['faith'] },
  { key: 'close', label: 'Близькі люди', needs: ['love', 'people'] },
  { key: 'self', label: 'Особистий час', needs: ['rest', 'danish'] },
];
export const areaLabel = (k: string) => LIFE_AREAS.find(a => a.key === k)?.label ?? k;

/** The season that covers day k, if any. */
export const seasonOn = (S: State, k: string): Season | null => (S.season && S.season.from <= k && k <= S.season.to ? S.season : null);
/** A season whose end has passed and that was not looked at yet: the app only offers a review, it never makes new goals. */
export const seasonEnded = (S: State, k: string): Season | null => (S.season && S.season.to < k && !S.season.dismissed ? S.season : null);
/** Needs (by key) that the main directions of the season stand for. */
export function seasonNeedKeys(S: State, k: string): Set<string> {
  const s = seasonOn(S, k), out = new Set<string>();
  for (const a of s?.main || []) for (const n of LIFE_AREAS.find(x => x.key === a)?.needs || []) out.add(n);
  return out;
}
/** A season is valid with one to three main directions and a period that does not end before it starts. */
export function validSeason(v: { from: string; to: string; main: string[] }): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.from) || !/^\d{4}-\d{2}-\d{2}$/.test(v.to)) return 'Вкажи початок і кінець періоду';
  if (v.to < v.from) return 'Кінець періоду раніше за початок';
  if (v.main.length < 1) return 'Обери хоча б один головний напрям';
  if (v.main.length > 3) return 'Головних напрямів може бути не більше трьох';
  return null;
}
/** Days left in the season including day k (0 when it is over or does not apply). */
export const seasonDaysLeft = (s: Season, k: string) => Math.max(0, Math.round((new Date(s.to + 'T00:00').getTime() - new Date(k + 'T00:00').getTime()) / DAY) + 1);

/* ---------- coming back after some days away ---------- */

/** Whole days since the last visit; null on the first one. Used only to greet warmly, never to report what was missed. */
export function daysAway(last: string | null, today: string): number | null {
  if (!last || !/^\d{4}-\d{2}-\d{2}$/.test(last)) return null;
  return Math.max(0, Math.round((new Date(today + 'T00:00').getTime() - new Date(last + 'T00:00').getTime()) / DAY));
}
export const LAST_SEEN_KEY = 'lifeos-last-seen';

/* ---------- what is on today ---------- */

/** A task is "put aside" while its snooze date is ahead. */
export const isSnoozed = (t: Task, k: string) => !!t.snooze && t.snooze > k;
const goalPaused = (S: State, id?: number) => !!id && !!S.goals.find(g => g.id === id)?.paused;

/** Open tasks that are not "optional": important ones, or due today or earlier. */
const essential = (t: Task, k: string) => t.p === 'hi' || (t.due !== undefined && t.due <= k);

/** The one to three things that matter today: tasks that are due now or marked important. No count of what is left, no «overdue».
    In Recovery mode only one. A task put aside or tied to a paused goal is not offered. */
export function todayPicks(S: State, k: string): Task[] {
  const max = MODES[modeOf(S)].tasks;
  const rank = (t: Task) => (t.due && t.due <= k ? 0 : 2) + (t.p === 'hi' ? 0 : 1);
  return S.tasks
    .filter(t => !t.d && !isSnoozed(t, k) && !goalPaused(S, t.goal))
    .filter(t => modeOf(S) !== 'recovery' || essential(t, k))
    .sort((a, b) => rank(a) - rank(b) || (a.due || '9999').localeCompare(b.due || '9999') || a.id - b.id)
    .slice(0, max);
}
/** The tasks that Recovery can put aside: open, not important, not due yet or today. */
export const optionalTasks = (S: State, k: string) => S.tasks.filter(t => !t.d && !isSnoozed(t, k) && !essential(t, k));
export const snoozedTasks = (S: State, k: string) => S.tasks.filter(t => !t.d && isSnoozed(t, k));
export const dateAfter = (k: string, days: number) => ymd(addD(new Date(k + 'T00:00'), days));

/* ---------- energy and rest ---------- */

export type RestHint = { why: string; short: boolean };
/** A gentle suggestion to take it easier, from what the person wrote down: short sleep last night, or low energy today.
    It is a suggestion about the day, never a conclusion about health. Returns null when nothing was written or all is fine. */
export function restHint(S: State, k: string): RestHint | null {
  const sleep = sleepTotal(S.health[k]);
  const lowEnergy = S.energy?.[k] === 1 || moodsOn(S, k).some(m => energyLevel(m.energy) === 1);
  const tired = moodsOn(S, k).some(m => m.tags.includes('Втома'));
  if (sleep > 0 && sleep < 6 && (lowEnergy || tired)) return { why: `Сну було ${sleep} год, і сил небагато`, short: true };
  if (lowEnergy) return { why: 'Ти відмітив, що сил сьогодні мало', short: false };
  if (sleep > 0 && sleep < 5) return { why: `Сну було лише ${sleep} год`, short: true };
  return null;
}
/** Latest energy level written today: 0 not set, 1 low, 2 normal, 3 high. */
export function energyToday(S: State, k: string): number {
  if (S.energy?.[k]) return energyLevel(S.energy[k]);
  const m = moodsOn(S, k).filter(x => x.energy).at(-1);
  return m ? energyLevel(m.energy) : 0;
}

/* ---------- weekly review (three questions) ---------- */

/** At most two changes suggested from the three short answers. Only words the person wrote are used; nothing is invented.
    «Бракувало людей» → people, «відпочинку» → rest, «руху» → sport, and so on; a need that is already missing a lot is not repeated. */
export const MISS_WORDS: [RegExp, string][] = [
  [/люд|друз|спілку|зустріч|знайом|подруг/i, 'people'], [/відпоч|спок|сон|вимот|втом|перепочин/i, 'rest'], [/рух|спорт|трен|зал\b|біг|прогулян/i, 'sport'],
  [/віри|бог|молит|церк|біблі/i, 'faith'], [/нов(ого|их)|враже|цікав|пригод/i, 'new'], [/стосун|кохан|близьк/i, 'love'], [/данськ|мов[аиуі]/i, 'danish'],
];
export type ReviewIdea = { id: string; text: string; need?: number; to?: string };
export function reviewIdeas(S: State, answers: { missing?: string; change?: string }): ReviewIdea[] {
  const text = `${answers.missing || ''} ${answers.change || ''}`.trim();
  if (!text) return [];
  const out: ReviewIdea[] = [], seen = new Set<string>();
  for (const [re, key] of MISS_WORDS) {
    if (!re.test(text) || seen.has(key)) continue;
    const n = S.needs.find(x => x.key === key && x.on);
    if (!n) continue;
    seen.add(key);
    out.push({ id: 'need-' + n.id, need: n.id, text: `Дати місце: «${n.name}». Наступного тижня воно піде першим серед пропозицій плану.` });
  }
  if (/менше|занадто|забагато|перевантаж|зменш/i.test(answers.change || '') && modeOf(S) !== 'recovery') out.push({ id: 'lighter', text: 'Полегшити тиждень: можна увімкнути режим «Завантажений» чи «Відновлення», і пропозицій буде менше.', to: 'goals' });
  return out.slice(0, 2);
}

/* ---------- what is shown ---------- */

/** The blocks of the home screen the person can switch off. */
export const HOME_BLOCKS: [string, string][] = [
  ['season', 'Пріоритети періоду'], ['today', 'Справи на сьогодні'], ['events', 'Найближчі події'], ['free', 'Вільний час'],
  ['energy', 'Енергія й відпочинок'], ['social', 'Соціальне життя'], ['links', 'Особисті розділи'], ['details', 'Докладніше'],
];
export const homeOn = (S: State, key: string) => S.ui?.home?.[key] !== false;

/** The sections that can be switched off in the settings: key of the view, its name. Switching off only hides it; the data stays. */
export const MODULES: [string, string][] = [
  ['health', 'Здоровʼя'], ['habits', 'Звички'], ['money', 'Фінанси'], ['social', 'Соціальне життя'], ['faith', 'Віра'], ['anela', 'Anela'],
  ['focus', 'Фокус'], ['schedule', 'Розклад'],
];
export const moduleOn = (S: State, key: string) => S.ui?.modules?.[key] !== false;
/** The private sections: their texts can be hidden until tapped and left out of the spreadsheet export. */
export const PRIVATE_VIEWS = ['anela', 'faith'];
