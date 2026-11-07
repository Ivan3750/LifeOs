import { describe, expect, it } from 'vitest';
import { bankItems, parseAmount, parseCsv, parseDate, platformOf, socialItems } from '../pi/collector.mjs';

describe('collector: bank CSV', () => {
  it('reads amounts and dates in Danish and ISO formats', () => {
    expect(parseAmount('-1.234,56')).toBe(-1234.56);
    expect(parseAmount('59,5 kr')).toBe(59.5);
    expect(parseAmount('-59.50')).toBe(-59.5);
    expect(Number.isNaN(parseAmount('—'))).toBe(true);
    expect(parseDate('31-10-2026')).toBe('2026-10-31');
    expect(parseDate('5.1.26')).toBe('2026-01-05');
    expect(parseDate('2026-10-31 12:00')).toBe('2026-10-31');
    expect(parseDate('hello')).toBeNull();
  });

  it('parses quoted fields and the semicolon delimiter', () => {
    expect(parseCsv('a;b\n"x;y";2\n')).toEqual([['a', 'b'], ['x;y', '2']]);
  });

  it('turns lines into stable tx items and keeps two identical coffees apart', () => {
    const csv = 'Date;Amount;Text\n31-10-2026;-35,00;Café\n31-10-2026;-35,00;Café\n01-11-2026;1.500,00;Wolt udbetaling\n02-11-2026;0;noop\n';
    const cfg = { date: 'date', amount: 'amount', text: 'text' };
    const a = bankItems(csv, cfg), b = bankItems(csv, cfg);
    expect(a).toHaveLength(3);
    expect(a.map((x: { ext: string }) => x.ext)).toEqual(b.map((x: { ext: string }) => x.ext));
    expect(new Set(a.map((x: { ext: string }) => x.ext)).size).toBe(3);
    expect(a[2]).toMatchObject({ dir: 'in', amt: 1500, date: '2026-11-01' });
    expect(a[0]).toMatchObject({ dir: 'out', amt: 35 });
  });

  it('explains a wrong column name', () => {
    expect(() => bankItems('A;B\n1;2', { date: 'Date', amount: 'Amount' })).toThrow(/нема колонок/);
  });
});

describe('collector: ActivityWatch', () => {
  it('recognises platforms by url, app or title', () => {
    expect(platformOf({ url: 'https://www.youtube.com/watch?v=1' })).toBe('YouTube');
    expect(platformOf({ app: 'Telegram', title: 'chat' })).toBe('Telegram');
    expect(platformOf({ app: 'Code', title: 'main.ts' })).toBeNull();
  });

  it('adds up minutes per platform and skips away time', () => {
    const items = socialItems([[
      { duration: 600, data: { url: 'https://youtube.com/x' } },
      { duration: 900, data: { url: 'https://youtube.com/y' } },
      { duration: 3000, data: { url: 'https://youtube.com/z', status: 'afk' } },
      { duration: 20, data: { url: 'https://reddit.com' } },
      { duration: 100, data: { app: 'Code' } },
    ]], '2026-11-07');
    expect(items).toEqual([{ type: 'social', ext: 'aw:aw:2026-11-07:YouTube', date: '2026-11-07', platform: 'YouTube', min: 25 }]);
  });
});
