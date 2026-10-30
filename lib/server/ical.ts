import ICAL from 'ical.js';
import type { ExtEvent } from '@/lib/types';

const MAX_OCCURRENCES = 1500;
const MAX_ITERATIONS = 200_000;

/** Events of one iCal file that touch the range from..to, with repeating events unrolled. */
export function expand(text: string, from: Date, to: Date, src: number): ExtEvent[] {
  const root = new ICAL.Component(ICAL.parse(text));
  for (const tz of root.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(tz);

  const events = root.getAllSubcomponents('vevent').map(v => new ICAL.Event(v));
  const masters = new Map<string, InstanceType<typeof ICAL.Event>>();
  for (const e of events) if (!e.isRecurrenceException()) masters.set(e.uid, e);
  // an edited occurrence whose series is not in the file (common with shared invitations) is shown as an event of its own
  for (const e of events) {
    if (!e.isRecurrenceException()) continue;
    const master = masters.get(e.uid);
    if (master) master.relateException(e);
    else masters.set(`${e.uid}#${e.recurrenceId?.toString() ?? masters.size}`, e);
  }

  const out: ExtEvent[] = [];
  const push = (uid: string, title: string, start: InstanceType<typeof ICAL.Time>, end: InstanceType<typeof ICAL.Time>, location: string | null) => {
    const allDay = start.isDate;
    const s = allDay ? `${start.toString()}T00:00:00` : start.toJSDate().toISOString();
    const e = allDay ? `${end.toString()}T00:00:00` : end.toJSDate().toISOString();
    out.push({ id: `${src}-${uid}-${s}`, title: title || '(без назви)', start: s, end: e, allDay, location: location || undefined, src });
  };
  const inRange = (start: Date, end: Date) => end >= from && start <= to;

  for (const ev of masters.values()) {
    if (!ev.startDate) continue;
    if (!ev.isRecurring()) {
      const end = ev.endDate || ev.startDate;
      if (inRange(ev.startDate.toJSDate(), end.toJSDate())) push(ev.uid, ev.summary, ev.startDate, end, ev.location);
      continue;
    }
    const it = ev.iterator();
    let next: InstanceType<typeof ICAL.Time> | null, n = 0, i = 0;
    while ((next = it.next()) && i++ < MAX_ITERATIONS) {
      // occurrences far before the range are skipped cheaply and do not count towards the limit
      if (next.toJSDate().getTime() < from.getTime() - 3 * 864e5) continue;
      if (n++ >= MAX_OCCURRENCES) break;
      const d = ev.getOccurrenceDetails(next);
      const s = d.startDate.toJSDate();
      if (s > to) break;
      if (inRange(s, d.endDate.toJSDate())) push(ev.uid, d.item.summary, d.startDate, d.endDate, d.item.location);
    }
  }
  return out;
}
