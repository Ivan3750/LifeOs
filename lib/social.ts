import type { SocialEntry, State } from './types';
import { addD, sod, ymd } from './util';

export const PLATFORMS = ['Instagram', 'YouTube', 'TikTok', 'Telegram', 'Facebook', 'X / Twitter', 'Інше'] as const;
/** What the time was for. The point is not that all of it is wasted: some of it is learning, news or work. */
export const SOCIAL_WHY = ['Навчання', 'Розваги', 'Інформація', 'Робота'] as const;

export const socialGoal = (S: State, platform: string) => S.socialGoals?.[platform] ?? 0;

/** Everything logged on day k, per platform. over: minutes above the platforms' own daily limits. */
export function socialOn(S: State, k: string) {
  const list = S.social.filter(x => x.date === k), by: Record<string, number> = {};
  for (const x of list) by[x.platform] = (by[x.platform] || 0) + x.min;
  const total = Object.values(by).reduce((a, b) => a + b, 0);
  const over = Object.entries(by).reduce((a, [p, m]) => { const g = socialGoal(S, p); return a + (g > 0 ? Math.max(0, m - g) : 0); }, 0);
  return { list, by, total, over, compared: list.some(x => x.cmp) };
}

/** Totals for the last n days (ending today): minutes per platform and per purpose, days with a limit exceeded and days with comparing. */
export function socialPeriod(S: State, n: number, now = new Date()) {
  const keys = [...Array(n)].map((_, i) => ymd(addD(sod(now), i - n + 1)));
  const by: Record<string, number> = {}, why: Record<string, number> = {};
  let total = 0, overDays = 0, compared = 0, logged = 0;
  const perDay = keys.map(k => {
    const d = socialOn(S, k);
    for (const [p, m] of Object.entries(d.by)) by[p] = (by[p] || 0) + m;
    for (const x of d.list) why[x.why || 'Без позначки'] = (why[x.why || 'Без позначки'] || 0) + x.min;
    total += d.total; if (d.over > 0) overDays++; if (d.compared) compared++; if (d.total > 0) logged++;
    return { k, total: d.total, over: d.over };
  });
  return { keys, perDay, by, why, total, overDays, compared, logged };
}

export type SocialEntryInput = Pick<SocialEntry, 'platform' | 'min'> & Partial<Pick<SocialEntry, 'why' | 'cmp' | 'date'>>;
