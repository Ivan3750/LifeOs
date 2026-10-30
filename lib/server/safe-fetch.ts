import dns from 'node:dns/promises';
import net from 'node:net';

/** True for addresses that must never be reached from the server: loopback, private, link-local, CGNAT, multicast, unspecified. */
export function isPrivateIp(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 192 && b === 0)
      || (a === 198 && (b === 18 || b === 19));
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    const mapped = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return x === '::' || x === '::1' || x.startsWith('fc') || x.startsWith('fd') || /^fe[89ab]/.test(x) || x.startsWith('ff') || x.startsWith('64:ff9b');
  }
  return true;
}

/** Throws when the host of the URL is, or resolves to, a non-public address. */
export async function assertPublicHost(u: URL) {
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('адреса не публічна');
    return;
  }
  if (/^localhost$|\.localhost$|\.local$|\.internal$/i.test(host)) throw new Error('адреса не публічна');
  const addrs = await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some(a => isPrivateIp(a.address))) throw new Error('адреса не публічна');
}

/** Downloads text from a public https address.
    Every redirect is checked again, and the body is cut off when it grows past maxBytes. */
export async function fetchPublicText(url: string, opts: { maxBytes: number; timeoutMs?: number; headers?: Record<string, string>; maxRedirects?: number }) {
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 15000);
  let cur = new URL(url);
  for (let hop = 0; hop <= (opts.maxRedirects ?? 3); hop++) {
    if (cur.protocol !== 'https:') throw new Error('потрібне https-посилання');
    await assertPublicHost(cur);
    const res = await fetch(cur, { cache: 'no-store', redirect: 'manual', headers: opts.headers, signal });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      cur = new URL(res.headers.get('location')!, cur);
      continue;
    }
    if (!res.ok) return { status: res.status, text: '' };
    const len = Number(res.headers.get('content-length') || 0);
    if (len > opts.maxBytes) throw new Error('календар завеликий');
    const reader = res.body?.getReader();
    if (!reader) return { status: res.status, text: await res.text() };
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > opts.maxBytes) { await reader.cancel(); throw new Error('календар завеликий'); }
      chunks.push(value);
    }
    return { status: res.status, text: Buffer.concat(chunks).toString('utf8') };
  }
  throw new Error('забагато перенаправлень');
}
