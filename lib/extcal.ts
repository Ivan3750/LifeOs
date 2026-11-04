import type { ExtEvent, UiEvent } from './types';
import { addD, hhmm } from './util';

/** How many occurrences of each repeating event the loaded calendars hold (to offer «hide all of them»). */
export function seriesSizes(ext: ExtEvent[]) {
  const m = new Map<string, number>();
  for (const x of ext) if (x.series) m.set(x.series, (m.get(x.series) || 0) + 1);
  return m;
}

/** Events of subscribed calendars on one day. Events the person hid on this site (one occurrence, or a whole series) are left out;
    the calendar itself is never touched. */
export function extOn(ext: ExtEvent[], hidden: Record<string, 1> | undefined, date: string, sizes = seriesSizes(ext)): UiEvent[] {
  const out: UiEvent[] = [], skip = hidden || {};
  for (const x of ext) {
    if (skip[x.id] || (x.series && skip[x.series])) continue;
    const st = new Date(x.start), en = new Date(x.end), more = { extId: x.id, series: x.series, repeats: !!x.series && (sizes.get(x.series) || 0) > 1 };
    if (x.allDay) {
      // all-day events end on the (exclusive) next day
      const d0 = x.start.slice(0, 10), d1 = x.end.slice(0, 10);
      if (date >= d0 && date < d1) out.push({ id: 'x' + x.id + date, date, s: '00:00', e: '23:59', title: x.title, c: 'c4', ext: true, allDay: true, location: x.location, ...more });
    } else {
      // timed events also count on the following days they run into (night shifts, trips)
      const d0 = new Date(date + 'T00:00'), d1 = addD(d0, 1);
      if (st < d1 && en > d0) out.push({ id: 'x' + x.id + date, date, s: st > d0 ? hhmm(st) : '00:00', e: en < d1 ? hhmm(en) : '23:59', title: x.title, c: 'c4', ext: true, location: x.location, ...more });
    }
  }
  return out;
}
