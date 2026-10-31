import type { State } from './types';
import { DAY, pad2, ymd } from './util';

/** Reminders for the hours when cravings usually come. They belong to the device (the phone gets them, the laptop may not),
    so they are kept in the browser's own storage and are not synced. */
export type RemindCfg = { on: boolean; /** minutes before the hour to remind */ lead: number; /** also use the hours found in the history of cravings */ auto: boolean; /** extra times chosen by hand, 'HH:MM' */ hours: string[] };
export const DEFAULT_REMIND: RemindCfg = { on: false, lead: 15, auto: true, hours: [] };

const toMin = (t: string) => { const [a, b] = t.split(':').map(Number); return a * 60 + (b || 0); };
export const hhmm = (m: number) => `${pad2(Math.floor(m / 60) % 24)}:${pad2(m % 60)}`;

/** Hours of the day with at least two cravings in the last 60 days, the busiest three, in the order of the day. */
export function dangerHours(S: State, now = Date.now()): number[] {
  const hours = new Array(24).fill(0) as number[];
  for (const c of S.cravings) if (c.t >= now - 60 * DAY) hours[new Date(c.t).getHours()]++;
  return hours.map((n, h) => ({ n, h })).filter(x => x.n >= 2).sort((a, b) => b.n - a.n).slice(0, 3).map(x => x.h).sort((a, b) => a - b);
}

export type RemindTime = { min: number; auto: boolean };
/** The moments to remind about: the hours from the history (if on, and only while there is a habit to quit) plus the hand-picked times. */
export function reminderTimes(S: State, cfg: RemindCfg, now = Date.now()): RemindTime[] {
  const out: RemindTime[] = [];
  if (cfg.auto && S.badHabits.length) for (const h of dangerHours(S, now)) out.push({ min: h * 60, auto: true });
  for (const t of cfg.hours) { const m = toMin(t); if (Number.isFinite(m) && !out.some(x => x.min === m)) out.push({ min: m, auto: false }); }
  return out.sort((a, b) => a.min - b.min);
}

/** The moment that is due now (from `lead` minutes before it up to 30 minutes after) and has not been shown today. */
export function dueNow(times: RemindTime[], cfg: RemindCfg, at: Date, fired: string[]): RemindTime | null {
  if (!cfg.on) return null;
  const m = at.getHours() * 60 + at.getMinutes(), day = ymd(at);
  return times.find(t => m >= t.min - cfg.lead && m <= t.min + 30 && !fired.includes(`${day}-${t.min}`)) ?? null;
}
export const firedKey = (at: Date, t: RemindTime) => `${ymd(at)}-${t.min}`;

/** Text of the reminder. It names no habit, so it is safe to show on a locked phone. */
export const remindText = (t: RemindTime, at: Date) => {
  const m = at.getHours() * 60 + at.getMinutes(), before = t.min - m;
  return { title: 'Небезпечна година', body: before > 0 ? `Через ${before} хв зазвичай приходить потяг. Придумай, чим його замінити, і тримай під рукою SOS.` : `Зараз ${hhmm(t.min)}: час, коли потяг буває частіше. Що зробиш замість? Відкрий SOS.` };
};
