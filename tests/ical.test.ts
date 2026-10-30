import { describe, expect, it } from 'vitest';
import { expand } from '@/lib/server/ical';

const cal = (...events: string[]) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//test//EN\r\n${events.join('\r\n')}\r\nEND:VCALENDAR\r\n`;
const from = new Date('2026-03-01T00:00:00Z'), to = new Date('2026-03-31T00:00:00Z');

describe('expand', () => {
  it('unrolls a repeating event inside the range', () => {
    const ics = cal('BEGIN:VEVENT\r\nUID:a\r\nDTSTART:20260302T090000Z\r\nDTEND:20260302T100000Z\r\nRRULE:FREQ=WEEKLY;COUNT=4\r\nSUMMARY:Standup\r\nEND:VEVENT');
    const ev = expand(ics, from, to, 0);
    expect(ev).toHaveLength(4);
    expect(ev.every(e => e.title === 'Standup')).toBe(true);
  });

  it('finds occurrences of an old series without hitting the limit', () => {
    const ics = cal('BEGIN:VEVENT\r\nUID:old\r\nDTSTART:20150101T090000Z\r\nDTEND:20150101T093000Z\r\nRRULE:FREQ=DAILY\r\nSUMMARY:Daily\r\nEND:VEVENT');
    const ev = expand(ics, from, to, 0);
    expect(ev.length).toBeGreaterThanOrEqual(30);
  });

  it('shows an edited occurrence whose series is not in the file', () => {
    const ics = cal('BEGIN:VEVENT\r\nUID:solo\r\nRECURRENCE-ID:20260310T090000Z\r\nDTSTART:20260310T110000Z\r\nDTEND:20260310T120000Z\r\nSUMMARY:Moved meeting\r\nEND:VEVENT');
    const ev = expand(ics, from, to, 0);
    expect(ev).toHaveLength(1);
    expect(ev[0].title).toBe('Moved meeting');
  });

  it('skips a cancelled-by-move occurrence of a known series', () => {
    const ics = cal(
      'BEGIN:VEVENT\r\nUID:s\r\nDTSTART:20260302T090000Z\r\nDTEND:20260302T100000Z\r\nRRULE:FREQ=WEEKLY;COUNT=2\r\nSUMMARY:Weekly\r\nEND:VEVENT',
      'BEGIN:VEVENT\r\nUID:s\r\nRECURRENCE-ID:20260309T090000Z\r\nDTSTART:20260309T150000Z\r\nDTEND:20260309T160000Z\r\nSUMMARY:Weekly (late)\r\nEND:VEVENT',
    );
    const ev = expand(ics, from, to, 0);
    expect(ev.map(e => e.title).sort()).toEqual(['Weekly', 'Weekly (late)']);
  });

  it('handles all-day events', () => {
    const ics = cal('BEGIN:VEVENT\r\nUID:d\r\nDTSTART;VALUE=DATE:20260312\r\nDTEND;VALUE=DATE:20260313\r\nSUMMARY:Holiday\r\nEND:VEVENT');
    const [e] = expand(ics, from, to, 0);
    expect(e.allDay).toBe(true);
    expect(e.start.slice(0, 10)).toBe('2026-03-12');
  });
});
