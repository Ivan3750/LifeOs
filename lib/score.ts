import type { State, UiEvent } from './types';
import { addD, sod, toMin, ymd } from './util';
import { goalFocusOn, goalProgress } from './goals';
import { budgetDKK, monthOf, txDKK } from './money';

export const MOOD_TAGS = ['Радість', 'Спокій', 'Натхнення', 'Мотивація', 'Вдячність', 'Втома', 'Стрес', 'Тривога', 'Сум', 'Злість', 'Нудьга', 'Самотність'];
export const ACT_KINDS = ['Wolt', 'Магазин', 'Дорога', 'Справи', 'Спорт', 'Готування', 'Прибирання', 'Відпочинок', 'Бізнес', 'Інше'];
/** Energy is one of three levels, stored as 1, 3 or 5 so records from the older 1–5 scale still fit.
    level(): 0 not set, 1 low (1–2), 2 normal (3), 3 high (4–5). */
export const ENERGY3 = [
  { v: 1, l: 'Мало сил', hint: 'втомлений, хочеться лягти' },
  { v: 3, l: 'Нормально', hint: 'звичайний робочий стан' },
  { v: 5, l: 'Багато сил', hint: 'бадьорий, можу братися за важке' },
];
export const energyLevel = (e: number) => (!e ? 0 : e <= 2 ? 1 : e === 3 ? 2 : 3);
export const energyWord = (e: number) => (energyLevel(e) ? ENERGY3[energyLevel(e) - 1].l : '');
export const moodWord = (v: number) => (v >= 9 ? 'Чудово' : v >= 7 ? 'Добре' : v >= 5 ? 'Нормально' : v >= 3 ? 'Так собі' : v > 0 ? 'Погано' : 'не відмічено');
export const moodColor = (v: number) => (v ? `var(--m${Math.min(5, Math.max(1, Math.ceil(v / 2)))})` : 'var(--bar)');

/** Mood check-ins of one day, oldest first. */
export const moodsOn = (S: State, k: string) => S.moods.filter(m => ymd(new Date(m.t)) === k);

/** Average mood of a day on a 1–10 scale, 0 when nothing is logged. Days saved by older versions used 1–5. */
export function dayMood(S: State, k: string) {
  const list = moodsOn(S, k);
  if (list.length) return list.reduce((a, m) => a + m.v, 0) / list.length;
  const old = S.health[k]?.mood || 0;
  return old * 2;
}

/** Timestamp of a local clock time on day k. Built from the date itself, so days with a clock change
    (23 or 25 hours long) still put 08:00 at 08:00. '23:59' and '24:00' style ends are kept as given. */
const at = (k: string, hm: string) => { const m = toMin(hm); const d = new Date(k + 'T00:00'); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d.getTime(); };

const hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

/** Typical wake and bed time from the last 14 logged nights (before day k), as minutes after midnight.
    A bedtime after midnight counts as e.g. 25:00, so 23:30 and 01:00 average out properly. */
export function sleepRhythm(S: State, k = ymd(new Date())) {
  const days = [...Array(14)].map((_, i) => S.health[ymd(addD(new Date(k + 'T00:00'), -i - 1))]).filter(Boolean);
  const wake = median(days.filter(d => d!.wake).map(d => toMin(d!.wake!)));
  const bed = median(days.filter(d => d!.bed).map(d => { const m = toMin(d!.bed!); return m < 12 * 60 ? m + 1440 : m; }));
  return { wake, bed, nights: days.filter(d => d!.wake || d!.bed).length };
}

/** The planned day: when it starts and ends, and the meals in it.
    With dayFromSleep the start is today's logged wake time (or the typical one), the end is the
    typical bedtime (cut at midnight), and breakfast moves to half an hour after waking. */
export function dayPlan(S: State, k: string) {
  const fromSleep = S.dayFromSleep !== false, h = S.health[k], r = fromSleep ? sleepRhythm(S, k) : null;
  const startMin = h?.wake ? toMin(h.wake) : r?.wake ?? toMin(S.dayStart);
  let endMin = r?.bed != null ? Math.min(r.bed, 23 * 60 + 59) : toMin(S.dayEnd);
  if (endMin <= startMin) endMin = Math.max(toMin(S.dayEnd), startMin);
  const meals = (S.meals || []).filter(m => m.on).map(m => {
    if (fromSleep && m.key === 'breakfast') { const len = Math.max(10, toMin(m.e) - toMin(m.s)); return { ...m, s: hm(startMin + 30), e: hm(startMin + 30 + len) }; }
    return m;
  });
  return { start: hm(startMin), end: endMin >= 1439 ? '23:59' : hm(endMin), meals, fromSleep, rhythm: r, wakeLogged: !!h?.wake };
}

