import type { Need, State, UiEvent } from './types';
import { freeTime } from './score';
import { byHunger, weekKeys, weekStats, type NeedStat } from './needs';
import { toMin, weekdayIdx, ymd } from './util';
import { addD } from './util';
import { MODES, modeOf, seasonNeedKeys, seasonOn } from './life';

/* The week plan: the fixed blocks (school, work, a day off) come from the calendar, the free windows are what is left,
   and the hungry needs are put into them as ready slots. Not «find the time», but «16:00–16:40 training».
   The plan only suggests. It leaves part of every busy day empty (the reserve), does not fill the whole week with work for the business,
   and follows the current mode of life and the priorities of the season. Nothing becomes an event until the person adds it. */

export type Slot = { need: number; date: string; s: string; e: string };
export type Plan = { slots: Slot[]; /** Needs that did not fit: how many times each is still missing. */ unplaced: { need: number; missing: number }[]; days: DayFree[] };
/** kept: minutes of the day that stay free of any suggestion after the plan is made. */
export type DayFree = { date: string; free: number; busy: number; windows: [number, number][]; kept: number };

const at = (k: string, hm: string) => { const m = toMin(hm); const d = new Date(k + 'T00:00'); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d.getTime(); };
const hm = (ms: number) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
/** Slots start on a quarter of an hour. */
const ceilQ = (ms: number) => Math.ceil(ms / 9e5) * 9e5;
/** The work on the business (the need that is counted from logged work) is suggested a few times a week at most, never to fill the free time. */
const WORK_CAP = 2, WORK_CAP_SEASON = 3;
const freeMin = (d: DayFree) => d.windows.reduce((t, [a, b]) => t + (b - a), 0) / 6e4;

/** The first start (on a quarter of an hour) between lo and hi where a slot of `len` fits into a free window. */
const fit = (day: DayFree, lo: number, hi: number, len: number): number | null => {
  for (const [wa, wb] of day.windows) { const a = ceilQ(Math.max(wa, lo)); if (a + len <= Math.min(wb, hi)) return a; }
  return null;
};
const dayFits = (n: Need, k: string) => { const i = weekdayIdx(new Date(k + 'T00:00')); return n.days === 'any' || (n.days === 'weekend' ? i >= 5 : i < 5); };

/** The free windows of a day from now on (the calendar events and the meals are already taken out). */
function windowsFrom(S: State, k: string, events: UiEvent[], now: number): DayFree {
  const ft = freeTime(S, k, events, S.sessions, now);
  const from = k === ymd(new Date(now)) ? ceilQ(now) : 0;
  const windows = ft.windows.map(([a, b]) => [Math.max(a, from), b] as [number, number]).filter(([a, b]) => b - a >= 15 * 6e4);
  const free = windows.reduce((t, [a, b]) => t + (b - a), 0) / 6e4;
  return { date: k, free, busy: ft.busyDay, windows, kept: free };
}

/** Puts the missing slots of the week that starts on `ws` into the free windows.
    Hungriest needs go first (and those marked for focus in last week's review); a need is spread over different days,
    and a need that likes weekends or weekdays gets those first. */
