import { describe, expect, it } from 'vitest';
import { assertPublicHost, isPrivateIp } from '@/lib/server/safe-fetch';

describe('isPrivateIp', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fc00::1', 'fd12::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1'])('%s is private', ip => {
    expect(isPrivateIp(ip)).toBe(true);
  });
  it.each(['8.8.8.8', '172.15.0.1', '172.32.0.1', '93.184.216.34', '2606:4700:4700::1111'])('%s is public', ip => {
    expect(isPrivateIp(ip)).toBe(false);
  });
});

describe('assertPublicHost', () => {
  it('rejects literal private addresses and local names without any lookup', async () => {
    for (const u of ['https://127.0.0.1/a', 'https://[::1]/a', 'https://localhost/a', 'https://intranet.internal/a', 'https://172.20.0.5/a']) {
      await expect(assertPublicHost(new URL(u))).rejects.toThrow();
    }
  });
  it('accepts a literal public address', async () => {
    await expect(assertPublicHost(new URL('https://8.8.8.8/a'))).resolves.toBeUndefined();
  });
});
