import { cookies } from 'next/headers';
import { authConfigured, checkPassword, COOKIE, cookieOptions, newSession } from '@/lib/server/auth';

export const runtime = 'nodejs';

// Simple brute-force brake: 5 wrong attempts from one address lock it for a minute.
const attempts = new Map<string, { n: number; until: number }>();

export async function POST(req: Request) {
  if (!authConfigured()) return Response.json({ error: 'not-configured' }, { status: 503 });
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  const a = attempts.get(ip);
  if (a && a.until > Date.now()) return Response.json({ error: 'locked', retryIn: Math.ceil((a.until - Date.now()) / 1000) }, { status: 429 });

  let password = '';
  try { password = String((await req.json()).password || ''); } catch {}
  if (!checkPassword(password)) {
    const n = (a?.n || 0) + 1;
    attempts.set(ip, { n: n >= 5 ? 0 : n, until: n >= 5 ? Date.now() + 60_000 : 0 });
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