export function planWeek(S: State, ws: Date, eventsOn: (k: string) => UiEvent[], now = Date.now(), stats: NeedStat[] = weekStats(S, ws, eventsOn, now)): Plan {
  const keys = weekKeys(ws), today = ymd(new Date(now));
  const days = keys.filter(k => k >= today).map(k => windowsFrom(S, k, eventsOn(k), now));
  const free0 = new Map(days.map(d => [d.date, d.free]));
  const cfg = MODES[modeOf(S)];
  // what the mode and the season put first or leave out of the suggestions
  const seasonKeys = new Set<string>(); for (const k of keys) for (const n of seasonNeedKeys(S, k)) seasonKeys.add(n);
  const boost = new Set([...cfg.boost, ...seasonKeys]), skip = new Set(cfg.skip.filter(k => !seasonKeys.has(k)));
  const businessFirst = keys.some(k => seasonOn(S, k)?.main.includes('business'));
  const focus = new Set(S.reviews[ymd(addD(ws, -7))]?.focus || []);
  const placed = new Map<string, number>(), has = new Map<string, number>();
  for (const st of stats) for (let i = 0; i < 7; i++) if (st.byDay[i]) has.set(st.need.id + '|' + keys[i], st.byDay[i]);
  for (const e of S.events) if (e.need && keys.includes(e.date) && !e.ok) has.set(e.need + '|' + e.date, (has.get(e.need + '|' + e.date) || 0) + 1);
  const count = (k: string) => (placed.get(k) || 0) + S.events.filter(e => e.need && e.date === k && !e.ok).length;
  const work = (n: Need) => !!n.machine;

  // the order of placing: focus of the review first, then the needs of the mode and the season, then the needs with the most to do for the days that suit them
  // (a need that only fits weekends cannot wait), then the hungriest
  const pressure = (st: NeedStat) => {
    const fit = days.filter(d => dayFits(st.need, d.date)).length || days.length || 1;
    return Math.max(0, st.need.weekly - st.done - st.planned) / fit;
  };
  const wanted = (st: NeedStat) => (st.need.key ? Number(boost.has(st.need.key)) : 0);
  const eligible = stats.filter(st => !(st.need.key && skip.has(st.need.key)));
  const order = [...eligible].sort((a, b) => Number(focus.has(b.need.id)) - Number(focus.has(a.need.id)) || wanted(b) - wanted(a) || pressure(b) - pressure(a) || byHunger(a, b));
  const slots: Slot[] = [], left = new Map(eligible.map(st => {
    let n = Math.max(0, st.need.weekly - st.done - st.planned);
    if (work(st.need)) n = Math.min(n, Math.max(0, (businessFirst ? WORK_CAP_SEASON : WORK_CAP) - st.planned));
    return [st.need.id, n];
  }));
  // two passes: first every need goes only to the days that suit it, then what is left may take any day
  for (const strict of [true, false]) {
    for (const st of order) {
      const n = st.need, len = n.min * 6e4;
      while ((left.get(n.id) || 0) > 0) {
        let best: { score: number; day: DayFree; a: number } | null = null;
        for (const day of days) {
          const k = day.date;
          if (count(k) >= cfg.maxPerDay || (strict && !dayFits(n, k))) continue;
          // the business gets at most one suggestion a day
          if (work(n) && has.get(n.id + '|' + k)) continue;
          // the reserve: from the second suggestion of a day on, a share of the day's free time must stay untouched
          if (count(k) >= 1 && freeMin(day) - len / 6e4 < cfg.reserve * (free0.get(k) || 0)) continue;
          // the time of day the need likes; when that does not fit, two hours more on each side are allowed at a cost
          let a = fit(day, at(k, n.from), at(k, n.to), len), wide = 0;
          if (a === null) { a = fit(day, at(k, n.from) - 2 * 36e5, at(k, n.to) + 2 * 36e5, len); wide = 2; }
          if (a === null) continue;
          // lower is better: few things that day, not the same need twice, the usual time of day
          const score = count(k) + (has.get(n.id + '|' + k) ? 3 : 0) + wide;
          if (!best || score < best.score) best = { score, day, a };
        }
        if (!best) break;
        slots.push({ need: n.id, date: best.day.date, s: hm(best.a), e: hm(best.a + len) });
        placed.set(best.day.date, (placed.get(best.day.date) || 0) + 1);
        has.set(n.id + '|' + best.day.date, (has.get(n.id + '|' + best.day.date) || 0) + 1);
        // the slot takes its time out of the window (with a short gap after it)
        const from = best.a, gap = best.a + len + 10 * 6e4;
        best.day.windows = best.day.windows.flatMap(([a, b]) => (from >= a && from < b ? [[a, from], [Math.min(b, gap), b]] as [number, number][] : [[a, b]] as [number, number][])).filter(([a, b]) => b - a >= 15 * 6e4);
        best.day.kept = freeMin(best.day);
        left.set(n.id, (left.get(n.id) || 0) - 1);
      }
    }
  }
  const unplaced: Plan['unplaced'] = order.filter(st => (left.get(st.need.id) || 0) > 0).map(st => ({ need: st.need.id, missing: left.get(st.need.id)! }));
  slots.sort((a, b) => a.date.localeCompare(b.date) || a.s.localeCompare(b.s));
  return { slots, unplaced, days };
}
