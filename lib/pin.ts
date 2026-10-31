/** A lock for the phone: a code of English letters and digits. Only a salted hash is kept, in this device's own storage (never synced);
    whether the app is unlocked is not kept at all, so closing the app locks it again. This is a lock on the screen, not encryption of the data. */
export type PinRecord = { salt: string; hash: string; it: number; /** seconds in the background before the app locks (0 = at once) */ lock: number };

export const PIN_RE = /^[A-Za-z0-9]{4,32}$/;
export const validPin = (p: string) => PIN_RE.test(p);
/** Short hints for a better code, or an empty list. */
export const pinHints = (p: string) => [!/[A-Za-z]/.test(p) && 'додай хоча б одну літеру', !/\d/.test(p) && 'додай хоча б одну цифру', p.length < 6 && 'краще від 6 символів'].filter(Boolean) as string[];

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const derive = async (pin: string, salt: Uint8Array<ArrayBuffer>, it: number) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: it }, key, 256));
};

export async function makePin(pin: string, lock: number, it = 150_000): Promise<PinRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: b64(salt), hash: b64(await derive(pin, salt, it)), it, lock };
}
export async function checkPin(pin: string, r: PinRecord): Promise<boolean> {
  const got = await derive(pin, unb64(r.salt) as Uint8Array<ArrayBuffer>, r.it), want = unb64(r.hash);
  let diff = got.length ^ want.length; for (let i = 0; i < got.length; i++) diff |= got[i] ^ (want[i] ?? 0);
  return diff === 0;
}

/** Seconds to wait after wrong attempts: none for the first four, then 30 s, doubling. */
export const waitAfter = (fails: number) => (fails < 5 ? 0 : Math.min(3600, 30 * 2 ** (fails - 5)));
