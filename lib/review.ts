import type { State } from './types';
import { weekKey, type NeedStat } from './needs';

/* The Sunday review: each need gets a mark from 1 to 5, and the app suggests one or two changes for the next week, never ten. */

export const RATING_WORDS = ['', 'Дуже бракує', 'Бракує', 'Так собі', 'Добре', 'Вдосталь'];

export type Suggestion = {
  id: string; need: number;
  kind: 'focus' | 'raise' | 'lower';
  text: string;
  /** For raise and lower: the new weekly target. */
  target?: number;
  score: number;
};

/** At most two changes for the next week. A low mark with the target missed → the need goes first in the plan; a low mark although the target was met → the target is too low;
    a high mark although the target was missed → the target is too high. */
export function suggest(stats: NeedStat[], ratings: Record<string, number>, max = 2): Suggestion[] {
  const out: Suggestion[] = [];
  for (const st of stats) {
    const r = ratings[st.need.id];
    if (!r) continue;
    const n = st.need, met = st.done >= n.weekly, share = n.weekly ? st.done / n.weekly : 1;
    if (r <= 2 && !met) {
      out.push({ id: `focus-${n.id}`, need: n.id, kind: 'focus', score: 3 - r + 1 + (1 - share), text: `«${n.name}»: ${r} з 5, зроблено ${st.done} з ${n.weekly}. Наступного тижня поставлю це першим у плані` });
    } else if (r <= 2 && met && n.weekly < 14) {
      out.push({ id: `raise-${n.id}`, need: n.id, kind: 'raise', score: 3 - r + 0.5, target: n.weekly + 1, text: `«${n.name}»: ціль виконана (${st.done} з ${n.weekly}), а бракує. Підняти ціль до ${n.weekly + 1} на тиждень` });
    } else if (r >= 4 && !met && share < 0.5 && n.weekly > 1) {
      const t = Math.max(1, st.done, n.weekly - 1);
      if (t < n.weekly) out.push({ id: `lower-${n.id}`, need: n.id, kind: 'lower', score: 1.5 + (1 - share), target: t, text: `«${n.name}»: ${r} з 5, хоча зроблено лише ${st.done} з ${n.weekly}. Ціль завелика. Знизити до ${t}` });
    } else if (r === 3 && !met) {
      out.push({ id: `focus-${n.id}`, need: n.id, kind: 'focus', score: 0.5 * (1 - share), text: `«${n.name}»: ${st.done} з ${n.weekly}. Дам цьому місце в плані наступного тижня` });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, max);
}

/** The review of the week that starts on `wk` (the Monday's key). */
export const reviewOf = (S: State, wk = weekKey()) => S.reviews[wk];
