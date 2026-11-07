import type { State, Task, UiEvent } from './types';
import { energyLevel, freeTime, isWorkDay, moodsOn, offOn } from './score';
import { sleepTotal } from './sleep';
import { BAD_DAY, recoveryFor } from './life';
import { classify } from './timeuse';
import { dayRows, type DayRow } from './correlations';
import { budgetDKK, monthKey, spentDKK } from './money';
import { byUrgency, focusByTask } from './tasks';
import { addD, DN, hmPlain, sod, toMin, wStart, ymd } from './util';

/* The planner. It takes the free windows of the day (waking hours minus events and meals), the open tasks by urgency, how rested the person is
   and the hours when their own focus sessions usually go best, and lays the day out as ready-to-use blocks. No guessing at random and no model:
   every block says why it is where it is. The week view looks ahead for days where the deadlines do not fit into the time that is free. */

export type PlanBlock = { s: string; e: string; kind: 'focus' | 'move' | 'wind'; title: string; task?: string; why: string };
export type DayPlan = {
  k: string; mode: 'full' | 'light' | 'off';
  /** Why the day is planned this way (rested, short sleep, a day off…). */
  modeWhy: string;
  blocks: PlanBlock[];
  /** Focus minutes the plan puts in, and the minutes still wanted today. */
  planned: number; target: number;
  /** Open tasks that did not fit. */
  left: Task[];
  peak: { from: number; to: number; known: boolean };
  notes: string[];
  /** After a bad day (≤ 4/10): no making up for it, only the basics. */
  recovery: boolean;
};

const hm = (ms: number) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const MIN = 6e4, STEP = 5 * MIN;
const ceil5 = (ms: number) => Math.ceil(ms / STEP) * STEP;

/** The two hours of the day where the person's own focus sessions of the last 45 days add up to the most. Needs at least 6 sessions. */
export function peakHours(S: State, now = Date.now()): { from: number; to: number; known: boolean } {
  const since = now - 45 * 864e5, byHour = Array(24).fill(0) as number[];
  const list = S.sessions.filter(s => s.t >= since && s.t <= now && !s.demo);
  for (const s of list) { const h = new Date(s.t).getHours(); byHour[h] += s.m; }
  if (list.length < 6) return { from: 9, to: 11, known: false };
  let best = 9, top = -1;
  for (let h = 5; h < 22; h++) { const v = byHour[h] + byHour[h + 1]; if (v > top) { top = v; best = h; } }
  return { from: best, to: best + 2, known: true };
}

/** Minutes a task usually takes: what your finished tasks took in focus, between 25 and 90, 45 when there is nothing to go by. */
export function taskEstimate(S: State): number {
  const by = focusByTask(S), done = S.tasks.filter(t => t.d && (by.get(t.t) || 0) >= 10).map(t => by.get(t.t)!);
  if (done.length < 3) return 45;
  const avg = done.reduce((a, b) => a + b, 0) / done.length;
  return Math.max(25, Math.min(90, Math.round(avg / 5) * 5));
}

/** Focus minutes the day should hold: what is left of the weekly goal spread over the work days that are left (today included). */
function wantedToday(S: State, k: string, now: number) {
  const ws = wStart(new Date(k + 'T00:00')).getTime(), day0 = new Date(k + 'T00:00').getTime();
  const before = S.sessions.filter(s => s.t >= ws && s.t < day0).reduce((a, s) => a + s.m, 0);
  const worked = S.sessions.filter(s => s.t >= day0 && s.t < day0 + 864e5 && s.t <= now).reduce((a, s) => a + s.m, 0);
  let left = 0;
  for (let i = 0; i < 7; i++) { const d = ymd(addD(new Date(ws), i)); if (d >= k && isWorkDay(S, d) && !offOn(S, d)) left++; }
  const want = left ? Math.max(0, S.goal * 60 - before) / left : 0;
  return { want, worked };
}

