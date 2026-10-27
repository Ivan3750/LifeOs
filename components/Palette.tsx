'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, VIEWS } from '@/lib/store';
import { GUESS, TK } from '@/lib/util';
import { fmtCur } from '@/lib/money';
import { OFF_KINDS } from '@/lib/score';
import type { OffKind } from '@/lib/types';

type Cmd = { l: string; k: string; run: () => void };

export function Palette() {
  const { palette } = useStore();
  return palette ? <PaletteDialog /> : null;
}

function PaletteDialog() {
  const { S, setPalette, go, setMode, setSheet, toggleTimer, resetTimer, setTimerMode, A, update } = useStore();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { const t = setTimeout(() => input.current?.focus(), 30); return () => clearTimeout(t); }, []);

  const items = useMemo<Cmd[]>(() => {
    const base: Cmd[] = [
      ...VIEWS.map(([k, l]) => ({ l: 'Відкрити: ' + l, k: 'Перехід', run: () => go(k) })),
      { l: S.timer.running ? 'Поставити таймер на паузу' : 'Запустити таймер фокусу', k: 'Таймер', run: () => { if (S.timer.mode !== 'focus' && !S.timer.running) setTimerMode('focus'); toggleTimer(); } },
      { l: 'Скинути таймер', k: 'Таймер', run: resetTimer },
      { l: 'Швидко додати…', k: 'N', run: () => setSheet({ kind: 'qa' }) },
      { l: S.mode === 'co' ? 'Перейти в особистий режим' : 'Перейти в режим компанії', k: 'Режим', run: () => setMode(S.mode === 'co' ? 'me' : 'co') },
      { l: 'Нова угода', k: 'Компанія', run: () => setSheet({ kind: 'form', key: 'deal' }) },
      { l: 'Новий рахунок', k: 'Компанія', run: () => setSheet({ kind: 'form', key: 'invoice' }) },
      { l: 'Новий проєкт', k: 'Компанія', run: () => setSheet({ kind: 'form', key: 'project' }) },
      { l: 'Новий потенційний клієнт', k: 'Компанія', run: () => setSheet({ kind: 'form', key: 'lead' }) },
      { l: 'Записати витрату на рекламу', k: 'Компанія', run: () => setSheet({ kind: 'form', key: 'ad' }) },
      ...(Object.entries(OFF_KINDS) as [OffKind, (typeof OFF_KINDS)[OffKind]][]).map(([kind, o]) => ({ l: `Сьогодні: ${o.label.toLowerCase()}`, k: 'День', run: () => A.setDayOff(TK(), kind) })),
      ...(S.offDays?.[TK()] ? [{ l: 'Сьогодні звичайний день (зняти позначку)', k: 'День', run: () => A.setDayOff(TK(), null) }] : []),
      { l: 'Нова подія', k: 'Розклад', run: () => setSheet({ kind: 'form', key: 'event' }) },
      ...S.tasks.filter(t => !t.d).map(t => ({ l: 'Фокус на: ' + t.t, k: 'Задача', run: () => { update(s => { s.timer.task = t.t; }); go('focus'); } })),
      ...S.habits.filter(h => !h.days[TK()]).map(h => ({ l: 'Відмітити звичку: ' + h.name, k: 'Звичка', run: () => A.toggleHabit(h.id) })),
    ];
    const t = q.trim(), ql = t.toLowerCase();
    // -45 кава → krone account; -250 ₴ таксі, -250 грн таксі or -250uah → hryvnia account
    const mm = t.match(/^-\s*(\d+(?:[.,]\d+)?)\s*(₴|грн\.?|uah|kr\.?|dkk)?\s*(.*)$/i);
    if (mm) {
      const amt = +mm[1].replace(',', '.'), acc = mm[2] && /₴|грн|uah/i.test(mm[2]) ? 'ua' : 'dk', note = mm[3] || '';
      const cat = (GUESS.find(([re]) => re.test(note)) || [null, 'Інше'])[1];
      return [{ l: `Записати витрату ${fmtCur(amt, acc === 'ua' ? 'UAH' : 'DKK')} · ${cat}${note ? ' · ' + note : ''}`, k: 'Enter', run: () => A.addTx('out', amt, cat, note, TK(), acc) }];
    }
    let r = ql ? base.filter(c => c.l.toLowerCase().includes(ql)) : base;
    if (t.startsWith('+')) r = [{ l: 'Додати задачу: ' + t.slice(1).trim(), k: 'Enter', run: () => A.addTask(t.slice(1)) }, ...r];
    else if (ql && !r.length) r = [{ l: 'Додати задачу: ' + t, k: 'Enter', run: () => A.addTask(t) }];
    return r.slice(0, 9);
  }, [q, S, go, setMode, setSheet, toggleTimer, resetTimer, setTimerMode, A, update]);

  const run = (i: number) => { const c = items[i]; setPalette(false); c?.run(); };
  const s = Math.min(sel, items.length - 1);
  return (
    <div className="ov" onClick={e => { if (e.target === e.currentTarget) setPalette(false); }}>
      <div className="pal" role="dialog" aria-label="Команди">
        <input ref={input} value={q} placeholder="Команда, «+ задача» або «-45 кава»…" autoComplete="off"
          onChange={e => { setQ(e.target.value); setSel(0); }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { setSel((s + 1) % items.length); e.preventDefault(); }
            else if (e.key === 'ArrowUp') { setSel((s - 1 + items.length) % items.length); e.preventDefault(); }
            else if (e.key === 'Enter') run(s);
          }} />
        <ul role="listbox">
          {items.map((c, i) => <li key={c.l} role="option" aria-selected={i === s} onClick={() => run(i)}>{c.l}<small>{c.k}</small></li>)}
        </ul>
      </div>
    </div>
  );
}