/** Waking window of a day (see dayPlan), with the end cut at "now" for today. */
export function wakingWindow(S: State, k: string, now = Date.now()) {
  const p = dayPlan(S, k);
  const start = at(k, p.start);
  let end = at(k, p.end);
  if (end <= start) end = start;
  return { start, end: Math.min(end, Math.max(start, now)), fullEnd: end };
}

/** Free minutes of a day (waking window minus calendar events and meals) and focus minutes in that time.
    Also returns the free windows and the events and meals that took time out of the waking day. */
export function freeTime(S: State, k: string, events: UiEvent[], sessions = S.sessions, now = Date.now()) {
  const { start, end, fullEnd } = wakingWindow(S, k, now);
  const d0 = new Date(k + 'T00:00').getTime(), d1 = addD(new Date(d0), 1).getTime();
  const timed = [
    ...events.filter(e => !e.allDay).map(e => ({ title: e.title, s: e.s, e: e.e, ext: !!e.ext, meal: false })),
    ...dayPlan(S, k).meals.map(m => ({ title: m.label, s: m.s, e: m.e, ext: false, meal: true })),
  ].map(e => ({ e, a: at(k, e.s), b: at(k, e.e) })).filter(x => x.b > x.a).sort((x, y) => x.a - y.a);
  // overlapping events are merged so shared time is subtracted once
  const merged: [number, number][] = [];
  for (const { a, b } of timed) { const last = merged[merged.length - 1]; if (last && a <= last[1]) last[1] = Math.max(last[1], b); else merged.push([a, b]); }
  const windowsBetween = (a: number, b: number) => {
    const out: [number, number][] = [];
    let cur = a;
    for (const [s0, s1] of merged) { if (s1 <= cur) continue; if (s0 >= b) break; if (s0 > cur) out.push([cur, s0]); cur = Math.max(cur, s1); }
    if (b > cur) out.push([cur, b]);
    return out;
  };
  const mins = (w: [number, number][]) => w.reduce((t, [a, b]) => t + (b - a), 0) / 6e4;
  const windows = windowsBetween(start, fullEnd);
  const blockers = timed
    .map(({ e, a, b }) => ({ ...e, min: Math.max(0, Math.min(b, fullEnd) - Math.max(a, start)) / 6e4 }))
    .filter(x => x.min > 0);
  const daySessions = sessions.filter(s => s.t >= d0 && s.t < d1);
  return {
    free: mins(windowsBetween(start, end)),    // free so far (whole day for past days)
    freeDay: mins(windows),                    // free in the whole planned day
    busyDay: (fullEnd - start) / 6e4 - mins(windows),
    worked: daySessions.reduce((a, s) => a + s.m, 0),
    start, end, fullEnd, windows, blockers,
  };
}

export type ScorePart = { key: string; group: string; label: string; got: number; max: number; hint: string };
/** The big items the day score is made of; each is the sum of its parts. */
export const SCORE_GROUPS: { key: string; label: string }[] = [
  { key: 'work', label: 'Робота й цілі' }, { key: 'body', label: 'Тіло' }, { key: 'mind', label: 'Настрій' },
  { key: 'habits', label: 'Звички' }, { key: 'money', label: 'Гроші' },
];
export type ScoreGroup = { key: string; label: string; got: number; max: number };
/** Minutes a day on the business that count as a full mark (logged as activity «Бізнес»). */
const BIZ_DAY_MIN = 60;
/** Minutes of business time logged on day k. */
export const bizMinutesOn = (S: State, k: string) => S.activities.filter(a => a.kind === 'Бізнес' && ymd(new Date(a.start)) === k).reduce((t, a) => t + Math.max(0, a.end - a.start) / 6e4, 0);
/** A part that is not counted on this day, with the reason shown to the user. */
export type ScoreSkip = { key: string; label: string; why: string };

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** Monthly bills that are paid on one day and should not make that day look like overspending. */
const FIXED_CATS = ['Житло'];
export const isWorkDay = (S: State, k: string) => (S.workDays || [true, true, true, true, true, false, false])[(new Date(k + 'T00:00').getDay() + 6) % 7];

