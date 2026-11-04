import type { State, UiEvent } from './types';
import { adviceList, type Advice } from './correlations';
import { coach, type Tip } from './coach';

/** One piece of advice as the screens show it: the same card on the home page and on the advice page. */
export type Card = Omit<Advice, 'area'> & { id: string; area: string; /** the section to open */ to?: string };

/** The coach's plain rules (deadlines, leads, pace, quitting…) speak about topics the history-based advice may already have covered. */
const TOPIC: Record<string, string> = { 'short-sleep': 'sleep', 'late-bed': 'bed', 'sleep-rhythm': 'bed', water: 'water', move: 'workout', spend: 'spend', 'low-mood': 'mood' };

const fromTip = (t: Tip): Card => ({
  id: t.id, tone: t.tone === 'good' ? 'good' : 'warn', area: t.area, title: t.title, reason: t.why, action: t.action, cause: '', facts: t.facts, to: t.to, topic: TOPIC[t.id],
});

/** Everything worth doing today for the advice page: first what the person's own history says about today (the cards of the home page),
    then the plain rules about deadlines, money, pace and habits, each topic once. Things that go well come last. */
export function adviceCards(S: State, eventsOn: (k: string) => UiEvent[], now = new Date()) {
  const mine: Card[] = adviceList(S, now).map((a, i) => ({ ...a, id: 'h' + i }));
  const r = coach(S, eventsOn, now);
  const seen = new Set(mine.map(a => a.topic).filter(Boolean));
  const extra: Card[] = [];
  for (const t of r.tips) {
    const c = fromTip(t);
    if (c.topic && seen.has(c.topic)) continue;
    if (c.topic) seen.add(c.topic);
    extra.push(c);
  }
  const all = [...mine, ...extra];
  return { todo: all.filter(c => c.tone !== 'good').slice(0, 8), good: all.filter(c => c.tone === 'good').slice(0, 3), days: r.days, coverage: r.coverage };
}
