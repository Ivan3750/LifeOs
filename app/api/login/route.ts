import { cookies } from 'next/headers';
import { authConfigured, checkPassword, COOKIE, cookieOptions, newSession } from '@/lib/server/auth';

export const runtime = 'nodejs';

// Brute-force brake: 5 wrong attempts from one address lock it for a minute.
// The address comes from a proxy header that a client can fake when the app is exposed directly, so there is also
// one limit for all addresses together: 20 wrong attempts in 10 minutes lock everybody out for a minute.
// The counters live in this process only (on serverless hosting every instance has its own).
const attempts = new Map<string, { n: number; until: number }>();
const allIps = { n: 0, since: 0, until: 0 };
const MAX_TRACKED = 1000;

function prune(now: number) {
  if (attempts.size < MAX_TRACKED) return;
  for (const [k, v] of attempts) if (v.until <= now) attempts.delete(k);
  while (attempts.size >= MAX_TRACKED) attempts.delete(attempts.keys().next().value!);
}

export async function POST(req: Request) {
  if (!authConfigured()) return Response.json({ error: 'not-configured' }, { status: 503 });
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  const now = Date.now(), a = attempts.get(ip);
  const until = Math.max(a?.until || 0, allIps.until);
  if (until > now) return Response.json({ error: 'locked', retryIn: Math.ceil((until - now) / 1000) }, { status: 429 });

  let password = '';
  try { password = String((await req.json()).password || ''); } catch {}
  if (!checkPassword(password)) {
    const n = (a?.n || 0) + 1;
    prune(now);
    attempts.set(ip, { n: n >= 5 ? 0 : n, until: n >= 5 ? now + 60_000 : 0 });
    if (now - allIps.since > 10 * 60_000) { allIps.n = 0; allIps.since = now; }
    if (++allIps.n >= 20) { allIps.n = 0; allIps.until = now + 60_000; }
    await new Promise(r => setTimeout(r, 400));
    return Response.json({ error: 'wrong-password' }, { status: 401 });
  }
  attempts.delete(ip);
  (await cookies()).set(COOKIE, newSession(), cookieOptions(req));
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  (await cookies()).set(COOKIE, '', cookieOptions(req, 0));
  return Response.json({ ok: true });
}
