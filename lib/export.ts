import type { ExtEvent, State } from './types';
import { goalProgress } from './goals';
import { napMinutes } from './sleep';
import { addD, hhmm, ymd } from './util';

export const SECTIONS = [
  ['focus', 'Фокус і сесії'], ['tasks', 'Задачі'], ['habits', 'Звички'], ['health', 'Сон, вода, рух'], ['moods', 'Настрій'],
  ['acts', 'Справи'], ['events', 'Події: мої і з календарів'], ['goals', 'Цілі і сфери життя'],
  ['notes', 'Нотатки'], ['quit', 'Відмова від звичок і потяги'],
] as const;
export type SectionKey = (typeof SECTIONS)[number][0];

export type Period = { from: string; to: string };
export type Table = { name: string; file: string; head: string[]; rows: (string | number)[][] };

/** Presets for the period picker; null from means «from the very beginning». */
export function presetPeriod(kind: 'week' | 'month' | 'quarter' | 'year' | 'all', today = new Date()): Period {
  const to = ymd(today);
  const back = { week: 6, month: 29, quarter: 89, year: 364 }[kind as 'week'];
  return kind === 'all' ? { from: '0000-01-01', to } : { from: ymd(addD(today, -back)), to };
}

const inP = (d: string, p: Period) => d >= p.from && d <= p.to;
const day = (t: number) => ymd(new Date(t));
const clock = (t: number) => hhmm(new Date(t));
const dur = (a: number, b: number) => Math.round((b - a) / 6e4);

/** All the data of the chosen sections inside the period, as tables (one per kind of record).
    ext: events from subscribed calendars that fall into the period. */
export function buildTables(S: State, ext: ExtEvent[], p: Period, on: Record<SectionKey, boolean>): Table[] {
  const T: Table[] = [];
  const add = (key: SectionKey, name: string, file: string, head: string[], rows: (string | number)[][]) => { if (on[key] && rows.length) T.push({ name, file, head, rows }); };

  add('focus', 'Фокус', 'fokus', ['Дата', 'Початок', 'Хвилин', 'Задача'],
    S.sessions.filter(s => inP(day(s.t), p)).sort((a, b) => a.t - b.t).map(s => [day(s.t), clock(s.t), s.m, s.task || '']));
  add('tasks', 'Задачі', 'zadachi', ['Задача', 'Статус', 'Важлива', 'Термін', 'Виконано', 'Ціль'],
    S.tasks.filter(t => !t.d || !t.doneAt || inP(day(t.doneAt), p)).map(t => [t.t, t.d ? 'виконано' : 'відкрита', t.p === 'hi' ? 'так' : '', t.due || '', t.doneAt ? day(t.doneAt) : '', S.goals.find(g => g.id === t.goal)?.title || '']));
  add('habits', 'Звички', 'zvychky', ['Дата', 'Звичка'],
    S.habits.flatMap(h => Object.keys(h.days).filter(d => inP(d, p)).map(d => [d, h.name])).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
  add('health', 'Здоровʼя', 'zdorovya', ['Дата', 'Заснув', 'Прокинувся', 'Сон, год', 'Денний сон, хв', 'Вода, склянок', 'Рух, хв', 'Вага, кг'],
    Object.keys(S.health).filter(d => inP(d, p)).sort().map(d => { const h = S.health[d]; return [d, h.bed || '', h.wake || '', h.sleep || '', napMinutes(h) || '', h.water || '', h.workout || '', h.weight || '']; }));
  add('quit', 'Відмова від звичок', 'vidmova', ['Дата', 'Час', 'Звичка', 'Що сталося', 'Причина', 'Допомогло'],
    S.cravings.filter(c => inP(day(c.t), p)).sort((a, b) => a.t - b.t).map(c => [day(c.t), clock(c.t), S.badHabits.find(h => h.id === c.habit)?.name || '', c.outcome === 'resisted' ? 'витримав' : 'зрив', c.trigger, c.tool ? ({ exercise: 'вправи', breath: 'дихання', game: 'гра' } as Record<string, string>)[c.tool] || c.tool : '']));
  add('moods', 'Настрій', 'nastrij', ['Дата', 'Час', 'Настрій 1–10', 'Сили', 'Теги', 'Нотатка'],
    S.moods.filter(m => inP(day(m.t), p)).sort((a, b) => a.t - b.t).map(m => [day(m.t), clock(m.t), m.v, m.energy ? ({ 1: 'мало', 3: 'нормально', 5: 'багато' } as Record<number, string>)[m.energy <= 2 ? 1 : m.energy === 3 ? 3 : 5] : '', m.tags.join('; '), m.note]));
  add('acts', 'Справи', 'spravy', ['Дата', 'Початок', 'Кінець', 'Хвилин', 'Тип', 'Що'],
    S.activities.filter(a => inP(day(a.start), p)).sort((a, b) => a.start - b.start).map(a => [day(a.start), clock(a.start), clock(a.end), dur(a.start, a.end), a.kind, a.title]));
  add('events', 'Події', 'podii', ['Дата', 'Початок', 'Кінець', 'Подія', 'Звідки', 'Місце'], [
    ...S.events.filter(e => inP(e.date, p)).map(e => [e.date, e.s, e.e, e.title, 'мої', '']),
    ...ext.filter(e => inP(e.start.slice(0, 10), p)).map(e => e.allDay
      ? [e.start.slice(0, 10), 'весь день', '', e.title, 'календар', e.location || '']
      : [day(Date.parse(e.start)), clock(Date.parse(e.start)), clock(Date.parse(e.end)), e.title, 'календар', e.location || '']),
  ].sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1]))));
  add('goals', 'Цілі', 'cili', ['Ціль', 'Сфера', 'Прогрес, %', 'Дедлайн', 'Кроки виконано'],
    S.goals.map(g => [g.title, g.area, Math.round(goalProgress(g) * 100), g.due, g.steps?.length ? `${g.steps.filter(s => s.d).length}/${g.steps.length}` : '']));
  add('goals', 'Колесо балансу', 'koleso', ['Сфера', 'Оцінка 1–10'], ['Здоровʼя', 'Карʼєра', 'Фінанси', 'Стосунки', 'Друзі', 'Відпочинок', 'Розвиток', 'Дім'].map((a, i) => [a, S.wheel[i] ?? '']));
  add('notes', 'Нотатки', 'notatky', ['Оновлено', 'Назва', 'Текст'],
    S.noteList.filter(n => inP(day(n.updated), p)).map(n => [day(n.updated), n.title, n.text]));
  return T;
}

const cell = (v: string | number) => (/[",;\r\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
/** CSV with a BOM so that Excel reads Cyrillic correctly. */
export const toCsv = (t: Table) => '﻿' + [t.head, ...t.rows].map(r => r.map(cell).join(',')).join('\r\n');

/** Whole export as one JSON document: the tables, plus the raw state when the person asked for everything. */
export function toJson(tables: Table[], p: Period, meta: { name: string }) {
  return {
    app: 'lifeos', kind: 'export', exportedAt: new Date().toISOString(), name: meta.name, period: p,
    tables: Object.fromEntries(tables.map(t => [t.name, t.rows.map(r => Object.fromEntries(t.head.map((h, i) => [h, r[i]])))])),
  };
}
