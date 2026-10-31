import type { State, UiEvent } from './types';
import { addD, sod, toMin, ymd } from './util';

/** Where an event's time goes. Colours are fixed so a category looks the same everywhere. */
export const EV_CATS: { key: string; label: string; color: string }[] = [
  { key: 'work', label: 'Робота', color: '#FF5B1F' },
  { key: 'biz', label: 'Бізнес', color: '#C2410C' },
  { key: 'study', label: 'Навчання', color: '#6A4CE0' },
  { key: 'sport', label: 'Спорт і здоровʼя', color: '#3FB383' },
  { key: 'food', label: 'Їжа', color: '#F2B544' },
  { key: 'people', label: 'Спілкування', color: '#E0568C' },
  { key: 'rest', label: 'Відпочинок і розваги', color: '#3B9BF0' },
  { key: 'road', label: 'Дорога', color: '#8C8781' },
  { key: 'chores', label: 'Побут і справи', color: '#B58B5E' },
  { key: 'other', label: 'Інше', color: '#B9B3AC' },
];
export const catOf = (key: string) => EV_CATS.find(c => c.key === key) || EV_CATS[EV_CATS.length - 1];

/** First guesses from the words in a title. Stems are the first 5 letters, so «лекція» and «лекції» are the same word.
    A guess is only a suggestion: the user confirms it once, and then the app knows. */
const GUESS_WORDS: Record<string, string[]> = {
  work: ['зустр', 'дзвін', 'call', 'meeti', 'проєк', 'проек', 'презе', 'робот', 'звіт', 'інтер', 'нарад', 'stand', 'sprin', 'work'],
  biz: ['клієн', 'бізне', 'угода', 'угоди', 'продаж', 'лід', 'реклам', 'рахун', 'комер', 'партн', 'sales', 'clien', 'busin', 'таргет'],
  study: ['лекці', 'курс', 'урок', 'навча', 'універ', 'воркш', 'семін', 'екзам', 'лабор', 'вебін', 'class', 'lectu', 'study', 'практ', 'данськ'],
  sport: ['спорт', 'трену', 'зал', 'біг', 'пробі', 'йога', 'футбо', 'плава', 'басей', 'велос', 'gym', 'run', 'лікар', 'стома', 'аналі', 'масаж', 'терап', 'dentis'],
  food: ['обід', 'вечер', 'снід', 'сніда', 'кава', 'ланч', 'ресто', 'кафе', 'їжа', 'готув', 'lunch', 'dinne', 'break', 'brunc'],
  people: ['друз', 'побач', 'вечір', 'гості', 'клуб', 'родин', 'мама', 'тато', 'свято', 'party', 'drink'],
  rest: ['кіно', 'фільм', 'гра', 'відпо', 'прогу', 'концер', 'театр', 'ігри', 'серіа', 'movie', 'game', 'relax'],
  road: ['дорог', 'поїзд', 'потяг', 'автоб', 'метро', 'переї', 'аероп', 'політ', 'таксі', 'train', 'fligh', 'commu'],
  chores: ['прибир', 'магаз', 'покуп', 'пошта', 'банк', 'побут', 'ремон', 'стирк', 'nette', 'shop', 'clean'],
};
const STOP = new Set(['для', 'при', 'про', 'над', 'під', 'від', 'без', 'the', 'and', 'with', 'мій', 'моя', 'моє']);

/** A title in the form used as a key: lower case, without numbers and punctuation. */
export const normTitle = (t: string) => t.toLowerCase().replace(/[^\p{L}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
/** Word stems of a title (5 letters each). */
export const stems = (t: string) => [...new Set(normTitle(t).split(' ').filter(w => w.length >= 3 && !STOP.has(w)).map(w => w.slice(0, 5)))];

export type Guess = { cat: string | null; source: 'user' | 'learned' | 'guess' | 'none' };

/** What this title most likely means: an answer given before wins, then what was learned from other titles with the same words, then a plain guess. */
export function classify(S: State, title: string): Guess {
  const n = normTitle(title), ws = stems(title);
  if (S.evCats?.[n]) return { cat: S.evCats[n], source: 'user' };
  const votes: Record<string, number> = {};
  for (const w of ws) for (const [c, v] of Object.entries(S.evWords?.[w] || {})) votes[c] = (votes[c] || 0) + v;
  const total = Object.values(votes).reduce((a, b) => a + b, 0), top = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] / total >= 0.6) return { cat: top[0], source: 'learned' };
  for (const [c, list] of Object.entries(GUESS_WORDS)) if (ws.some(w => list.includes(w))) return { cat: c, source: 'guess' };
  return { cat: null, source: 'none' };
}

/** Remembers the answer for a title and for each of its words. Changing an answer takes the old votes back. Works on a draft state. */
export function learn(s: State, title: string, cat: string) {
  const n = normTitle(title); if (!n) return;
  const old = s.evCats[n], ws = stems(title);
  if (old === cat) return;
  if (old) for (const w of ws) { const m = s.evWords[w]; if (m?.[old]) { m[old]--; if (m[old] <= 0) delete m[old]; if (!Object.keys(m).length) delete s.evWords[w]; } }
  s.evCats[n] = cat;
  for (const w of ws) { s.evWords[w] = s.evWords[w] || {}; s.evWords[w][cat] = (s.evWords[w][cat] || 0) + 1; }
}
/** Takes an answer back. */
export function unlearn(s: State, title: string) {
  const n = normTitle(title), old = s.evCats[n]; if (!old) return;
  for (const w of stems(title)) { const m = s.evWords[w]; if (m?.[old]) { m[old]--; if (m[old] <= 0) delete m[old]; if (!Object.keys(m).length) delete s.evWords[w]; } }
  delete s.evCats[n];
}

