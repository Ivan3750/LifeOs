import type { State } from './types';
import { dayRows, type DayRow, type Metric } from './correlations';
import { addD, sod, ymd } from './util';

/* «Вчора проти звичайного»: yesterday's numbers next to the person's own average of the 14 days before it.
   No guessing and no model: a plain comparison, shown only where both sides exist. */

export type BriefLine = { key: Metric; label: string; value: string; usual: string; tone: 'good' | 'warn' | 'info'; to: string };
export type Brief = { k: string; lines: BriefLine[]; better: number; worse: number };

const n1 = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');
const mins = (m: number) => (m >= 60 ? `${n1(m / 60)} год` : `${Math.round(m)} хв`);

/** How each number is shown, which direction is better, how big a gap counts as «different», and where to open it.
    skip0: a zero most likely means «not written down», so it is not compared. */
const SPEC: Partial<Record<Metric, { label: string; fmt: (v: number) => string; better: 1 | -1; gap: number; to: string; skip0?: boolean }>> = {
  sleep: { label: 'Сон', fmt: v => `${n1(v)} год`, better: 1, gap: 0.75, to: 'health' },
  mood: { label: 'Настрій', fmt: v => `${n1(v)}/10`, better: 1, gap: 1, to: 'health' },
  focus: { label: 'Фокус', fmt: mins, better: 1, gap: 25, to: 'focus' },
  tasks: { label: 'Закрито задач', fmt: v => String(Math.round(v)), better: 1, gap: 2, to: 'tasks' },
  workout: { label: 'Рух', fmt: v => `${Math.round(v)} хв`, better: 1, gap: 12, to: 'health', skip0: true },
  water: { label: 'Вода', fmt: v => `${Math.round(v)} скл.`, better: 1, gap: 2, to: 'health', skip0: true },
};

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

/** Compares day k (yesterday by default) with the average of the 14 days before it. A number needs at least 3 of those days. */
export function dayBrief(S: State, now = new Date(), k = ymd(addD(sod(now), -1))): Brief {
  const rows = dayRows(S, 40, now), i = rows.findIndex(r => r.k === k);
  const empty = { k, lines: [] as BriefLine[], better: 0, worse: 0 };
  if (i < 0) return empty;
  const day = rows[i], before = rows.slice(Math.max(0, i - 14), i);
  const lines: BriefLine[] = [];
  for (const [key, sp] of Object.entries(SPEC) as [Metric, NonNullable<(typeof SPEC)[Metric]>][]) {
    const v = day[key];
    if (v === null || (sp.skip0 && v === 0)) continue;
    const past = before.map((r: DayRow) => r[key]).filter((x): x is number => x !== null && !(sp.skip0 && x === 0));
    if (past.length < 3) continue;
    const avg = mean(past), diff = v - avg;
    const far = Math.abs(diff) >= sp.gap;
    lines.push({ key, label: sp.label, value: sp.fmt(v), usual: sp.fmt(avg), to: sp.to, tone: !far ? 'info' : diff * sp.better > 0 ? 'good' : 'warn' });
  }
  const order = { warn: 0, good: 1, info: 2 };
  lines.sort((a, b) => order[a.tone] - order[b.tone]);
  return { k, lines, better: lines.filter(l => l.tone === 'good').length, worse: lines.filter(l => l.tone === 'warn').length };
}
