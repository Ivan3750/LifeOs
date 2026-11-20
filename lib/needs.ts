import type { Need, State, UiEvent } from './types';
import { addD, DAY, sod, toMin, weekdayIdx, wStart, ymd } from './util';
import { classify, normTitle } from './timeuse';

/* Needs: what the person lacks, counted per week. The app does not only record what was done; it knows what is missing. */

/** The needs a fresh start comes with. Ids below 100 are reserved for them, so two devices that both start fresh agree on them. */
export const DEFAULT_NEEDS: Need[] = [
  { id: 1, key: 'sport', name: 'Спорт', weekly: 4, on: true, min: 40, from: '16:00', to: '20:00', days: 'any', cat: 'sport', workout: true },
  { id: 2, key: 'people', name: 'Люди', weekly: 2, on: true, min: 90, from: '10:00', to: '14:00', days: 'weekend', cat: 'people' },
  { id: 3, key: 'new', name: 'Нове', weekly: 5, on: true, min: 30, from: '17:00', to: '21:00', days: 'any' },
  { id: 4, key: 'faith', name: 'Віра', weekly: 3, on: true, min: 20, from: '07:30', to: '10:00', days: 'any', kw: ['церкв', 'молитв', 'біблі', 'богослуж', 'church', 'kirke'] },
  { id: 5, key: 'rest', name: 'Відпочинок', weekly: 3, on: true, min: 60, from: '19:00', to: '22:00', days: 'any' },
  { id: 6, key: 'income', name: 'Дохід (WebHjerte)', weekly: 4, on: true, min: 90, from: '09:00', to: '15:00', days: 'weekdays', kw: ['webhjerte'], machine: true },
  { id: 7, key: 'danish', name: 'Датська', weekly: 4, on: true, min: 25, from: '18:00', to: '21:00', days: 'any', kw: ['данськ', 'dansk'] },
  { id: 8, key: 'love', name: 'Стосунки', weekly: 2, on: true, min: 90, from: '18:00', to: '22:00', days: 'any' },
];

export type Hunger = 'ok' | 'warn' | 'red';
export const HUNGER_WORD: Record<Hunger, string> = { ok: 'Все гаразд', warn: 'Трохи бракує', red: 'Варто приділити увагу' };
/** No red anywhere: what needs attention is shown in the warm accent colour, never as an alarm. */
export const HUNGER_COLOR: Record<Hunger, string> = { ok: 'var(--good)', warn: 'var(--warn)', red: 'var(--accent)' };
const HUNGER_ORDER: Record<Hunger, number> = { red: 0, warn: 1, ok: 2 };

/** How hungry a need is. dayIdx: 0 = Monday … 6 = Sunday (the day of the week it is now).
    Green: the target is met, or the week is going at the pace it needs. Yellow: a little behind but easy to catch up.
    Red: two behind, or as many left to do as there are days left. */
export function hunger(done: number, target: number, dayIdx: number): Hunger {
  if (target <= 0 || done >= target) return 'ok';
  const expected = Math.floor((target * (dayIdx + 1)) / 7 + 1e-9), behind = expected - done;
  if (behind <= 0) return 'ok';
  return behind >= 2 || target - done >= 7 - dayIdx ? 'red' : 'warn';
}

/** The days of the week starting on `ws`, as keys. */
export const weekKeys = (ws: Date) => [...Array(7)].map((_, i) => ymd(addD(sod(ws), i)));
/** Key of the Monday of the week the date is in; reviews are stored under it. */
export const weekKey = (d: Date = new Date()) => ymd(wStart(d));

export type NeedStat = {
  need: Need;
  /** Times met this week: marked by hand + found in the calendar and the other data. */
  done: number; manual: number; auto: number;
  /** Slots of the week planner that are still ahead. */
  planned: number;
  byDay: number[];
  status: Hunger;
};

const minutesOf = (ms: number) => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); };

