import crypto from 'node:crypto';
import { cookies } from 'next/headers';

export const COOKIE = 'pulse_session';
const MAX_AGE = 30 * 24 * 3600;

export const authConfigured = () => !!process.env.APP_PASSWORD;

// Changing APP_PASSWORD (or SESSION_SECRET) signs every device out.
const key = () => crypto.createHash('sha256').update('pulse-os:' + (process.env.SESSION_SECRET || process.env.APP_PASSWORD || '')).digest();
const mac = (exp: number) => crypto.createHmac('sha256', key()).update(String(exp)).digest('base64url');

export function newSession() {
  const exp = Date.now() + MAX_AGE * 1000;
  return `${exp}.${mac(exp)}`;
}

export function verifySession(token?: string) {
  if (!token || !authConfigured()) return false;
  const [e, m] = token.split('.');
  const exp = Number(e);
  if (!exp || exp < Date.now() || !m) return false;
  const a = Buffer.from(m), b = Buffer.from(mac(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function checkPassword(p: string) {
  if (!authConfigured()) return false;
  const a = crypto.createHash('sha256').update(p).digest(), b = crypto.createHash('sha256').update(process.env.APP_PASSWORD!).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function isAuthed() {
  return verifySession((await cookies()).get(COOKIE)?.value);
}

/** Secure only over https, so the cookie also works when the app is opened at http://<LAN address>. */
export const cookieOptions = (req: Request, maxAge = MAX_AGE) => {
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0].trim() || new URL(req.url).protocol.replace(':', '');
  return { httpOnly: true, sameSite: 'lax' as const, secure: proto === 'https', path: '/', maxAge };
};

export const unauthorized = () => Response.json({ error: 'unauthorized' }, { status: 401 });
