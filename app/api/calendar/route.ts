import ICAL from 'ical.js';
import type { ExtEvent } from '@/lib/types';
import { isAuthed, unauthorized } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_URLS = 10;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_OCCURRENCES = 1500;

/** Turns webcal:// into https:// and rejects anything that is not a public https address. */
function normalize(raw: string): string | null {
  try {
    const u = new URL(raw.trim().replace(/^webcal:/i, 'https:'));
    if (u.protocol !== 'https:') return null;
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[?::1\]?$)/i.test(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

const label = (u: string) => { try { return new URL(u).host; } catch { return 'календар'; } };

function expand(text: string, from: Date, to: Date, src: number): ExtEvent[] {
  const root = new ICAL.Component(ICAL.parse(text));
  for (const tz of root.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(tz);

  const events = root.getAllSubcomponents('vevent').map(v => new ICAL.Event(v));
  const masters = new Map<string, InstanceType<typeof ICAL.Event>>();
  for (const e of events) if (!e.isRecurrenceException()) masters.set(e.uid, e);
  for (const e of events) if (e.isRecurrenceException()) masters.get(e.uid)?.relateException(e);

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
    let next: InstanceType<typeof ICAL.Time> | null, n = 0;
    while ((next = it.next()) && n++ < MAX_OCCURRENCES) {
      const d = ev.getOccurrenceDetails(next);
      const s = d.startDate.toJSDate();
      if (s > to) break;
      if (inRange(s, d.endDate.toJSDate())) push(ev.uid, d.item.summary, d.startDate, d.endDate, d.item.location);
    }
  }
  return out;
}

export async function POST(req: Request) {
  if (!(await isAuthed())) return unauthorized();
  let body: { urls?: unknown; from?: string; to?: string } = {};
  try { body = await req.json(); } catch {}

  const fromEnv = (process.env.ICAL_URLS || '').split(/[\s,]+/).filter(Boolean);
  const fromClient = Array.isArray(body.urls) ? body.urls.filter((u): u is string => typeof u === 'string') : [];
  const urls = [...new Set([...fromEnv, ...fromClient].map(normalize).filter((u): u is string => !!u))].slice(0, MAX_URLS);

  if (!urls.length) return Response.json({ configured: false, events: [], errors: [] });

  const now = Date.now();
  const from = body.from ? new Date(body.from) : new Date(now - 14 * 864e5);
  const to = body.to ? new Date(body.to) : new Date(now + 60 * 864e5);

  const errors: string[] = [];
  const results = await Promise.all(urls.map(async (u, i) => {
    try {
      const res = await fetch(u, { cache: 'no-store', headers: { 'user-agent': 'PulseOS/1.0 (+calendar sync)' }, signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(res.status === 404 ? 'посилання не знайдено (404). Можливо, його скинули в налаштуваннях календаря' : `сервер відповів ${res.status}`);
      const text = await res.text();
      if (text.length > MAX_BYTES) throw new Error('календар завеликий');
      if (!text.includes('BEGIN:VCALENDAR')) throw new Error('це не iCal-файл. Потрібне посилання, що закінчується на .ics');
      return expand(text, from, to, i);
    } catch (e) {
      errors.push(`${label(u)}: ${e instanceof Error ? e.message : 'не вдалося завантажити'}`);
      return [];
    }
  }));

  const events = results.flat().sort((a, b) => a.start.localeCompare(b.start));
  return Response.json({ configured: true, events, errors });
}
