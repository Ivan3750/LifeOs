import type { Person, Place, State, Touch } from './types';
import { daysBetween } from './needs';
import { ymd } from './util';

export const KINDS: [Person['kind'], string, number][] = [['friend', 'Друг', 14], ['family', 'Родина', 7], ['partner', 'Партнер(ка)', 2], ['work', 'Колега', 30]];
export const kindLabel = (k: Person['kind']) => KINDS.find(x => x[0] === k)?.[1] ?? '';

/** The last message or meeting with a person. */
export function lastTouch(S: State, id: number): Touch | undefined {
  return S.touches.filter(t => t.person === id).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)[0];
}

/** Days since the last contact (null: never). */
export function daysSince(S: State, id: number, today = ymd(new Date())): number | null {
  const t = lastTouch(S, id);
  return t ? Math.max(0, daysBetween(t.date, today)) : null;
}

/** How overdue a person is: 1 means the wanted gap has just passed. Someone never contacted counts as clearly overdue. */
export function overdue(S: State, p: Person, today = ymd(new Date())): number {
  const d = daysSince(S, p.id, today);
  return d === null ? 3 : d / Math.max(1, p.every);
}

/** Who to write to or meet today: the one planned for today first, then whoever is the most overdue. */
export function suggestPerson(S: State, today = ymd(new Date())): { person: Person; days: number | null; ratio: number } | null {
  const ranked = S.people.map(p => ({ person: p, days: daysSince(S, p.id, today), ratio: p.nextDate === today ? 100 : overdue(S, p, today) }))
    .sort((a, b) => b.ratio - a.ratio || a.person.name.localeCompare(b.person.name));
  return ranked[0] ?? null;
}

/** Clubs and communities: the ones with a date ahead come first (soonest first), then the rest by the longest wait. */
export function sortPlaces(list: Place[], today = ymd(new Date())): Place[] {
  const ahead = (p: Place) => !!p.going && p.going >= today;
  return [...list].sort((a, b) => Number(ahead(b)) - Number(ahead(a)) || (ahead(a) ? a.going!.localeCompare(b.going!) : (a.was || '').localeCompare(b.was || '')));
}