/** Day score 0–100, or null when nothing on the day can be judged yet.
    Rules that keep it fair:
    - A part counts only when it applies: nothing logged, a rest day or "too early today" leaves it out
      instead of giving zero. The parts that are left are scaled to 100.
    - Today is judged against what was possible so far, not against the whole day.
    - Focus is expected only on work days; the weekly goal is split between them.
    - Spending is judged by the month so far (a rent day is not a bad day) and only when you track money. */
export function dayScore(S: State, k: string, events: UiEvent[], sessions = S.sessions, now = Date.now()) {
  const h = S.health[k], parts: ScorePart[] = [], skipped: ScoreSkip[] = [];
  const ft = freeTime(S, k, events, sessions, now);
  const isToday = ymd(new Date(now)) === k;
  // share of the waking day that has passed (1 for past days)
  const elapsed = isToday ? clamp01((now - ft.start) / Math.max(1, ft.fullEnd - ft.start)) : 1;
  const add = (key: string, label: string, max: number, ratio: number, hint: string, group = key) => parts.push({ key, group, label, max, got: Math.round(clamp01(ratio) * max * 10) / 10, hint });
  const skip = (key: string, label: string, why: string) => skipped.push({ key, label, why });

  // Focus: the day's share of the weekly goal, but never more than 60% of the free time the day had.
  // Today only the part of that free time that has already passed is expected.
  const work = isWorkDay(S, k), days = Math.max(1, (S.workDays || []).filter(Boolean).length || 5);
  const dailyGoal = (S.goal * 60) / days;
  const fullTarget = Math.min(dailyGoal, ft.freeDay * 0.6);
  const target = fullTarget * (isToday && ft.freeDay ? ft.free / ft.freeDay : 1);
  if (!work && ft.worked < 1) skip('focus', 'Фокус', 'вихідний, роботу не очікуємо');
  else if (!work) add('focus', 'Фокус', 20, 1, `${Math.round(ft.worked)} хв у вихідний, це плюс`, 'work');
  else if (target < 20 && ft.worked < 20) skip('focus', 'Фокус', isToday ? 'ще рано: вільного часу майже не було' : 'вільного часу майже не було');
  else add('focus', 'Фокус', 20, ft.worked / Math.max(20, target), `${Math.round(ft.worked)} з ${Math.round(Math.max(20, target))} хв${isToday ? ' на цей час' : ''}`, 'work');

  // Goals: focus minutes spent on tasks linked to a goal; expected only when a goal is still open.
  const goalOpen = S.goals.some(g => goalProgress(g) < 1), gMin = goalFocusOn(S, k, sessions), gTarget = Math.max(20, fullTarget * 0.5 * (isToday && ft.freeDay ? ft.free / ft.freeDay : 1));
  if (!goalOpen) skip('goals', 'Цілі', 'активних цілей нема');
  else if (!work && gMin < 1) skip('goals', 'Цілі', 'вихідний');
  else if (gMin < 1 && isToday && elapsed < 0.5) skip('goals', 'Цілі', 'ще рано');
  else add('goals', 'Цілі', 10, work ? gMin / gTarget : 1, `${Math.round(gMin)} хв на цілі${work ? ` з ${Math.round(gTarget)}` : ', це плюс'}`, 'work');

  // Business: time logged as activity «Бізнес»; expected on work days once the business is used at all.
  const bMin = bizMinutesOn(S, k), bizUsed = S.activities.some(a => a.kind === 'Бізнес') || S.co.deals.length + S.co.projects.length + S.co.invoices.length > 0;
  if (!bizUsed) skip('biz', 'Бізнес', 'не ведеться');
  else if (!work && bMin < 1) skip('biz', 'Бізнес', 'вихідний');
  else if (bMin < 1 && isToday && elapsed < 0.5) skip('biz', 'Бізнес', 'ще рано');
  else add('biz', 'Бізнес', 10, work ? bMin / BIZ_DAY_MIN : 1, `${Math.round(bMin)} з ${BIZ_DAY_MIN} хв на бізнес${work ? '' : ', це плюс'}`, 'work');

  // Sleep and mood count only once they are logged.
  const sl = h?.sleep || 0;
  if (sl) add('sleep', 'Сон', 12, sl >= 7 && sl <= 9 ? 1 : sl < 7 ? (sl - 4) / 3 : (12 - sl) / 3, `${sl} год (норма 7–9)`, 'body');
  else skip('sleep', 'Сон', 'не записано');

  // Water and movement count once logged (or when the day is over and nothing was logged for a day with other data).
  if (h?.water) add('water', 'Вода', 4, h.water / 8, `${h.water} з 8 склянок`, 'body');
  else skip('water', 'Вода', 'не записано');
  if (h?.workout) add('move', 'Рух', 4, h.workout / 30, `${h.workout} з 30 хв руху`, 'body');
  else skip('move', 'Рух', 'не записано');

  // Habits: today the expected number grows through the day; before midday they count only once something is done.
  if (S.habits.length) {
    const done = S.habits.filter(x => x.days[k]).length, total = S.habits.length;
    if (isToday && done === 0 && elapsed < 0.5) skip('habits', 'Звички', 'ще є час, рахуються з середини дня');
    else add('habits', 'Звички', 20, done / (total * Math.max(elapsed, 0.5)), `${done} з ${total}${isToday && elapsed < 1 ? ', день ще триває' : ''}`);
  }

  // Mood: 7/10 and better is a full score, 5/10 ("нормально") still gives more than half.
  const mood = dayMood(S, k);
  if (mood) add('mood', 'Настрій', 10, (mood - 2) / 5, `${mood.toFixed(1)} з 10`, 'mind');
  else skip('mood', 'Настрій', 'не записано');

  // Spending: fixed bills (housing) come off the month budget first; the rest is split into a daily limit.
  // A day within the limit is full marks, twice the limit or more is zero.
  // Both accounts count, hryvnias converted to kroner; transfers between own accounts are not spending.
  const mk = k.slice(0, 7), monthTx = monthOf(S, mk).filter(t => t.type === 'out'), budget = budgetDKK(S);
  if (budget > 0 && monthTx.length) {
    const d = new Date(k + 'T00:00'), dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const fixed = monthTx.filter(t => FIXED_CATS.includes(t.cat)).reduce((a, t) => a + txDKK(S, t), 0);
    const lim = Math.max(0, budget - fixed) / dim;
    const spent = monthTx.filter(t => t.date === k && !FIXED_CATS.includes(t.cat)).reduce((a, t) => a + txDKK(S, t), 0);
    add('money', 'Витрати', 10, !lim ? (spent ? 0 : 1) : spent <= lim ? 1 : 2 - spent / lim, `${Math.round(spent)} з ${Math.round(lim)} kr. денного ліміту${fixed ? ', без житла' : ''}`, 'money');
  } else skip('money', 'Витрати', budget > 0 ? 'цього місяця витрат не записано' : 'бюджет не задано');

  // The total is the weighted average of the big items that could be judged, scaled to 100.
  const groups: ScoreGroup[] = SCORE_GROUPS.map(g => {
    const ps = parts.filter(p => p.group === g.key);
    return { ...g, got: ps.reduce((a, p) => a + p.got, 0), max: ps.reduce((a, p) => a + p.max, 0) };
  }).filter(g => g.max > 0);
  const gMax = groups.reduce((a, g) => a + g.max, 0), gGot = groups.reduce((a, g) => a + g.got, 0);
  return { total: gMax ? Math.round((gGot / gMax) * 100) : null, parts, groups, skipped, ft };
}

export const scoreWord = (n: number | null) => (n === null ? 'Ще нема що оцінювати' : n >= 85 ? 'Чудовий день' : n >= 70 ? 'Добрий день' : n >= 50 ? 'Непогано' : n >= 30 ? 'Слабко' : 'Дуже погано');
export const scoreColor = (n: number | null) => (n === null ? 'var(--bar)' : n >= 70 ? 'var(--good)' : n >= 50 ? 'var(--accent-2)' : n >= 30 ? 'var(--accent)' : 'var(--m1)');

/** Keys of the last n days, oldest first. */
export const lastDays = (n: number) => [...Array(n)].map((_, i) => ymd(addD(sod(new Date()), i - n + 1)));
