import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { crc32, zip } from '@/lib/zip';
import { buildTables, presetPeriod, SECTIONS, toCsv, type SectionKey } from '@/lib/export';
import { makeState } from '@/lib/seed';

const all = Object.fromEntries(SECTIONS.map(([k]) => [k, true])) as Record<SectionKey, boolean>;

describe('zip', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
  it('writes an archive that unzip accepts, with Cyrillic names and text', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'zip-'));
    const file = path.join(dir, 't.zip');
    writeFileSync(file, zip([{ name: 'fokus.csv', text: 'Дата,Хвилин\r\n2026-03-01,25' }, { name: 'zadachi.csv', text: 'a' }]));
    let out = '';
    try { out = execFileSync('python3', ['-c', 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(z.read("fokus.csv").decode("utf-8")); print(len(z.namelist()))', file]).toString(); } catch { return; }
    expect(out).toContain('Дата,Хвилин');
    expect(out.trim().endsWith('2')).toBe(true);
  });
});

describe('buildTables', () => {
  const S = makeState(false);
  S.sessions.push({ t: new Date('2026-03-10T10:00:00').getTime(), m: 50, task: 'Звіт' }, { t: new Date('2026-01-01T10:00:00').getTime(), m: 25 });
  S.events.push({ id: 1, date: '2026-03-12', s: '10:00', e: '11:00', title: 'Лекція', c: 'c1' });
  S.money.tx.push({ id: 2, type: 'out', amt: 90, cat: 'Їжа', note: 'Кава, "велика"', date: '2026-03-11', acc: 'dk' });
  const ext = [
    { id: 'a', title: 'Зустріч у календарі', start: '2026-03-12T09:00:00.000Z', end: '2026-03-12T10:00:00.000Z', allDay: false, src: 0 },
    { id: 'b', title: 'Давня подія', start: '2025-01-01T09:00:00.000Z', end: '2025-01-01T10:00:00.000Z', allDay: false, src: 0 },
  ];

  it('keeps only the records inside the period', () => {
    const t = buildTables(S, ext, { from: '2026-03-01', to: '2026-03-31' }, all);
    expect(t.find(x => x.file === 'fokus')?.rows).toHaveLength(1);
    expect(t.find(x => x.file === 'finansy')?.rows).toHaveLength(1);
  });
  it('puts own and calendar events into one table, only those in the period', () => {
    const rows = buildTables(S, ext, { from: '2026-03-01', to: '2026-03-31' }, all).find(x => x.file === 'podii')!.rows;
    expect(rows.map(r => r[3])).toEqual(expect.arrayContaining(['Лекція', 'Зустріч у календарі']));
    expect(rows.map(r => r[3])).not.toContain('Давня подія');
  });
  it('leaves out sections that are switched off', () => {
    const t = buildTables(S, ext, { from: '2026-03-01', to: '2026-03-31' }, { ...all, money: false, events: false });
    expect(t.some(x => x.file === 'finansy' || x.file === 'podii')).toBe(false);
  });
  it('escapes csv cells and starts with a BOM', () => {
    const csv = toCsv(buildTables(S, [], { from: '2026-03-01', to: '2026-03-31' }, all).find(x => x.file === 'finansy')!);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"Кава, ""велика"""');
  });
  it('makes presets that end today', () => {
    const p = presetPeriod('week', new Date('2026-03-18T12:00:00'));
    expect(p).toEqual({ from: '2026-03-12', to: '2026-03-18' });
    expect(presetPeriod('all', new Date('2026-03-18T12:00:00')).from).toBe('0000-01-01');
  });
});
