import type { State } from './types';

export type Hit = { l: string; k: string; to: string };

const cut = (s: string, n = 60) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

/** Looks for words in what the person wrote: tasks, notes, payments, goals, habits, events and the company records. Every word must be found.
    Returns at most `limit` hits, each with the section to open. */
export function searchAll(S: State, query: string, limit = 6): Hit[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length || query.trim().length < 2) return [];
  const out: Hit[] = [];
  const has = (...parts: (string | undefined)[]) => { const h = parts.filter(Boolean).join(' ').toLowerCase(); return words.every(w => h.includes(w)); };
  const add = (hit: Hit) => { if (out.length < limit) out.push(hit); };

  for (const t of S.tasks) if (has(t.t)) add({ l: cut(t.t), k: t.d ? 'Задача · виконана' : 'Задача', to: 'tasks' });
  for (const n of S.noteList) if (has(n.title, n.text)) add({ l: cut(n.title || n.text), k: 'Нотатка', to: 'notes' });
  for (const g of S.goals) if (has(g.title)) add({ l: cut(g.title), k: 'Ціль', to: 'goals' });
  for (const h of S.habits) if (has(h.name)) add({ l: cut(h.name), k: 'Звичка', to: 'habits' });
  for (const h of S.badHabits) if (has(h.name)) add({ l: cut(h.name), k: 'Шкідлива звичка', to: 'quit' });
  for (const t of [...S.money.tx].sort((a, b) => b.date.localeCompare(a.date))) {
    if (has(t.note, t.cat)) add({ l: `${t.date} · ${t.cat} · ${t.type === 'in' ? '+' : '−'}${t.amt}${t.note ? ' · ' + cut(t.note, 30) : ''}`, k: 'Гроші', to: 'money' });
  }
  for (const e of S.events) if (has(e.title)) add({ l: `${e.date} · ${cut(e.title, 40)}`, k: 'Подія', to: 'schedule' });
  for (const x of S.co.leads) if (has(x.name, x.contact, x.note)) add({ l: cut(x.name), k: 'Ліди', to: 'leads' });
  for (const x of S.co.clients) if (has(x.name, x.contact, x.note)) add({ l: cut(x.name), k: 'Клієнти', to: 'clients' });
  for (const x of S.co.deals) if (has(x.title, x.client)) add({ l: cut(x.title), k: 'Угоди', to: 'deals' });
  for (const x of S.co.projects) if (has(x.name, x.client)) add({ l: cut(x.name), k: 'Проєкти', to: 'projects' });
  return out;
}
