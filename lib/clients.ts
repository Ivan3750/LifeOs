import type { Client, Lead, LeadStatus, State } from './types';
import { daysTo, TK } from './util';

export const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export type ClientRow = {
  id?: number; name: string; contact: string; source: string; since: string; note: string;
  /** false for a name that only appears in deals, projects or invoices and has no client card yet */
  card: boolean;
  revenue: number; unpaid: number; deals: number; dealsAmt: number; projects: number; invoices: number;
  lastPaid: string; dormant: number | null;
};

/** Days without a paid invoice after which a client who bought before is considered to have gone quiet. */
export const DORMANT_DAYS = 60;

/** Every client with what they bring. Cards come first; names that only appear in deals, projects or invoices are added without a card. */
export function clientRows(S: State): ClientRow[] {
  const C = S.co, map = new Map<string, ClientRow>();
  const blank = (name: string): ClientRow => ({ name, contact: '', source: '', since: '', note: '', card: false, revenue: 0, unpaid: 0, deals: 0, dealsAmt: 0, projects: 0, invoices: 0, lastPaid: '', dormant: null });
  for (const c of C.clients) map.set(norm(c.name), { ...blank(c.name), id: c.id, contact: c.contact, source: c.source, since: c.since, note: c.note, card: true });
  const row = (name: string) => { const k = norm(name); if (!k) return null; let r = map.get(k); if (!r) { r = blank(name.trim()); map.set(k, r); } return r; };
  for (const d of C.deals) { const r = row(d.client); if (r && d.stage !== 'lost' && d.stage !== 'won') { r.deals++; r.dealsAmt += d.amt; } }
  for (const p of C.projects) { const r = row(p.client); if (r && p.status === 'active') r.projects++; }
  for (const i of C.invoices) {
    const r = row(i.client); if (!r) continue;
    r.invoices++;
    if (i.paid) { r.revenue += i.amt; if (i.paidAt > r.lastPaid) r.lastPaid = i.paidAt; } else r.unpaid += i.amt;
  }
  for (const r of map.values()) {
    if (r.lastPaid && !r.deals && !r.projects && !r.unpaid) { const d = -daysTo(r.lastPaid); r.dormant = d >= DORMANT_DAYS ? d : null; }
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue || b.dealsAmt - a.dealsAmt || a.name.localeCompare(b.name));
}

export type Heat = 'hot' | 'warm' | 'cold';
const STEP: Record<LeadStatus, number> = { new: 1, contacted: 2, replied: 3, meeting: 4, won: 0, dead: 0 };

/** How warm a lead is: further along the chain and a bigger deal make it hotter, a contact that is long overdue cools it. */
export function leadHeat(l: Lead, today = TK()): Heat {
  let h = STEP[l.status] + (l.value >= 20000 ? 1 : 0);
  if (l.next && l.next < today) { const late = -daysTo(l.next); h -= late > 7 ? 2 : late > 3 ? 1 : 0; }
  return h >= 4 ? 'hot' : h >= 2 ? 'warm' : 'cold';
}
export const HEAT_LABEL: Record<Heat, string> = { hot: 'гарячий', warm: 'теплий', cold: 'холодний' };

/** Ready-made messages for each step of talking to a lead; {name} is the person. */
export const LEAD_SCRIPT: Record<LeadStatus, string> = {
  new: 'Добрий день, {name}! Мене звати {me}. Побачив(ла) ваш бізнес і думаю, що можу допомогти з [чим]. Чи зручно коротко поговорити цього тижня?',
  contacted: 'Добрий день, {name}! Пишу ще раз щодо мого повідомлення. Підкажіть, чи актуально для вас [тема]? Якщо ні, не буду турбувати.',
  replied: 'Дякую за відповідь, {name}! Пропоную короткий дзвінок на 15 хвилин, щоб зрозуміти вашу задачу. Коли вам зручно: завтра чи післязавтра?',
  meeting: 'Дякую за розмову, {name}! Як домовлялись, надсилаю підсумок і пропозицію. Дайте знати, якщо є питання, а завтра я зателефоную, щоб узгодити наступний крок.',
  won: 'Дякую, що обрали нас, {name}! Раді працювати разом. Напишу найближчими днями щодо наступних кроків.',
  dead: 'Добрий день, {name}! Минулого разу не склалося. Якщо щось змінилось, я на звʼязку.',
};
export const leadScript = (l: Lead, me: string) => LEAD_SCRIPT[l.status].replace('{name}', l.name.split(/[,(]/)[0].trim()).replace('{me}', me || 'ваш виконавець');
export const clientScript = (name: string, me: string) => `Добрий день, ${name}! Давно не чули одне одного. Як справи з [проєктом]? Є кілька ідей, що можуть вам допомогти, розкажу, якщо цікаво. З повагою, ${me || 'ваш виконавець'}.`;

export type { Client };
