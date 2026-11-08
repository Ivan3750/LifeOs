import { describe, expect, it } from 'vitest';
import { dayBrief } from '@/lib/briefing';
import { claudeReport } from '@/lib/report';
import { makeState } from '@/lib/seed';
import { addD, ymd } from '@/lib/util';

const NOW = new Date('2026-03-18T15:00:00');
const blank = () => { const s = makeState(false); s.goal = 10; return s; };
const H = { water: 0, mood: 0, steps: 0, workout: 0, weight: 0 };

describe('dayBrief', () => {
  it('compares yesterday with the 14 days before and marks better and worse', () => {
    const s = blank();
    for (let i = 2; i <= 10; i++) s.health[ymd(addD(NOW, -i))] = { ...H, sleep: 7.5 };
    s.health[ymd(addD(NOW, -1))] = { ...H, sleep: 5 };
    const b = dayBrief(s, NOW);
    expect(b.k).toBe('2026-03-17');
    const sleep = b.lines.find(l => l.key === 'sleep')!;
    expect(sleep.tone).toBe('warn');
    expect(sleep.value).toBe('5 год');
    expect(sleep.usual).toBe('7,5 год');
    expect(b.worse).toBe(1);
  });

  it('says nothing without enough history, and does not treat an empty water or movement log as a zero', () => {
    const s = blank();
    s.health[ymd(addD(NOW, -1))] = { ...H, sleep: 7 };
    expect(dayBrief(s, NOW).lines).toEqual([]);
    for (let i = 2; i <= 6; i++) s.health[ymd(addD(NOW, -i))] = { ...H, sleep: 7, water: 8, workout: 30 };
    const b = dayBrief(s, NOW);
    expect(b.lines.map(l => l.key)).toEqual(['sleep']);
    expect(b.lines[0].tone).toBe('info');
  });
});

describe('claudeReport', () => {
  it('holds the numbers and the questions, and leaves free text out', () => {
    const s = blank();
    s.health['2026-03-16'] = { ...H, sleep: 6.5, water: 5 };
    s.noteList.push({ id: 1, title: 'Таємна нотатка', text: 'мій пароль 1234', created: 1, updated: 1 });
    s.habits.push({ id: 5, name: 'Читання', days: { '2026-03-16': 1 } });
    const r = claudeReport(s, NOW, 30);
    expect(r).toContain('2026-03-16 | 6.5');
    expect(r).toContain('Читання: 1 з 30');
    expect(r).toContain('3 дуже конкретні зміни');
    expect(r).not.toContain('Таємна');
    expect(r).not.toContain('пароль');
  });
});

import { searchAll } from '@/lib/search';

describe('searchAll', () => {
  it('finds words in tasks, notes and events and says where to open them', () => {
    const s = blank();
    s.tasks.push({ id: 1, t: 'Подзвонити клієнту Олексію', p: 'lo', d: false });
    s.noteList.push({ id: 1, title: 'Ідеї', text: 'купити подарунок Олексію', created: 1, updated: 1 });
    s.events.push({ id: 5, date: '2026-03-16', s: '10:00', e: '11:00', title: 'кава з Олексієм', c: 'c1' });
    const hits = searchAll(s, 'олекс');
    expect(hits.map(h => h.to).sort()).toEqual(['notes', 'schedule', 'tasks']);
    expect(searchAll(s, 'подарунок олексію').map(h => h.to)).toEqual(['notes']);   // every word must be found
    expect(searchAll(s, 'о')).toEqual([]);                                          // one letter is too little to search
    expect(searchAll(s, 'нема такого')).toEqual([]);
  });
});
