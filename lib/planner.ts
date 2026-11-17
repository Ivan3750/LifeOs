import type { Need, State, UiEvent } from './types';
import { freeTime } from './score';
import { byHunger, weekKeys, weekStats, type NeedStat } from './needs';
import { toMin, weekdayIdx, ymd } from './util';
import { addD } from './util';

/* The week plan: the fixed blocks (school, work, a day off) come from the calendar, the free windows are what is left,
   and the hungry needs are put into them as ready slots. Not «find the time», but «16:00–16:40 training». */

export type Slot = { need: number; date: string; s: string; e: string };
export type Plan = { slots: Slot[]; /** Needs that did not fit: how many times each is still missing. */ unplaced: { need: number; missing: number }[]; days: DayFree[] };
export type DayFree = { date: string; free: number; busy: number; windows: [number, number][] };

const at = (k: string, hm: string) => { const m = toMin(hm); const d = new Date(k + 'T00:00'); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d.getTime(); };
const hm = (ms: number) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
/** Slots start on a quarter of an hour. */
const ceilQ = (ms: number) => Math.ceil(ms / 9e5) * 9e5;
const MAX_PER_DAY = 3;

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
  return { date: k, free: windows.reduce((t, [a, b]) => t + (b - a), 0) / 6e4, busy: ft.busyDay, windows };
}

/** Puts the missing slots of the week that starts on `ws` into the free windows.
    Hungriest needs go first (and those marked for focus in last week's review); a need is spread over different days,
    and a need that likes weekends or weekdays gets those first. */
export function planWeek(S: State, ws: Date, eventsOn: (k: string) => UiEvent[], now = Date.now(), stats: NeedStat[] = weekStats(S, ws, eventsOn, now)): Plan {
  const keys = weekKeys(ws), today = ymd(new Date(now));
  const days = keys.filter(k => k >= today).map(k => windowsFrom(S, k, eventsOn(k), now));
  const focus = new Set(S.reviews[ymd(addD(ws, -7))]?.focus || []);
  const placed = new Map<string, number>(), has = new Map<string, number>();
  for (const st of stats) for (let i = 0; i < 7; i++) if (st.byDay[i]) has.set(st.need.id + '|' + keys[i], st.byDay[i]);
  for (const e of S.events) if (e.need && keys.includes(e.date) && !e.ok) has.set(e.need + '|' + e.date, (has.get(e.need + '|' + e.date) || 0) + 1);
  const count = (k: string) => (placed.get(k) || 0) + S.events.filter(e => e.need && e.date === k && !e.ok).length;

  // the order of placing: focus first, then the needs with the most to do for the days that suit them (a need that only fits weekends cannot wait), then the hungriest
  const pressure = (st: NeedStat) => {
    const fit = days.filter(d => dayFits(st.need, d.date)).length || days.length || 1;
    return Math.max(0, st.need.weekly - st.done - st.planned) / fit;
  };
  const order = [...stats].sort((a, b) => Number(focus.has(b.need.id)) - Number(focus.has(a.need.id)) || pressure(b) - pressure(a) || byHunger(a, b));
  const slots: Slot[] = [], left = new Map(stats.map(st => [st.need.id, Math.max(0, st.need.weekly - st.done - st.planned)]));
  // two passes: first every need goes only to the days that suit it, then what is left may take any day
  for (const strict of [true, false]) {
    for (const st of order) {
      const n = st.need, len = n.min * 6e4;
      while ((left.get(n.id) || 0) > 0) {
        let best: { score: number; day: DayFree; a: number } | null = null;
        for (const day of days) {
          const k = day.date;
          if (count(k) >= MAX_PER_DAY || (strict && !dayFits(n, k))) continue;
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
        left.set(n.id, (left.get(n.id) || 0) - 1);
      }
    }
  }
  const unplaced: Plan['unplaced'] = order.filter(st => (left.get(st.need.id) || 0) > 0).map(st => ({ need: st.need.id, missing: left.get(st.need.id)! }));
  slots.sort((a, b) => a.date.localeCompare(b.date) || a.s.localeCompare(b.s));
  return { slots, unplaced, days };
}