const evMin = (e: UiEvent) => Math.max(0, toMin(e.e) - toMin(e.s) + (e.e === '23:59' ? 1 : 0));

export type EventGroup = { norm: string; title: string; count: number; min: number; cat: string | null; source: Guess['source'] };
/** Calendar events (mine and from calendars, not logged activities and not all-day) of the given days, grouped by title. */
export function eventGroups(S: State, days: string[], eventsOn: (k: string) => UiEvent[]): EventGroup[] {
  const m = new Map<string, EventGroup>();
  for (const k of days) for (const e of eventsOn(k)) {
    if (e.act !== undefined || e.allDay) continue;
    const n = normTitle(e.title); if (!n) continue;
    const g = m.get(n) || { norm: n, title: e.title, count: 0, min: 0, ...classify(S, e.title) };
    g.count++; g.min += evMin(e); m.set(n, g);
  }
  return [...m.values()].sort((a, b) => b.min - a.min);
}

export type LedgerRow = { key: string; label: string; color: string; min: number };

/** Merged list of busy intervals; add() returns only the part of a new interval that was still free, so time is never counted twice. */
function busy() {
  let list: [number, number][] = [];
  return (a: number, b: number) => {
    if (b <= a) return 0;
    let overlap = 0;
    for (const [x, y] of list) overlap += Math.max(0, Math.min(b, y) - Math.max(a, x));
    const next = [...list, [a, b] as [number, number]].sort((p, q) => p[0] - q[0]), merged: [number, number][] = [];
    for (const iv of next) { const l = merged[merged.length - 1]; if (l && iv[0] <= l[1]) l[1] = Math.max(l[1], iv[1]); else merged.push([...iv]); }
    list = merged;
    return (b - a - overlap) / 6e4;
  };
}

/** Where the hours of the given days went. Priority when things overlap: focus, errands, calendar events. Sleep and social media have no
    exact time of day, so their minutes are taken off what is left. Whatever is not accounted for is «Без обліку». For today only the hours so far count. */
export function timeLedger(S: State, days: string[], eventsOn: (k: string) => UiEvent[], now = Date.now()): { rows: LedgerRow[]; total: number } {
  const acc: Record<string, number> = {};
  const put = (key: string, v: number) => { if (v > 0) acc[key] = (acc[key] || 0) + v; };
  let total = 0;
  for (const k of days) {
    const d0 = new Date(k + 'T00:00').getTime(), d1 = addD(new Date(d0), 1).getTime(), end = Math.min(d1, Math.max(d0, now));
    if (end <= d0) continue;
    const win = (end - d0) / 6e4; total += win;
    const add = busy(), clip = (a: number, b: number): [number, number] => [Math.max(a, d0), Math.min(b, end)];
    let used = 0;
    for (const s of S.sessions) { const [a, b] = clip(s.t, s.t + s.m * 6e4); const m = add(a, b); put('focus', m); used += m; }
    const runs = S.act ? [{ kind: S.act.kind, start: S.act.start, end: now }] : [];
    for (const a of [...S.activities, ...runs]) { const [x, y] = clip(a.start, a.end); const m = add(x, y); put(a.kind === 'Бізнес' ? 'ev:biz' : 'act', m); used += m; }
    for (const e of eventsOn(k)) {
      if (e.act !== undefined || e.allDay) continue;
      const day = new Date(k + 'T00:00'), a = new Date(day).setHours(Math.floor(toMin(e.s) / 60), toMin(e.s) % 60, 0, 0), b = e.e === '23:59' ? d1 : new Date(day).setHours(Math.floor(toMin(e.e) / 60), toMin(e.e) % 60, 0, 0);
      const [x, y] = clip(a, b); const m = add(x, y); put('ev:' + (classify(S, e.title).cat || 'other'), m); used += m;
    }
    const sleep = Math.min(Math.max(0, win - used), (S.health[k]?.sleep || 0) * 60); put('sleep', sleep); used += sleep;
    const soc = Math.min(Math.max(0, win - used), S.social.filter(x => x.date === k).reduce((a, x) => a + x.min, 0)); put('social', soc); used += soc;
    put('rem', Math.max(0, win - used));
  }
  const rows: LedgerRow[] = [];
  const meta: Record<string, [string, string]> = { sleep: ['Сон', '#8B7CF6'], focus: ['Фокус', '#FF5B1F'], act: ['Справи (Wolt, дорога…)', '#2B2723'], social: ['Соцмережі', '#E5484D'], rem: ['Без обліку', '#D8D3CC'] };
  for (const [key, min] of Object.entries(acc)) {
    if (key.startsWith('ev:')) { const c = catOf(key.slice(3)); rows.push({ key, label: c.label, color: c.color, min }); }
    else rows.push({ key, label: meta[key][0], color: meta[key][1], min });
  }
  rows.sort((a, b) => (a.key === 'rem' ? 1 : b.key === 'rem' ? -1 : b.min - a.min));
  return { rows, total };
}

/** Keys of the days from `from` to `to`, both included. */
export const dayRange = (from: Date, to: Date) => { const out: string[] = []; for (let d = sod(from); d <= to; d = addD(d, 1)) out.push(ymd(d)); return out; };