/** Plans the free windows of day k. For today only what is still ahead is used. */
export function planDay(S: State, k: string, events: UiEvent[], now = Date.now()): DayPlan {
  const peak = peakHours(S, now), notes: string[] = [];
  const off = offOn(S, k), work = isWorkDay(S, k) && !off;
  const h = S.health[k], slept = h ? sleepTotal(h) : 0;
  const energy = moodsOn(S, k).filter(m => m.energy > 0).map(m => energyLevel(m.energy));
  const lowEnergy = energy.length > 0 && energy[energy.length - 1] === 1;
  const tired = (slept > 0 && slept < 6) || lowEnergy;
  const rec = recoveryFor(S, k);
  const mode: DayPlan['mode'] = off ? 'off' : tired || rec.on ? 'light' : 'full';
  const modeWhy = rec.on && !off ? `Вчора було ${String(rec.score).replace('.', ',')}/10: режим відновлення. Без надолужування: сон, одна важлива задача, рух, люди, нормальний вечір` : off ? `Сьогодні позначено «${off.note || off.kind}»: без навантаження, лише найважливіше`
    : slept > 0 && slept < 6 ? `Спав ${String(slept).replace('.', ',')} год: легкий режим, коротші блоки й менше складного`
    : lowEnergy ? 'Енергія низька: легкий режим, коротші блоки'
    : work ? 'Виспаний і з силами: звичайний план' : 'Вихідний: тільки те, що горить';
  const plan: DayPlan = { k, mode, modeWhy, blocks: [], planned: 0, target: 0, left: [], peak, notes, recovery: rec.on && !off };

  const ft = freeTime(S, k, events, S.sessions, now);
  const isToday = ymd(new Date(now)) === k;
  const from = isToday ? ceil5(now) : 0;
  const windows = ft.windows.map(([a, b]) => [Math.max(a, from), b] as [number, number]).filter(([a, b]) => b - a >= 25 * MIN);

  // tasks: overdue and due today first; then the important ones; a rest day only takes what is due
  const today = k;
  const soon = ymd(addD(new Date(k + 'T00:00'), 2));
  const open = S.tasks.filter(t => !t.d).sort(byUrgency);
  const eligibleAll = open.filter(t => (t.due && t.due <= today) || (mode !== 'off' && work && (t.p === 'hi' || (t.due && t.due <= soon))));
  // recovery: one important task, never the whole pile
  const eligible = rec.on ? eligibleAll.slice(0, 1) : eligibleAll;
  const est = taskEstimate(S), by = focusByTask(S);
  const need = (t: Task) => Math.max(25, est - (by.get(t.t) || 0));

  const { want, worked } = wantedToday(S, k, now);
  const dueNow = eligible.filter(t => t.due && t.due <= today);
  // what the day should hold: the goal's share (less when tired), but the things due today are always planned
  let target = mode === 'off' ? 0 : rec.on ? Math.min(60, eligible.reduce((a, t) => a + need(t), 0)) : Math.max(0, (work ? want : 0) * (mode === 'light' ? 0.6 : 1) - worked);
  if (!rec.on) target = Math.max(target, Math.min(dueNow.reduce((a, t) => a + need(t), 0), 240));
  plan.target = Math.round(target);

  // slots: cut the windows into focus blocks with a 10-minute break between them; the best hours are given out first
  const len = mode === 'light' ? 35 : 50;
  type Slot = { a: number; b: number; score: number };
  const slots: Slot[] = [];
  for (const [a, b] of windows) {
    for (let t = ceil5(a); t + 25 * MIN <= b; t += (len + 10) * MIN) {
      const end = Math.min(t + len * MIN, b), d = new Date(t);
      const mid = d.getHours() + d.getMinutes() / 60;
      slots.push({ a: t, b: end, score: -Math.abs(mid - (peak.from + 1)) });
    }
  }
  const byBest = [...slots].sort((x, y) => y.score - x.score || x.a - y.a);
  const queue = eligible.map(t => ({ t, left: need(t) }));
  const taken: { a: number; b: number; block: PlanBlock }[] = [];
  let planned = 0;
  for (const sl of byBest) {
    if (planned >= target - 5) break;
    const cur = queue.find(q => q.left > 0);
    const mins = Math.round((sl.b - sl.a) / MIN);
    if (!cur) {
      if (mode === 'off' || !work || rec.on) break;
      taken.push({ a: sl.a, b: sl.b, block: { s: hm(sl.a), e: hm(sl.b), kind: 'focus', title: 'Вільний фокус', why: 'Задачі розплановано: цей час для цілі тижня' } });
      planned += mins; continue;
    }
    const inPeak = new Date(sl.a).getHours() >= peak.from && new Date(sl.a).getHours() < peak.to;
    const urgent = !!cur.t.due && cur.t.due <= today;
    const why = (urgent ? (cur.t.due! < today ? 'Прострочено' : 'Термін сьогодні') : cur.t.p === 'hi' ? 'Важлива' : 'Скоро термін') + (inPeak ? (peak.known ? '; у твої найкращі години фокусу' : '; ранок найкраще для складного') : '');
    const more = taken.some(x => x.block.task === cur.t.t) ? '; друга частина' : '';
    taken.push({ a: sl.a, b: sl.b, block: { s: hm(sl.a), e: hm(sl.b), kind: 'focus', title: cur.t.t, task: cur.t.t, why: why + more } });
    cur.left -= mins; planned += mins;
  }
  plan.left = queue.filter(q => q.left > 0).map(q => q.t);

  // movement: where the body still lacks it, in the free gap closest to 17:30 that the focus blocks did not take
  const moveNeed = (S.moveGoal || 30) - (h?.workout || 0);
  const hasSport = events.some(e => !e.allDay && e.act === undefined && classify(S, e.title).cat === 'sport');
  if (moveNeed > 0 && !hasSport) {
    const mins = Math.min(45, Math.max(20, moveNeed)), want17 = new Date(k + 'T17:30').getTime();
    let best: [number, number] | null = null;
    for (const [a, b] of windows) {
      // cut the focus blocks out of the window
      let pieces: [number, number][] = [[a, b]];
      for (const t of taken) pieces = pieces.flatMap(([x, y]) => (t.b <= x || t.a >= y ? [[x, y]] : [[x, Math.max(x, t.a - 10 * MIN)], [Math.min(y, t.b + 10 * MIN), y]])).filter(([x, y]) => y - x > 0) as [number, number][];
      for (const [x, y] of pieces) if (y - x >= mins * MIN) {
        const s0 = Math.min(Math.max(ceil5(want17 - (mins * MIN) / 2), x), y - mins * MIN);
        if (!best || Math.abs(s0 - want17) < Math.abs(best[0] - want17)) best = [s0, s0 + mins * MIN];
      }
    }
    if (best) taken.push({ a: best[0], b: best[1], block: { s: hm(best[0]), e: hm(best[1]), kind: 'move', title: mode === 'light' ? 'Прогулянка' : 'Рух', why: `Сьогодні ще ${moveNeed} хв руху до цілі; після роботи найлегше розвантажити голову` } });
  }

  // wind-down: an hour before the wanted bedtime
  if (S.bedTarget && k >= ymd(new Date(now))) {
    const bed = toMin(S.bedTarget), mins = bed < 12 * 60 ? bed + 1440 : bed, s0 = new Date(k + 'T00:00').getTime() + (mins - 60) * MIN;
    if (s0 > now && mins - 60 < 24 * 60) taken.push({ a: s0, b: s0 + 30 * MIN, block: { s: hm(s0), e: hm(s0 + 30 * MIN), kind: 'wind', title: 'Вимкнути екрани', why: `Відбій о ${S.bedTarget}: без телефона та роботи, щоб заснути вчасно` } });
  }

  plan.blocks = taken.sort((x, y) => x.a - y.a).map(x => x.block);
  plan.planned = planned;
  if (!windows.length && isToday) notes.push('На сьогодні вже нема вільних вікон від 25 хв.');
  else if (planned < target - 10 && mode !== 'off') notes.push(`Не вистачає часу: хочеться ${hmPlain(target)} фокусу, а вільного під план лише на ${hmPlain(planned)}.`);
  if (plan.left.length) notes.push(`Не вмістилося ${plan.left.length}: ${plan.left.slice(0, 3).map(t => '«' + t.t + '»').join(', ')}. Перенеси термін або віддай комусь.`);
  if (rec.on) {
    if (rec.next) notes.push(`Вчора ти записав, що зробить день кращим: «${rec.next}». Зроби це.`);
    notes.push(rec.streak >= 2 ? `Уже ${rec.streak} дні поспіль ≤ ${BAD_DAY}/10. Це сигнал не тиснути, а відпочити й поговорити з кимось живим.` : 'Поганий день нормальний. Головне, щоб він не став трьома: сьогодні нічого не надолужуй.');
  }
  if (!peak.known) notes.push('Годин твого найкращого фокусу поки не знаю: після 6 фокус-сесій підлаштую план під них.');
  return plan;
}

