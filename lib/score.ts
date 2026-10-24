import type { State, UiEvent } from './types';
import { addD, DAY, daysInMonth, sod, toMin, ymd } from './util';

export const MOOD_TAGS = ['Радість', 'Спокій', 'Натхнення', 'Мотивація', 'Вдячність', 'Втома', 'Стрес', 'Тривога', 'Сум', 'Злість', 'Нудьга', 'Самотність'];
export const ENERGY = ['Без сил', 'Мало', 'Нормально', 'Бадьоро', 'Повно енергії'];
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

/** Waking window of a day: from the logged wake time (or dayStart) to dayEnd, with the end cut at "now" for today. */
export function wakingWindow(S: State, k: string, now = Date.now()) {
  const d0 = new Date(k + 'T00:00').getTime(), h = S.health[k];
  const start = d0 + toMin(h?.wake || S.dayStart) * 6e4;
  let end = d0 + toMin(S.dayEnd) * 6e4;
  if (end <= start) end = start;
  return { start, end: Math.min(end, Math.max(start, now)), fullEnd: end };
}

/** Free minutes of a day (waking window minus calendar events) and focus minutes in that time.
    Also returns the free windows and the events that took time out of the waking day. */
export function freeTime(S: State, k: string, events: UiEvent[], sessions = S.sessions, now = Date.now()) {
  const { start, end, fullEnd } = wakingWindow(S, k, now);
  const d0 = new Date(k + 'T00:00').getTime();
  const timed = events.filter(e => !e.allDay).map(e => ({ e, a: d0 + toMin(e.s) * 6e4, b: d0 + toMin(e.e) * 6e4 })).filter(x => x.b > x.a).sort((x, y) => x.a - y.a);
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
    .map(({ e, a, b }) => ({ title: e.title, s: e.s, e: e.e, ext: !!e.ext, min: Math.max(0, Math.min(b, fullEnd) - Math.max(a, start)) / 6e4 }))
    .filter(x => x.min > 0);
  const daySessions = sessions.filter(s => s.t >= d0 && s.t < d0 + DAY);
  return {
    free: mins(windowsBetween(start, end)),    // free so far (whole day for past days)
    freeDay: mins(windows),                    // free in the whole planned day
    busyDay: (fullEnd - start) / 6e4 - mins(windows),
    worked: daySessions.reduce((a, s) => a + s.m, 0),
    start, end, fullEnd, windows, blockers,
  };
}

export type ScorePart = { key: string; label: string; got: number; max: number; hint: string };

/** Day score 0–100. Every part gives points from 0 to its weight; parts that do not apply are left out
    and the rest is scaled to 100, so the score is fair also without habits or a budget. */
export function dayScore(S: State, k: string, events: UiEvent[], sessions = S.sessions, now = Date.now()) {
  const h = S.health[k], parts: ScorePart[] = [];
  const ft = freeTime(S, k, events, sessions, now);
  const add = (key: string, label: string, max: number, ratio: number, hint: string) => parts.push({ key, label, max, got: Math.round(Math.max(0, Math.min(1, ratio)) * max * 10) / 10, hint });

  // focus: 60% of free time (or at least the daily share of the weekly goal) counts as a full day of work
  const dailyGoal = (S.goal * 60) / 5;
  const target = Math.max(30, Math.min(dailyGoal, ft.free * 0.6 || dailyGoal));
  add('focus', 'Фокус', 30, ft.worked / target, `${Math.round(ft.worked)} з ${Math.round(target)} хв`);

  // Sleep and mood count only once they are logged: an empty field is "not yet known", not a bad day.
  const sl = h?.sleep || 0;
  if (sl) add('sleep', 'Сон', 15, sl >= 7 && sl <= 9 ? 1 : sl < 7 ? (sl - 4) / 3 : (12 - sl) / 3, `${sl} год (норма 7–9)`);

  if (S.habits.length) { const done = S.habits.filter(x => x.days[k]).length; add('habits', 'Звички', 15, done / S.habits.length, `${done} з ${S.habits.length}`); }

  const mood = dayMood(S, k);
  if (mood) add('mood', 'Настрій', 10, (mood - 1) / 9, `${mood.toFixed(1)} з 10`);

  if (S.money.budget > 0) {
    const lim = S.money.budget / daysInMonth(), spent = S.money.tx.filter(t => t.date === k && t.type === 'out').reduce((a, t) => a + t.amt, 0);
    add('money', 'Витрати', 10, spent <= lim ? 1 : 1 - (spent - lim) / lim, spent <= lim ? 'у межах ліміту' : 'понад денний ліміт');
  }

  const max = parts.reduce((a, p) => a + p.max, 0), got = parts.reduce((a, p) => a + p.got, 0);
  return { total: max ? Math.round((got / max) * 100) : 0, parts, ft };
}

export const scoreWord = (n: number) => (n >= 85 ? 'Чудовий день' : n >= 70 ? 'Добрий день' : n >= 50 ? 'Непогано' : n >= 30 ? 'Слабко' : 'Дуже погано');
export const scoreColor = (n: number) => (n >= 70 ? 'var(--good)' : n >= 50 ? 'var(--accent-2)' : n >= 30 ? 'var(--accent)' : 'var(--m1)');

/** Keys of the last n days, oldest first. */
export const lastDays = (n: number) => [...Array(n)].map((_, i) => ymd(addD(sod(new Date()), i - n + 1)));
