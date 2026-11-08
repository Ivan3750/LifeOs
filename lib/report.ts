import type { State } from './types';
import { dayRows, describe, findings } from './correlations';
import { goalProgress } from './goals';
import { streakDays } from './quit';
import { ymd } from './util';

/** A compact text of the last days for pasting into a normal Claude chat (no key needed): the person's own numbers and the questions to ask about them.
    Free text is left out on purpose (notes, comments on payments, event titles): only numbers, categories and the names of goals and habits. */
export function claudeReport(S: State, now = new Date(), days = 30): string {
  const rows = dayRows(S, days, now), r1 = (v: number | null, d = 1) => (v === null ? '' : String(Math.round(v * 10 ** d) / 10 ** d));
  const keys = rows.map(r => r.k), from = keys[0], to = keys[keys.length - 1];
  const out: string[] = [];
  out.push(`# Мої дані з LifeOs за ${days} днів (${from} — ${to})`, '', 'Порожня клітинка означає «не записано», а не нуль.', '');

  out.push('## По днях', '', 'Дата | Сон, год | Настрій 1-10 | Сили 1-5 | Фокус, хв | Закрито задач | Звички, % | Вода, скл. | Рух, хв');
  for (const r of rows) {
    const cells = [r1(r.sleep), r1(r.mood), r1(r.energy), r1(r.focus, 0), r1(r.tasks, 0), r.habits === null ? '' : String(Math.round(r.habits * 100)), r1(r.water, 0), r.workout ? r1(r.workout, 0) : ''];
    if (cells.some(c => c !== '')) out.push(`${r.k} | ${cells.join(' | ')}`);
  }

  const avg = (pick: (r: (typeof rows)[number]) => number | null, d = 1, skip0 = false) => {
    const v = rows.map(pick).filter((x): x is number => x !== null && !(skip0 && x === 0));
    return v.length ? `${r1(v.reduce((a, b) => a + b, 0) / v.length, d)} (днів із записом: ${v.length})` : 'нема записів';
  };
  out.push('', '## Середнє за період', '',
    `- Сон, год: ${avg(r => r.sleep)}`, `- Настрій: ${avg(r => r.mood)}`, `- Сили: ${avg(r => r.energy)}`, `- Фокус, хв/день: ${avg(r => r.focus, 0)}`,
    `- Закрито задач/день: ${avg(r => r.tasks)}`, `- Звички: ${avg(r => (r.habits === null ? null : r.habits * 100), 0)}% виконано`, `- Вода, склянок: ${avg(r => r.water, 1, true)}`,
    `- Рух, хв: ${avg(r => r.workout, 0, true)}`);

  if (S.habits.length) out.push('', '## Звички (у скількох днях виконано)', '', ...S.habits.map(h => `- ${h.name}: ${keys.filter(k => h.days[k]).length} з ${days}`));
  if (S.badHabits.length) out.push('', '## Шкідливі звички', '', ...S.badHabits.map(h => `- ${h.name}: ${streakDays(h, now.getTime())} днів без зриву, зривів за період: ${h.slips.filter(t => ymd(new Date(t)) >= from).length}`));
  if (S.goals.length) out.push('', '## Цілі', '', ...S.goals.map(g => `- ${g.title} (${g.area}): ${Math.round(goalProgress(g) * 100)}%`));

  const fs = findings(S, now);
  if (fs.length) out.push('', '## Що застосунок уже помітив сам (прості збіги, не діагноз)', '', ...fs.slice(0, 8).map(f => `- ${describe(f, S).text}`));

  out.push('', '---', '',
    'Ти мій особистий коуч. Проаналізуй ці дані чесно й конкретно, українською:',
    '1. Що найбільше впливає на мій настрій і сили? Покажи закономірності з цифрами.',
    '2. Де я втрачаю час, увагу чи здоровʼя?',
    '3. Що в мене виходить добре, що треба зберегти?',
    '4. Дай 3 дуже конкретні зміни на наступний тиждень, найлегшу першою.',
    'Не вигадуй того, чого нема в даних, і скажи, де даних замало.');
  return out.join('\n');
}