/* ---------- the week ---------- */

export type WeekDay = { k: string; label: string; work: boolean; free: number; due: number; state: 'ok' | 'tight' | 'over' | 'rest' };
export type Delta = { label: string; now: string; before: string; tone: 'good' | 'warn' | 'info'; to: string };
export type WeekView = {
  days: WeekDay[];
  /** The first day where the deadlines cannot fit, with the numbers. */
  crunch: { k: string; label: string; need: number; room: number } | null;
  /** Focus: done this week, forecast at the current pace, and the goal. */
  focus: { done: number; forecast: number; goal: number; perDayNeeded: number; daysLeft: number; /** false while there is no finished work day this week to take a pace from */ known: boolean };
  /** Spending of the month: so far, forecast and budget (null when none is set). */
  money: { spent: number; forecast: number; budget: number | null } | null;
  deltas: Delta[];
  steps: string[];
};

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const num1 = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');

/** A look at the next 7 days (will the deadlines fit?), how this week is going against the goal and the month's money, and last week against the one before. */
export function weekView(S: State, eventsOn: (k: string) => UiEvent[], now = new Date()): WeekView {
  const t = now.getTime(), est = taskEstimate(S), today = ymd(sod(now));
  const days: WeekDay[] = [];
  let cumNeed = 0, cumRoom = 0, crunch: WeekView['crunch'] = null;
  const open = S.tasks.filter(x => !x.d);
  for (let i = 0; i < 7; i++) {
    const d = addD(sod(now), i), k = ymd(d), work = isWorkDay(S, k) && !offOn(S, k);
    const ft = freeTime(S, k, eventsOn(k), S.sessions, t);
    const free = i === 0 ? Math.max(0, ft.freeDay - ft.free) : ft.freeDay;
    // part of the free time that can really be focus: 60%, and nothing on a day off
    const room = work ? free * 0.6 : 0;
    const due = open.filter(x => (x.due && x.due === k) || (i === 0 && x.due && x.due < k)).length;
    cumNeed += due * est; cumRoom += room;
    const over = cumNeed > cumRoom + 15, tight = !over && cumNeed > cumRoom * 0.8 && cumNeed > 0;
    if (over && !crunch) crunch = { k, label: i === 0 ? 'сьогодні' : i === 1 ? 'завтра' : DN[(d.getDay() + 6) % 7], need: Math.round(cumNeed), room: Math.round(cumRoom) };
    days.push({ k, label: i === 0 ? 'Сьогодні' : DN[(d.getDay() + 6) % 7], work, free: Math.round(free), due, state: !work && due === 0 ? 'rest' : over ? 'over' : tight ? 'tight' : 'ok' });
  }

  // this week's focus
  const ws = wStart(now).getTime(), done = S.sessions.filter(s => s.t >= ws && s.t <= t).reduce((a, s) => a + s.m, 0);
  const wk = [...Array(7)].map((_, i) => ymd(addD(new Date(ws), i)));
  const past = wk.filter(k => k < today && isWorkDay(S, k) && !offOn(S, k)), ahead = wk.filter(k => k >= today && isWorkDay(S, k) && !offOn(S, k));
  const todayMin = S.sessions.filter(s => ymd(new Date(s.t)) === today).reduce((a, s) => a + s.m, 0);
  const pastMin = done - todayMin;
  const pace = past.length ? pastMin / past.length : S.goal * 60 / Math.max(1, past.length + ahead.length);
  const forecast = Math.round(done + Math.max(0, ahead.length - (isWorkDay(S, today) ? 1 : 0)) * pace + (isWorkDay(S, today) ? Math.max(pace - todayMin, 0) : 0));
  const goal = S.goal * 60, daysLeft = ahead.length;
  const focus = { done: Math.round(done), forecast, goal, daysLeft, known: past.length > 0, perDayNeeded: daysLeft ? Math.max(0, Math.round((goal - done) / daysLeft)) : 0 };

  // the month's money
  const mk = monthKey(now);
  let money: WeekView['money'] = null;
  const spent = spentDKK(S, mk);
  if (S.money.tx.length && spent > 0) {
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), day = now.getDate();
    const recent = dayRows(S, 14, now).map(r => r.spend).filter((x): x is number => x !== null);
    // one big payment (rent) must not set the daily pace: days are capped at twice the usual spending day
    const nz = recent.filter(x => x > 0).sort((a, b) => a - b), med = nz.length ? nz[Math.floor(nz.length / 2)] : 0;
    const daily = recent.length >= 5 && med > 0 ? mean(recent.map(x => Math.min(x, med * 2))) : spent / Math.max(1, day);
    const b = budgetDKK(S, mk);
    money = { spent: Math.round(spent), forecast: Math.round(spent + daily * (dim - day)), budget: b > 0 ? Math.round(b) : null };
  }

  // last 7 days against the 7 before (a number needs 3 days on each side)
  const rows = dayRows(S, 14, now), cur = rows.slice(7), prev = rows.slice(0, 7);
  const spec: { key: keyof DayRow; label: string; fmt: (v: number) => string; better: 1 | -1; gap: number; to: string; sum?: boolean }[] = [
    { key: 'focus', label: 'Фокус за день', fmt: v => hmPlain(v), better: 1, gap: 0.15, to: 'focus' },
    { key: 'tasks', label: 'Закрито задач за день', fmt: v => num1(v), better: 1, gap: 0.2, to: 'tasks' },
    { key: 'sleep', label: 'Сон', fmt: v => num1(v) + ' год', better: 1, gap: 0.08, to: 'health' },
    { key: 'mood', label: 'Настрій', fmt: v => num1(v) + '/10', better: 1, gap: 0.08, to: 'health' },
    { key: 'workout', label: 'Рух', fmt: v => Math.round(v) + ' хв', better: 1, gap: 0.2, to: 'health' },
    { key: 'spend', label: 'Витрати за день', fmt: v => Math.round(v) + ' kr.', better: -1, gap: 0.2, to: 'money' },
  ];
  const deltas: Delta[] = [];
  for (const sp of spec) {
    const a = cur.map(r => r[sp.key] as number | null).filter((x): x is number => x !== null), b = prev.map(r => r[sp.key] as number | null).filter((x): x is number => x !== null);
    if (a.length < 3 || b.length < 3) continue;
    const va = mean(a), vb = mean(b);
    if (!(va > 0 || vb > 0)) continue;
    const rel = vb > 0 ? (va - vb) / vb : 1;
    deltas.push({ label: sp.label, now: sp.fmt(va), before: sp.fmt(vb), to: sp.to, tone: Math.abs(rel) < sp.gap ? 'info' : rel * sp.better > 0 ? 'good' : 'warn' });
  }
  deltas.sort((x, y) => ({ warn: 0, good: 1, info: 2 })[x.tone] - ({ warn: 0, good: 1, info: 2 })[y.tone]);

  // three concrete steps, most pressing first
  const steps: string[] = [];
  if (crunch) steps.push(`До ${crunch.label} треба ~${hmPlain(crunch.need)} на задачі з термінами, а під фокус вільно лише ~${hmPlain(crunch.room)}. Перенеси термін однієї-двох або звільни час у календарі.`);
  if (focus.known && goal > 0 && daysLeft > 0 && forecast < goal * 0.85) steps.push(`За поточного темпу вийде ${hmPlain(forecast)} фокусу з ${S.goal} год. Щоб встигнути, треба ~${hmPlain(focus.perDayNeeded)} щодня.`);
  if (money && money.budget && money.forecast > money.budget) steps.push(`Витрати місяця підуть на ~${money.forecast} kr. при бюджеті ${money.budget}. Щоб вкластись, лишилось ~${Math.max(0, Math.round((money.budget - money.spent) / Math.max(1, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate())))} kr. на день.`);
  for (const d of deltas.filter(x => x.tone === 'warn').slice(0, 2)) steps.push(`${d.label}: ${d.now} проти ${d.before} тиждень тому. Подивись, що змінилось.`);
  return { days, crunch, focus, money, deltas, steps: steps.slice(0, 4) };
}