/** Everything about the needs for the week that starts on `ws`. eventsOn: the calendar (ours and subscribed ones). */
export function weekStats(S: State, ws: Date, eventsOn: (k: string) => UiEvent[], now = Date.now()): NeedStat[] {
  const keys = weekKeys(ws), today = ymd(new Date(now)), nowMin = minutesOf(now);
  const cur = ymd(wStart(new Date(now))) === ymd(sod(ws));
  const past = keys[6] < today;
  const idx = cur ? weekdayIdx(new Date(now)) : past ? 6 : -1;
  // slots made by the planner are not counted by themselves: they only count when ticked off
  const planned = new Set(S.events.filter(e => e.need).map(e => e.id));
  const events = new Map<string, UiEvent[]>();
  const evOn = (k: string) => { let l = events.get(k); if (!l) { l = eventsOn(k).filter(e => !e.allDay && e.act === undefined && e.nap === undefined && !(e.localId !== undefined && planned.has(e.localId))); events.set(k, l); } return l; };
  const machineDays = new Set(S.machines.flatMap(m => m.log.filter(l => l.leads > 0 || l.clients > 0).map(l => l.date)));
  const logs = new Map<string, number>();
  for (const l of S.needLog) logs.set(l.need + '|' + l.date, (logs.get(l.need + '|' + l.date) || 0) + 1);

  return S.needs.filter(n => n.on).map(need => {
    const words = (need.kw || []).map(w => w.trim().toLowerCase()).filter(Boolean);
    const byDay = keys.map(k => {
      if (k > today) return 0;
      const manual = logs.get(need.id + '|' + k) || 0;
      const hits = (need.cat || words.length ? evOn(k) : []).filter(e => {
        if (k === today && toMin(e.e) > nowMin) return false;
        if (need.cat && classify(S, e.title).cat === need.cat) return true;
        const t = normTitle(e.title);
        return words.some(w => t.includes(w));
      }).length;
      // a workout or work on the goal is only a fallback: it is not added on top of what was marked or found already
      const fallback = manual + hits === 0 && ((need.workout && (S.health[k]?.workout || 0) > 0) || (need.machine && machineDays.has(k))) ? 1 : 0;
      return manual + hits + fallback;
    });
    const manual = keys.reduce((a, k) => a + (logs.get(need.id + '|' + k) || 0), 0), done = byDay.reduce((a, b) => a + b, 0);
    const ahead = S.events.filter(e => e.need === need.id && keys.includes(e.date) && !e.ok && (e.date > today || (e.date === today && toMin(e.s) > nowMin))).length;
    return { need, done, manual, auto: done - manual, planned: ahead, byDay, status: hunger(done, need.weekly, idx) };
  });
}

/** The hungriest first. */
export const byHunger = (a: NeedStat, b: NeedStat) => HUNGER_ORDER[a.status] - HUNGER_ORDER[b.status] || (b.need.weekly - b.done) / (b.need.weekly || 1) - (a.need.weekly - a.done) / (a.need.weekly || 1);

/** Days from `from` to `to` (dates 'YYYY-MM-DD'). */
export const daysBetween = (from: string, to: string) => Math.round((new Date(to + 'T00:00').getTime() - new Date(from + 'T00:00').getTime()) / DAY);

/* ---------- the daily minimum ---------- */

/** One small thing to try today; the list is the same for everyone, the day picks the item. */
export const NEW_IDEAS = [
  'Піти додому іншим маршрутом',
  'Спробувати нову страву чи каву',
  'Зайти в місце, де ще не був',
  'Вивчити 5 нових датських слів',
  'Послухати подкаст чи жанр музики, якого не слухаєш',
  'Поставити комусь запитання, яке ще не ставив',
  'Приготувати те, чого ще не готував',
  'Прогулятися районом, де ти не буваєш',
  'Прочитати 10 сторінок про щось нове',
  'Спробувати новий вид руху: розтяжка, скакалка, йога',
  'Привітатись із сусідом чи незнайомцем',
  'Зробити щось руками: намалювати, полагодити, зліпити',
  'Записати одну думку, яку давно носиш',
  'Подивитись фільм чи відео про те, чого не знаєш',
];
export const ideaFor = (d: Date, shift = 0) => NEW_IDEAS[(Math.floor(sod(d).getTime() / DAY) + shift + NEW_IDEAS.length * 1000) % NEW_IDEAS.length];

const needByKey = (S: State, key: string) => S.needs.find(n => n.key === key);

/** The three things of the day, and which are done: movement, one new thing, one person. */
export function dailyState(S: State, k: string) {
  const sport = needByKey(S, 'sport'), nov = needByKey(S, 'new');
  const logged = (n?: Need) => !!n && S.needLog.some(l => l.date === k && l.need === n.id);
  return {
    move: !!S.daily[k]?.move || (S.health[k]?.workout || 0) > 0 || logged(sport),
    nov: !!S.daily[k]?.nov || logged(nov),
    person: S.touches.some(t => t.date === k),
  };
}
