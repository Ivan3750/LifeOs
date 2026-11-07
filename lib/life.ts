import type { LifeDay, State } from './types';
import { sleepTotal } from './sleep';
import { addD, hmPlain, sod, wStart, ymd } from './util';

/* «Good life», not «perfect day»: the day is judged by six sectors of life, not by how much was done.
   Ten hours of work must not buy the right to call a day good, so the score is the plain mean of the sectors (a 1 pulls it down as much as a 10 lifts it).
   The system is a GPS, not a boss: it shows where the day tilted and what small thing to change tomorrow. */

export type SectorKey = 'dev' | 'people' | 'body' | 'god' | 'life' | 'rest';
export const SECTORS: { key: SectorKey; icon: string; label: string; what: string }[] = [
  { key: 'dev', icon: '🧠', label: 'Розвиток', what: 'навчання, важлива справа, фокус' },
  { key: 'people', icon: '❤️', label: 'Люди', what: 'друзі, нові знайомства, дівчата, сімʼя' },
  { key: 'body', icon: '🏃', label: 'Тіло', what: 'рух, нормальна їжа, сон' },
  { key: 'god', icon: '✝️', label: 'Бог', what: 'час із Богом, молитва, внутрішній стан' },
  { key: 'life', icon: '⚡', label: 'Життя', what: 'нове, спонтанне, музика, сміх, пригода' },
  { key: 'rest', icon: '😌', label: 'Відновлення', what: 'спокій, вечір без роботи, нічого не робити без провини' },
];
export const MOMENTS = ['Майже не було', 'Був один хороший момент', 'Кілька хороших моментів', 'День реально був живим'];
/** Real conversations per week that keep the social side alive (small ones count: a word after class, a message to a friend). */
export const TALKS_GOAL = 3;
/** A day at or under this score starts recovery mode for the next day. */
export const BAD_DAY = 4;

export const emptyLife = (): LifeDay => ({ dev: 0, people: 0, body: 0, god: 0, life: 0, rest: 0, moment: '', why: '', next: '', moments: 0, talks: 0 });
export const lifeOn = (S: State, k: string): LifeDay | undefined => S.life?.[k];

const rated = (d: LifeDay) => SECTORS.map(s => d[s.key]).filter(v => v > 0);

/** The mean of the rated sectors, one decimal. Needs at least four of six, so a day with one number is not judged. */
export function lifeScore(d?: LifeDay): number | null {
  if (!d) return null;
  const r = rated(d);
  if (r.length < 4) return null;
  return Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10) / 10;
}

/** The sector that was lowest that day (null when nothing is rated). */
export function weakest(d?: LifeDay) {
  if (!d) return null;
  const list = SECTORS.filter(s => d[s.key] > 0).sort((a, b) => d[a.key] - d[b.key]);
  return list[0] ? { ...list[0], v: d[list[0].key] } : null;
}

/** After a bad day: do not make up for it with double productivity. Only the basics. */
export function recoveryFor(S: State, k: string): { on: boolean; score: number; next: string; streak: number } {
  const prev = (n: number) => lifeScore(lifeOn(S, ymd(addD(new Date(k + 'T00:00'), -n))));
  const y = prev(1);
  if (y === null || y > BAD_DAY) return { on: false, score: y ?? 0, next: '', streak: 0 };
  let streak = 1;
  while (streak < 5) { const v = prev(streak + 1); if (v !== null && v <= BAD_DAY) streak++; else break; }
  return { on: true, score: y, next: lifeOn(S, ymd(addD(new Date(k + 'T00:00'), -1)))?.next || '', streak };
}

export type LifeWeek = {
  days: number; avg: number | null; avgs: { key: SectorKey; icon: string; label: string; avg: number | null }[];
  low: { key: SectorKey; label: string; icon: string; avg: number } | null;
  talks: number; momentDays: number; best: string[];
  /** Plain message about the balance, or '' when there is nothing to say yet. */
  note: string;
};

/** The last 7 days by sector: where the life tilts. */
export function lifeWeek(S: State, now = new Date()): LifeWeek {
  const keys = [...Array(7)].map((_, i) => ymd(addD(sod(now), i - 6)));
  const days = keys.map(k => lifeOn(S, k)).filter((d): d is LifeDay => !!d && rated(d).length > 0);
  const avgs = SECTORS.map(s => {
    const v = days.map(d => d[s.key]).filter(x => x > 0);
    return { key: s.key, icon: s.icon, label: s.label, avg: v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null };
  });
  const scores = keys.map(k => lifeScore(lifeOn(S, k))).filter((x): x is number => x !== null);
  const avg = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
  const known = avgs.filter(a => a.avg !== null) as { key: SectorKey; icon: string; label: string; avg: number }[];
  const low = known.length >= 3 ? [...known].sort((a, b) => a.avg - b.avg)[0] : null;
  const ws = ymd(wStart(now));
  const talks = Object.entries(S.life || {}).filter(([k]) => k >= ws).reduce((a, [, d]) => a + (d.talks || 0), 0);
  const best = keys.map(k => lifeOn(S, k)?.moment).filter((x): x is string => !!x).slice(-3).reverse();
  let note = '';
  if (low && avg !== null) {
    const hi = [...known].sort((a, b) => b.avg - a.avg)[0];
    note = hi.avg - low.avg >= 2.5 ? `Перекіс: «${low.label}» ${String(low.avg).replace('.', ',')} проти «${hi.label}» ${String(hi.avg).replace('.', ',')}. Не «я поганий», а підказка: що одне мале в цьому секторі можна зробити завтра?` : 'Сектори тримаються рівно. Стабільні 7–8 краще за стрибки 10 і 4.';
  }
  return { days: days.length, avg, avgs, low, talks, momentDays: keys.filter(k => (lifeOn(S, k)?.moments || 0) >= 1 || !!lifeOn(S, k)?.moment).length, best, note };
}

/** What the logs already say about a sector today, as a hint next to the slider (the rating itself is always yours). */
export function sectorHint(S: State, k: string, key: SectorKey): string {
  const h = S.health[k];
  if (key === 'dev') { const m = S.sessions.filter(s => ymd(new Date(s.t)) === k).reduce((a, s) => a + s.m, 0); return m ? `фокус ${hmPlain(m)}` : ''; }
  if (key === 'body') { const parts = [h?.workout ? `рух ${h.workout} хв` : '', h?.water ? `вода ${h.water}` : ''].filter(Boolean); return parts.join(', '); }
  if (key === 'rest') { const sl = sleepTotal(h); const soc = S.social.filter(x => x.date === k).reduce((a, x) => a + x.min, 0); return [sl ? `сон ${String(sl).replace('.', ',')} год` : '', soc ? `соцмережі ${hmPlain(soc)}` : ''].filter(Boolean).join(', '); }
  return '';
}
