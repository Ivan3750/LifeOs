import { expand } from '@/lib/server/ical';
import { isAuthed, unauthorized } from '@/lib/server/auth';
import { fetchPublicText } from '@/lib/server/safe-fetch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_URLS = 10;
const MAX_BYTES = 5 * 1024 * 1024;
/** Downloaded calendars are kept for a short time, so refreshing from several devices does not hit the provider every time. */
const CACHE_MS = 2 * 60_000;
const cache = new Map<string, { at: number; text: string }>();

/** Turns webcal:// into https://. Whether the host is public is checked when it is fetched (see safe-fetch). */
function normalize(raw: string): string | null {
  try {
    const u = new URL(raw.trim().replace(/^webcal:/i, 'https:'));
    if (u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

const label = (u: string) => { try { return new URL(u).host; } catch { return 'календар'; } };

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
      let hit = cache.get(u);
      if (!hit || Date.now() - hit.at > CACHE_MS) {
        const res = await fetchPublicText(u, { maxBytes: MAX_BYTES, headers: { 'user-agent': 'PulseOS/1.0 (+calendar sync)' } });
        if (res.status !== 200) throw new Error(res.status === 404 ? 'посилання не знайдено (404). Можливо, його скинули в налаштуваннях календаря' : `сервер відповів ${res.status}`);
        if (!res.text.includes('BEGIN:VCALENDAR')) throw new Error('це не iCal-файл. Потрібне посилання, що закінчується на .ics');
        hit = { at: Date.now(), text: res.text };
        cache.set(u, hit);
        if (cache.size > 50) cache.delete(cache.keys().next().value!);
      }
      return expand(hit.text, from, to, i);
    } catch (e) {
      errors.push(`${label(u)}: ${e instanceof Error ? e.message : 'не вдалося завантажити'}`);
      return [];
    }
  }));

  const events = results.flat().sort((a, b) => a.start.localeCompare(b.start));
  return Response.json({ configured: true, events, errors });
}
