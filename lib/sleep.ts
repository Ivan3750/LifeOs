import type { State } from './types';
import { addD, sod, toMin, ymd } from './util';

/** Bedtime as minutes on a line that runs through midnight: 23:30 is 1410, 00:30 is 1470 (anything before noon counts as after midnight). */
export const bedLine = (t: string) => { const m = toMin(t); return m < 720 ? m + 1440 : m; };
export const clock = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m) % 60).padStart(2, '0')}`;

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const spread = (a: number[]) => (a.length > 1 ? Math.max(...a) - Math.min(...a) : 0);
const stdev = (a: number[]) => { if (a.length < 2) return 0; const m = avg(a); return Math.sqrt(avg(a.map(x => (x - m) ** 2))); };

/** How well one night keeps to the wanted times, 0..1. Bedtime up to 30 minutes after the target is fine, two hours late is zero;
    waking up within 45 minutes of the target is fine, 2.5 hours off is zero. With only one of the two times the other is left out. */
export function keepsRhythm(S: State, bed?: string, wake?: string): number | null {
  const parts: [number, number][] = [];
  if (bed) { const late = bedLine(bed) - (bedLine(S.bedTarget || '23:30') + 30); parts.push([1 - Math.max(0, late) / 120, 0.6]); }
  if (wake) { const dev = Math.abs(toMin(wake) - toMin(S.wakeTarget || '07:30')); parts.push([1 - Math.max(0, dev - 45) / 105, 0.4]); }
  if (!parts.length) return null;
  const w = parts.reduce((a, [, x]) => a + x, 0);
  return Math.max(0, Math.min(1, parts.reduce((a, [v, x]) => a + v * x, 0) / w));
}

/** The last n nights with a logged bedtime or wake-up time, newest last. */
export function sleepNights(S: State, n = 14, now = new Date()) {
  const out: { k: string; bed?: number; wake?: number; hours: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const k = ymd(addD(sod(now), -i)), h = S.health[k];
    if (h && (h.bed || h.wake || h.sleep)) out.push({ k, bed: h.bed ? bedLine(h.bed) : undefined, wake: h.wake ? toMin(h.wake) : undefined, hours: h.sleep || 0 });
  }
  return out;
}

/** Sleep as a habit: how long, but above all how steady. */
export function sleepStability(S: State, n = 14, now = new Date()) {
  const nights = sleepNights(S, n, now);
  const beds = nights.filter(x => x.bed !== undefined).map(x => x.bed!), wakes = nights.filter(x => x.wake !== undefined).map(x => x.wake!);
  const hours = nights.map(x => x.hours).filter(x => x > 0);
  const target = bedLine(S.bedTarget || '23:30');
  const lateNights = beds.filter(b => b > target + 30).length;
  const onTarget = beds.filter(b => b <= target + 30).length;
  // steadiness: bedtime counts more than wake time; a spread of 90+ minutes (standard deviation) is zero
  const steady = beds.length >= 3 ? Math.round(100 * (0.6 * (1 - Math.min(1, stdev(beds) / 90)) + 0.4 * (wakes.length >= 3 ? 1 - Math.min(1, stdev(wakes) / 90) : 1))) : null;
  const half = Math.floor(beds.length / 2);
  const earlier = beds.length >= 6 ? avg(beds.slice(0, half)) - avg(beds.slice(half)) : 0; // minutes the bedtime moved earlier lately (negative: later)
  return {
    nights: nights.length, bedNights: beds.length,
    avgHours: avg(hours), avgBed: beds.length ? avg(beds) : null, avgWake: wakes.length ? avg(wakes) : null,
    earliestBed: beds.length ? Math.min(...beds) : null, latestBed: beds.length ? Math.max(...beds) : null,
    bedSpread: spread(beds), wakeSpread: spread(wakes), lateNights, onTarget, steady, earlier, target,
    /** Time to put the work away: 40 minutes before the wanted bedtime. */
    windDown: clock(target - 40),
  };
}
